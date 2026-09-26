<?php
declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/app/sync/funciones.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    responder(405, ['error' => 'Utiliza el método POST.']);
}

// Interpretamos el JSON enviado por la página.
try {
    $datos = json_decode(
        file_get_contents('php://input'),
        true,
        512,
        JSON_THROW_ON_ERROR
    );
} catch (JsonException $error) {
    responder(400, ['error' => 'El cuerpo debe contener JSON válido.']);
}

if (!is_array($datos) || !is_string($datos['codigo'] ?? null)) {
    responder(400, ['error' => 'Debes enviar un código.']);
}

$codigo = strtoupper(trim($datos['codigo']));

if (!preg_match('/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/', $codigo)) {
    responder(400, ['error' => 'El código debe tener seis caracteres válidos.']);
}

try {
    $conexion = require dirname(__DIR__, 3) . '/app/sync/conexion.php';

    $tokenReceptor = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $tokenReceptor);

    $consulta = $conexion->prepare(
        "UPDATE sesiones
         SET token_receptor_hash = :token_hash,
             estado = 'vinculada',
             vinculada_en = UTC_TIMESTAMP()
         WHERE codigo = :codigo
           AND estado = 'esperando'
           AND token_receptor_hash IS NULL
           AND codigo_expira_en > UTC_TIMESTAMP()
           AND expira_en > UTC_TIMESTAMP()"
    );

    $consulta->execute([
        'token_hash' => $tokenHash,
        'codigo' => $codigo,
    ]);

    if ($consulta->rowCount() !== 1) {
        responder(409, [
            'error' => 'Código inexistente, vencido o sesión ya vinculada.',
        ]);
    }

    responder(200, [
        'codigo' => $codigo,
        'token_receptor' => $tokenReceptor,
        'estado' => 'vinculada',
    ]);
} catch (Throwable $error) {
    error_log((string) $error);

    responder(500, [
        'error' => 'No se pudo vincular la sesión.',
    ]);
}