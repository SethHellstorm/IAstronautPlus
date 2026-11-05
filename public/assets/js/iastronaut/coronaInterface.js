import { getMissionAudioId } from './missionAudioCatalog.js';
import { roundRect } from './canvasUtils.js';
import { drawMissionLog } from './missionLog.js';
import { drawSolarRoute } from "./solarRoute.js";
import { SOLAR_MISSION } from "./missionData.js";
import { createPanel, createUIState, drawPanelFactory, addBubble } from './uiPanel.js';
import { makePanel, drawShell, drawWrapped, drawBar, drawButton, drawPrimaryButton, drawDot, pointInRect } from './panelCanvas.js';
import { MISSION_AUDIO_DIR, HIT_ZONES, MAIN_PANEL_Y, MAIN_PANEL_HEIGHT, MAIN_PANEL_WIDTH, PANEL_LAYOUT_GAP } from './config.js';
import { createTTSPlayer, createVoiceGuide } from './voice.js';
import { createMicChatController } from './chat.js';

export function createCoronaInterface({ THREE, scene, renderer, getMission, recenter, onReturn = null, onStart = null, onRestart = null, navigation = null }) {
    const terminal = createPanel({ THREE, scene });
    const group = terminal.uiGroup;
    group.scale.setScalar(1);
    const state = createUIState();
    const originalDraw = drawPanelFactory({ THREE, ...terminal, state });
    const drawTerminal = originalDraw;
    const panel = (id,w,h,width,height,x,y) => makePanel({ THREE, uiGroup: group,
        id, canvasW:w, canvasH:h, width,height,x,y,z:0.02 });
    const sideX = MAIN_PANEL_WIDTH / 2 + PANEL_LAYOUT_GAP + 1.28 / 2;
    const dossier = panel('moon-dossier',760,760,1.28,1.28,-sideX,MAIN_PANEL_Y);
    const controls = panel('moon-controls',760,900,1.28,1.52,sideX,MAIN_PANEL_Y);
    dossier.mesh.rotation.y = 0.08;
    controls.mesh.rotation.y = -0.08;
    const route = panel('moon-route',1400,500,2.58,0.92,0,MAIN_PANEL_Y + MAIN_PANEL_HEIGHT/2 + PANEL_LAYOUT_GAP + 0.92/2);
    const status = panel('moon-status',1180,230,2.12,0.42,0,MAIN_PANEL_Y - MAIN_PANEL_HEIGHT/2 - PANEL_LAYOUT_GAP - 0.42/2);
    const resume = panel('moon-resume',680,180,1.06,0.28,-2.22,-0.8);
    const panels = [dossier,controls,route,status,resume];
    let started = !!getMission().started, focus = false, tab = 'OBJETIVO', lastCollected = getMission().collected, lastError = '';
    const scanResults = ["Corona interior registrada. Observa el halo brillante junto al borde del disco ocultado.", "Filamento coronal registrado. Observa la estructura luminosa que se extiende hacia el espacio.", "Prominencia solar registrada. Observa la estructura rojiza que sobresale del borde."];
    const completionSummary = "Investigacion completada. Registraste la corona interior, un filamento coronal y una prominencia solar. Puedes revisar los resultados o volver al Sol.";
    const scienceTopics = {
        composition:{label:'COMPOSICION',value:'PLASMA',detail:'La corona es la atmosfera exterior del Sol. En este prototipo observamos tres regiones y registramos datos.'},
        temperature:{label:'TEMPERATURA',value:'OBSERVACION',detail:'El escaneo representa una medicion remota. Los colores del prototipo no son un termometro.'},
        gravity:{label:'GRAVEDAD',value:'SONDA DE OBSERVACION',detail:'La camara permanece fija. Gira para localizar las tres regiones de estudio.'},
        curiosity:{label:'CURIOSIDAD',value:'ARCOS DE PLASMA',detail:'Los arcos son una representacion visual simplificada, no una simulacion fisica.'},
        compare:{label:'COMPARAR',value:'MISION SECUNDARIA',detail:'Esta actividad registra observaciones. Su progreso es independiente de la mision principal del Sol.'}
    };
    let logSection = 'main';
    let selectedTopic = 'composition';
    let hover = '';
    const logs = ['Expedicion de la corona preparada.'];
    const tts = createTTSPlayer();
    const guide = createVoiceGuide({ ttsPlayer: tts, localAudioBasePath: MISSION_AUDIO_DIR });
    let active = false, handlingAction = false;
    const narrate = (text, options = {}) => {
        const audioId = getMissionAudioId(text);
        return audioId ? guide.playLocal(audioId, options) : guide.speak(text, options);
    };
    const say = (text, options) => { addBubble(state, drawTerminal, text, 'bot', {source:'mission'}); if(active && !handlingAction) void narrate(text, options); };
    let idleSince = null, idleReminded = false;
    function resetIdle() { idleSince = null; idleReminded = false; }
    let lastRouteDraw = -Infinity;
    function drawRoute(now = performance.now()) {
        const routeState=navigation?.getState() || {current:SOLAR_MISSION[0], currentIndex:0, task:{completed:true}, completed:new Set(['earth']), traveling:false};
        drawSolarRoute({solarMap:route, state:routeState,
            director:{isUnlocked:i=>navigation ? navigation.isUnlocked(i) : i<=1},
            isHovered:(_p,type,index='')=>hover===`${type}:${index}`, onCorona:true, onMoon:!!navigation?.travelOptional, activeCorona:true, t:now / 1000});
        lastRouteDraw = now;
    }
    function update(now = performance.now()) {
        // Match the main route cadence without redrawing the other panels.
        if (active && !focus && group.visible && route.mesh.visible && !document.hidden && now - lastRouteDraw >= 250) {
            drawRoute(now);
        }
        const mission = getMission();
        if (!active || !focus || !started || !mission.ready || mission.error || mission.collected === 3 || document.hidden) {
            resetIdle();
            return;
        }
        if (idleSince === null) idleSince = now;
        if (!idleReminded && now - idleSince >= 18000) {
            idleReminded = true;
            say('Busca las regiones con aro dorado y selecci\u00f3nalas para escanear los registros pendientes.');
        }
    }
    const context = () => {
        const m = getMission();
        return { scene_id:'corona', scene_name:'corona solar', scene_type:'mision secundaria opcional',
            objective:'Escanear tres registros: selecciona las regiones con aro dorado.',
            operation_title:'Exploracion de la corona', operation_started:started,
            operation_complete:m.collected===3, operation_progress:Math.round(m.collected/3*100),
            operation_briefing:'Actividad independiente. No desbloquea planetas ni modifica la ruta principal.',
            pending_target:m.collected===3?'':`Escanear ${3-m.collected} registros restantes`,
            completed_targets:(m.collectedIds || []).map(id=>scanResults[id]),
            hint:'Pulsa Iniciar operacion y apunta a los aros dorados con el raton o el gatillo.',
            last_result:logs.at(-1), selected_topic:tab==='CIENCIA'?scienceTopics[selectedTopic].label:tab, next_destination:'Sol (regreso desde la corona solar)' };
    };
    function restart() {
        if(!onRestart || !getMission().ready) return;
        resetIdle();
        mic.stop(); guide.stop();
        onRestart();
        started=false;focus=false;lastCollected=0;tab='OBJETIVO';
        logs.length=0;logs.push('Operacion de la corona reiniciada.');
        say('Operaci\u00f3n reiniciada. Pulsa Iniciar operaci\u00f3n para escanear de nuevo los tres registros.');
        refresh();
    }
    function start() {
        if (!getMission().ready || getMission().error) return;
        if (!started) { started = true; onStart?.(); logs.push('Escaneo iniciada.'); say('Escanea las tres regiones con aro dorado. Puedes volver a los paneles para hablar conmigo.'); }
        resetIdle(); focus = true; refresh();
    }
    const mic = createMicChatController({state,drawPanel:drawTerminal,ttsPlayer:tts,voiceGuide:guide,
        getMissionContext:context, onAssistantAction:runAction});
    async function travelTo(index) {
        if(!navigation || !SOLAR_MISSION[index]) return false;
        if(!navigation.isUnlocked(index)) {
            const previous=SOLAR_MISSION[Math.max(0,index-1)];
            const message=`${SOLAR_MISSION[index].name} sigue bloqueado. Completa primero la operaci\u00f3n de ${previous.name}.`;
            focus=false;refresh();
            addBubble(state,drawTerminal,message,'bot',{source:'mission'});
            const audioId=getMissionAudioId(message);
            if(audioId) void guide.playLocal(audioId,{interrupt:true,remember:true});
            return false;
        }
        await navigation.travelTo(index);
        return true;
    }
    async function runAction(action) {
        const type=typeof action==='string'?action:action?.type;
        const target=action?.target || action?.topic || action?.key;
        handlingAction=true;
        try {
            if(type==='start_operation' || type==='deploy_probe') {start();return true;}
            if(type==='go_home' || type==='previous_destination') {await onReturn?.();return true;}
            if(type==='next_destination') {
                if(navigation) {
                    const current=navigation.getState().currentIndex;
                    if(navigation.isUnlocked(current+1)) {await navigation.travelTo(current+1);return true;}
                }
                say('Ese destino sigue bloqueado. Vuelve al Sol para continuar la ruta principal.');return false;
            }
            if(type==='select_topic') {
                if(!scienceTopics[target]) return false;
                selectedTopic=target;tab='CIENCIA';focus=false;refresh();return true;
            }
            if(type==='show_log' || type==='show_objective') {
                tab=type==='show_log'?'BITACORA':'OBJETIVO';
                if(type==='show_log') logSection=target==='optional'?'optional':'main';
                focus=false;refresh();return true;
            }
            if(type==='repeat_briefing' || type==='highlight_target') {say(context().objective);return true;}
            return false; // Una orden de la corona nunca reinicia el progreso principal.
        } finally {handlingAction=false;}
    }
    function text(p, value, y, size=28, color='#E8FAFF', lines=5) {
        p.ctx.fillStyle=color; p.ctx.font=`750 ${size}px system-ui, sans-serif`;
        p.ctx.textAlign='left'; p.ctx.textBaseline='top';
        drawWrapped(p.ctx,value,34,y,p.canvas.width-68,size+9,lines);
    }
    function button(p,key,label,y,primary=false,disabled=false) {
        const rect={x:32,y,w:p.canvas.width-64,h:88};
        if(primary && !disabled) drawPrimaryButton(p.ctx,rect,label,hover===key);
        else drawButton(p.ctx,rect,label,true,'#FFCF72',disabled,26,hover===key);
        if(!disabled) p.hitZones.push({key,rect});
    }
    function refresh(error=lastError) {
        lastError=error;
        const m=getMission(), complete=m.collected===3, accent=complete?'#59F49B':'#FFCF72';
        if(m.collected!==lastCollected) {
            resetIdle();
            const result = scanResults[m.collectedIds?.at(-1)];
            if (result) {logs.push(result);say(result);}
            if (complete) say(completionSummary, {interrupt:false});
            lastCollected=m.collected;
            if(complete) focus=false;
        }
        for(const p of panels) { p.hitZones=[]; drawShell(p.ctx,p.canvas.width,p.canvas.height,
            ({'moon-dossier':'CENTRO DE MISION','moon-controls':'CONTROL DE VUELO','moon-route':'RUTA HOLOGRAFICA / SECUNDARIA','moon-status':'ESTADO DE MISION','moon-resume':'EXPLORACION CORONA SOLAR'})[p.id],accent); }
        ['OBJETIVO','CIENCIA','BITACORA'].forEach((label,i)=>{
            const rect={x:28+i*240,y:96,w:224,h:62};
            drawButton(dossier.ctx,rect,label,tab===label,accent,false,22,hover===label);
            dossier.hitZones.push({key:label,rect});
        });
        function card(p, label, body, y, height, lines=3) {
            const c=p.ctx;
            c.fillStyle='#082740'; c.strokeStyle=accent; c.lineWidth=3;
            c.beginPath(); c.roundRect(28,y,704,height,18); c.fill(); c.stroke();
            c.fillStyle=accent; c.font='900 22px ui-monospace, monospace';
            c.textAlign='left'; c.textBaseline='top'; c.fillText(label,52,y+25);
            c.fillStyle='#EDF9FF'; c.font='750 27px system-ui, sans-serif';
            drawWrapped(c,body,52,y+74,654,33,lines);
        }
        if(tab==='OBJETIVO') {
        text(dossier,'MISI\u00d3N SECUNDARIA \u00b7 CORONA SOLAR',180,23,accent,1);
        text(dossier,'ESCANEO DE REGISTROS',225,32,'#FFFFFF',2);
        }
        if(tab==='OBJETIVO') {
            card(dossier,complete?'RESULTADOS':'OBJETIVO ACTUAL',complete?completionSummary:'Escanea la corona interior, el filamento coronal y la prominencia. Selecciona sus aros dorados.',320,174);
            drawBar(dossier.ctx,36,548,688,m.collected/3*100,accent,'PROGRESO DE OPERACI\u00d3N');
            text(dossier,complete?'REGISTROS RECUPERADAS':started?'OPERACI\u00d3N EN CURSO':'LISTA PARA INICIAR',610,23,accent,1);
            text(dossier,'Misi\u00f3n opcional. El progreso principal no cambia.',650,25,'#E8FAFF',2);
        } else if(tab==='CIENCIA') {
            text(dossier,'CORONA SOLAR',174,38,accent,1);
            text(dossier,'SAT\u00c9LITE NATURAL',220,22,'#A5DDEE',1);
            Object.entries(scienceTopics).forEach(([key,topic],i)=>{
                const rect={x:30+(i%2)*356,y:260+Math.floor(i/2)*72,w:i===4?700:338,h:60};
                drawButton(dossier.ctx,rect,topic.label,key===selectedTopic,accent,false,23,hover===`science:${key}`);
                dossier.hitZones.push({key:`science:${key}`,rect});
            });
            const topic=scienceTopics[selectedTopic];
            card(dossier,topic.value,topic.detail,486,226,4);
        } else {
            const main=navigation?.getState() || {completed:new Set(['earth']),currentIndex:0};
            drawMissionLog({ctx:dossier.ctx,state:main,isUnlocked:i=>navigation?navigation.isUnlocked(i):i<=1,
                section:logSection,coronaCount:m.collected,activeCorona:true,hover:hover.startsWith('log:')?hover.slice(4):'',
                onZone:(key,rect)=>dossier.hitZones.push({key:`log:${key}`,rect})});
        }
        text(controls,'CORONA SOLAR',96,45,accent,1);
        text(controls,'ESCANEO DE REGISTROS',148,23,'#BDEBF7',1);
        card(controls,complete?'OPERACI\u00d3N COMPLETA':started?'OPERACI\u00d3N EN PAUSA':'SIGUIENTE PASO',
            lastError || (!m.ready?'Cargando los registros...':complete?completionSummary:started?'Retoma la exploraci\u00f3n para buscar los aros dorados.':'IAstronaut te guiar\u00e1 paso a paso durante la misi\u00f3n.'),196,174);
        drawBar(controls.ctx,36,424,688,m.collected/3*100,accent,'PROGRESO DE OPERACI\u00d3N');
        button(controls,'start',complete?'EXPLORAR CORONA SOLAR':started?'RETOMAR OPERACI\u00d3N':'INICIAR OPERACI\u00d3N',510,true,!m.ready || !!lastError);
        button(controls,'restart','REPETIR OPERACI\u00d3N',660,false,!onRestart || !m.ready || (!started && m.collected===0));
        if (onReturn) button(controls,'return','VOLVER AL SOL',778);
        else text(controls,'Misi\u00f3n opcional / progreso independiente',790,23);
        drawRoute();
        text(status,'DESTINO',86,22,accent,1);
        text(status,'CORONA SOLAR',119,32,'#FFFFFF',1);
        text(status,complete?'REGISTROS RECUPERADAS':started?'ESCANEO EN CURSO':'LISTA PARA INICIAR',174,19,'#BDEBF7',1);
        const c=status.ctx;
        c.strokeStyle='#286178'; c.lineWidth=2;
        [382,798].forEach(x=>{c.beginPath();c.moveTo(x,85);c.lineTo(x,204);c.stroke();});
        c.fillStyle=accent;c.font='800 22px ui-monospace, monospace';c.fillText('REGISTROS',420,86);
        c.fillStyle='#FFFFFF';c.font='900 32px system-ui';c.fillText(`${m.collected} / 3`,420,119);
        c.fillStyle='#BDEBF7';c.font='800 20px ui-monospace, monospace';c.fillText('MISI\u00d3N OPCIONAL',420,174);
        drawBar(c,838,155,306,m.collected/3*100,accent,'OPERACI\u00d3N');
        {
            const {ctx,canvas}=resume;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const hovered = hover === "panels";
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, hovered ? "rgba(30,104,137,0.98)" : "rgba(7,39,62,0.94)");
        gradient.addColorStop(1, hovered ? "rgba(14,73,104,0.98)" : "rgba(3,20,36,0.94)");
        ctx.save();
        ctx.shadowColor = hovered ? "rgba(255,255,255,0.62)" : `${accent}70`;
        ctx.shadowBlur = hovered ? 28 : 18;
        ctx.fillStyle = gradient;
        roundRect(ctx, 8, 8, canvas.width - 16, canvas.height - 16, 28);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = hovered ? "#FFFFFF" : accent;
        ctx.lineWidth = hovered ? 7 : 4;
        roundRect(ctx, 8, 8, canvas.width - 16, canvas.height - 16, 28);
        ctx.stroke();
        ctx.fillStyle = accent;
        ctx.font = "900 42px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("←  VOLVER A PANELES", canvas.width / 2, canvas.height / 2);
        ctx.textAlign = "left";
            resume.hitZones.push({key:'panels',rect:{x:0,y:0,w:canvas.width,h:canvas.height}});
        }
        terminal.panelMesh.visible=!focus;
        for(const p of panels) {p.mesh.visible=p===resume?focus:!focus;p.texture.needsUpdate=true;}
    }
    const meshes=[terminal.panelMesh,...panels.map(p=>p.mesh)];
    for(const mesh of meshes) {mesh.material.depthTest=false;mesh.material.depthWrite=false;mesh.material.toneMapped=false;mesh.renderOrder=100;}
    function hit(ray) {group.updateMatrixWorld(true);return ray.intersectObjects(meshes.filter(m=>m.visible && group.visible),false)[0] || null;}
    function keyFor(h) {
        if(!h?.uv) return '';
        if(h.object===terminal.panelMesh) {
            const point={x:h.uv.x*terminal.panelCanvas.width,y:(1-h.uv.y)*terminal.panelCanvas.height};
            return Object.entries(HIT_ZONES).find(([key,r])=>['exit','recenter','talk','grab'].includes(key)&&pointInRect(point,r))?.[0] || '';
        }
        const p=panels.find(p=>p.mesh===h.object);
        const point=p?{x:h.uv.x*p.canvas.width,y:(1-h.uv.y)*p.canvas.height}:null;
        const zone=p?.hitZones.find(z=>z.rect?pointInRect(point,z.rect):Math.hypot(point.x-z.circle.x,point.y-z.circle.y)<=z.circle.r);
        return zone?.key || (zone?.type==='destination'?`destination:${zone.index}`:['moon','corona'].includes(zone?.type)?`${zone.type}:`:'');
    }
    function clickHit(h) {
        if(!h || !meshes.includes(h.object)) return false;
        const key=keyFor(h);
        if(key.startsWith('destination:')) {void travelTo(Number(key.split(':')[1]));}
        else if(key==='moon:' || key==='corona:') {void navigation?.travelOptional?.(key.slice(0,-1));}
        else if(key.startsWith('science:') && scienceTopics[key.slice(8)]) {selectedTopic=key.slice(8);refresh();}
        else if(key==='log:main' || key==='log:optional') {logSection=key.slice(4);refresh();}
        else if(key==='return') {mic.stop();guide.stop();onReturn?.();}
        else if(key==='talk') void mic.toggleMic();
        else if(key==='recenter') recenter();
        else if(key==='exit') {mic.stop();focus=true;refresh();}
        else if(key==='panels') {focus=false;refresh();}
        else if(key==='start') start();
        else if(key==='restart') restart();
        else if(['OBJETIVO','CIENCIA','BITACORA'].includes(key)) {tab=key;refresh();}
        return true;
    }
    function hoverHit(h) {
        const key=keyFor(h);
        if(key!==hover) {hover=key;state.hoverZone=key;drawTerminal();refresh();}
        return !!h;
    }
    function scroll(ray,delta) {const h=hit(ray);if(h?.object!==terminal.panelMesh)return false;state.scrollY=Math.max(0,Math.min(state.scrollMax,state.scrollY+delta));state.autoScroll=false;drawTerminal();return true;}
    const welcome='Bienvenido a la corona solar, aqu\u00ed obtendremos registros para investigaci\u00f3n.';
    say(welcome);
    refresh();
    window.addEventListener('pagehide',()=>{mic.stop();guide.stop();});
    return {group,refresh,update,inputContext:{panelMesh:terminal.panelMesh,panelCanvas:terminal.panelCanvas,uiGroup:group,state,drawPanel:drawTerminal},click:ray=>clickHit(hit(ray)),setHover:ray=>hoverHit(hit(ray)),scroll,
        clickHit,hoverHit,getInteractiveMeshes:()=>meshes.filter(m=>m.visible && group.visible),
        runAction,getContext:context,
        enter:()=>{resetIdle();active=true;void guide.unlock();void narrate(getMission().collected===3?'La misi\u00f3n de la corona est\u00e1 completa. Puedes consultar la ciencia o regresar al Sol.':started?'Bienvenido de nuevo. Retoma la operaci\u00f3n para escanear los registros pendientes.':welcome);},
        stop:()=>{resetIdle();active=false;mic.stop();guide.stop();},canCollect:()=>started,
        onXRStart:()=>mic.onXRSessionStart(),onXREnd:()=>mic.stop()};
}
