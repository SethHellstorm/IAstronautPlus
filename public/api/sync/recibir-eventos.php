<?php
declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/app/sync/funciones.php';
require_once dirname(__DIR__, 3) . '/app/sync/acceso.php';

exigirAccesoSync();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    responder(405, ['error' => 'Utiliza el método GET.']);
}

$autorizacion = $_SERVER['HTTP_AUTHORIZATION'] ?? '';

if (!preg_match('/^Bearer ([a-f0-9]{64})$/', $autorizacion, $coincidencias)) {
    responder(401, ['error' => 'Credencial ausente o inválida.']);
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
        responder(403, [
            'error' => 'Credencial o sesión no disponible.',
        ]);
    }

    $buscarEventos = $conexion->prepare(
        "SELECT id, clave_evento, tipo, datos, creado_en, expira_en
         FROM eventos
         WHERE sesion_id = :sesion_id
           AND confirmado_en IS NULL
           AND expira_en > UTC_TIMESTAMP()
         ORDER BY id ASC
         LIMIT 20"
    );

    $buscarEventos->execute([
        'sesion_id' => $sesion['id'],
    ]);

    $eventos = $buscarEventos->fetchAll();

    foreach ($eventos as &$evento) {
        $evento['id'] = (int) $evento['id'];

        $evento['datos'] = json_decode(
            $evento['datos'],
            true,
            512,
            JSON_THROW_ON_ERROR
        );
    }
    unset($evento);

    responder(200, [
        'sesion_id' => (int) $sesion['id'],
        'eventos' => $eventos,
    ]);
} catch (Throwable $error) {
    error_log((string) $error);

    responder(500, [
        'error' => 'No se pudieron consultar los eventos.',
    ]);
}