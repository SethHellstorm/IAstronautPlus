<?php
declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/app/sync/funciones.php';
require_once dirname(__DIR__, 3) . '/app/sync/acceso.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    responder(405, ['error' => 'Método no permitido.']);
}

try {
    exigirAccesoSync();

    responder(200, ['autorizado' => true, 'acceso_id' => $GLOBALS['sync_acceso_id']]);
} catch (Throwable $error) {
    error_log('Error al consultar acceso sync: ' . $error->getMessage());

    responder(500, [
        'error' => 'No se pudo comprobar el acceso.'
    ]);
}