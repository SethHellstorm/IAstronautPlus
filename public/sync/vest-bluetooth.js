const ChalecoBluetooth = (() => {
    const SERVICIO = '7c1f4d8a-9f70-4f5e-9d1a-2d5fbf2f2a01';
    const COMANDOS = '7c1f4d8a-9f70-4f5e-9d1a-2d5fbf2f2a02';
    const ESTADO = '7c1f4d8a-9f70-4f5e-9d1a-2d5fbf2f2a03';

    const probar = document.getElementById('probarChaleco');
    const respuesta = document.getElementById('respuestaChaleco');

    let caracteristicaComandos = null;
    let caracteristicaEstado = null;

    const conectar = document.getElementById('conectarChaleco');
    const desconectar = document.getElementById('desconectarChaleco');
    const estado = document.getElementById('estadoChaleco');

    let dispositivo = null;
    let autorizado = false;
    let ocupado = false;
    let deteniendo = false;
    let apagado = null;

    function actualizarBotones() {
        conectar.disabled =
            !autorizado || ocupado || Boolean(dispositivo?.gatt?.connected);

        desconectar.disabled =
            !autorizado || ocupado || !dispositivo?.gatt?.connected;
        probar.disabled =
            !autorizado ||
            ocupado ||
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

        const mensaje = new TextDecoder()
            .decode(evento.target.value)
            .trim();

        respuesta.textContent = 'ESP32: ' + mensaje;
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
            dispositivo?.removeEventListener('gattserverdisconnected', alDesconectar);
            dispositivo = await navigator.bluetooth.requestDevice({
                filters: [{ services: [SERVICIO] }]
            });

            if (!autorizado || ControlAcceso.terminado) return;

            dispositivo.addEventListener('gattserverdisconnected', alDesconectar);

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

    function alDesconectar(evento) {
        if (evento.target !== dispositivo) return;
        limpiarComunicacion();
        estado.textContent = 'Se desconectó el ESP32.';
        actualizarBotones();
    }

    function detener(evento) {
        autorizado = false;
        deteniendo = true;
        actualizarBotones();
        if (!apagado) {
            const comandos = caracteristicaComandos;
            apagado = new Promise(resolve => {
                let finalizado = false;
                const fin = () => {
                    if (finalizado) return;
                    finalizado = true;
                    clearTimeout(limite);
                    desconectarDispositivo();
                    resolve();
                };
                const limite = setTimeout(fin, 500);
                if (!comandos || !dispositivo?.gatt?.connected) { fin(); return; }
                try {
                    // Mejor esfuerzo: la desconexion siempre ocurre, aun sin respuesta.
                    Promise.resolve(comandos.writeValueWithResponse(
                        new TextEncoder().encode(JSON.stringify({type: 'allOff'}))
                    )).then(fin, fin);
                } catch (_) { fin(); }
            });
        }
        evento?.detail?.esperas?.push(apagado);
        return apagado;
    }

    window.addEventListener('sync:acceso-terminado', detener);
    window.addEventListener('pagehide', () => {
        autorizado = false;
        deteniendo = true;
        desconectarDispositivo();
    });

    let perfiles = null;
    async function enviarEfecto(efecto, duration) {
        if (!perfiles) {
            try {
                const r = await fetch('./efectos.json', {cache: 'no-store'});
                if (!r.ok) throw new Error('No se pudieron cargar los tiempos.');
                perfiles = await r.json();
            } catch (error) { error.noEnviado = true; throw error; }
        }
        if (!Object.hasOwn(perfiles, efecto) || perfiles[efecto].duration !== duration) {
            throw Object.assign(new Error('Duracion de efecto no permitida.'), {noEnviado: true});
        }
        // effect_sim nunca activa los comandos termicos del firmware del chaleco real.
        return enviarComando({type: 'effect_sim', effect: efecto, duration},
            'effect_sim:' + efecto + ',dur=' + duration);
    }
    function enviarVibracionPrueba() {
        return enviarComando({type: 'vibration', channel: 'all', action: 'on', duration: 200},
            'vibration:on,ch=all,dur=200');
    }
    function enviarComando(comando, confirmacion) {
        if (!autorizado || ControlAcceso.terminado) {
            return Promise.reject(Object.assign(new Error('El acceso terminó.'), {noEnviado: true}));
        }

        if (
            !dispositivo?.gatt?.connected ||
            !caracteristicaComandos ||
            !caracteristicaEstado
        ) {
            return Promise.reject(Object.assign(new Error('Conecta primero el ESP32.'), {noEnviado: true}));
        }

        if (ocupado) {
            return Promise.reject(Object.assign(new Error('Bluetooth está ocupado.'), {noEnviado: true}));
        }

        ocupado = true;
        actualizarBotones();

        const equipo = dispositivo;
        const comandos = caracteristicaComandos;
        const notificaciones = caracteristicaEstado;

        estado.textContent = 'Enviando efecto simulado…';
        respuesta.textContent = '';

        return new Promise((resolve, reject) => {
            let finalizado = false;
            let escrituraLista = false;
            let confirmacionRecibida = false;

            const temporizador = setTimeout(() => {
                finalizar(new Error(
                    'No se confirmó el comando en 3 segundos. Reconecta el ESP32.'
                ));
            }, 3000);

            function finalizar(error = null) {
                if (finalizado) return;
                finalizado = true;

                clearTimeout(temporizador);
                notificaciones.removeEventListener(
                    'characteristicvaluechanged',
                    recibirConfirmacion
                );
                equipo.removeEventListener(
                    'gattserverdisconnected',
                    cancelar
                );
                window.removeEventListener('sync:acceso-terminado', cancelar);
                window.removeEventListener('pagehide', cancelar);

                if (error && !deteniendo) {
                    // Impide reutilizar esta conexión con respuestas tardías.
                    desconectarDispositivo();
                }

                ocupado = false;
                actualizarBotones();

                if (error) {
                    reject(error);
                } else {
                    estado.textContent = 'ESP32 confirmó el efecto simulado.';
                    resolve();
                }
            }

            function comprobarFinalizacion() {
                if (finalizado) return;

                if (!autorizado || ControlAcceso.terminado || !equipo.gatt.connected) {
                    cancelar();
                } else if (escrituraLista && confirmacionRecibida) {
                    finalizar();
                }
            }

            function cancelar() {
                finalizar(new Error('La comunicación fue interrumpida.'));
            }

            function recibirConfirmacion(evento) {
                if (!autorizado || ControlAcceso.terminado) {
                    cancelar();
                    return;
                }

                const mensaje = new TextDecoder()
                    .decode(evento.target.value)
                    .trim();

                if (mensaje.startsWith('error:')) {
                    finalizar(new Error('El ESP32 rechazó el comando: ' + mensaje));
                    return;
                }

                if (mensaje === confirmacion) {
                    confirmacionRecibida = true;
                    comprobarFinalizacion();
                }
            }

            notificaciones.addEventListener(
                'characteristicvaluechanged',
                recibirConfirmacion
            );
            equipo.addEventListener('gattserverdisconnected', cancelar);
            window.addEventListener('sync:acceso-terminado', cancelar);
            window.addEventListener('pagehide', cancelar);

            const datos = new TextEncoder().encode(JSON.stringify(comando));

            try {
                comandos.writeValueWithResponse(datos).then(() => {
                    escrituraLista = true;
                    comprobarFinalizacion();
                }).catch(finalizar);
            } catch (error) {
                finalizar(error);
            }
        });
    }

    probar.addEventListener('click', async () => {
        try {
            await enviarVibracionPrueba();
        } catch (error) {
            if (autorizado && !ControlAcceso.terminado) {
                estado.textContent = error.message;
            }
        }
    });


    return { habilitar, enviarVibracionPrueba, enviarEfecto };
})();
