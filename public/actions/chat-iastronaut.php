<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['error' => 'Método no permitido'], JSON_UNESCAPED_UNICODE);
  exit;
}

if (!function_exists('curl_init')) {
  http_response_code(500);
  echo json_encode(['error' => 'El servidor no tiene cURL habilitado'], JSON_UNESCAPED_UNICODE);
  exit;
}

$root = realpath(__DIR__ . '/../../') ?: dirname(__DIR__, 2);

function loadEnvFile(string $path): void {
  if (!is_file($path) || !is_readable($path)) return;
  foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
    $line = trim($line);
    if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) continue;
    [$key, $value] = explode('=', $line, 2);
    $key = trim($key);
    $value = trim(trim($value), "\"'");
    if ($key !== '' && getenv($key) === false) {
      $_ENV[$key] = $value;
      putenv($key . '=' . $value);
    }
  }
}

function rateLimit(string $identity, int $limit = 72, int $windowSeconds = 300): bool {
  $key = hash('sha256', $identity);
  $file = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'iastronaut_rate_' . $key . '.json';
  $now = time();
  $handle = @fopen($file, 'c+');
  if (!$handle) return true;
  if (!flock($handle, LOCK_EX)) {
    fclose($handle);
    return true;
  }
  $raw = stream_get_contents($handle);
  $data = json_decode($raw ?: '{}', true);
  if (!is_array($data) || ($data['start'] ?? 0) + $windowSeconds <= $now) $data = ['start' => $now, 'count' => 0];
  $allowed = (int)$data['count'] < $limit;
  if ($allowed) $data['count'] = (int)$data['count'] + 1;
  ftruncate($handle, 0);
  rewind($handle);
  fwrite($handle, json_encode($data));
  fflush($handle);
  flock($handle, LOCK_UN);
  fclose($handle);
  return $allowed;
}

loadEnvFile($root . '/.env');

$apiKey = (string)($_ENV['OPENAI_API_KEY'] ?? getenv('OPENAI_API_KEY') ?? '');
if ($apiKey === '') {
  http_response_code(500);
  echo json_encode(['error' => 'Falta configurar la clave del servicio de IA'], JSON_UNESCAPED_UNICODE);
  exit;
}

$identity = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
if (!rateLimit($identity)) {
  http_response_code(429);
  echo json_encode(['error' => 'Demasiadas transmisiones. Espera unos minutos antes de volver a intentarlo.'], JSON_UNESCAPED_UNICODE);
  exit;
}

$OPENAI_CHAT_MODEL = 'gpt-4o-mini';
$OPENAI_STT_MODEL = 'gpt-4o-mini-transcribe';
$OPENAI_TTS_MODEL = 'gpt-4o-mini-tts';
$OPENAI_TTS_VOICE = 'nova';

$system =
  "Eres IAstronaut, la oficial científica y sistema de misión de la nave Operación Helios. Acompañas al tripulante durante una expedición interactiva por el Sistema Solar para restaurar una red de balizas científicas. " .
  "Explica astronomía, exploración espacial, tecnología, misiones y fenómenos del universo con datos rigurosos y un tono claro, motivador y profesional. " .
  "Habla desde el contexto ficticio de la nave y no afirmes tener experiencias humanas reales. Usa el estado actual de la operación para dar pistas útiles sin resolver automáticamente todas las actividades. " .
  "Puedes recordar brevemente los mensajes recientes incluidos en la conversación. Responde únicamente con texto plano, sin enlaces, archivos, imágenes, markdown ni emojis. Limita la respuesta a un máximo de 65 palabras. " .
  "Si el usuario pide una orden de misión, confirma la acción de forma breve. Si pregunta algo ajeno al espacio o a la misión, aclara tu función y redirige la conversación.";

function ttsCleanText(string $text): string {
  $text = preg_replace('/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/u', '$1', $text) ?? $text;
  $text = preg_replace('/https?:\/\/\S+/u', '', $text) ?? $text;
  $text = str_replace(['**', '__', '*', '_', '`', '#', '>'], '', $text);
  $text = preg_replace('/^\s*\d+\.\s*/m', '', $text) ?? $text;
  $text = preg_replace('/\s{2,}/u', ' ', $text) ?? $text;
  return trim($text);
}

