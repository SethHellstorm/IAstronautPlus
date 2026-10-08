// Puente opcional: abrir desde el emisor, en la misma pestana, con ?sync=1.
export function createMissionHaptics({base = '', notify = () => {}} = {}) {
    if (new URLSearchParams(window.location.search).get('sync') !== '1') return () => {};
    let session;
    try { session = JSON.parse(sessionStorage.getItem('iastronaut_sync_emisor')); } catch (_) {}
    let stopped = false, ready = false, sending = false, timer;
    let queue = [], scene = 'earth';
    const endpoint = name => `${base}/api/sync/${name}.php`;
    const headers = {'Content-Type': 'application/json', Authorization: 'Bearer ' + session?.token_emisor};
    function finish() {
        if (stopped) return;
        stopped = true; ready = false; queue = []; clearTimeout(timer);
        for (const key of Object.keys(sessionStorage)) {
            if (key.startsWith('iastronaut_sync_')) sessionStorage.removeItem(key);
        }
        window.location.replace(`${base}/sync/acceso.html`);
    }
    if (!session || !/^[a-f0-9]{64}$/.test(session.token_emisor || '')) {
        finish(); return () => {};
    }
    const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('iastronaut_sync_acceso') : null;
    const accessId = sessionStorage.getItem('iastronaut_sync_acceso');
    if (channel) channel.onmessage = ({data}) => {
        if (data?.tipo === 'cerrado' && data.accesoId === accessId) finish();
    };
    function payload(effect, destination) {
        const key = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
        return {clave_evento: key, tipo: 'haptico', efecto: effect, escena: destination};
    }
    async function verify() {
        if (stopped) return;
        try {
            const r = await fetch(endpoint('estado-sesion'), {headers, cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(2000)});
            if ([401,403,409,410].includes(r.status)) { finish(); return; }
            const data = await r.json();
            ready = r.ok && data.estado === 'vinculada';
        } catch (_) { ready = false; }
        if (!stopped) timer = setTimeout(verify, 2000);
    }
    async function flush() {
        if (sending || stopped) return;
        sending = true;
        try {
            while (queue.length && !stopped) {
                const item = queue.shift();
                if (performance.now() - item.time > 1500) continue;
                try {
                    const r = await fetch(endpoint('enviar-evento'), {method:'POST',headers,
                        credentials:'same-origin',body:JSON.stringify(item.body),signal:AbortSignal.timeout(2000)});
                    if ([401,403,409,410].includes(r.status)) { finish(); break; }
                    if (!r.ok) throw new Error('Efecto no aceptado');
                } catch (_) {
                    // No se reproduce un efecto viejo tras recuperar la conexion.
                    queue = []; ready = false;
                    if (!stopped) notify('No se pudo confirmar el efecto del simulador. No se repetira automaticamente.');
                }
            }
        } finally { sending = false; }
    }
    window.addEventListener('pagehide', () => {
        if (!stopped) {
            // Mejor esfuerzo; el ESP32 mantiene ademas su propio limite temporal.
            fetch(endpoint('enviar-evento'), {method:'POST',headers,credentials:'same-origin',keepalive:true,
                body:JSON.stringify(payload('apagar',scene))}).catch(()=>{});
        }
        stopped = true; queue = []; clearTimeout(timer); channel?.close();
    });
    window.addEventListener('pageshow', e => { if (e.persisted) window.location.reload(); });
    verify();
    return ({effect, scene: destination}) => {
        scene = destination;
        if (stopped || !ready) return;
        if (effect === 'apagar') queue = [];
        // Cola corta: no acumula sensaciones para reproducirlas mas tarde.
        if (queue.length >= 4) return;
        queue.push({body:payload(effect,destination), time:performance.now()});
        flush();
    };
}
