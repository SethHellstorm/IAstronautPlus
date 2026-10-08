<?php
// Ejecutar por CLI. Todas las escrituras se revierten en finally.
declare(strict_types=1);
require_once dirname(__DIR__) . '/app/sync/acceso.php';
if (PHP_SAPI !== 'cli') { exit(1); }
$pdo = conexionAccesoSync();
$version = versionPasswordSync();
function check(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
    echo "OK: $message\n";
}
function accesoPrueba(PDO $pdo, string $version): string {
    $id = bin2hex(random_bytes(32));
    $q = $pdo->prepare('INSERT INTO sync_accesos(id,version_password,expira_en) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR))');
    $q->execute([$id,$version]);
    return $id;
}
function sesionPrueba(PDO $pdo, string $emisor, ?string $receptor = null): int {
    $q = $pdo->prepare("INSERT INTO sesiones(codigo,token_emisor_hash,estado,codigo_expira_en,expira_en)
        VALUES(?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 10 MINUTE),DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR))");
    $q->execute([strtoupper(bin2hex(random_bytes(3))),bin2hex(random_bytes(32)),$receptor ? 'vinculada' : 'esperando']);
    $id = (int) $pdo->lastInsertId();
    $q = $pdo->prepare('INSERT INTO sync_acceso_sesiones(acceso_id,sesion_id,rol) VALUES(?,?,?)');
    $q->execute([$emisor,$id,'emisor']);
    if ($receptor) $q->execute([$receptor,$id,'receptor']);
    return $id;
}
function revocado(PDO $pdo, string $id): bool {
    $q=$pdo->prepare('SELECT revocado FROM sync_accesos WHERE id=?');$q->execute([$id]);return (bool)$q->fetchColumn();
}
function estado(PDO $pdo, int $id): string {
    $q=$pdo->prepare('SELECT estado FROM sesiones WHERE id=?');$q->execute([$id]);return (string)$q->fetchColumn();
}
$pdo->beginTransaction();
try {
    $a=accesoPrueba($pdo,$version);$b=accesoPrueba($pdo,$version);
    $c=accesoPrueba($pdo,$version);$d=accesoPrueba($pdo,$version);
    $espera=sesionPrueba($pdo,$a);$activa=sesionPrueba($pdo,$a,$b);
    $otra=sesionPrueba($pdo,$c,$d);
    $pdo->exec("UPDATE sesiones SET codigo_expira_en=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE id=$espera");
    invalidarAccesosSync($pdo,$version);
    check(estado($pdo,$espera)==='cerrada' && !revocado($pdo,$a) && estado($pdo,$activa)==='vinculada','codigo vencido cierra solo esa vinculacion');
    // Las asociaciones historicas no propagan revocaciones.
    $historica=sesionPrueba($pdo,$b,$c);$pdo->exec("UPDATE sesiones SET estado='cerrada' WHERE id=$historica");
    $q=$pdo->prepare('UPDATE sync_accesos SET revocado=1 WHERE id=?');$q->execute([$a]);
    invalidarAccesosSync($pdo,$version);
    check(revocado($pdo,$b) && estado($pdo,$activa)==='cerrada','revocacion cierra el par activo');
    check(!revocado($pdo,$c) && !revocado($pdo,$d) && estado($pdo,$otra)==='vinculada','historial cerrado no revoca otras vinculaciones');
    $pdo->exec("UPDATE sesiones SET expira_en=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE id=$otra");
    invalidarAccesosSync($pdo,$version);
    check(estado($pdo,$otra)==='cerrada' && !revocado($pdo,$c),'caducidad de sincronizacion conserva autorizacion vigente');
    $e=accesoPrueba($pdo,$version);$f=accesoPrueba($pdo,$version);$expirada=sesionPrueba($pdo,$e,$f);
    $q=$pdo->prepare('UPDATE sync_accesos SET expira_en=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE id=?');$q->execute([$e]);
    invalidarAccesosSync($pdo,$version);
    check(revocado($pdo,$e) && revocado($pdo,$f) && estado($pdo,$expirada)==='cerrada','autorizacion vencida invalida ambos extremos activos');
    $g=accesoPrueba($pdo,$version);$h=accesoPrueba($pdo,$version);
    $cambio=sesionPrueba($pdo,$g,$h);
    cambiarFuncionAccesoSync($pdo,$g);
    check(!revocado($pdo,$g) && revocado($pdo,$h) && estado($pdo,$cambio)==='cerrada',
        'cambiar funcion conserva acceso propio y cierra el par');
    cambiarFuncionAccesoSync($pdo,$g);
    check(!revocado($pdo,$g),'reintentar cambio no revoca acceso propio');
    $compartido=accesoPrueba($pdo,$version);
    $mismaSesion=sesionPrueba($pdo,$compartido,$compartido);
    cambiarFuncionAccesoSync($pdo,$compartido);
    check(!revocado($pdo,$compartido) && estado($pdo,$mismaSesion)==='cerrada',
        'dos roles del mismo acceso vuelven a seleccion sin perder autorizacion');
    $ttl=$pdo->prepare('SELECT TIMESTAMPDIFF(SECOND,UTC_TIMESTAMP(),DATE_ADD(UTC_TIMESTAMP(),INTERVAL :vigencia SECOND))');
    $ttl->execute(['vigencia'=>5]);
    check((int)$ttl->fetchColumn()===5,'vigencia corta parametrizada de eventos hapticos');
    $ms=$pdo->query('SELECT TIMESTAMPDIFF(MICROSECOND,UTC_TIMESTAMP(6),DATE_ADD(UTC_TIMESTAMP(),INTERVAL 60 SECOND)) DIV 1000')->fetchColumn();
    check((int)$ms>58000 && (int)$ms<=60000,'vigencia relativa compatible con MySQL');
} finally {
    $pdo->rollBack();
}
echo "Pruebas terminadas; escrituras revertidas.\n";
