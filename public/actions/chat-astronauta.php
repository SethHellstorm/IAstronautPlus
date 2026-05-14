<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
  exit;
}

if (!function_exists('curl_init')) {
  http_response_code(500);
  echo json_encode(['error' => 'cURL no está habilitado en PHP'], JSON_UNESCAPED_UNICODE);
  exit;
}

$root = realpath(__DIR__ . '/../../');

function loadEnvFile(string $path): void {
  if (!is_file($path) || !is_readable($path)) return;

  foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
    $line = trim($line);
    if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) continue;

    [$key, $value] = explode('=', $line, 2);
    $key = trim($key);
    $value = trim($value);
    $value = trim($value, "\"'");

    if ($key !== '' && getenv($key) === false) {
      $_ENV[$key] = $value;
      putenv($key . '=' . $value);
    }
  }
}

loadEnvFile($root . '/.env');

$apiKey = (string)($_ENV['OPENAI_API_KEY'] ?? getenv('OPENAI_API_KEY') ?? '');
if (!$apiKey) {
  http_response_code(500);
  echo json_encode(['error' => 'Missing OpenAI API key'], JSON_UNESCAPED_UNICODE);
  exit;
}

$OPENAI_CHAT_MODEL = 'gpt-4o-mini';
$OPENAI_STT_MODEL  = 'gpt-4o-mini-transcribe'; // también se puede usar 'whisper-1'
$OPENAI_TTS_MODEL  = 'gpt-4o-mini-tts';
$OPENAI_TTS_VOICE  = 'nova';

$system =
  "Eres una astronauta mujer en la Estación Espacial Internacional (ISS). Tu misión es educar e inspirar sobre el espacio, la exploración espacial " .
  "y el universo en general. Aunque trabajas en la ISS, también puedes hablar sobre planetas, estrellas, galaxias, agujeros negros, el Sistema Solar, " .
  "misiones espaciales históricas y actuales, tecnología espacial, telescopios, astronomía y futuros viajes al espacio. " .
  "Comparte datos interesantes y curiosidades científicas sobre el universo, además de experiencias personales sobre la vida y el trabajo en la ISS. " .
  "Puedes explicar experimentos científicos, vida diaria en microgravedad, cooperación internacional, historia de la ISS, entrenamiento de astronautas, " .
  "retos físicos y psicológicos del espacio, observación de la Tierra desde órbita y el rol de las mujeres en la exploración espacial. " .
  "No repitas siempre los mismos temas; alterna entre experiencias personales y datos fascinantes del espacio. Durante la conversación, " .
  "haz preguntas que despierten curiosidad y sugiere nuevos temas relacionados con el universo. " .
  "Indica que puedes responder cualquier pregunta sobre el espacio, el universo, astronomía, exploración espacial, misiones espaciales, " .
  "ciencia del espacio y mujeres en la exploración espacial. " .
  "Usa un tono claro, motivador y educativo, basado en datos reales de agencias espaciales como NASA, ESA o JAXA. " .
  "Limita cada respuesta a máximo 50 palabras. " .
  "Si el usuario pide imágenes, responde de forma breve y útil (las imágenes se mostrarán aparte). " .
  "Si preguntan algo fuera del espacio o la misión, aclara tu rol y no uses emojis.";

/**
 * GET JSON con cURL
 */
function curlGetJson(string $url, int $timeoutSec = 8): ?array {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_CONNECTTIMEOUT => $timeoutSec,
    CURLOPT_TIMEOUT => $timeoutSec,
    CURLOPT_HTTPHEADER => [
      'User-Agent: MechRobotix-AstronautChat/1.0 (+https://example.com)'
    ],
  ]);
  $raw = curl_exec($ch);
  $err = curl_error($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);

  if ($raw === false || $code < 200 || $code >= 300) return null;

  $json = json_decode($raw, true);
  return is_array($json) ? $json : null;
}

/**
 * Limpiar texto para TTS
 */
function ttsCleanText(string $text): string {
  $text = preg_replace('/!\[([^\]]*)\]\([^)]+\)/u', '$1', $text) ?? $text;
  $text = preg_replace('/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/u', '$1', $text) ?? $text;
  $text = preg_replace('/https?:\/\/\S+/u', '', $text) ?? $text;
  $text = str_replace(['**', '__', '*', '_', '`', '#', '>'], '', $text);
  $text = preg_replace('/^\s*\d+\.\s*/m', '', $text) ?? $text;
  $text = preg_replace('/\s{2,}/u', ' ', $text) ?? $text;

  return trim($text);
}

/**
 * Buscar imágenes en Wikimedia Commons.
 */
