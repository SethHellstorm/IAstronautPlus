# Sincronización de sesiones (prototipo local)

## Estructura
- `public/api/sync/`: endpoints HTTP de acceso, vinculación y eventos.
- `public/sync/emisor.html` y `receptor.html`: páginas de prueba.
- `app/sync/conexión.php`: PDO y configuración privada.
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

## Entrega al ESP32 simulador

El receptor conecta por Web Bluetooth. Un evento `prueba` envía una vibración
simulada de 200 ms. La API se confirma solo después de completar la escritura
Bluetooth y recibir `vibration:on,ch=all,dur=200`. Esto confirma la respuesta
del simulador, no una vibración física de un chaleco real.

Las confirmaciones HTTP pendientes se guardan en sessionStorage y se procesan
antes de consultar eventos nuevos y después de cada aceptación Bluetooth.
Un fallo HTTP no vuelve a enviar el comando al ESP32. Antes de intentar Bluetooth
se guarda una marca de envío incierto. Si falta la respuesta, se interrumpe la
conexión o se recarga durante el envío, ese evento no se repite automáticamente
ni se confirma al servidor. Su identificador aparece en el receptor. Si se sabe
que no se intentó escribir (sin conexión o Bluetooth ocupado), puede reintentarse.

Esta proteccion depende de conservar sessionStorage en la misma pestaña. No es
una garantía de ejecución exactamente una vez: el firmware actual no recibe IDs
de eventos ni permite consultar si un comando ya se ejecutó. Los eventos inciertos
se dejan expirar; una nueva prueba debe generarse expresamente desde el emisor.
La vigencia recibida en milisegundos la calcula MySQL y se descuenta con el reloj
monotónico del navegador, sin depender de la fecha configurada en la PC.

Al cerrar el acceso o cambiar de función, primero se detiene la actividad local.
Se intenta `allOff` y se desconecta sin esperar mas de 500 ms. No se garantiza que
`allOff` llegue si la conexión falla o hay una escritura pendiente. Al abandonar
la página se desconecta directamente: el navegador no garantiza completar envios
asíncronos durante su cierre. El firmware debe conservar sus propios mecanismos
de apagado y límite de duración.

Los eventos de las misiones se conectan al simulador mediante el enlace del emisor.
Falta probar el chaleco físico; no se accionan motores ni temperatura real.

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
- Vencer la autorización o cambiar la contraseña requiere autenticarse otra vez.
  Vencer el código o la sesión de sincronización cierra esa vinculacion, pero
  conserva una autorización que siga vigente. Los historiales ya cerrados no
  propagan revocaciones a otras vinculaciones.
- Cambiar función conserva el acceso propio y termina sus vinculaciones. El par
  activo pierde su autorización, siguiendo el comportamiento de cierre del par.
  Los tokens anteriores no se aceptan con otro acceso.
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

## Pruebas de regresión

Desde la raíz del proyecto:

```powershell
node --test tests/sync-regression.cjs
& 'C:\php\php.exe' tests/sync-access.php
```

Las pruebas JavaScript simulan HTTP, almacenamiento y Bluetooth; no usan hardware.
Las de PHP usan la base configurada, toman el bloqueo de sincronización y revierten
sus escrituras en una transacción. Requieren las migraciones 001 a 003 y MySQL activo.
Los contadores AUTO_INCREMENT pueden avanzar aunque se reviertan las filas.

## Efectos temporizados de misiones (simulador)

- Interaccion aceptada: 200 ms de vibracion simulada.
- Mision completada: pulso 150 ms, pausa 150 ms y pulso 150 ms (450 ms total).
- Entrada al Sol: calor simulado durante un maximo de 3000 ms.
- Entrada a Neptuno: frio simulado durante un maximo de 3000 ms.
- Salida del destino: apagar. Un nuevo efecto sustituye al anterior, no se acumulan.

Los limites estan en `public/sync/efectos.json`; el servidor fija el tiempo y el
receptor lo valida. El sketch del simulador acepta solamente esos valores exactos.
Cambiar perfiles requiere actualizar y cargar tambien el sketch. Los eventos de
mision caducan en 5 segundos en el servidor; los de prueba conservan 60 segundos.
La consulta del receptor cada 2 segundos implica latencia: el apagado remoto no es
instantaneo. El temporizador local del ESP32 no depende del navegador ni de la red.
No se garantiza entrega de un evento en caso de perdida de conexion; no se repite
una sensacion antigua al reconectar. Los eventos termicos se generan una vez por
entrada efectiva a la escena, no en cada actualizacion del contador.

