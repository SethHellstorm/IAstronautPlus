# Sincronización de sesiones (prototipo local)

## Estructura
- `public/api/sync/`: los seis endpoints HTTP.
- `public/sync/emisor.html` y `receptor.html`: páginas de prueba.
- `app/sync/conexion.php`: PDO y configuración privada.
- `app/sync/funciones.php`: cabeceras y respuesta JSON compartidas.
- `database/migrations/001_crear_sincronizacion.sql`: tablas sin datos.

## Configuración
PHP 8.1+ con PDO MySQL (probado con PHP 8.5) y MySQL 8.0.
El cargador phpdotenv ya se encuentra en `public/assets/vendor`.
Si falta, instalar las dependencias con Composer desde `public/assets`.

Copiar `.env.example` a `.env` únicamente en una instalación nueva.
En instalaciones existentes, añadir DB_HOST, DB_PORT, DB_DATABASE,
DB_USERNAME y DB_PASSWORD sin reemplazar OPENAI_API_KEY.
Las variables del entorno tienen prioridad sobre el archivo .env.
No versionar credenciales. .env dejó de estar rastreado; esto no borra
versiones históricas. Si hubo secretos publicados, deben rotarse.

La integración conserva la base existente. Para una base nueva, crearla
primero y ejecutar la migración seleccionando esa base en Workbench.
CREATE TABLE IF NOT EXISTS no actualiza tablas que ya existan.

## Ejecutar desde PowerShell
Detener con Ctrl+C el servidor anterior de Testings y ejecutar:

```powershell
& 'C:\php\php.exe' -d display_errors=0 -d log_errors=1 -S 127.0.0.1:8080 -t 'C:\Users\Caoz0\Documents\ProyectoEstadias\IAstronautPlus\public'
```

- Emisor: http://127.0.0.1:8080/sync/emisor.html
- Receptor: http://127.0.0.1:8080/sync/receptor.html
- Experiencia existente: http://127.0.0.1:8080/

Servir siempre `public`, no la raíz del repositorio. El servidor integrado
puede devolver index.php ante rutas inexistentes; eso no publica los archivos
privados que están fuera de public. En Apache, conservar Authorization para
los endpoints Bearer.

## Flujo
Crear sesión, introducir código en receptor, enviar un evento, comprobar su
aparición y confirmado_en en MySQL. Las URLs relativas funcionan también bajo
un prefijo de despliegue. Las credenciales de sesión usan sessionStorage.
El código dura 10 minutos, la sesión 2 horas y los eventos 60 segundos.
Las páginas consultan cada 2 segundos después de completar la petición anterior.

## Alcance pendiente
No hay integración con eventos de la escena VR ni con ESP32/Bluetooth.
No hay límite de intentos de creación/vinculación: mantener en localhost hasta
implementar ese control antes del túnel público. Los pendientes de confirmación,
claves de envío y lista visual siguen en memoria y se pierden al recargar.
La confirmación significa mostrar el evento, no ejecutarlo en el chaleco.

Los scripts educativos de terminal permanecen en Testings/privado y su
conexion.php remite a la configuración nueva. Los archivos web se trasladaron.


## Autorización y cierre de sincronización

Aplicar `database/migrations/003_accesos_sincronizacion.sql` después de las
migraciones anteriores. El acceso con contraseña se registra en `sync_accesos`
y se asocia a cada rol mediante `sync_acceso_sesiones`.

- Emisor y receptor comprueban el acceso antes de recuperar datos y cada dos segundos.
- Sin autorización, se limpian las claves `iastronaut_sync_` de sessionStorage y
  se abre `acceso.html`. Tras autenticar, siempre se elige una función.
- Cerrar sesión revoca el acceso en MySQL y cierra sus vinculaciones. También
  revoca el acceso del otro extremo de esas vinculaciones. Si ese acceso tiene
  otras vinculaciones, el cierre se propaga a ellas.
- Vencimiento, cambio de contraseña y sincronización cerrada requieren autenticación
  y vinculación nuevas. Los tokens anteriores no se aceptan con otro acceso.
- El servidor comprueba vencimientos antes de cada operación. No requiere un cron:
  las filas se marcan al atender la siguiente petición y no se permite continuar
  con una autorización vencida. Un navegador suspendido lo detecta al reanudar.
- Las sesiones anteriores a la migración, sin asociación de acceso, se cierran al
  siguiente control. Es necesario ingresar de nuevo y crear una vinculación nueva.
- Una falla de red o del servidor no borra por sí sola los pendientes. El cierre
  manual solo se presenta como confirmado después de la respuesta del servidor.

Las operaciones de autorización y sync se serializan con un bloqueo MySQL breve
por base de datos para impedir carreras entre cierre y envío/vinculación. Se
libera al terminar la petición; el tiempo máximo de espera es cinco segundos.
Para una carga alta convendrá sustituirlo por bloqueos por autorización/sesión.

La revocación evita nuevas operaciones; no revierte un evento ya procesado.
Los eventos pendientes de sesiones cerradas permanecen como historial en MySQL,
pero ya no se entregan. Cerrar el acceso no elimina otras claves del navegador.
