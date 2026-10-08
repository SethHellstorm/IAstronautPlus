<?php
declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/app/sync/funciones.php';
require_once dirname(__DIR__, 3) . '/app/sync/acceso.php';

exigirAccesoSync();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    responder(405, ['error' => 'Utiliza el método POST.']);
}

$autorizacion = $_SERVER['HTTP_AUTHORIZATION'] ?? '';

if (!preg_match('/^Bearer ([a-f0-9]{64})$/', $autorizacion, $coincidencias)) {
    responder(401, ['error' => 'Credencial ausente o inválida.']);
}

try {
    $datos = json_decode(
        file_get_contents('php://input'),
        true,
        512,
        JSON_THROW_ON_ERROR
    );
} catch (JsonException $error) {
    responder(400, ['error' => 'JSON inválido.']);
}

$eventoId = is_array($datos) ? ($datos['evento_id'] ?? null) : null;

if (!is_int($eventoId) || $eventoId < 1) {
    responder(400, ['error' => 'El ID del evento debe ser un entero positivo.']);
}

try {
    $conexion = require dirname(__DIR__, 3) . '/app/sync/conexion.php';

    $buscarSesion = $conexion->prepare(
        "SELECT id
         FROM sesiones
         WHERE token_receptor_hash = :token_hash
           AND estado = 'vinculada'
           AND expira_en > UTC_TIMESTAMP()"
    );

    $buscarSesion->execute([
        'token_hash' => hash('sha256', $coincidencias[1]),
    ]);

    $sesion = $buscarSesion->fetch();

    if (!$sesion) {
        responder(403, ['error' => 'Credencial o sesión no disponible.']);
    }

    $parametros = [
        'evento_id' => $eventoId,
        'sesion_id' => $sesion['id'],
    ];

    $actualizar = $conexion->prepare(
        "UPDATE eventos
         SET confirmado_en = UTC_TIMESTAMP()
         WHERE id = :evento_id
           AND sesion_id = :sesion_id
           AND confirmado_en IS NULL"
    );

    $actualizar->execute($parametros);
    $nuevaConfirmacion = $actualizar->rowCount() === 1;

    $consultar = $conexion->prepare(
        "SELECT id, confirmado_en
         FROM eventos
         WHERE id = :evento_id
           AND sesion_id = :sesion_id"
    );

    $consultar->execute($parametros);
    $evento = $consultar->fetch();

    if (!$evento) {
        responder(404, ['error' => 'Evento no encontrado en esta sesión.']);
    }

    responder(200, [
        'evento_id' => (int) $evento['id'],
        'confirmado' => $evento['confirmado_en'] !== null,
        'ya_estaba_confirmado' => !$nuevaConfirmacion,
        'confirmado_en' => $evento['confirmado_en'],
    ]);
} catch (Throwable $error) {
    error_log((string) $error);

    responder(500, ['error' => 'No se pudo confirmar el evento.']);
}