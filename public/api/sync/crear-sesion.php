<?php
declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/app/sync/funciones.php';
require_once dirname(__DIR__, 3) . '/app/sync/acceso.php';

exigirAccesoSync();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    responder(405, ['error' => 'Utiliza el método POST.']);
}

try {
    $conexion = conexionAccesoSync();
    $conexion->beginTransaction();

    $tokenEmisor = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $tokenEmisor);
    $alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    $consulta = $conexion->prepare(
        "INSERT INTO sesiones (
            codigo,
            token_emisor_hash,
            codigo_expira_en,
            expira_en
        ) VALUES (
            :codigo,
            :token_hash,
            DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE),
            DATE_ADD(UTC_TIMESTAMP(), INTERVAL 2 HOUR)
        )"
    );

    for ($intento = 0; $intento < 5; $intento++) {
        $codigo = '';

        for ($i = 0; $i < 6; $i++) {
            $codigo .= $alfabeto[random_int(0, strlen($alfabeto) - 1)];
        }

        try {
            $consulta->execute([
                'codigo' => $codigo,
                'token_hash' => $tokenHash,
            ]);
        } catch (PDOException $error) {
            if ((int) ($error->errorInfo[1] ?? 0) === 1062) {
                continue;
            }

            throw $error;
        }

        $sesionId = (int) $conexion->lastInsertId();
        asociarAccesoSync($conexion, $sesionId, 'emisor');
        $conexion->commit();
        responder(201, [
            'sesion_id' => $sesionId,
            'codigo' => $codigo,
            'token_emisor' => $tokenEmisor,
            'estado' => 'esperando',
        ]);
    }

    responder(503, [
        'error' => 'No se pudo generar un código. Intenta nuevamente.',
    ]);
} catch (Throwable $error) {
    if (isset($conexion) && $conexion->inTransaction()) $conexion->rollBack();
    error_log((string) $error);

    responder(500, [
        'error' => 'No se pudo crear la sesión.',
    ]);
}