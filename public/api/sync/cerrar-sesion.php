<?php
declare(strict_types=1);
require_once dirname(__DIR__, 3) . '/app/sync/funciones.php';
require_once dirname(__DIR__, 3) . '/app/sync/acceso.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    responder(405, ['error' => 'Método no permitido.']);
}
try {
    cerrarAccesoSync(conexionAccesoSync());
    responder(200, ['cerrado' => true]);
} catch (Throwable $e) {
    error_log('Cierre sync: ' . $e->getMessage());
    responder(503, ['error' => 'No se pudo confirmar el cierre. Reintenta.']);
}
