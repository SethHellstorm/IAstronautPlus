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

    // Cierra las vinculaciones asociadas a este acceso.
    $cerrar = $conexion->prepare(
        "UPDATE sesiones s
         JOIN sync_acceso_sesiones a ON a.sesion_id = s.id
         SET s.estado = 'cerrada'
         WHERE a.acceso_id = ?"
    );
    $cerrar->execute([$accesoId]);

    // Separa nuestro acceso antes de propagar el cierre.
    // Así podemos elegir otra función sin ingresar la contraseña.
    $separar = $conexion->prepare(
        'DELETE FROM sync_acceso_sesiones WHERE acceso_id = ?'
    );
    $separar->execute([$accesoId]);

    // El otro extremo pierde la vinculación y su autorización,
    // conforme al comportamiento de cierre que ya implementamos.
    invalidarAccesosSync($conexion, versionPasswordSync());

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