<?php
declare(strict_types=1);

function iniciarSesionAccesoSync(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');

    session_name('IASTRONAUT_SYNC_ACCESS');

    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => (
            isset($_SERVER['HTTPS']) &&
            $_SERVER['HTTPS'] !== 'off'
        ),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);

    if (!session_start()) {
        throw new RuntimeException('No se pudo iniciar la sesión de acceso.');
    }
}
// El bloqueo breve serializa las operaciones de sync, incluido cierre contra envío.
// Se libera al terminar la petición incluso si responder() llama exit.
function conexionAccesoSync(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $pdo = require __DIR__ . '/conexion.php';
    $nombre = hash('sha256', 'sync_' . (string) $pdo->query('SELECT DATABASE()')->fetchColumn());
    $lock = $pdo->prepare('SELECT GET_LOCK(?, 5)');
    $lock->execute([$nombre]);
    if ((int) $lock->fetchColumn() !== 1) throw new RuntimeException('Sincronización ocupada.');
    register_shutdown_function(static function () use ($pdo, $nombre): void {
        $q = $pdo->prepare('SELECT RELEASE_LOCK(?)');
        $q->execute([$nombre]);
    });
    return $pdo;
}

function invalidarAccesosSync(PDO $pdo, string $version): void
{
    // Propaga el cierre a los dos extremos y a sus otras vinculaciones.
    do {
        $q = $pdo->prepare("UPDATE sync_accesos SET revocado = 1
            WHERE revocado = 0 AND (expira_en <= UTC_TIMESTAMP() OR version_password <> ?)");
        $q->execute([$version]);
        $cerradas = $pdo->exec("UPDATE sesiones s
            LEFT JOIN sync_acceso_sesiones m ON m.sesion_id = s.id AND m.rol = 'emisor'
            LEFT JOIN sync_accesos a ON a.id = m.acceso_id
            SET s.estado = 'cerrada'
            WHERE s.estado <> 'cerrada' AND (a.id IS NULL OR a.revocado = 1
                OR s.expira_en <= UTC_TIMESTAMP()
                OR (s.estado = 'esperando' AND s.codigo_expira_en <= UTC_TIMESTAMP()))");
        $cerradas += $pdo->exec("UPDATE sesiones s
            JOIN sync_acceso_sesiones m ON m.sesion_id = s.id
            JOIN sync_accesos a ON a.id = m.acceso_id
            SET s.estado = 'cerrada' WHERE s.estado <> 'cerrada' AND a.revocado = 1");
        $revocadas = $pdo->exec("UPDATE sync_accesos a
            JOIN sync_acceso_sesiones m ON m.acceso_id = a.id
            JOIN sesiones s ON s.id = m.sesion_id
            SET a.revocado = 1 WHERE a.revocado = 0 AND s.estado = 'cerrada'");
    } while ($cerradas > 0 || $revocadas > 0);
}

function versionPasswordSync(): string
{
    $hash = $_ENV['SYNC_PASSWORD_HASH'] ?? $_SERVER['SYNC_PASSWORD_HASH'] ?? getenv('SYNC_PASSWORD_HASH');
    if (!is_string($hash) || empty(password_get_info($hash)['algo'])) {
        throw new RuntimeException('Falta configurar el acceso.');
    }
    return hash('sha256', $hash);
}

function cerrarAccesoSync(PDO $pdo): void
{
    iniciarSesionAccesoSync();
    $id = $_SESSION['sync_acceso']['id'] ?? '';
    $q = $pdo->prepare('UPDATE sync_accesos SET revocado = 1 WHERE id = ?');
    $q->execute([$id]);
    invalidarAccesosSync($pdo, versionPasswordSync());
    unset($_SESSION['sync_acceso']);
    session_write_close();
}

function asociarAccesoSync(PDO $pdo, int $sesionId, string $rol): void
{
    $q = $pdo->prepare('INSERT INTO sync_acceso_sesiones (acceso_id, sesion_id, rol) VALUES (?, ?, ?)');
    $q->execute([$GLOBALS['sync_acceso_id'], $sesionId, $rol]);
}

function exigirAccesoSync(): void
{
    try {
        $pdo = conexionAccesoSync();
        invalidarAccesosSync($pdo, versionPasswordSync());
        iniciarSesionAccesoSync();
        $id = $_SESSION['sync_acceso']['id'] ?? '';
        $q = $pdo->prepare('SELECT id FROM sync_accesos WHERE id = ? AND revocado = 0 AND expira_en > UTC_TIMESTAMP()');
        $q->execute([$id]);
        $valido = (bool) $q->fetchColumn();
        if (!$valido) unset($_SESSION['sync_acceso']);
        session_write_close();
        if (!$valido) responder(401, ['error' => 'Debes ingresar la contraseña.', 'codigo' => 'ACCESO_REQUERIDO']);
        $GLOBALS['sync_acceso_id'] = $id;
        // Un token antiguo no puede reutilizarse con otra autorización.
        $bearer = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (preg_match('/^Bearer ([a-f0-9]{64})$/', $bearer, $m)) {
            $token = hash('sha256', $m[1]);
            $q = $pdo->prepare("SELECT s.id FROM sesiones s JOIN sync_acceso_sesiones m ON m.sesion_id = s.id
                WHERE m.acceso_id = ? AND s.estado <> 'cerrada' AND
                ((m.rol = 'emisor' AND s.token_emisor_hash = ?) OR (m.rol = 'receptor' AND s.token_receptor_hash = ?))");
            $q->execute([$id, $token, $token]);
            if (!$q->fetchColumn()) {
                responder(409, [
                    'error' => 'La vinculación ya no está disponible.',
                    'codigo' => 'SINCRONIZACION_TERMINADA'
                ]);
            }
        }
    } catch (Throwable $e) {
        error_log('Acceso sync: ' . $e->getMessage());
        responder(503, ['error' => 'No se pudo comprobar el acceso. Intenta nuevamente.']);
    }
}
