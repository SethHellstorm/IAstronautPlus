// Control común de las páginas emisor y receptor.
const ControlAcceso = (() => {
    let terminado = false;
    let temporizador;
    let accesoId = null;
    const canal = typeof BroadcastChannel === 'function'
        ? new BroadcastChannel('iastronaut_sync_acceso') : null;
    const errorAcceso = () => Object.assign(new Error('Acceso terminado.'), {codigo: 'ACCESO_REQUERIDO'});

    function limpiar() {
        for (const clave of Object.keys(sessionStorage)) {
            if (clave.startsWith('iastronaut_sync_')) sessionStorage.removeItem(clave);
        }
    }
    let apagadoLocal;
    function detenerLocal() {
        if (apagadoLocal) return apagadoLocal;
        terminado = true;
        clearTimeout(temporizador);
        const esperas = [];
        window.dispatchEvent(new CustomEvent('sync:acceso-terminado', {detail: {esperas}}));
        document.querySelectorAll('button, input').forEach(e => e.disabled = true);
        apagadoLocal = Promise.allSettled(esperas);
        return apagadoLocal;
    }
    async function terminar(notificar = true) {
        if (terminado) return;
        await detenerLocal();
        try { limpiar(); } catch (_) { /* El servidor invalida los tokens. */ }
        if (notificar) canal?.postMessage({tipo: 'cerrado', accesoId});
        window.location.replace('./acceso.html');
    }
    if (canal) canal.onmessage = ({data}) => {
        if (data?.tipo === 'cerrado' && data.accesoId === accesoId) terminar(false);
    };
    async function solicitar(url, opciones = {}) {
        if (terminado) throw errorAcceso();
        const respuesta = await fetch(url, {
            credentials: 'same-origin', cache: 'no-store',
            signal: AbortSignal.timeout(8000), ...opciones
        });
        if (terminado) throw errorAcceso();
        if (respuesta.status === 401) {
            const datos = await respuesta.clone().json();
            if (datos.codigo === 'ACCESO_REQUERIDO') {
                terminar();
                throw errorAcceso();
            }
        }
        if (respuesta.status === 409) {
            const datos = await respuesta.clone().json();

            if (datos.codigo === 'SINCRONIZACION_TERMINADA') {
                terminar(false);
                throw errorAcceso();
            }
        }
        return respuesta;
    }
    async function comprobar() {
        const respuesta = await solicitar('../api/sync/estado-acceso.php');
        const datos = await respuesta.json();
        if (terminado) throw errorAcceso();
        if (!respuesta.ok || datos.autorizado !== true || typeof datos.acceso_id !== 'string') {
            throw new Error(datos.error || 'No se pudo comprobar el acceso.');
        }
        if (accesoId && accesoId !== datos.acceso_id) {
            terminar(false);
            throw errorAcceso();
        }
        accesoId = datos.acceso_id;
        // Descarta el estado de una autorización anterior, incluso tras cerrar el navegador.
        if (sessionStorage.getItem('iastronaut_sync_acceso') !== accesoId) {
            limpiar();
            sessionStorage.setItem('iastronaut_sync_acceso', accesoId);
        }
    }
    async function vigilar() {
        if (terminado) return;
        try {
            await comprobar();
            const estado = document.getElementById('estadoCierre');
            if (estado.textContent === 'No se pudo comprobar el acceso. Reintentando…') estado.textContent = '';
        }
        catch (e) {
            if (e.codigo !== 'ACCESO_REQUERIDO') {
                document.getElementById('estadoCierre').textContent =
                    'No se pudo comprobar el acceso. Reintentando…';
            }
        }
        if (!terminado) temporizador = setTimeout(vigilar, 2000);
    }
    async function iniciar(recuperar) {
        const controles = [...document.querySelectorAll('button, input')];
        const estados = controles.map(e => e.disabled);
        controles.forEach(e => e.disabled = true);
        const mensaje = document.getElementById('mensaje');
        mensaje.textContent = 'Comprobando acceso…';
        try {
            await comprobar();
            controles.forEach((e, i) => e.disabled = estados[i]);
            mensaje.textContent = 'Acceso autorizado.';
            recuperar();
            const cambiar = document.getElementById('cambiarFuncion');

            if (cambiar) {
                cambiar.disabled = false;
                cambiar.onclick = cambiarFuncion;
            }
            temporizador = setTimeout(vigilar, 2000);
        } catch (e) {
            if (e.codigo !== 'ACCESO_REQUERIDO') mensaje.textContent = e.message + ' Recarga para reintentar.';
        }
    }
    async function salir(cambio) {
        if (terminado) return;
        // Detiene comandos y solicitudes antes de esperar la red.
        const apagado = detenerLocal();
        const boton = document.getElementById(cambio ? 'cambiarFuncion' : 'cerrarAcceso');
        const estado = document.getElementById('estadoCierre');
        async function intentar() {
            boton.disabled = true;
            estado.textContent = cambio ? 'Terminando la vinculación...' : 'Cerrando sesión...';
            try {
                const respuesta = await fetch('../api/sync/' + (cambio ? 'cambiar-funcion.php' : 'cerrar-sesion.php'), {
                    method: 'POST', credentials: 'same-origin', cache: 'no-store',
                    signal: AbortSignal.timeout(8000)
                });
                const datos = await respuesta.json();
                const vencido = respuesta.status === 401 && datos.codigo === 'ACCESO_REQUERIDO';
                if (!vencido && (!respuesta.ok || datos[cambio ? 'seleccion_disponible' : 'cerrado'] !== true)) {
                    throw new Error(datos.error || 'Operación no confirmada.');
                }
                await apagado;
                try { limpiar(); } catch (_) { /* No se reutiliza la vinculacion del servidor. */ }
                canal?.postMessage({tipo: 'cerrado', accesoId});
                window.location.replace('./acceso.html');
            } catch (_) {
                estado.textContent = 'No se pudo confirmar la salida. La sincronización local está detenida. Pulsa Reintentar.';
                boton.textContent = 'Reintentar';
                boton.disabled = false;
                boton.onclick = intentar;
            }
        }
        await intentar();
    }
    function cambiarFuncion() { return salir(true); }
    function cerrar() { return salir(false); }
    window.addEventListener('pageshow', e => { if (e.persisted) window.location.reload(); });
    return {iniciar, solicitar, cerrar, get terminado() { return terminado; }};
})();