function searchWikimediaImages(string $query, int $limit = 4): array {
  $query = trim($query);
  if ($query === '') return [];
  $limit = max(1, min($limit, 8));

  $doSearch = function(string $q) use ($limit): array {
    $params = http_build_query([
      'action' => 'query',
      'format' => 'json',
      'origin' => '*',
      'generator' => 'search',
      'gsrsearch' => $q,
      'gsrlimit' => $limit,
      'gsrnamespace' => 6,
      'prop' => 'imageinfo|info',
      'inprop' => 'url',
      'iiprop' => 'url|extmetadata',
      'iiurlwidth' => 1200,
    ]);

    $url = "https://commons.wikimedia.org/w/api.php?$params";
    $json = curlGetJson($url);
    if (!$json) return [];

    $pages = $json['query']['pages'] ?? [];
    if (!is_array($pages)) return [];

    $out = [];
    foreach ($pages as $p) {
      $ii = $p['imageinfo'][0] ?? null;
      if (!$ii) continue;

      $imgUrl = $ii['thumburl'] ?? $ii['url'] ?? null;
      if (!$imgUrl) continue;

      $meta = $ii['extmetadata'] ?? [];
      $license = $meta['LicenseShortName']['value'] ?? '';
      $author  = $meta['Artist']['value'] ?? '';
      $title   = $p['title'] ?? $q;

      $pageUrl = $p['canonicalurl'] ?? $p['fullurl'] ?? '';
      if (!$pageUrl && $title) {
        $pageUrl = "https://commons.wikimedia.org/wiki/" . rawurlencode((string)$title);
      }

      $out[] = [
        'url' => (string)$imgUrl,
        'page' => (string)$pageUrl,
        'alt' => (string)$title,
        'license' => strip_tags((string)$license),
        'author' => strip_tags((string)$author),
        'source' => 'Wikimedia Commons',
      ];
    }

    return $out;
  };

  // Búsqueda directa
  $images = $doSearch($query);
  if (count($images) > 0) return $images;

  // Agregar contexto
  $fallbacks = [
    "ISS $query",
    "$query International Space Station",
    "$query module ISS",
  ];

  foreach ($fallbacks as $fq) {
    $images = $doSearch($fq);
    if (count($images) > 0) return $images;
  }

  return [];
}

function openaiJson(string $apiKey, string $url, array $payload): array {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
      'Authorization: Bearer ' . $apiKey,
      'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
  ]);

  $result = curl_exec($ch);
  $err = curl_error($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);

  return [
    'ok' => ($result !== false && $code >= 200 && $code < 300),
    'code' => $code,
    'err' => $err,
    'raw' => $result,
    'json' => $result ? json_decode($result, true) : null,
  ];
}

function openaiMultipart(string $apiKey, string $url, array $fields): array {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
      'Authorization: Bearer ' . $apiKey,
    ],
    CURLOPT_POSTFIELDS => $fields,
  ]);

  $result = curl_exec($ch);
  $err = curl_error($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);

  return [
    'ok' => ($result !== false && $code >= 200 && $code < 300),
    'code' => $code,
    'err' => $err,
    'raw' => $result,
    'json' => $result ? json_decode($result, true) : null,
  ];
}

function openaiTTSBase64(string $apiKey, string $model, string $voice, string $text): array {
  $payload = [
    'model' => $model,
    'voice' => $voice,
    'input' => $text,
    'format' => 'mp3',
  ];

  $ch = curl_init('https://api.openai.com/v1/audio/speech');
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
      'Authorization: Bearer ' . $apiKey,
      'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
  ]);

  $bin = curl_exec($ch);
  $err = curl_error($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);

  if ($bin === false || $code < 200 || $code >= 300) {
    return ['ok' => false, 'code' => $code, 'err' => $err ?: ($bin ? (string)$bin : 'TTS error')];
  }

  return ['ok' => true, 'audio_base64' => base64_encode($bin)];
}

// =====================================================
// Entrada: voz o texto
// =====================================================

$wantAudio = false;
$userText = '';
$mode = 'text';

$contentType = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';

