<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/acceso.php';
require_once __DIR__ . '/limpieza.php';
try {
    $pdo = conexionAccesoSync();
    if ($pdo->query('SELECT @@event_scheduler')->fetchColumn() !== 'ON') {
        throw new RuntimeException('El programador de eventos MySQL debe estar ON.');
    }
    $source = file_get_contents(dirname(__DIR__, 2) . '/database/migrations/004_limpieza_diaria.sql');
    $start = strpos($source, 'CREATE EVENT');
    $end = strpos($source, 'END$$', $start);
    if ($start === false || $end === false) throw new RuntimeException('Migracion no valida.');
    $pdo->exec(substr($source, $start, $end - $start + 3));
    // Primera limpieza al instalar; las siguientes se ejecutan desde MySQL.
    $pdo->beginTransaction();
    $counts = limpiarRegistrosSync($pdo);
    $pdo->commit();
    echo json_encode(['eliminados' => $counts, 'programacion' => $pdo->query(
        "SELECT EVENT_NAME, STATUS, INTERVAL_VALUE, INTERVAL_FIELD, STARTS, TIME_ZONE
         FROM information_schema.EVENTS WHERE EVENT_SCHEMA = DATABASE() AND EVENT_NAME = 'sync_limpieza_diaria'"
    )->fetch()], JSON_PRETTY_PRINT) . PHP_EOL;
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    fwrite(STDERR, 'No se pudo completar la instalacion: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}
