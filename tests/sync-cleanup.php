<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit(1);
require dirname(__DIR__) . '/app/sync/acceso.php';
require dirname(__DIR__) . '/app/sync/limpieza.php';
$p = conexionAccesoSync();
function verificar(bool $value, string $message): void {
    if (!$value) throw new RuntimeException($message);
    echo "OK: $message\n";
}
function existe(PDO $p, string $table, mixed $id, string $column='id'): bool {
    $q=$p->prepare("SELECT 1 FROM $table WHERE $column=?");$q->execute([$id]);return (bool)$q->fetchColumn();
}
function acceso(PDO $p, bool $old): string {
    $id=bin2hex(random_bytes(32));
    $date=$old?'DATE_SUB(UTC_TIMESTAMP(),INTERVAL 25 HOUR)':'DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR)';
    $p->prepare("INSERT INTO sync_accesos(id,version_password,expira_en) VALUES(?,?,$date)")->execute([$id,str_repeat('a',64)]);
    return $id;
}
function sesion(PDO $p,string $access,int $age,bool $active=false): int {
    $expiry=$active?'DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR)':'DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 HOUR)';
    $p->prepare("INSERT INTO sesiones(codigo,token_emisor_hash,estado,creada_en,codigo_expira_en,expira_en)
        VALUES(?,?,'vinculada',DATE_SUB(UTC_TIMESTAMP(),INTERVAL $age HOUR),UTC_TIMESTAMP(),$expiry)")
        ->execute([strtoupper(bin2hex(random_bytes(3))),bin2hex(random_bytes(32))]);
    $id=(int)$p->lastInsertId();
    $p->prepare("INSERT INTO sync_acceso_sesiones VALUES(?,?,'emisor')")->execute([$access,$id]);return $id;
}
function evento(PDO $p,int $session,int $age,bool $active=false): int {
    $expiry=$active?'DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR)':'DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 MINUTE)';
    $p->prepare("INSERT INTO eventos(sesion_id,clave_evento,tipo,datos,creado_en,expira_en)
        VALUES(?,?,'prueba','{}',DATE_SUB(UTC_TIMESTAMP(),INTERVAL $age HOUR),$expiry)")->execute([$session,bin2hex(random_bytes(16))]);
    return (int)$p->lastInsertId();
}
$p->beginTransaction();
try {
    $oldAccess=acceso($p,true);$recentAccess=acceso($p,false);$mappedAccess=acceso($p,true);
    $old=sesion($p,$oldAccess,25);$recent=sesion($p,$recentAccess,23);$active=sesion($p,$mappedAccess,25,true);
    $withRecent=sesion($p,$recentAccess,25);
    $oldEvent=evento($p,$old,25);$recentEvent=evento($p,$withRecent,1);$activeEvent=evento($p,$active,25,true);
    $oldLimit=bin2hex(random_bytes(32));$newLimit=bin2hex(random_bytes(32));
    $p->prepare('INSERT INTO limites_solicitudes(clave,intentos,ventana_iniciada_en) VALUES(?,1,DATE_SUB(UTC_TIMESTAMP(),INTERVAL 25 HOUR)),(?,1,UTC_TIMESTAMP())')->execute([$oldLimit,$newLimit]);
    limpiarRegistrosSync($p);
    verificar(!existe($p,'eventos',$oldEvent),'elimina evento vencido con mas de 24 horas');
    verificar(!existe($p,'sesiones',$old),'elimina sesion antigua sin dejar claves foraneas invalidas');
    verificar(!existe($p,'sync_acceso_sesiones',$old,'sesion_id'),'elimina asociaciones por cascada');
    verificar(!existe($p,'sync_accesos',$oldAccess),'elimina acceso vencido hace mas de 24 horas y sin vinculos');
    verificar(existe($p,'sesiones',$recent) && existe($p,'sync_accesos',$recentAccess),'conserva registros recientes');
    verificar(existe($p,'sesiones',$active) && existe($p,'eventos',$activeEvent),'conserva sesiones y eventos todavia vigentes');
    verificar(existe($p,'sync_accesos',$mappedAccess),'conserva acceso referenciado');
    verificar(existe($p,'sesiones',$withRecent) && existe($p,'eventos',$recentEvent),'conserva sesion con evento reciente');
    verificar(!existe($p,'limites_solicitudes',$oldLimit,'clave') && existe($p,'limites_solicitudes',$newLimit,'clave'),'limpia contadores viejos sin reiniciar limite vigente');
} finally { $p->rollBack(); }
echo "Pruebas revertidas; sin borrados permanentes.\n";
