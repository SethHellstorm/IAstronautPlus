$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$php = 'C:\php\php.exe'
$tunnel = Join-Path $projectRoot '.tools\cloudflared.exe'
if (!(Test-Path -LiteralPath $tunnel)) { throw 'Falta .tools/cloudflared.exe (cliente oficial de Cloudflare).' }
if (Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue) { throw 'El puerto 8081 ya esta ocupado. Deten la prueba HTTPS anterior.' }
$server = Start-Process -FilePath $php -WorkingDirectory $projectRoot -ArgumentList @('-d','display_errors=0','-d','log_errors=1','-S','127.0.0.1:8081','-t','public','scripts/router-https.php') -WindowStyle Hidden -PassThru
try {
    Start-Sleep -Seconds 1
    if ($server.HasExited) { throw 'No se pudo iniciar PHP.' }
    Write-Host 'Abre la URL HTTPS que aparece abajo, agregando /sync/acceso.html. Ctrl+C detiene la prueba.'
    & $tunnel tunnel --url http://127.0.0.1:8081 --no-autoupdate
} finally {
    if (!$server.HasExited) { Stop-Process -Id $server.Id }
}
