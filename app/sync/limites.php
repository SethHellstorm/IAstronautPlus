<?php
declare(strict_types=1);

function consumirLimiteSync(
    PDO $conexion,
    string $operacion,
    string $identidad,
    int $limite = 10,
    int $ventanaSegundos = 300
): array {
    if ($limite < 1 || $ventanaSegundos < 1) {
        throw new InvalidArgumentException('El límite y la ventana deben ser positivos.');
    }

    $clave = hash('sha256', $operacion . '|' . $identidad);

    $conexion->beginTransaction();

    try {
        // Crea el contador si no existe. Si existe, conserva su valor.
        $crear = $conexion->prepare(
            "INSERT INTO limites_solicitudes (
                clave, intentos, ventana_iniciada_en
            ) VALUES (
                :clave, 0, UTC_TIMESTAMP()
            )
            ON DUPLICATE KEY UPDATE clave = VALUES(clave)"
        );

        $crear->execute(['clave' => $clave]);

        // Bloquea esta fila hasta que finalice la transacción.
        $consultar = $conexion->prepare(
            "SELECT
                intentos,
                TIMESTAMPDIFF(
                    SECOND,
                    ventana_iniciada_en,
                    UTC_TIMESTAMP()
                ) AS transcurridos
             FROM limites_solicitudes
             WHERE clave = :clave
             FOR UPDATE"
        );

        $consultar->execute(['clave' => $clave]);
        $contador = $consultar->fetch();

        $intentos = (int) $contador['intentos'];
        $transcurridos = max(0, (int) $contador['transcurridos']);

        if ($transcurridos >= $ventanaSegundos) {
            $reiniciar = $conexion->prepare(
                "UPDATE limites_solicitudes
                 SET intentos = 0,
                     ventana_iniciada_en = UTC_TIMESTAMP()
                 WHERE clave = :clave"
            );

            $reiniciar->execute(['clave' => $clave]);

            $intentos = 0;
            $transcurridos = 0;
        }

        $permitido = $intentos < $limite;

        if ($permitido) {
            $incrementar = $conexion->prepare(
                "UPDATE limites_solicitudes
                 SET intentos = intentos + 1
                 WHERE clave = :clave"
            );

            $incrementar->execute(['clave' => $clave]);
            $intentos++;
        }

        $conexion->commit();

        return [
            'permitido' => $permitido,
            'restantes' => max(0, $limite - $intentos),
            'reintentar_en' => $permitido
                ? 0
                : max(1, $ventanaSegundos - $transcurridos),
        ];
    } catch (Throwable $error) {
        if ($conexion->inTransaction()) {
            $conexion->rollBack();
        }

        throw $error;
    }
}