<?php
declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/app/sync/funciones.php';
require_once dirname(__DIR__, 3) . '/app/sync/limites.php';
require_once dirname(__DIR__, 3) . '/app/sync/acceso.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    responder(405, ['error' => 'Utiliza el método POST.']);
}

$contentType = strtolower(trim(
    explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]
));

if ($contentType !== 'application/json') {
    responder(415, ['error' => 'Envía la solicitud como application/json.']);
}

try {
    $conexion = conexionAccesoSync();

    $limite = consumirLimiteSync(
        $conexion,
        'iniciar-sesion',
        (string) ($_SERVER['REMOTE_ADDR'] ?? 'desconocida'),
        10,
        300
    );

    if (!$limite['permitido']) {
        header('Retry-After: ' . $limite['reintentar_en']);

        responder(429, [
            'error' => 'Demasiados intentos. Espera antes de volver a intentar.',
            'reintentar_en' => $limite['reintentar_en'],
        ]);
    }

    // Limitamos también el tamaño del cuerpo que leemos.
    $cuerpo = file_get_contents('php://input', false, null, 0, 4097);

    if ($cuerpo === false || strlen($cuerpo) > 4096) {
        responder(413, ['error' => 'La solicitud es demasiado grande.']);
    }

    try {
        $datos = json_decode($cuerpo, true, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        responder(400, ['error' => 'JSON inválido.']);
    }

    $password = is_array($datos) ? ($datos['password'] ?? null) : null;

    if (
        !is_string($password) ||
        $password === '' ||
        strlen($password) > 1024
    ) {
        responder(400, ['error' => 'Introduce una contraseña válida.']);
    }

    // conexion.php ya cargó las variables de .env.
    $hash = $_ENV['SYNC_PASSWORD_HASH']
        ?? $_SERVER['SYNC_PASSWORD_HASH']
        ?? getenv('SYNC_PASSWORD_HASH');

    if (
        !is_string($hash) ||
        empty(password_get_info($hash)['algo'])
    ) {
        throw new RuntimeException('Falta configurar un hash de acceso válido.');
    }

    if (!password_verify($password, $hash)) {
        responder(401, ['error' => 'Contraseña incorrecta.']);
    }

    cerrarAccesoSync($conexion);
    iniciarSesionAccesoSync();

    // Cambiamos el identificador después de autenticar al usuario.
    if (!session_regenerate_id(true)) {
        throw new RuntimeException('No se pudo renovar la sesión.');
    }

    $accesoId = bin2hex(random_bytes(32));
    $registro = $conexion->prepare('INSERT INTO sync_accesos (id, version_password, expira_en) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 2 HOUR))');
    $registro->execute([$accesoId, hash('sha256', $hash)]);

    $_SESSION['sync_acceso'] = [
        'id' => $accesoId,
        'expira_en' => time() + 7200,
        'version_password' => hash('sha256', $hash),
    ];

    session_write_close();

    responder(200, [
        'autorizado' => true,
        'duracion_segundos' => 7200,
    ]);
} catch (Throwable $error) {
    // Registramos solo el mensaje, sin argumentos ni contraseña.
    error_log('Inicio de sesión sync: ' . $error->getMessage());

    responder(500, ['error' => 'No se pudo iniciar sesión.']);
}