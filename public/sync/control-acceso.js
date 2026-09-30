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
    function terminar(notificar = true) {
        if (terminado) return;
        terminado = true;
        clearTimeout(temporizador);
        document.querySelectorAll('button, input').forEach(e => e.disabled = true);
        try { limpiar(); } catch (_) { /* El servidor ya invalida los tokens. */ }
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
        return respuesta;
    }
    async function comprobar() {
        const respuesta = await solicitar('../api/sync/estado-acceso.php');
        const datos = await respuesta.json();
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
            temporizador = setTimeout(vigilar, 2000);
        } catch (e) {
            if (e.codigo !== 'ACCESO_REQUERIDO') mensaje.textContent = e.message + ' Recarga para reintentar.';
        }
    }
    async function cerrar() {
        const boton = document.getElementById('cerrarAcceso');
        const estado = document.getElementById('estadoCierre');
        boton.disabled = true;
        estado.textContent = 'Cerrando sesión…';
        try {
            const respuesta = await solicitar('../api/sync/cerrar-sesion.php', {method: 'POST'});
            const datos = await respuesta.json();
            if (!respuesta.ok || datos.cerrado !== true) throw new Error(datos.error || 'Cierre no confirmado.');
            terminar();
        } catch (e) {
            if (e.codigo !== 'ACCESO_REQUERIDO') {
                estado.textContent = 'No se pudo confirmar el cierre. Puedes reintentarlo.';
                boton.disabled = false;
            }
        }
    }
    window.addEventListener('pageshow', e => { if (e.persisted) window.location.reload(); });
    return {iniciar, solicitar, cerrar, get terminado() { return terminado; }};
})();
