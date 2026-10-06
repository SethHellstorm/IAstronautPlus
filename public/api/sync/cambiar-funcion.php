<?php
declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/app/sync/funciones.php';
require_once dirname(__DIR__, 3) . '/app/sync/acceso.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    responder(405, ['error' => 'Método no permitido.']);
}

exigirAccesoSync();

try {
    $conexion = conexionAccesoSync();
    $accesoId = $GLOBALS['sync_acceso_id'];

    $conexion->beginTransaction();

    cambiarFuncionAccesoSync($conexion, $accesoId);

    $conexion->commit();

    responder(200, ['seleccion_disponible' => true]);
} catch (Throwable $error) {
    if (isset($conexion) && $conexion->inTransaction()) {
        $conexion->rollBack();
    }

    error_log('Cambio de función sync: ' . $error->getMessage());

    responder(503, [
        'error' => 'No se pudo cambiar de función. Intenta nuevamente.'
    ]);
}