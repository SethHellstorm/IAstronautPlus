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

$clave = is_array($datos) ? ($datos['clave_evento'] ?? null) : null;

if (!is_string($clave) || !preg_match('/^[a-f0-9]{32}$/', $clave)) {
    responder(400, ['error' => 'La clave del evento no es válida.']);
}

try {
    $conexion = require dirname(__DIR__, 3) . '/app/sync/conexion.php';

    $buscarSesion = $conexion->prepare(
        "SELECT id
         FROM sesiones
         WHERE token_emisor_hash = :token_hash
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

    // Por ahora solo permitimos este evento fijo de prueba.
    $contenido = json_encode(
        ['mensaje' => 'Hola desde la página emisora'],
        JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
    );

    $insertar = $conexion->prepare(
        "INSERT INTO eventos (
            sesion_id, clave_evento, tipo, datos, expira_en
        ) VALUES (
            :sesion_id, :clave, 'prueba', :datos,
            DATE_ADD(UTC_TIMESTAMP(), INTERVAL 60 SECOND)
        )"
    );

    $duplicado = false;

    try {
        $insertar->execute([
            'sesion_id' => $sesion['id'],
            'clave' => $clave,
            'datos' => $contenido,
        ]);

        $eventoId = (int) $conexion->lastInsertId();
    } catch (PDOException $error) {
        if ((int) ($error->errorInfo[1] ?? 0) !== 1062) {
            throw $error;
        }

        $buscarEvento = $conexion->prepare(
            "SELECT id
             FROM eventos
             WHERE sesion_id = :sesion_id
               AND clave_evento = :clave"
        );

        $buscarEvento->execute([
            'sesion_id' => $sesion['id'],
            'clave' => $clave,
        ]);

        $existente = $buscarEvento->fetch();

        if (!$existente) {
            throw $error;
        }

        $eventoId = (int) $existente['id'];
        $duplicado = true;
    }

    responder($duplicado ? 200 : 201, [
        'evento_id' => $eventoId,
        'clave_evento' => $clave,
        'ya_existia' => $duplicado,
    ]);
} catch (Throwable $error) {
    error_log((string) $error);
    responder(500, ['error' => 'No se pudo registrar el evento.']);
}