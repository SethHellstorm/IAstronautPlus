<?php
declare(strict_types=1);

$root = dirname(__DIR__, 2);
require_once $root . '/public/assets/vendor/autoload.php';
Dotenv\Dotenv::createImmutable($root)->safeLoad();

$config = static function (string $key, ?string $default = null): string {
    $value = $_ENV[$key] ?? $_SERVER[$key] ?? getenv($key);
    if ($value === false || $value === null) {
        if ($default === null) throw new RuntimeException("Falta configurar {$key}.");
        return $default;
    }
    return (string) $value;
};

$host = $config('DB_HOST', '127.0.0.1');
$puerto = $config('DB_PORT', '3306');
$base = $config('DB_DATABASE', 'iastronaut_sync');
$conexion = new PDO(
    "mysql:host={$host};port={$puerto};dbname={$base};charset=utf8mb4",
    $config('DB_USERNAME'),
    $config('DB_PASSWORD'),
    [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]
);
$conexion->exec("SET time_zone = '+00:00'");
return $conexion;