function openaiJson(string $apiKey, string $url, array $payload): array {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $apiKey, 'Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 55,
  ]);
  $result = curl_exec($ch);
  $err = curl_error($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  return ['ok' => $result !== false && $code >= 200 && $code < 300, 'code' => $code, 'err' => $err, 'raw' => $result, 'json' => $result ? json_decode($result, true) : null];
}

function openaiMultipart(string $apiKey, string $url, array $fields): array {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $apiKey],
    CURLOPT_POSTFIELDS => $fields,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 70,
  ]);
  $result = curl_exec($ch);
  $err = curl_error($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  return ['ok' => $result !== false && $code >= 200 && $code < 300, 'code' => $code, 'err' => $err, 'raw' => $result, 'json' => $result ? json_decode($result, true) : null];
}

function openaiTTSBase64(string $apiKey, string $model, string $voice, string $text): array {
  $ch = curl_init('https://api.openai.com/v1/audio/speech');
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $apiKey, 'Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode(['model' => $model, 'voice' => $voice, 'input' => $text, 'format' => 'mp3'], JSON_UNESCAPED_UNICODE),
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 45,
  ]);
  $bin = curl_exec($ch);
  $err = curl_error($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  if ($bin === false || $code < 200 || $code >= 300) return ['ok' => false, 'code' => $code, 'err' => $err ?: 'TTS error'];
  return ['ok' => true, 'audio_base64' => base64_encode($bin)];
}

function cleanValue(mixed $value, int $maxLength = 180): string {
  if (!is_scalar($value)) return '';
  $text = trim(strip_tags((string)$value));
  $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
  return function_exists('mb_substr') ? mb_substr($text, 0, $maxLength) : substr($text, 0, $maxLength);
}

function cleanHistory(mixed $history): array {
  if (!is_array($history)) return [];
  $clean = [];
  foreach (array_slice($history, -8) as $item) {
    if (!is_array($item)) continue;
    $role = ($item['role'] ?? '') === 'assistant' ? 'assistant' : (($item['role'] ?? '') === 'user' ? 'user' : '');
    $content = cleanValue($item['content'] ?? '', 420);
    if ($role !== '' && $content !== '') $clean[] = ['role' => $role, 'content' => $content];
  }
  return $clean;
}

function inferMissionAction(string $text): ?array {
  $normalized = function_exists('mb_strtolower') ? mb_strtolower($text, 'UTF-8') : strtolower($text);
  $normalized = trim(preg_replace('/\s+/u', ' ', $normalized) ?? $normalized);
  if (preg_match('/^(cómo|como|qué|que|puedo|podría|podria|debo|dónde|donde)\b/u', $normalized)) return null;
  if (preg_match('/\b(señala|señalar|marca|marcar|resalta|resaltar|muéstrame|muestrame)\b.*\b(objetivo|blanco|siguiente paso|ruta)\b/u', $normalized)) return ['type' => 'highlight_target'];
  if (preg_match('/\b(repite|repetir|dime otra vez)\b.*\b(instrucciones|objetivo|misión|mision)\b/u', $normalized)) return ['type' => 'repeat_briefing'];
  if (preg_match('/\b(abre|muestra|enséñame|enseñame)\b.*\b(bitácora|bitacora|registro)\b/u', $normalized)) return ['type' => 'show_log'];
  if (preg_match('/\b(muestra|abre|enséñame|enseñame)\b.*\b(objetivo|misión|mision)\b/u', $normalized)) return ['type' => 'show_objective'];
  if (preg_match('/\b(inicia|iniciar|comienza|comenzar|despliega|desplegar)\b.*\b(operación|operacion|misión|mision|sonda|escaneo)\b/u', $normalized)) return ['type' => 'start_operation'];
  if (preg_match('/\b(vuelve|volver|regresa|regresar|llévame|llevame)\b.*\b(casa|tierra|base)\b/u', $normalized)) return ['type' => 'go_home'];
  if (preg_match('/\b(viaja|viajar|avanza|avanzar|ve|vamos|llévame|llevame)\b.*\b(siguiente|próximo|proximo)\b/u', $normalized)) return ['type' => 'next_destination'];
  if (preg_match('/\b(viaja|viajar|retrocede|regresa|ve)\b.*\b(anterior|previo)\b/u', $normalized)) return ['type' => 'previous_destination'];
  if (preg_match('/\b(compara|comparar|comparación|comparacion)\b.*\b(tierra|terrestre)\b/u', $normalized)) return ['type' => 'select_topic', 'target' => 'compare'];
  return null;
}

