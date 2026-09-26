<?php
declare(strict_types=1);

function e(?string $value): string
{
  return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function app_base_path(): string
{
  $base = defined('BASE_PATH') ? (string) BASE_PATH : '';
  $base = rtrim(str_replace('\\', '/', $base), '/');
  return $base === '/' ? '' : $base;
}

function url(string $path = ''): string
{
  $base = app_base_path();
  $path = trim($path);
  if ($path === '') return $base === '' ? '/' : $base . '/';
  return $base . '/' . ltrim($path, '/');
}

function asset(string $path): string
{
  return url('assets/' . ltrim($path, '/'));
}

function configEnvInt(string $key, int $default, int $minimum, int $maximum): int
{
  $value = $_ENV[$key] ?? getenv($key);
  if ($value === false || filter_var($value, FILTER_VALIDATE_INT) === false) return $default;
  return max($minimum, min($maximum, (int) $value));
}

function startRateLimitSession(): void
{
  if (session_status() === PHP_SESSION_ACTIVE) return;

  $secure = (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off')
    || (int) ($_SERVER['SERVER_PORT'] ?? 0) === 443;

  ini_set('session.use_strict_mode', '1');
  session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $secure,
    'httponly' => true,
    'samesite' => 'Lax',
  ]);
  session_start();
}

function clientIp(): string
{
  $ip = trim((string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
  return $ip !== '' ? $ip : 'unknown';
}

function rateLimitDirectory(): ?string
{
  $candidates = [
    PROJECT_ROOT . '/storage/rate-limits',
    rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'iastronaut-rate-limits',
  ];

  foreach ($candidates as $directory) {
    if (!is_dir($directory) && !@mkdir($directory, 0775, true) && !is_dir($directory)) continue;
    if (is_writable($directory)) return $directory;
  }

  return null;
}

function consumeSessionLimit(string $scope, int $limit, int $windowSeconds): array
{
  $startedHere = session_status() !== PHP_SESSION_ACTIVE;
  startRateLimitSession();
  $now = time();
  $bucket = $_SESSION['iastronaut_rate_limit'][$scope] ?? null;

  if (!is_array($bucket) || (int) ($bucket['reset_at'] ?? 0) <= $now) {
    $bucket = ['count' => 0, 'reset_at' => $now + $windowSeconds];
  }

  $allowed = (int) $bucket['count'] < $limit;
  if ($allowed) $bucket['count'] = (int) $bucket['count'] + 1;
  $_SESSION['iastronaut_rate_limit'][$scope] = $bucket;

  if ($startedHere) session_write_close();

  return [
    'allowed' => $allowed,
    'retry_after' => $allowed ? 0 : max(1, (int) $bucket['reset_at'] - $now),
  ];
}

function consumeIpLimit(string $scope, int $limit, int $windowSeconds): array
{
  $directory = rateLimitDirectory();
  if ($directory === null) return ['allowed' => false, 'retry_after' => $windowSeconds];

  $file = $directory . '/' . hash('sha256', $scope . '|' . clientIp()) . '.json';
  $handle = @fopen($file, 'c+');
  if ($handle === false) return ['allowed' => false, 'retry_after' => $windowSeconds];

  try {
    if (!flock($handle, LOCK_EX)) return ['allowed' => false, 'retry_after' => $windowSeconds];

    rewind($handle);
    $raw = stream_get_contents($handle);
    $bucket = json_decode(is_string($raw) ? $raw : '', true);
    $now = time();

    if (!is_array($bucket) || (int) ($bucket['reset_at'] ?? 0) <= $now) {
      $bucket = ['count' => 0, 'reset_at' => $now + $windowSeconds];
    }

    $allowed = (int) $bucket['count'] < $limit;
    if ($allowed) $bucket['count'] = (int) $bucket['count'] + 1;

    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, json_encode($bucket, JSON_UNESCAPED_SLASHES));
    fflush($handle);
    flock($handle, LOCK_UN);

    return [
      'allowed' => $allowed,
      'retry_after' => $allowed ? 0 : max(1, (int) $bucket['reset_at'] - $now),
    ];
  } finally {
    fclose($handle);
  }
}

function consumeRequestLimit(string $scope, int $sessionLimit, int $ipLimit, int $windowSeconds): array
{
  $session = consumeSessionLimit($scope, $sessionLimit, $windowSeconds);
  if (!$session['allowed']) return $session;
  return consumeIpLimit($scope, $ipLimit, $windowSeconds);
}

