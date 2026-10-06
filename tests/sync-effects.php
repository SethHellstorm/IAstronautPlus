<?php
declare(strict_types=1);
require dirname(__DIR__) . '/app/sync/efectos.php';
foreach (['interaccion'=>200,'mision_completa'=>450,'calor_sol'=>3000,'frio_neptuno'=>3000,'apagar'=>0] as $effect=>$duration) {
    $scene=$effect==='calor_sol'?'sun':($effect==='frio_neptuno'?'neptune':'earth');
    if (efectoSync($effect,$scene)['duration']!==$duration) throw new RuntimeException('Duracion incorrecta');
}
foreach ([['calor_sol','earth'],['frio_neptuno','sun'],['desconocido','earth'],[null,'earth']] as [$effect,$scene]) {
    try { efectoSync($effect,$scene); throw new RuntimeException('Acepto efecto invalido'); }
    catch (InvalidArgumentException $e) {}
}
echo "OK: perfiles temporales y restricciones de destino\n";