Para probar:
1. Abrir `firmware/ChalecoSimulador/ChalecoSimulador.ino` en Arduino IDE y cargarlo
   en el ESP32-WROVER. Este sketch no configura salidas fisicas.
2. Vincular emisor y receptor y conectar el ESP32 desde el receptor en Chrome.
3. En el emisor, usar **Iniciar misiones con el simulador conectado**, en la misma
   pestana. La experiencia sin `?sync=1` sigue funcionando sin efectos remotos.
4. El monitor serie (115200) muestra inicio y apagado del efecto. El apagado por
   tiempo se ejecuta desde `loop()` sin `delay(duration)`.

El protocolo nuevo usa `effect_sim`, deliberadamente distinto de los comandos
termicos reales. El simulador anterior necesita actualizarse para reconocerlo.

## Limpieza automatica cada 24 horas

La migracion `004_limpieza_diaria.sql` crea el evento MySQL
`sync_limpieza_diaria`. Se ejecuta cada dia, con fechas UTC, mientras MySQL y
`event_scheduler` esten activos; no depende de visitas ni del servidor PHP.

Politica:
- Eventos: creados hace al menos 24 horas y ya vencidos, confirmados o no.
- Sesiones: creadas hace al menos 24 horas, vencidas y sin eventos restantes.
  Sus asociaciones se eliminan por ON DELETE CASCADE.
- Accesos: vencidos hace al menos 24 horas y sin asociaciones.
- Limites de solicitudes: ventanas iniciadas hace al menos 24 horas. Las ventanas
  usadas actualmente son de 300 segundos; si se amplian, revisar esta politica.

La ejecucion diaria no implica borrar cada fila exactamente al cumplir 24 horas:
puede permanecer hasta la siguiente pasada (aproximadamente 24 a 48 horas).
Las sesiones con eventos recientes se conservan hasta poder eliminar sus hijos.
No borra tablas, credenciales de .env ni reinicia los identificadores AUTO_INCREMENT.
No limpia los mensajes ya dibujados ni el almacenamiento de las pestanas abiertas.

La limpieza usa una transaccion y el mismo bloqueo MySQL que las operaciones de
sincronizacion. Si no obtiene el bloqueo en cinco segundos, omite esa pasada.
Si falla una sentencia, revierte todos los borrados de esa ejecucion.

Instalacion por terminal (solo CLI; requiere privilegio EVENT en la base):

```powershell
& 'C:\php\php.exe' app/sync/instalar-limpieza.php
```

El instalador crea la tarea si falta y realiza una primera limpieza inmediata.
Repetirlo no cambia el horario de una tarea existente. La migracion tambien puede
aplicarse desde Workbench seleccionando la base correcta. MySQL debe estar encendido
para ejecutar la tarea; si estuvo apagado, los registros esperan la siguiente pasada.

Prueba reversible de la politica, con datos artificiales y rollback:

```powershell
& 'C:\php\php.exe' tests/sync-cleanup.php
```

Consultar la programacion y su ultima ejecucion (horas UTC):

```sql
SELECT EVENT_NAME, STATUS, INTERVAL_VALUE, INTERVAL_FIELD, STARTS, LAST_EXECUTED
FROM information_schema.EVENTS
WHERE EVENT_SCHEMA = DATABASE() AND EVENT_NAME = 'sync_limpieza_diaria';
```

## HTTPS temporal para visor

Desde la raiz del proyecto, ejecutar `powershell -ExecutionPolicy Bypass -File scripts/iniciar-https.ps1`.
Requiere el cliente oficial `.tools/cloudflared.exe`. El script inicia PHP en
127.0.0.1:8081 y publica un tunel temporal de Cloudflare. Ctrl+C termina el tunel
y el proceso PHP iniciado por el script. No abrir otro servidor en ese puerto.
La URL impresa cambia entre ejecuciones; agregar `/sync/acceso.html` y usarla
tanto en el visor (emisor) como en Chrome de la computadora (receptor).

El router de este modo reconoce HTTPS del proxy local para cookies Secure,
protege la experiencia y las acciones con el acceso sync y bloquea archivos
ocultos y assets/vendor. No sirve la raiz privada del proyecto. El servidor HTTP
anterior no se modifica. El tunel necesita Internet, MySQL y la computadora
encendidos. Este modo temporal no es un despliegue de produccion.
