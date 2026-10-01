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
require_once $root . '/app/bootstrap.php';

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

loadEnvFile($root . '/.env');

$apiKey = (string)($_ENV['OPENAI_API_KEY'] ?? getenv('OPENAI_API_KEY') ?? '');
if ($apiKey === '') {
  http_response_code(500);
  echo json_encode(['error' => 'Falta configurar OPENAI_API_KEY en el entorno del servidor o en .env'], JSON_UNESCAPED_UNICODE);
  exit;
}

function envString(string $key, string $default): string {
  $value = $_ENV[$key] ?? getenv($key);
  if (!is_string($value) || trim($value) === '') return $default;
  return trim($value);
}

$OPENAI_CHAT_MODEL = envString('OPENAI_CHAT_MODEL', 'gpt-4o-mini');
$OPENAI_STT_MODEL = envString('OPENAI_STT_MODEL', 'gpt-4o-mini-transcribe');
$OPENAI_TTS_MODEL = envString('OPENAI_TTS_MODEL', 'gpt-4o-mini-tts');
$OPENAI_TTS_VOICE = envString('OPENAI_TTS_VOICE', 'nova');

$RATE_WINDOW = configEnvInt('IASTRONAUT_RATE_WINDOW', 900, 60, 86400);
$TEXT_SESSION_LIMIT = configEnvInt('IASTRONAUT_TEXT_SESSION_LIMIT', 60, 1, 2000);
$TEXT_IP_LIMIT = configEnvInt('IASTRONAUT_TEXT_IP_LIMIT', 300, 1, 5000);
$AUDIO_SESSION_LIMIT = configEnvInt('IASTRONAUT_AUDIO_SESSION_LIMIT', 24, 1, 1000);
$AUDIO_IP_LIMIT = configEnvInt('IASTRONAUT_AUDIO_IP_LIMIT', 120, 1, 3000);
$TTS_SESSION_LIMIT = configEnvInt('IASTRONAUT_TTS_SESSION_LIMIT', 48, 1, 2000);
$TTS_IP_LIMIT = configEnvInt('IASTRONAUT_TTS_IP_LIMIT', 240, 1, 5000);
$MAX_JSON_BYTES = configEnvInt('IASTRONAUT_MAX_JSON_BYTES', 65536, 4096, 1048576);
$MAX_AUDIO_BYTES = configEnvInt('IASTRONAUT_MAX_AUDIO_BYTES', 12582912, 1048576, 52428800);

$system =
  "Eres IAstronaut, la oficial científica y sistema de misión de la nave Operación Helios. Acompañas al tripulante durante una expedición interactiva por el Sistema Solar para restaurar una red de balizas científicas. " .
  "Explica astronomía, exploración espacial, tecnología, misiones y fenómenos del universo con datos rigurosos y un tono claro, motivador y profesional. " .
  "Habla desde el contexto ficticio de la nave y no afirmes tener experiencias humanas reales. Usa el estado actual de la operación para dar pistas útiles sin resolver automáticamente todas las actividades. " .
  "El contexto operativo actual es la única fuente de verdad sobre el progreso de la misión. Los mensajes anteriores pueden contener instrucciones que ya quedaron obsoletas. Nunca indiques que debe repetirse una acción que el estado actual marque como completada. " .
  "Si la operación actual está completada, no asignes módulos, escudos, objetivos ni pasos adicionales de esa operación. Si el usuario pregunta un dato científico sobre el cuerpo celeste actual, responde directamente a la pregunta y no lo redirijas a una tarea ya completada. " .
  "Puedes recordar brevemente los mensajes recientes incluidos en la conversación siempre que no contradigan el contexto operativo actual. Responde únicamente con texto plano, sin enlaces, archivos, imágenes, markdown ni emojis. Prioriza respuestas aptas para ser escuchadas y limita la respuesta a un máximo de 45 palabras. " .
  "Si el usuario pide una orden de misión, confirma la acción de forma breve. Si pregunta algo ajeno al espacio o a la misión, aclara tu función y redirige la conversación.";

