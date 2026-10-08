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

$token = $coincidencias[1];

try {
    $conexion = require dirname(__DIR__, 3) . '/app/sync/conexion.php';

    $consulta = $conexion->prepare(
        "SELECT
            id,
            codigo,
            estado,
            vinculada_en,
            expira_en <= UTC_TIMESTAMP() AS sesion_vencida,
            codigo_expira_en <= UTC_TIMESTAMP() AS codigo_vencido
         FROM sesiones
         WHERE token_emisor_hash = :token_hash"
    );

    $consulta->execute([
        'token_hash' => hash('sha256', $token),
    ]);

    $sesion = $consulta->fetch();

    if (!$sesion) {
        responder(401, ['error' => 'Credencial inválida.']);
    }

    if (
        $sesion['estado'] === 'cerrada' ||
        (int) $sesion['sesion_vencida'] === 1
    ) {
        responder(410, ['error' => 'La sesión está cerrada o vencida.']);
    }

    if (
        $sesion['estado'] === 'esperando' &&
        (int) $sesion['codigo_vencido'] === 1
    ) {
        responder(410, ['error' => 'El código venció. Crea una sesión nueva.']);
    }

    responder(200, [
        'sesion_id' => (int) $sesion['id'],
        'codigo' => $sesion['codigo'],
        'estado' => $sesion['estado'],
        'vinculada_en' => $sesion['vinculada_en'],
    ]);
} catch (Throwable $error) {
    error_log((string) $error);

    responder(500, [
        'error' => 'No se pudo consultar la sesión.',
    ]);
}