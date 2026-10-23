const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const base = path.resolve(__dirname, '../public/assets/js/iastronaut');
const read = file => fs.readFileSync(path.join(base, file), 'utf8');
async function moduleAt(file, globals={}) {
    const context=vm.createContext({console, ...globals});
    const cache=new Map();
    async function load(file) {
        file=path.resolve(file);
        if(cache.has(file)) return cache.get(file);
        const mod=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file});
        cache.set(file,mod);
        await mod.link((name,parent)=>load(path.resolve(path.dirname(parent.identifier),name)));
        return mod;
    }
    const mod=await load(path.join(base,file));await mod.evaluate();return mod.namespace;
}
function storage(initial=[]) {
    const data=new Map(initial);return {data,getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
}
test('Luna requiere completar Tierra, no basta visitarla',async()=>{
    const {isMoonUnlocked}=await moduleAt('moonProgress.js');
    assert.equal(isMoonUnlocked({visited:new Set(['earth']),completed:new Set()}),false);
    assert.equal(isMoonUnlocked({completed:new Set(['earth'])}),true);
});
test('muestras unicas, restauracion y progreso principal intacto',async()=>{
    const {createMoonProgress,MOON_PROGRESS_KEY}=await moduleAt('moonProgress.js');
    const main='iastronaut_operation_helios_v2';const saved=JSON.stringify({completed:['earth'],currentSceneId:'earth'});
    const store=storage([[main,saved]]);const p=createMoonProgress(store);
    assert.equal(p.collect(0),false);p.start();assert.equal(p.collect(0),true);
    assert.equal(p.collect(0),false);assert.equal(p.collect(9),false);
    const restored=createMoonProgress(store);assert.equal(restored.getState().collected.length,1);
    restored.collect(1);restored.collect(2);assert.equal(createMoonProgress(store).getState().completed,true);
    assert.equal(store.getItem(main),saved);assert.deepEqual([...store.data.keys()].sort(),[main,MOON_PROGRESS_KEY].sort());
});
test('guardado corrupto o no disponible no interrumpe la mision',async()=>{
    const {createMoonProgress,MOON_PROGRESS_KEY}=await moduleAt('moonProgress.js');
    assert.equal(createMoonProgress(storage([[MOON_PROGRESS_KEY,'{broken']])).getState().collected.length,0);
    const corrupt=createMoonProgress(storage([[MOON_PROGRESS_KEY,JSON.stringify({collected:[0,0,2,8,'1',null]})]]));
    assert.equal(corrupt.getState().collected.length,2);
    const p=createMoonProgress({getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}});
    p.start();p.collect(0);assert.equal(p.getState().collected.length,1);assert.equal(p.getState().persistent,false);
});
function transitionHarness(completed=true) {
    const source=read('threeScene.js');
    const code=source.slice(source.indexOf('    async function openMoon()'),source.indexOf('    let narrationSequence'));
    const main={visible:true},hidden={visible:false},controller={visible:true},hand={visible:true},camera={};
    const moon={root:{visible:false},enter(){this.root.visible=true},leave(){this.root.visible=false}};
    const ctx=vm.createContext({performance:{now:()=>0},setTimeout:fn=>fn(),fadeTo:async()=>{},travelEffect:{start(){},stop(){}},moon,moonActive:false,moonOpening:false,mainSceneSnapshot:null,
        director:{announceMoonLocked(){ctx.lockedNotice=true;},getState:()=>({current:{id:'earth'},traveling:false,completed:new Set(completed?['earth']:[])})},
        isMoonUnlocked:s=>s.completed.has('earth'),dismissPendingWelcome(){},mic:{stop(){}},voiceGuide:{stop(){}},sendHaptic(){},
        xr:{controllers:{controller},hands:{hand}},camera,
        scene:{children:[main,hidden,controller,hand,moon.root],background:'stars',environment:'env'},
        renderer:{shadowMap:{enabled:false,type:'original'}},panelMesh:{visible:true},
        THREE:{Color:class{},PCFSoftShadowMap:'soft'},recenterPanel(){},syncVRExitVisibility(){},console});
    vm.runInContext(code,ctx);
    return {ctx,main,hidden,controller,hand,moon};
}
test('entrada bloqueada no cambia la escena',async()=>{
    const h=transitionHarness(false);await vm.runInContext('openMoon()',h.ctx);
    assert.equal(h.ctx.lockedNotice,true);assert.equal(h.ctx.moonActive,false);assert.equal(h.main.visible,true);assert.equal(h.ctx.scene.background,'stars');
});
test('entrada oculta mundo principal y conserva mandos; regreso restaura visibilidad y luces',async()=>{
    const h=transitionHarness();await vm.runInContext('openMoon()',h.ctx);
    assert.equal(h.ctx.moonActive,true);assert.equal(h.main.visible,false);assert.equal(h.controller.visible,true);
    assert.equal(h.hand.visible,true);assert.equal(h.ctx.panelMesh.visible,false);assert.equal(h.ctx.renderer.shadowMap.enabled,true);
    vm.runInContext('closeMoon()',h.ctx);
    assert.equal(h.ctx.moonActive,false);assert.equal(h.main.visible,true);assert.equal(h.hidden.visible,false);
    assert.equal(h.moon.root.visible,false);assert.equal(h.ctx.panelMesh.visible,true);assert.equal(h.ctx.scene.background,'stars');
    assert.equal(h.ctx.scene.environment,'env');assert.equal(h.ctx.renderer.shadowMap.enabled,false);
});
function canvas() {
    const element={width:0,height:0};
    const ctx=new Proxy({canvas:element,measureText:t=>({width:String(t).length*14}),createLinearGradient:()=>({addColorStop(){}})},
        {get:(o,k)=>k in o?o[k]:(()=>{})});element.getContext=()=>ctx;return element;
}
class Vector {set(){return this}clone(){return new Vector()}copy(){return this}setScalar(){return this}}
class Group {constructor(){this.children=[];this.position=new Vector;this.rotation={};this.scale=new Vector;this.userData={};this.visible=true;}add(o){this.children.push(o)}updateMatrixWorld(){}}
class Mesh extends Group {constructor(g,m){super();this.material=m;}}
const THREE={Group,Mesh,CanvasTexture:class{},MeshBasicMaterial:class{constructor(o){Object.assign(this,o)}},PlaneGeometry:class{},MathUtils:{clamp:(v,a,b)=>Math.min(b,Math.max(a,v))}};
test('HUD integrado: iniciar, mostrar paneles, volver a Tierra y restaurar mision iniciada',async()=>{
    const {createMoonInterface}=await moduleAt('moonInterface.js',{document:{createElement:canvas},navigator:{},window:{APP_BASE:'',addEventListener(){}},performance,setTimeout,clearTimeout});
    let starts=0,returns=0;const state={ready:false,collected:0,started:false};
    const hud=createMoonInterface({THREE,scene:new Group,renderer:{},getMission:()=>state,recenter(){},onStart:()=>starts++,onReturn:()=>returns++});
    const panel=id=>hud.group.children.find(o=>o.userData.missionPanelId===id);
    const click=(id,x,y,w,h)=>hud.clickHit({object:panel(id),uv:{x:x/w,y:1-y/h}});
    click('moon-controls',200,570,760,900);assert.equal(starts,0);
    state.ready=true;hud.refresh();click('moon-controls',200,570,760,900);assert.equal(starts,1);assert(hud.canCollect());
    assert.equal(panel('moon-controls').visible,false);
    click('moon-resume',200,110,680,180);assert.equal(panel('moon-controls').visible,true);
    click('moon-controls',200,810,760,900);assert.equal(returns,1);
    state.started=true;state.collected=2;
    const restored=createMoonInterface({THREE,scene:new Group,renderer:{},getMission:()=>state,recenter(){}});
    assert.equal(restored.canCollect(),true);
    assert.equal(await restored.runAction({type:'select_topic',target:'gravity'}),true);
    assert.equal(restored.getContext().selected_topic,'GRAVEDAD');
    assert.equal(await restored.runAction({type:'select_topic',target:'invalid'}),false);
    assert.equal(await restored.runAction({type:'restart_mission'}),false);
    assert.equal(await hud.runAction({type:'go_home'}),true);
    assert.equal(returns,2);

});
function chatHarness(extra={}) {
    const state={bubbles:[]};let spoken=0,actions=0;
    let respond;
    const response=new Promise(resolve=>respond=resolve);
    const env={console,performance,setInterval,clearInterval,window:{isSecureContext:true},navigator:{},
        ENDPOINT:'/chat',FormData:class {append(){}},
        addBubble:(s,d,t)=>s.bubbles.push({text:t}),setListening:(s,d,v)=>s.listening=v,setAISpeaking:(s,d,v)=>s.aiSpeaking=v,
        canRecord:()=>true,enforceMaxBubbles(){},fetchWithTimeout:()=>response,readJsonResponse:async x=>x,...extra};
    const ctx=vm.createContext(env);
    const source=read('chat.js').replace(/^import .*;\r?\n/gm,'').replace('export function createMicChatController','function createMicChatController')
        .replace('        toggleMic,','        toggleMic, sendAudioBlob,');
    vm.runInContext(source,ctx);
    const controller=ctx.createMicChatController({state,drawPanel(){},ttsPlayer:{stop(){},setSpeakingChangeHandler(){}},
        voiceGuide:{unlock:async()=>{},speak:async()=>spoken++},onAssistantAction:()=>actions++});
    return {controller,state,respond,spoken:()=>spoken,actions:()=>actions};
}
test('salir de la escena descarta una respuesta de voz tardia',async()=>{
    const h=chatHarness();const pending=h.controller.sendAudioBlob({size:2000},'audio/webm');
    h.controller.stop();h.respond({transcript:'hola',reply:'Respuesta tardia',action:{type:'start_operation'}});await pending;
    assert.equal(h.spoken(),0);assert.equal(h.actions(),0);
    assert.equal(h.state.bubbles.some(b=>b.text==='Respuesta tardia'),false);
});
test('permiso de microfono que llega tras salir cierra sus pistas sin activar escucha',async()=>{
    let resolveStream,requested,stopped=0;
    const permissionRequested=new Promise(resolve=>requested=resolve);
    const permission=new Promise(resolve=>resolveStream=resolve);
    const h=chatHarness({navigator:{mediaDevices:{getUserMedia:()=>{requested();return permission}}}});
    const pending=h.controller.toggleMic();await permissionRequested;
    h.controller.stop();resolveStream({getTracks:()=>[{stop:()=>stopped++}]});await pending;
    assert.equal(stopped,1);assert.equal(h.state.listening,false);
});

test('reiniciar Luna limpia muestras persistidas sin modificar la ruta principal',async()=>{
    const {createMoonProgress}=await moduleAt('moonProgress.js');
    const store=storage([['iastronaut_operation_helios_v2','principal']]);
    const p=createMoonProgress(store);p.start();[0,1,2].forEach(id=>p.collect(id));
    p.reset();
    const restored=createMoonProgress(store);
    assert.equal(restored.getState().collected.length,0);
    assert.equal(restored.getState().started,false);
    assert.equal(restored.getState().completed,false);
    assert.equal(store.getItem('iastronaut_operation_helios_v2'),'principal');
    restored.start();assert.equal(restored.collect(0),true);
});