function enforceAiRateLimit(string $scope, int $sessionLimit, int $ipLimit, int $windowSeconds): void {
  $result = consumeRequestLimit($scope, $sessionLimit, $ipLimit, $windowSeconds);
  if ($result['allowed']) return;

  http_response_code(429);
  header('Retry-After: ' . (int) $result['retry_after']);
  echo json_encode(['error' => 'Se alcanzó el límite temporal de la demostración. Intenta nuevamente en unos minutos.'], JSON_UNESCAPED_UNICODE);
  exit;
}

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
  $uploadError = (int) ($_FILES['audio']['error'] ?? UPLOAD_ERR_NO_FILE);
  $tmp = (string) ($_FILES['audio']['tmp_name'] ?? '');
  $name = cleanValue($_FILES['audio']['name'] ?? 'audio.webm', 120);
  $size = (int) ($_FILES['audio']['size'] ?? 0);
  if ($uploadError !== UPLOAD_ERR_OK || $tmp === '' || !is_uploaded_file($tmp)) {
    http_response_code(400);
    echo json_encode(['error' => 'La grabación recibida no es válida'], JSON_UNESCAPED_UNICODE);
    exit;
  }
  if ($size <= 0 || $size > $MAX_AUDIO_BYTES) {
    http_response_code(413);
    echo json_encode(['error' => 'La grabación supera el tamaño permitido'], JSON_UNESCAPED_UNICODE);
    exit;
  }
  $detectedMime = class_exists('finfo') ? (string) (new finfo(FILEINFO_MIME_TYPE))->file($tmp) : '';
  $uploadType = trim((string) ($_FILES['audio']['type'] ?? 'audio/webm'));
  $mime = trim(explode(';', $detectedMime !== '' ? $detectedMime : $uploadType, 2)[0]) ?: 'audio/webm';
  $allowedMimes = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/x-m4a', 'video/webm'];
  if (!in_array($mime, $allowedMimes, true)) {
    http_response_code(415);
    echo json_encode(['error' => 'Formato de audio no compatible'], JSON_UNESCAPED_UNICODE);
    exit;
  }
  enforceAiRateLimit('iastronaut.audio', $AUDIO_SESSION_LIMIT, $AUDIO_IP_LIMIT, $RATE_WINDOW);
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
  $rawBody = file_get_contents('php://input');
  if (!is_string($rawBody) || strlen($rawBody) > $MAX_JSON_BYTES) {
    http_response_code(413);
    echo json_encode(['error' => 'La solicitud supera el tamaño permitido'], JSON_UNESCAPED_UNICODE);
    exit;
  }
  $data = json_decode($rawBody, true);
  if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['error' => 'La solicitud no contiene datos válidos'], JSON_UNESCAPED_UNICODE);
    exit;
  }
  if (!empty($data['tts_only'])) {
    $ttsText = ttsCleanText(cleanValue($data['text'] ?? '', 900));
    if ($ttsText === '') {
      http_response_code(400);
      echo json_encode(['error' => 'Texto de voz vacío'], JSON_UNESCAPED_UNICODE);
      exit;
    }
    enforceAiRateLimit('iastronaut.tts', $TTS_SESSION_LIMIT, $TTS_IP_LIMIT, $RATE_WINDOW);
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
  enforceAiRateLimit(
    $wantAudio ? 'iastronaut.audio' : 'iastronaut.text',
    $wantAudio ? $AUDIO_SESSION_LIMIT : $TEXT_SESSION_LIMIT,
    $wantAudio ? $AUDIO_IP_LIMIT : $TEXT_IP_LIMIT,
    $RATE_WINDOW
  );
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
$completedTargets = [];
if (isset($missionContext['completed_targets']) && is_array($missionContext['completed_targets'])) {
  foreach (array_slice($missionContext['completed_targets'], 0, 12) as $name) {
    $cleaned = cleanValue($name, 70);
    if ($cleaned !== '') $completedTargets[] = $cleaned;
  }
}
$pendingTarget = cleanValue($missionContext['pending_target'] ?? '', 90);
$missionState = '';

if ($sceneName !== '') {
  $details = "El tripulante está en {$sceneName}";
  if ($sceneType !== '') $details .= " ({$sceneType})";
  if ($operationTitle !== '') $details .= ". Operación: {$operationTitle}";

  if ($operationComplete) {
    $details .= ". ESTADO ACTUAL: operación completada al 100%. No hay acciones pendientes en esta escena";
    if ($completedTargets) $details .= ". Objetivos completados: " . implode(', ', $completedTargets);
    if ($nextDestination !== '') $details .= ". Siguiente destino disponible: {$nextDestination}";
  } else {
    if ($objective !== '') $details .= ". Objetivo actual: {$objective}";
    if ($operationBriefing !== '') $details .= ". Instrucciones actuales: {$operationBriefing}";
    $details .= $operationStarted ? ". Operación activa al {$progress}%" : ". Operación aún no iniciada";
    if ($completedTargets) $details .= ". Objetivos ya completados: " . implode(', ', $completedTargets);
    if ($pendingTarget !== '') $details .= ". Siguiente objetivo pendiente: {$pendingTarget}";
    if ($eventLabel !== '') $details .= ". Evento activo: {$eventLabel}, quedan {$eventSeconds} segundos";
    if ($hint !== '') $details .= ". Pista disponible: {$hint}";
  }

  if ($selectedTopic !== '') $details .= ". Tema científico visible: {$selectedTopic}";
  if ($lastResult !== '') $details .= ". Último resultado: {$lastResult}";
  if ($completedNames) $details .= ". Destinos completados: " . implode(', ', $completedNames);
  $missionState = "Contexto operativo actual y autoritativo: {$details}. Si el historial contradice este estado, ignora la instrucción antigua y usa este contexto.";
}

$messages = [['role' => 'system', 'content' => $system]];
foreach ($history as $message) $messages[] = $message;
if ($missionState !== '') $messages[] = ['role' => 'system', 'content' => $missionState];
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