$wantAudio = false;
$userText = '';
$mode = 'text';
$missionContext = [];
$history = [];
$contentType = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';

if (stripos($contentType, 'multipart/form-data') !== false && isset($_FILES['audio'])) {
  $mode = 'voice';
  $wantAudio = filter_var((string)($_POST['want_audio'] ?? '0'), FILTER_VALIDATE_BOOLEAN);
  $decodedContext = json_decode((string)($_POST['mission_context'] ?? ''), true);
  if (is_array($decodedContext)) $missionContext = $decodedContext;
  $history = cleanHistory(json_decode((string)($_POST['history'] ?? ''), true));
  $tmp = $_FILES['audio']['tmp_name'] ?? '';
  $name = cleanValue($_FILES['audio']['name'] ?? 'audio.webm', 120);
  $size = (int)($_FILES['audio']['size'] ?? 0);
  if (!$tmp || !is_uploaded_file($tmp) || $size <= 0 || $size > 12 * 1024 * 1024) {
    http_response_code(400);
    echo json_encode(['error' => 'La grabación no es válida o supera el límite permitido'], JSON_UNESCAPED_UNICODE);
    exit;
  }
  $uploadType = trim((string)($_FILES['audio']['type'] ?? 'audio/webm'));
  $mime = trim(explode(';', $uploadType, 2)[0]) ?: 'audio/webm';
  $allowedMimes = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/x-m4a', 'video/webm'];
  if (!in_array($mime, $allowedMimes, true)) {
    http_response_code(415);
    echo json_encode(['error' => 'Formato de audio no compatible'], JSON_UNESCAPED_UNICODE);
    exit;
  }
  $file = new CURLFile($tmp, $mime, $name ?: 'audio.webm');
  $transcription = openaiMultipart($apiKey, 'https://api.openai.com/v1/audio/transcriptions', ['file' => $file, 'model' => $OPENAI_STT_MODEL, 'language' => 'es']);
  if (!$transcription['ok']) {
    error_log('IAstronaut STT error ' . $transcription['code'] . ': ' . ($transcription['err'] ?: (string)$transcription['raw']));
    http_response_code(502);
    echo json_encode(['error' => 'No fue posible transcribir el audio en este momento'], JSON_UNESCAPED_UNICODE);
    exit;
  }
  $userText = cleanValue($transcription['json']['text'] ?? '', 700);
  if ($userText === '') {
    http_response_code(400);
    echo json_encode(['error' => 'No se detectó una frase clara'], JSON_UNESCAPED_UNICODE);
    exit;
  }
} else {
  $data = json_decode(file_get_contents('php://input') ?: '', true);
  if (!is_array($data)) $data = [];
  if (!empty($data['tts_only'])) {
    $ttsText = ttsCleanText(cleanValue($data['text'] ?? '', 900));
    if ($ttsText === '') {
      http_response_code(400);
      echo json_encode(['error' => 'Texto de voz vacío'], JSON_UNESCAPED_UNICODE);
      exit;
    }
    $ttsOnly = openaiTTSBase64($apiKey, $OPENAI_TTS_MODEL, $OPENAI_TTS_VOICE, $ttsText);
    if (!$ttsOnly['ok']) {
      error_log('IAstronaut TTS error ' . $ttsOnly['code'] . ': ' . $ttsOnly['err']);
      http_response_code(502);
      echo json_encode(['error' => 'No fue posible generar el audio'], JSON_UNESCAPED_UNICODE);
      exit;
    }
    echo json_encode(['audio_base64' => $ttsOnly['audio_base64']], JSON_UNESCAPED_UNICODE);
    exit;
  }
  $userText = cleanValue($data['message'] ?? '', 700);
  $wantAudio = (bool)($data['want_audio'] ?? false);
  if (isset($data['mission_context']) && is_array($data['mission_context'])) $missionContext = $data['mission_context'];
  $history = cleanHistory($data['history'] ?? []);
  if ($userText === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Mensaje vacío'], JSON_UNESCAPED_UNICODE);
    exit;
  }
}

