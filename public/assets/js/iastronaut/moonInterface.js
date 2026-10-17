import { createPanel, createUIState, drawPanelFactory, addBubble } from './uiPanel.js';
import { makePanel, drawShell, drawWrapped, drawBar, drawButton, drawPrimaryButton, drawDot, pointInRect } from './panelCanvas.js';
import { HIT_ZONES } from './config.js';
import { createTTSPlayer, createVoiceGuide } from './voice.js';
import { createMicChatController } from './chat.js';

export function createMoonInterface({ THREE, scene, renderer, getMission, recenter, onReturn = null, onStart = null }) {
    const terminal = createPanel({ THREE, scene });
    const group = terminal.uiGroup;
    group.scale.setScalar(0.75);
    const state = createUIState();
    const originalDraw = drawPanelFactory({ THREE, ...terminal, state });
    const drawTerminal = () => {
        originalDraw();
        // Sustituye mover por explorar: el conjunto permanece anclado.
        const c = terminal.ctx;
        c.fillStyle = '#0B2138';
        c.fillRect(1230, 32, 140, 106);
        drawButton(c, HIT_ZONES.grab, 'VER LUNA', true, '#3FDCFF', false, 16);
        terminal.panelTex.needsUpdate = true;
    };
    const panel = (id,w,h,width,height,x,y) => makePanel({ THREE, uiGroup: group,
        id, canvasW:w, canvasH:h, width,height,x,y,z:0.02 });
    const dossier = panel('moon-dossier',760,760,1.28,1.28,-1.91,-0.08);
    const controls = panel('moon-controls',760,900,1.28,1.52,1.91,-0.08);
    const route = panel('moon-route',1400,320,2.58,0.59,0,1.275);
    const status = panel('moon-status',1180,230,2.12,0.42,0,-1.35);
    const resume = panel('moon-resume',680,180,1.06,0.28,0,-0.8);
    const panels = [dossier,controls,route,status,resume];
    let started = !!getMission().started, focus = false, tab = 'OBJETIVO', lastCollected = getMission().collected, lastError = '';
    let hover = '';
    const logs = ['Expedicion lunar preparada.'];
    const tts = createTTSPlayer();
    const guide = createVoiceGuide({ ttsPlayer: tts });
    const say = text => { addBubble(state, drawTerminal, text, 'bot', {source:'mission'}); };
    const context = () => {
        const m = getMission();
        return { scene_id:'moon', scene_name:'Luna', scene_type:'mision secundaria opcional',
            objective:'Recoger tres muestras: selecciona las rocas con aro azul.',
            operation_title:'Exploracion lunar', operation_started:started,
            operation_complete:m.collected===3, operation_progress:Math.round(m.collected/3*100),
            operation_briefing:'Actividad independiente. No desbloquea planetas ni modifica la ruta principal.',
            pending_target:m.collected===3?'':`Recoger ${3-m.collected} muestras restantes`,
            completed_targets:Array.from({length:m.collected},(_,i)=>`Muestra ${i+1}`),
            hint:'Pulsa Iniciar operacion y apunta a los aros azules con el raton o el gatillo.',
            last_result:logs.at(-1), selected_topic:tab, next_destination:'' };
    };
    function start() {
        if (!getMission().ready || getMission().error) return;
        if (!started) { started = true; onStart?.(); logs.push('Recoleccion iniciada.'); say('Recoge las tres rocas con aro azul. Puedes volver a los paneles para hablar conmigo.'); }
        focus = true; refresh();
    }
    const mic = createMicChatController({state,drawPanel:drawTerminal,ttsPlayer:tts,voiceGuide:guide,
        getMissionContext:context, onAssistantAction: action => {
            if (action?.type==='start_operation' || action?.type==='deploy_probe') start();
            else if (['show_log','show_objective','select_topic'].includes(action?.type)) {
                tab=action.type==='show_log'?'BITACORA':action.type==='select_topic'?'CIENCIA':'OBJETIVO'; focus=false; refresh();
            } else if (action?.type==='repeat_briefing') say(context().objective);
            // Las acciones de viaje y reinicio principal no se ejecutan en la Luna.
        }});
    function text(p, value, y, size=28, color='#E8FAFF', lines=5) {
        p.ctx.fillStyle=color; p.ctx.font=`750 ${size}px system-ui, sans-serif`;
        p.ctx.textAlign='left'; p.ctx.textBaseline='top';
        drawWrapped(p.ctx,value,34,y,p.canvas.width-68,size+9,lines);
    }
    function button(p,key,label,y,primary=false,disabled=false) {
        const rect={x:32,y,w:p.canvas.width-64,h:88};
        if(primary && !disabled) drawPrimaryButton(p.ctx,rect,label,hover===key);
        else drawButton(p.ctx,rect,label,true,'#3FDCFF',disabled,26,hover===key);
        if(!disabled) p.hitZones.push({key,rect});
    }
    function refresh(error=lastError) {
        lastError=error;
        const m=getMission(), complete=m.collected===3, accent=complete?'#59F49B':'#3FDCFF';
        if(m.collected!==lastCollected) {
            logs.push(`Muestra ${m.collected} de 3 recuperada.`);
            say(complete?'Mision lunar completada. Las tres muestras estan recuperadas.':`Muestra recuperada. Faltan ${3-m.collected}.`);
            lastCollected=m.collected;
            if(complete) focus=false;
        }
        for(const p of panels) { p.hitZones=[]; drawShell(p.ctx,p.canvas.width,p.canvas.height,
            ({'moon-dossier':'CENTRO DE MISION','moon-controls':'CONTROL DE VUELO','moon-route':'RUTA HOLOGRAFICA / SECUNDARIA','moon-status':'ESTADO DE MISION','moon-resume':'EXPLORACION LUNAR'})[p.id],accent); }
        ['OBJETIVO','CIENCIA','BITACORA'].forEach((label,i)=>{
            const rect={x:28+i*240,y:96,w:224,h:62};
            drawButton(dossier.ctx,rect,label,tab===label,accent,false,22,hover===label);
            dossier.hitZones.push({key:label,rect});
        });
        text(dossier,'LUNA / RECOLECCION DE MUESTRAS',192,32,accent);
        text(dossier,tab==='OBJETIVO'?'Recoge tres muestras seleccionando las rocas con aro azul. Esta actividad no altera el progreso principal.':
            tab==='CIENCIA'?'El regolito es la capa de polvo y fragmentos que cubre el suelo lunar. Las muestras de roca permiten estudiar la historia de la Luna.':logs.join('\n'),280,28,'#E8FAFF',9);
        drawBar(dossier.ctx,34,665,692,m.collected/3*100,accent,'PROGRESO LUNAR');
        text(controls,'LUNA',100,46,accent);
        text(controls,'RECOLECCION DE MUESTRAS',165,26);
        text(controls,lastError || (!m.ready?'Cargando las muestras...':complete?'Mision completada. Puedes seguir explorando.':started?'Continua buscando los aros azules.':'IAstronaut te acompana. Inicia la operacion cuando estes listo.'),240,29,'#E8FAFF',4);
        drawBar(controls.ctx,34,470,692,m.collected/3*100,accent,'PROGRESO DE OPERACION');
        button(controls,'start',complete?'EXPLORAR LUNA':started?'RETOMAR OPERACION':'INICIAR OPERACION',540,true,!m.ready || !!lastError);
        button(controls,'repeat','REPETIR INSTRUCCION',660);
        if (onReturn) button(controls,'return','VOLVER A LA TIERRA',778);
        else text(controls,'Mision opcional / progreso independiente',790,23);
        route.ctx.strokeStyle='#286178'; route.ctx.lineWidth=5;
        route.ctx.beginPath();route.ctx.moveTo(260,155);route.ctx.lineTo(1140,155);route.ctx.stroke();
        drawDot(route.ctx,260,155,'#52BEFF',20);drawDot(route.ctx,1140,155,accent,26);
        route.ctx.fillStyle='#E8FAFF'; route.ctx.font='800 26px system-ui';
        route.ctx.fillText('TIERRA',205,215);route.ctx.fillText('LUNA',1100,215);
        route.ctx.font='700 23px system-ui';route.ctx.fillText('DESTINO SECUNDARIO',550,145);
        text(status,`LUNA  /  ${complete?'COMPLETA':started?'EN CURSO':'LISTA'}  /  MUESTRAS ${m.collected} DE 3`,98,28);
        drawBar(status.ctx,34,186,1112,m.collected/3*100,accent,'OPERACION LUNAR');
        button(resume,'panels','MOSTRAR PANELES',83);
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
        return p?.hitZones.find(z=>pointInRect({x:h.uv.x*p.canvas.width,y:(1-h.uv.y)*p.canvas.height},z.rect))?.key || '';
    }
    function clickHit(h) {
        if(!h || !meshes.includes(h.object)) return false;
        const key=keyFor(h);
        if(key==='return') {mic.stop();guide.stop();onReturn?.();}
        else if(key==='talk') void mic.toggleMic();
        else if(key==='recenter') recenter();
        else if(key==='exit' || key==='grab') {mic.stop();focus=true;refresh();}
        else if(key==='panels') {focus=false;refresh();}
        else if(key==='start') start();
        else if(key==='repeat') {say(context().objective);void guide.speak(context().objective);}
        else if(['OBJETIVO','CIENCIA','BITACORA'].includes(key)) {tab=key;refresh();}
        return true;
    }
    function hoverHit(h) {
        const key=keyFor(h);
        if(key!==hover) {hover=key;state.hoverZone=key;drawTerminal();refresh();}
        return !!h;
    }
    function scroll(ray,delta) {const h=hit(ray);if(h?.object!==terminal.panelMesh)return false;state.scrollY=Math.max(0,Math.min(state.scrollMax,state.scrollY+delta));state.autoScroll=false;drawTerminal();return true;}
    say('Bienvenido a la Luna. Revisa el objetivo, la ciencia y la bitacora. Pulsa Iniciar operacion para recoger tres muestras. Puedes hablar conmigo mediante el microfono.');
    refresh();
    window.addEventListener('pagehide',()=>{mic.stop();guide.stop();});
    return {group,refresh,click:ray=>clickHit(hit(ray)),setHover:ray=>hoverHit(hit(ray)),scroll,
        clickHit,hoverHit,getInteractiveMeshes:()=>meshes.filter(m=>m.visible && group.visible),
        stop:()=>{mic.stop();guide.stop();},canCollect:()=>started,
        onXRStart:()=>mic.onXRSessionStart(),onXREnd:()=>mic.stop()};
}
