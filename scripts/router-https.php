<?php
// Solo para el servidor local dedicado al tunel, enlazado a 127.0.0.1.
declare(strict_types=1);
$root = dirname(__DIR__);
$public = realpath($root . '/public');
$path = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
if (preg_match('~(?:^|/)[.]|[\\\\\x00]~', $path) || str_starts_with($path, '/assets/vendor/')) {
    http_response_code(404); exit;
}
$file = realpath($public . ($path === '/' ? '/index.php' : $path));
if (!$file || !is_file($file) || !str_starts_with($file, $public . DIRECTORY_SEPARATOR)) {
    http_response_code(404); exit;
}
// Cloudflare termina TLS. Solo se aceptan cabeceras del proxy local en este puerto.
if (in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true)
    && ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') {
    $_SERVER['HTTPS'] = 'on';
}
// Protege la experiencia y sus acciones (incluido chat); los endpoints sync tienen su propio control.
if ($path === '/' || $path === '/index.php' || str_starts_with($path, '/actions/')) {
    require_once $root . '/app/sync/funciones.php';
    require_once $root . '/app/sync/acceso.php';
    exigirAccesoSync();
    if ($path === '/' || $path === '/index.php') header('Content-Type: text/html; charset=utf-8');
    // No retener el bloqueo de sync durante una respuesta del chat.
    $pdo = conexionAccesoSync();
    $pdo->query("SELECT RELEASE_LOCK(SHA2(CONCAT('sync_', DATABASE()),256))");
}
if (pathinfo($file, PATHINFO_EXTENSION) === 'php') {
    $_SERVER['SCRIPT_NAME'] = $path === '/' ? '/index.php' : $path;
    $_SERVER['PHP_SELF'] = $_SERVER['SCRIPT_NAME'];
    $_SERVER['SCRIPT_FILENAME'] = $file;
    require $file;
    return true;
}
return false;
