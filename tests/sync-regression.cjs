const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, 'public/sync', name), 'utf8');
class Target {
    constructor() { this.listeners = new Map(); this.disabled = false; this.textContent = ''; }
    addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
    removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
    dispatchEvent(e) { e.target = this; for (const fn of [...(this.listeners.get(e.type) || [])]) fn(e); }
    async click() { for (const fn of [...(this.listeners.get('click') || [])]) await fn({target:this}); await this.onclick?.(); }
    appendChild() {}
}
function environment(storage = new Map()) {
    const elements = new Map(); const window = new Target(); const timers = [];
    window.isSecureContext = true; window.location = {replace: url => window.redirect = url, reload() {}};
    const ctx = vm.createContext({window, console, TextEncoder, TextDecoder, Promise, AbortSignal,
        Event: class {constructor(type) {this.type=type;}},
        CustomEvent: class {constructor(type, args) {this.type=type; this.detail=args.detail;}},
        document: {getElementById(id) {if (!elements.has(id)) elements.set(id, new Target()); return elements.get(id);},
            querySelectorAll() {return [...elements.values()];}, createElement() {return new Target();}},
        sessionStorage: {getItem: key => storage.get(key) ?? null, setItem: (key,value) => storage.set(key,value), removeItem: key => storage.delete(key)},
        setTimeout: (fn,ms) => {timers.push({fn,ms}); return timers.length;}, clearTimeout() {},
        performance: {now: () => 0}, navigator: {}});
    return {ctx, window, elements, storage, timers, run: src => vm.runInContext(src,ctx)};
}
const response = (body,status=200) => ({ok:status<400,status,json:async()=>body,clone(){return this;}});
const event = id => ({id,tipo:'prueba',datos:{mensaje:'prueba'},vigencia_ms:60000});
const pendingKey = 'iastronaut_sync_confirmaciones_ble_v1_ABCDEF';
function receiver({storage = new Map(), events = [], send = async()=>{}, ack = async()=>{}}={}) {
    const env = environment(storage); const calls=[];
    env.ctx.ControlAcceso = {terminado:false,iniciar(){},cerrar(){},async solicitar(url, opts) {
        if (url.includes('confirmar-evento')) {const id=JSON.parse(opts.body).evento_id; calls.push('ack:'+id); await ack(id); return response({confirmado:true,evento_id:id});}
        calls.push('get');return response({eventos: events.filter(e=>!calls.includes('acked:'+e.id))});
    }};
    const originalAck=ack; ack=async id=>{await originalAck(id);calls.push('acked:'+id);};
    env.ctx.ChalecoBluetooth = {habilitar(){},async enviarVibracionPrueba(){calls.push('ble'); await send();}};
    const source = [...read('receptor.html').matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
    env.run(source);env.run("sesionReceptora={codigo:'ABCDEF',token_receptor:'a'.repeat(64)}; recuperarConfirmaciones();");
    return {...env,calls,poll:()=>env.run('consultarEventos()')};
}
test('confirma anteriores antes de consultar o intentar Bluetooth nuevo', async()=>{
    const r=receiver({storage:new Map([[pendingKey,'[1]']]),events:[event(2)],send:async()=>{throw Object.assign(new Error('offline'),{noEnviado:true});}});
    await r.poll();assert.deepEqual(r.calls,['ack:1','acked:1','get','ble']);
    assert.equal(r.storage.get(pendingKey),'[]');assert.equal(r.storage.get(pendingKey+'_inciertos'),'[]');
});
test('fallo HTTP y recarga reintentan ACK sin repetir Bluetooth', async()=>{
    const storage=new Map();let fails=true;
    const r=receiver({storage,events:[event(1)],ack:async()=>{if(fails)throw new Error('red');}});
    await r.poll();assert.equal(storage.get(pendingKey),'[1]');fails=false;
    const reload=receiver({storage,events:[event(1)]});await reload.poll();
    assert.ok(reload.calls.includes('ack:1'));assert.ok(!reload.calls.includes('ble'));
});
test('respuesta Bluetooth perdida no se reenvia ni confirma, incluso tras recarga',async()=>{
    const storage=new Map();const r=receiver({storage,events:[event(3)],send:async()=>{throw new Error('timeout');}});
    await r.poll();await r.poll();assert.equal(r.calls.filter(x=>x==='ble').length,1);
    const reload=receiver({storage,events:[event(3)]});await reload.poll();
    assert.deepEqual(reload.calls,['get']);assert.equal(storage.get(pendingKey+'_inciertos'),'[3]');
});
test('sin conexion antes de enviar permite reintento posterior',async()=>{
    let offline=true;const r=receiver({events:[event(4)],send:async()=>{if(offline)throw Object.assign(new Error('offline'),{noEnviado:true});}});
    await r.poll();offline=false;await r.poll();assert.ok(r.calls.includes('acked:4'));
});
test('almacenamiento bloqueado impide enviar',async()=>{
    const r=receiver({events:[event(1)]});r.ctx.sessionStorage.setItem=()=>{throw new Error('storage');};await r.poll();assert.ok(!r.calls.includes('ble'));
});
test('evento vencido no se envia',async()=>{
    const r=receiver({events:[{...event(1),vigencia_ms:0}]});await r.poll();assert.ok(!r.calls.includes('ble'));
});
function bluetooth(env) {
    const device=new Target(), status=new Target(); const writes=[];
    const command={writeValueWithResponse:async bytes=>{writes.push(JSON.parse(new TextDecoder().decode(bytes)));}};
    status.startNotifications=async()=>{};
    device.name='Simulador';device.gatt={connected:false,async connect(){this.connected=true;return this;},
        disconnect(){this.connected=false;device.dispatchEvent({type:'gattserverdisconnected'});},
        async getPrimaryService(){return {getCharacteristic:async uuid=>uuid.endsWith('02')?command:status};}};
    env.ctx.navigator.bluetooth={requestDevice:async()=>device};env.run(read('vest-bluetooth.js'));env.run('ChalecoBluetooth.habilitar()');
    return {device,status,command,writes,connect:()=>env.elements.get('conectarChaleco').click(),
        notify(text){status.value=new TextEncoder().encode(text);status.dispatchEvent({type:'characteristicvaluechanged'});}};
}
test('Bluetooth exige escritura y respuesta; salir intenta allOff y desconecta',async()=>{
    const env=environment();env.ctx.ControlAcceso={terminado:false};const ble=bluetooth(env);await ble.connect();
    let finishWrite;ble.command.writeValueWithResponse=bytes=>{ble.writes.push(JSON.parse(new TextDecoder().decode(bytes)));return new Promise(resolve=>finishWrite=resolve);};
    let accepted=false;const send=env.run('ChalecoBluetooth.enviarVibracionPrueba()').then(()=>accepted=true);
    ble.notify('vibration:on,ch=all,dur=200');await Promise.resolve();assert.equal(accepted,false);finishWrite();await send;assert.equal(accepted,true);
    ble.command.writeValueWithResponse=async bytes=>ble.writes.push(JSON.parse(new TextDecoder().decode(bytes)));
    const esperas=[];env.ctx.ControlAcceso.terminado=true;env.window.dispatchEvent({type:'sync:acceso-terminado',detail:{esperas}});await Promise.all(esperas);
    assert.equal(ble.writes.at(-1).type,'allOff');assert.equal(ble.device.gatt.connected,false);
});
test('apagado queda limitado aunque GATT no responda; cancela envio pendiente',async()=>{
    const env=environment();env.ctx.ControlAcceso={terminado:false};const ble=bluetooth(env);await ble.connect();
    ble.command.writeValueWithResponse=()=>new Promise(()=>{});
    const send=env.run('ChalecoBluetooth.enviarVibracionPrueba()');const rejected=assert.rejects(send,/interrumpida/);
    const esperas=[];env.ctx.ControlAcceso.terminado=true;env.window.dispatchEvent({type:'sync:acceso-terminado',detail:{esperas}});
    env.timers.find(t=>t.ms===500).fn();await Promise.all(esperas);await rejected;assert.equal(ble.device.gatt.connected,false);
});
test('reconectar no acumula manejadores de desconexion',async()=>{
    const env=environment();env.ctx.ControlAcceso={terminado:false};const ble=bluetooth(env);
    for(let i=0;i<3;i++){await ble.connect();ble.device.gatt.disconnect();}
    assert.equal(ble.device.listeners.get('gattserverdisconnected').size,1);
});
test('cerrar bloquea actividad antes del HTTP y permite reintentar fallo sin reanudarla',async()=>{
    const env=environment();let fail=true;let calls=0;
    env.ctx.fetch=async()=>{calls++;assert.equal(env.run('ControlAcceso.terminado'),true);if(fail)throw new Error('red');return response({cerrado:true});};
    env.run(read('control-acceso.js'));let stopped=false;env.window.addEventListener('sync:acceso-terminado',()=>stopped=true);
    await env.run('ControlAcceso.cerrar()');assert.equal(stopped,true);assert.equal(env.window.redirect,undefined);
    fail=false;await env.elements.get('cerrarAcceso').onclick();assert.equal(calls,2);assert.equal(env.window.redirect,'./acceso.html');
});
test('redireccion espera apagado Bluetooth antes de salir',async()=>{
    const env=environment();env.ctx.fetch=async()=>response({codigo:'ACCESO_REQUERIDO'},401);env.run(read('control-acceso.js'));
    let finish;env.window.addEventListener('sync:acceso-terminado',e=>e.detail.esperas.push(new Promise(resolve=>finish=resolve)));
    await assert.rejects(env.run("ControlAcceso.solicitar('/test')"));assert.equal(env.window.redirect,undefined);
    finish();for(let i=0;i<5;i++)await Promise.resolve();assert.equal(env.window.redirect,'./acceso.html');
});
test('cada aceptacion se confirma antes del siguiente comando',async()=>{
    let n=0;const r=receiver({events:[event(1),event(2)],send:async()=>{if(++n===2)throw new Error('timeout');}});
    await r.poll();assert.deepEqual(r.calls,['get','ble','ack:1','acked:1','ble']);
});
test('una respuesta de autorizacion tardia no reactiva la pagina',async()=>{
    const env=environment();let finishJson;
    env.ctx.fetch=async url=>url.includes('cerrar-sesion')?response({cerrado:true}):{ok:true,status:200,json:()=>new Promise(resolve=>finishJson=resolve)};
    env.run(read('control-acceso.js'));env.ctx.recovered=false;
    const init=env.run('ControlAcceso.iniciar(()=>{recovered=true})');
    for(let i=0;i<5;i++)await Promise.resolve();
    await env.run('ControlAcceso.cerrar()');finishJson({autorizado:true,acceso_id:'test'});await init;
    assert.equal(env.ctx.recovered,false);assert.equal(env.run('ControlAcceso.terminado'),true);
});
test('respuesta de creacion tardia no recupera credenciales despues de salir',async()=>{
    const env=environment();let finishJson;
    env.ctx.ControlAcceso={terminado:false,iniciar(){},cerrar(){},solicitar:async()=>({ok:true,json:()=>new Promise(resolve=>finishJson=resolve)})};
    env.run([...read('emisor.html').matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1]);
    const creating=env.elements.get('crear').click();for(let i=0;i<5;i++)await Promise.resolve();
    env.ctx.ControlAcceso.terminado=true;finishJson({codigo:'ABCDEF',token_emisor:'a'.repeat(64),sesion_id:1});await creating;
    assert.equal(env.storage.has('iastronaut_sync_emisor'),false);
});
test('efectos rechazan duraciones fuera del perfil antes de escribir Bluetooth', async()=>{
    const env=environment();env.ctx.ControlAcceso={terminado:false};
    env.ctx.fetch=async()=>response(JSON.parse(read('efectos.json')));
    const ble=bluetooth(env);await ble.connect();
    await assert.rejects(env.run("ChalecoBluetooth.enviarEfecto('calor_sol',60000)"), /Duracion/);
    assert.equal(ble.writes.length,0);
    const send=env.run("ChalecoBluetooth.enviarEfecto('calor_sol',3000)");
    for(let i=0;i<5;i++)await Promise.resolve();
    assert.equal(ble.writes[0].duration,3000);assert.equal(ble.writes[0].type,'effect_sim');
    ble.notify('effect_sim:calor_sol,dur=3000');await send;
});
test('misiones emiten pulsos y entradas termicas una vez por visita', async()=>{
    const folder=path.join(root,'public/assets/js/iastronaut');
    const url=text=>'data:text/javascript;base64,'+Buffer.from(text).toString('base64');
    let source=fs.readFileSync(path.join(folder,'missionDirector.js'),'utf8');
    for(const name of ['missionData.js','missionOperations.js','missionMath.js']) source=source.replace('./'+name,url(fs.readFileSync(path.join(folder,name),'utf8')));
    global.localStorage={getItem:()=>JSON.stringify({visited:['earth','sun','mercury','neptune']}),setItem(){}};
    try {
        const {createMissionDirector}=await import(url(source));const effects=[];
        const d=createMissionDirector({onSceneChange:async()=>({}),onHaptic:e=>effects.push(e)});
        await d.initialize();
        d.interactTarget('earth-nav');d.interactTarget('earth-comms');d.interactTarget('earth-power');
        assert.deepEqual(effects.map(e=>e.effect),['interaccion','interaccion','mision_completa']);
        await d.travelTo(1);await d.travelTo(1);d.update(1);
        assert.equal(effects.filter(e=>e.effect==='calor_sol').length,1);
        await d.travelTo(2);assert.equal(effects.at(-1).effect,'apagar');
        await d.travelTo(8);assert.equal(effects.at(-1).effect,'frio_neptuno');
        await d.travelTo(0);assert.equal(effects.at(-1).effect,'apagar');
        await d.travelTo(8);await d.restartMission();
        assert.equal(effects.at(-1).effect,'apagar');assert.equal(d.getState().current.id,'earth');
        const count=effects.length;
        d.interactTarget('earth-nav');d.interactTarget('earth-nav');
        assert.equal(effects.length,count+1, 'un modulo instalado no vuelve a vibrar');
    } finally {delete global.localStorage;}
});
test('puente de misiones descarta efectos sin autorizacion y envia sin duraciones libres',async()=>{
    const env=environment(new Map([['iastronaut_sync_emisor',JSON.stringify({token_emisor:'a'.repeat(64)})],['iastronaut_sync_acceso','access']]));
    env.window.location.search='?sync=1';env.ctx.URLSearchParams=URLSearchParams;
    env.ctx.crypto=require('node:crypto').webcrypto;
    const requests=[];
    env.ctx.fetch=async(url,opts)=>{requests.push({url,opts});return url.includes('estado-sesion')?response({estado:'vinculada'}):response({evento_id:1});};
    env.run(fs.readFileSync(path.join(root,'public/assets/js/iastronaut/missionHaptics.js'),'utf8').replace('export function','function'));
    env.run('var sendEffect=createMissionHaptics();');
    await new Promise(resolve=>setImmediate(resolve));
    env.run("sendEffect({effect:'calor_sol',scene:'sun'})");
    for(let i=0;i<5;i++)await Promise.resolve();
    const body=JSON.parse(requests.find(r=>r.url.includes('enviar-evento')).opts.body);
    assert.equal(body.efecto,'calor_sol');assert.equal(body.duration,undefined);
    env.window.dispatchEvent({type:'pagehide'});
    const count=requests.length;env.run("sendEffect({effect:'frio_neptuno',scene:'neptune'})");assert.equal(requests.length,count);
    assert.equal(JSON.parse(requests.at(-1).opts.body).efecto,'apagar');
});
