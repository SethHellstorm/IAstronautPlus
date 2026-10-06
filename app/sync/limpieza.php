<?php
declare(strict_types=1);

// Comparte exactamente los DELETE del evento MySQL. El llamador controla transaccion/bloqueo.
function sentenciasRetencionSync(): array
{
    $sql = file_get_contents(dirname(__DIR__, 2) . '/database/migrations/004_limpieza_diaria.sql');
    if (!preg_match('/-- INICIO_RETENCION(.*?)-- FIN_RETENCION/s', $sql, $m)) {
        throw new RuntimeException('No se encontro la politica de retencion.');
    }
    $body = preg_replace('/--[^\r\n]*/', '', $m[1]);
    return array_values(array_filter(array_map('trim', explode(';', $body))));
}
function limpiarRegistrosSync(PDO $pdo): array
{
    $counts = [];
    foreach (sentenciasRetencionSync() as $sql) {
        preg_match('/DELETE FROM (\w+)/', $sql, $m);
        $counts[$m[1]] = $pdo->exec($sql);
    }
    return $counts;
}
