<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$conexion = require __DIR__ . '/conexion.php';
require_once __DIR__ . '/limites.php';

for ($i = 1; $i <= 4; $i++) {
    $resultado = consumirLimiteSync(
        $conexion,
        'prueba-local',
        'terminal',
        3,
        15
    );

    echo "Solicitud {$i}: "
        . json_encode($resultado, JSON_UNESCAPED_UNICODE)
        . PHP_EOL;
}