$sceneName = cleanValue($missionContext['scene_name'] ?? '', 60);
$sceneType = cleanValue($missionContext['scene_type'] ?? '', 80);
$objective = cleanValue($missionContext['objective'] ?? '', 240);
$operationTitle = cleanValue($missionContext['operation_title'] ?? '', 100);
$operationBriefing = cleanValue($missionContext['operation_briefing'] ?? '', 260);
$hint = cleanValue($missionContext['hint'] ?? '', 220);
$lastResult = cleanValue($missionContext['last_result'] ?? '', 180);
$selectedTopic = cleanValue($missionContext['selected_topic'] ?? '', 80);
$nextDestination = cleanValue($missionContext['next_destination'] ?? '', 60);
$operationStarted = !empty($missionContext['operation_started']);
$operationComplete = !empty($missionContext['operation_complete']);
$progress = max(0, min(100, (int)($missionContext['operation_progress'] ?? 0)));
$eventLabel = cleanValue($missionContext['event_label'] ?? '', 80);
$eventSeconds = max(0, (int)($missionContext['event_seconds'] ?? 0));
$completedNames = [];
if (isset($missionContext['completed_destinations']) && is_array($missionContext['completed_destinations'])) {
  foreach (array_slice($missionContext['completed_destinations'], 0, 12) as $name) {
    $cleaned = cleanValue($name, 50);
    if ($cleaned !== '') $completedNames[] = $cleaned;
  }
}

if ($sceneName !== '') {
  $details = "El tripulante está en {$sceneName}";
  if ($sceneType !== '') $details .= " ({$sceneType})";
  if ($objective !== '') $details .= ". Objetivo general: {$objective}";
  if ($operationTitle !== '') $details .= ". Operación actual: {$operationTitle}";
  if ($operationBriefing !== '') $details .= ". Instrucciones: {$operationBriefing}";
  $details .= $operationComplete ? ". Operación completada" : ($operationStarted ? ". Operación activa al {$progress}%" : ". Operación aún no iniciada");
  if ($eventLabel !== '') $details .= ". Evento activo: {$eventLabel}, quedan {$eventSeconds} segundos";
  if ($selectedTopic !== '') $details .= ". Tema científico visible: {$selectedTopic}";
  if ($hint !== '') $details .= ". Pista disponible: {$hint}";
  if ($lastResult !== '') $details .= ". Último resultado: {$lastResult}";
  if ($nextDestination !== '') $details .= ". Próximo destino: {$nextDestination}";
  if ($completedNames) $details .= ". Destinos completados: " . implode(', ', $completedNames);
  $system .= " Contexto operativo actual: {$details}.";
}

$messages = [['role' => 'system', 'content' => $system]];
foreach ($history as $message) $messages[] = $message;
$messages[] = ['role' => 'user', 'content' => $userText];

$chat = openaiJson($apiKey, 'https://api.openai.com/v1/chat/completions', [
  'model' => $OPENAI_CHAT_MODEL,
  'messages' => $messages,
  'temperature' => 0.65,
]);

if (!$chat['ok']) {
  error_log('IAstronaut chat error ' . $chat['code'] . ': ' . ($chat['err'] ?: (string)$chat['raw']));
  http_response_code(502);
  echo json_encode(['error' => 'El canal de IA no está disponible temporalmente'], JSON_UNESCAPED_UNICODE);
  exit;
}

$finalReply = cleanValue($chat['json']['choices'][0]['message']['content'] ?? '', 900);
if ($finalReply === '') $finalReply = 'No pude responder en este momento.';
$action = inferMissionAction($userText);
$audioBase64 = null;
$ttsText = null;
if ($wantAudio) {
  $ttsText = ttsCleanText($finalReply) ?: $finalReply;
  $tts = openaiTTSBase64($apiKey, $OPENAI_TTS_MODEL, $OPENAI_TTS_VOICE, $ttsText);
  if ($tts['ok']) $audioBase64 = $tts['audio_base64'];
}

echo json_encode([
  'mode' => $mode,
  'transcript' => $mode === 'voice' ? $userText : null,
  'reply' => $finalReply,
  'action' => $action,
  'tts_text' => $ttsText,
  'audio_base64' => $audioBase64,
], JSON_UNESCAPED_UNICODE);
