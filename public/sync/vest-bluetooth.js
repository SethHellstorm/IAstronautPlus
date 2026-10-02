const ChalecoBluetooth = (() => {
    const SERVICIO = '7c1f4d8a-9f70-4f5e-9d1a-2d5fbf2f2a01';
    const COMANDOS = '7c1f4d8a-9f70-4f5e-9d1a-2d5fbf2f2a02';
    const ESTADO = '7c1f4d8a-9f70-4f5e-9d1a-2d5fbf2f2a03';

    const probar = document.getElementById('probarChaleco');
    const respuesta = document.getElementById('respuestaChaleco');

    let caracteristicaComandos = null;
    let caracteristicaEstado = null;
    let esperandoPong = false;
    let tiempoPong = null;

    const conectar = document.getElementById('conectarChaleco');
    const desconectar = document.getElementById('desconectarChaleco');
    const estado = document.getElementById('estadoChaleco');

    let dispositivo = null;
    let autorizado = false;
    let ocupado = false;

    function actualizarBotones() {
        conectar.disabled =
            !autorizado || ocupado || Boolean(dispositivo?.gatt?.connected);

        desconectar.disabled =
            !autorizado || ocupado || !dispositivo?.gatt?.connected;
        probar.disabled =
            !autorizado ||
            ocupado ||
            esperandoPong ||
            !dispositivo?.gatt?.connected ||
            !caracteristicaComandos ||
            !caracteristicaEstado;
    }

    function habilitar() {
        autorizado = !ControlAcceso.terminado;

        if (!window.isSecureContext || !navigator.bluetooth) {
            autorizado = false;
            estado.textContent =
                'Web Bluetooth no está disponible en este navegador o dirección.';
        } else {
            estado.textContent = 'Listo para conectar el ESP32.';
        }

        actualizarBotones();
    }
    function limpiarComunicacion() {
        clearTimeout(tiempoPong);
        tiempoPong = null;
        esperandoPong = false;

        caracteristicaEstado?.removeEventListener(
            'characteristicvaluechanged',
            recibirEstado
        );

        caracteristicaComandos = null;
        caracteristicaEstado = null;
        actualizarBotones();
    }

    function recibirEstado(evento) {
        if (!autorizado || ControlAcceso.terminado) return;

        const mensaje = new TextDecoder().decode(evento.target.value).trim();
        respuesta.textContent = 'ESP32: ' + mensaje;

        if (mensaje === 'pong' && esperandoPong) {
            clearTimeout(tiempoPong);
            tiempoPong = null;
            esperandoPong = false;
            estado.textContent = 'Comunicación confirmada: ping → pong.';
            actualizarBotones();
        }
    }

    function desconectarDispositivo() {
        limpiarComunicacion();
        dispositivo?.gatt?.disconnect();
        estado.textContent = 'ESP32 desconectado.';
        actualizarBotones();
    }

    conectar.addEventListener('click', async () => {
        if (!autorizado || ControlAcceso.terminado || ocupado) return;

        ocupado = true;
        actualizarBotones();
        estado.textContent = 'Selecciona ChalecoVR-Simulador…';

        try {
            dispositivo = await navigator.bluetooth.requestDevice({
                filters: [{ services: [SERVICIO] }]
            });

            if (!autorizado || ControlAcceso.terminado) return;

            dispositivo.addEventListener(
                'gattserverdisconnected',
                () => {
                    estado.textContent = 'Se desconectó el ESP32.';
                    actualizarBotones();
                }
            );

            estado.textContent = 'Conectando…';

            const servidor = await dispositivo.gatt.connect();

            if (!autorizado || ControlAcceso.terminado) {
                desconectarDispositivo();
                return;
            }

            const servicio = await servidor.getPrimaryService(SERVICIO);

            caracteristicaComandos = await servicio.getCharacteristic(COMANDOS);
            caracteristicaEstado = await servicio.getCharacteristic(ESTADO);

            caracteristicaEstado.addEventListener(
                'characteristicvaluechanged',
                recibirEstado
            );

            await caracteristicaEstado.startNotifications();

            if (!autorizado || ControlAcceso.terminado) {
                desconectarDispositivo();
                return;
            }

            estado.textContent =
                'Conectado a ' + dispositivo.name + '. Servicio encontrado.';
        } catch (error) {
            limpiarComunicacion();
            dispositivo?.gatt?.disconnect();

            estado.textContent = error.name === 'NotFoundError'
                ? 'No se seleccionó un dispositivo.'
                : 'No se pudo conectar: ' + error.message;
        } finally {
            ocupado = false;
            actualizarBotones();
        }
    });

    desconectar.addEventListener('click', desconectarDispositivo);

    function detener() {
        autorizado = false;
        desconectarDispositivo();
    }

    window.addEventListener('sync:acceso-terminado', detener);
    window.addEventListener('pagehide', detener);
    probar.addEventListener('click', async () => {
        if (
            !autorizado ||
            ControlAcceso.terminado ||
            esperandoPong ||
            !dispositivo?.gatt?.connected ||
            !caracteristicaComandos ||
            !caracteristicaEstado
        ) {
            return;
        }

        esperandoPong = true;
        ocupado = true;
        actualizarBotones();

        respuesta.textContent = '';
        estado.textContent = 'Enviando ping…';

        // Se inicia antes del envío para poder recibir una respuesta inmediata.
        tiempoPong = setTimeout(() => {
            if (!esperandoPong) return;

            esperandoPong = false;
            estado.textContent =
                'No llegó pong en 3 segundos. Desconecta y vuelve a conectar.';

            // Evita confundir una respuesta tardía con una nueva prueba.
            desconectarDispositivo();
            estado.textContent =
                'Prueba agotada: no llegó pong. Vuelve a conectar el ESP32.';
        }, 3000);

        try {
            const datos = new TextEncoder().encode(
                JSON.stringify({ type: 'ping' })
            );

            await caracteristicaComandos.writeValueWithResponse(datos);

            if (
                esperandoPong &&
                autorizado &&
                !ControlAcceso.terminado
            ) {
                estado.textContent = 'Ping enviado. Esperando pong…';
            }
        } catch (error) {
            desconectarDispositivo();

            if (autorizado && !ControlAcceso.terminado) {
                estado.textContent = 'Falló la prueba: ' + error.message;
            }
        } finally {
            ocupado = false;
            actualizarBotones();
        }
    });

    return { habilitar };
})();