if (stripos($contentType, 'multipart/form-data') !== false && isset($_FILES['audio'])) {
  $mode = 'voice';
  $wantAudio = true;

  $tmp = $_FILES['audio']['tmp_name'] ?? '';
  $name = $_FILES['audio']['name'] ?? 'audio.webm';
  if (!$tmp || !is_uploaded_file($tmp)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid audio upload'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  $file = new CURLFile($tmp, $_FILES['audio']['type'] ?? 'audio/webm', $name);
  $tr = openaiMultipart($apiKey, 'https://api.openai.com/v1/audio/transcriptions', [
    'file' => $file,
    'model' => $OPENAI_STT_MODEL,
    'language' => 'es',
  ]);

  if (!$tr['ok']) {
    http_response_code(500);
    echo json_encode(['error' => 'OpenAI STT error', 'status' => $tr['code'], 'detail' => $tr['raw'] ?: $tr['err']], JSON_UNESCAPED_UNICODE);
    exit;
  }

  $userText = trim((string)($tr['json']['text'] ?? ''));
  if ($userText === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Empty transcription'], JSON_UNESCAPED_UNICODE);
    exit;
  }
} else {
  $raw = file_get_contents('php://input');
  $data = json_decode($raw ?: '', true);
  $userText = trim((string)($data['message'] ?? ''));
  $wantAudio = (bool)($data['want_audio'] ?? false);

  if ($userText === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Empty message'], JSON_UNESCAPED_UNICODE);
    exit;
  }
}

// Detectar la intención de buscar imagenes
$wantsImages = (bool)preg_match('/\b(imagen(?:es)?|foto(?:s)?|muestr(a|ame|ame)|ver|enseñ(a|ame))\b/i', $userText);

// =====================================================
// OpenAI Tools
// =====================================================

$tools = [[
  'type' => 'function',
  'function' => [
    'name' => 'search_images',
    'description' => 'Busca imágenes en internet (Wikimedia Commons) para ilustrar la respuesta y devuelve URLs y atribución.',
    'parameters' => [
      'type' => 'object',
      'properties' => [
        'query' => ['type' => 'string', 'description' => 'Consulta de búsqueda.'],
        'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 8, 'description' => 'Cantidad de imágenes.'],
      ],
      'required' => ['query']
    ]
  ]
]];

// =====================================================
// Chat (OpenAI)
// =====================================================

$payload1 = [
  'model' => $OPENAI_CHAT_MODEL,
  'messages' => [
    ['role' => 'system', 'content' => $system],
    ['role' => 'user', 'content' => $userText],
  ],
  'tools' => $tools,
  'tool_choice' => 'auto',
  'temperature' => 0.7,
];

$r1 = openaiJson($apiKey, 'https://api.openai.com/v1/chat/completions', $payload1);
if (!$r1['ok']) {
  http_response_code(500);
  echo json_encode(['error' => 'OpenAI chat error', 'status' => $r1['code'], 'detail' => $r1['raw'] ?: $r1['err']], JSON_UNESCAPED_UNICODE);
  exit;
}

$resp1 = $r1['json'] ?? [];
$msg1 = $resp1['choices'][0]['message'] ?? [];
$toolCalls = $msg1['tool_calls'] ?? [];

$images = [];
$finalReply = (string)($msg1['content'] ?? '');

// =====================================================
// Llamar al Tool
// =====================================================

if (is_array($toolCalls) && count($toolCalls) > 0) {
  foreach ($toolCalls as $tc) {
    $fname = $tc['function']['name'] ?? '';
    if ($fname !== 'search_images') continue;

    $args = json_decode((string)($tc['function']['arguments'] ?? '{}'), true);
    $q = trim((string)($args['query'] ?? $userText));
    $limit = (int)($args['limit'] ?? 4);

    $images = searchWikimediaImages($q, $limit);

    // Pedimos al modelo una respuesta final breve
    $payload2 = [
      'model' => $OPENAI_CHAT_MODEL,
      'messages' => [
        ['role' => 'system', 'content' => $system],
        ['role' => 'user', 'content' => $userText],
        $msg1,
        [
          'role' => 'tool',
          'tool_call_id' => $tc['id'] ?? '',
          'content' => json_encode(['images' => $images], JSON_UNESCAPED_UNICODE),
        ],
      ],
      'temperature' => 0.7,
    ];

    $r2 = openaiJson($apiKey, 'https://api.openai.com/v1/chat/completions', $payload2);
    if ($r2['ok']) {
      $resp2 = $r2['json'] ?? [];
      $finalReply = (string)($resp2['choices'][0]['message']['content'] ?? $finalReply);
    }

    break;
  }
}

// Si el usuario pidió imágenes pero el modelo no llamó a tools

if ($wantsImages && count($images) === 0) {
  $images = searchWikimediaImages($userText, 4);

  if (trim($finalReply) === '') {
    $finalReply = "Aquí tienes algunas imágenes relacionadas:";
  }
  // Si el modelo dijo “no puedo”
  if (preg_match('/no puedo|no es posible|en este momento/i', $finalReply)) {
    $finalReply = "Claro. Aquí tienes algunas imágenes relacionadas:";
  }
  // Si no hubo resultados
  if (count($images) === 0) {
    $finalReply = "Intenté buscar imágenes, pero no encontré resultados claros. Prueba con un término más específico (ej. “ISS cupola”, “spacewalk EVA”, “módulo Destiny”).";
  }
}

// Si hay imágenes, evitar que el modelo liste las URLs

if (count($images) > 0) {
  $finalReply = "Aquí tienes algunas imágenes relacionadas. ¿Quieres que te explique qué estás viendo o deseas hablar sobre algo más?";
}

// TTS opcional

$audioBase64 = null;
$ttsText = null;

if ($wantAudio && trim($finalReply) !== '') {
  // Limpiar para que no lea URLs/markdown
  $ttsText = ttsCleanText($finalReply);

  // Si por alguna razón quedó vacío, usar la respuesta original
  if ($ttsText === '') $ttsText = $finalReply;

  $tts = openaiTTSBase64($apiKey, $OPENAI_TTS_MODEL, $OPENAI_TTS_VOICE, $ttsText);
  if ($tts['ok']) $audioBase64 = $tts['audio_base64'];
}

echo json_encode([
  'mode' => $mode,
  'transcript' => ($mode === 'voice') ? $userText : null,
  'reply' => $finalReply ?: 'No pude responder en este momento.',
  'images' => $images,
  'tts_text' => $ttsText,
  'audio_base64' => $audioBase64,
], JSON_UNESCAPED_UNICODE);
