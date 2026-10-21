import { drawSolarRoute } from "./solarRoute.js";
import { SOLAR_MISSION } from "./missionData.js";
import { createPanel, createUIState, drawPanelFactory, addBubble } from './uiPanel.js';
import { makePanel, drawShell, drawWrapped, drawBar, drawButton, drawPrimaryButton, drawDot, pointInRect } from './panelCanvas.js';
import { HIT_ZONES, MAIN_PANEL_Y, MAIN_PANEL_HEIGHT, MAIN_PANEL_WIDTH, PANEL_LAYOUT_GAP } from './config.js';
import { createTTSPlayer, createVoiceGuide } from './voice.js';
import { createMicChatController } from './chat.js';

export function createMoonInterface({ THREE, scene, renderer, getMission, recenter, onReturn = null, onStart = null, navigation = null }) {
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
        function card(p, label, body, y, height, lines=3) {
            const c=p.ctx;
            c.fillStyle='#082740'; c.strokeStyle=accent; c.lineWidth=3;
            c.beginPath(); c.roundRect(28,y,704,height,18); c.fill(); c.stroke();
            c.fillStyle=accent; c.font='900 22px ui-monospace, monospace';
            c.textAlign='left'; c.textBaseline='top'; c.fillText(label,52,y+25);
            c.fillStyle='#EDF9FF'; c.font='750 27px system-ui, sans-serif';
            drawWrapped(c,body,52,y+74,654,33,lines);
        }
        text(dossier,'MISI\u00d3N SECUNDARIA \u00b7 LUNA',180,23,accent,1);
        text(dossier,'RECOLECCI\u00d3N DE MUESTRAS',225,32,'#FFFFFF',2);
        if(tab==='OBJETIVO') {
            card(dossier,'OBJETIVO ACTUAL','Recoge tres muestras seleccionando las rocas con aro azul.',320,174);
            drawBar(dossier.ctx,36,548,688,m.collected/3*100,accent,'PROGRESO DE OPERACI\u00d3N');
            text(dossier,complete?'MUESTRAS RECUPERADAS':started?'OPERACI\u00d3N EN CURSO':'LISTA PARA INICIAR',610,23,accent,1);
            text(dossier,'Misi\u00f3n opcional. El progreso principal no cambia.',650,25,'#E8FAFF',2);
        } else {
            card(dossier,tab==='CIENCIA'?'CIENCIA LUNAR':'BIT\u00c1CORA',tab==='CIENCIA'
                ?'El regolito es la capa de polvo y fragmentos que cubre el suelo lunar. Las muestras permiten estudiar la historia de la Luna.'
                :logs.join(' '),320,370,8);
        }
        text(controls,'LUNA',96,45,accent,1);
        text(controls,'RECOLECCI\u00d3N DE MUESTRAS',148,23,'#BDEBF7',1);
        card(controls,complete?'OPERACI\u00d3N COMPLETA':started?'OPERACI\u00d3N EN PAUSA':'SIGUIENTE PASO',
            lastError || (!m.ready?'Cargando las muestras...':complete?'Las tres muestras est\u00e1n recuperadas. Puedes volver a la Tierra.':started?'Retoma la exploraci\u00f3n para buscar los aros azules.':'IAstronaut te guiar\u00e1 paso a paso durante la misi\u00f3n.'),196,174);
        drawBar(controls.ctx,36,424,688,m.collected/3*100,accent,'PROGRESO DE OPERACI\u00d3N');
        button(controls,'start',complete?'EXPLORAR LUNA':started?'RETOMAR OPERACI\u00d3N':'INICIAR OPERACI\u00d3N',510,true,!m.ready || !!lastError);
        button(controls,'repeat','REPETIR INSTRUCCI\u00d3N',660);
        if (onReturn) button(controls,'return','VOLVER A LA TIERRA',778);
        else text(controls,'Misi\u00f3n opcional / progreso independiente',790,23);
        const routeState=navigation?.getState() || {current:SOLAR_MISSION[0], currentIndex:0, task:{completed:true}, completed:new Set(['earth']), traveling:false};
        drawSolarRoute({solarMap:route, state:routeState,
            director:{isUnlocked:i=>navigation ? navigation.isUnlocked(i) : i<=1},
            isHovered:(_p,type,index='')=>hover===`${type}:${index}`, onMoon:true, activeMoon:true});
        text(status,'DESTINO',86,22,accent,1);
        text(status,'LUNA',119,32,'#FFFFFF',1);
        text(status,complete?'MUESTRAS RECUPERADAS':started?'RECOLECCI\u00d3N EN CURSO':'LISTA PARA INICIAR',174,19,'#BDEBF7',1);
        const c=status.ctx;
        c.strokeStyle='#286178'; c.lineWidth=2;
        [382,798].forEach(x=>{c.beginPath();c.moveTo(x,85);c.lineTo(x,204);c.stroke();});
        c.fillStyle=accent;c.font='800 22px ui-monospace, monospace';c.fillText('MUESTRAS',420,86);
        c.fillStyle='#FFFFFF';c.font='900 32px system-ui';c.fillText(`${m.collected} / 3`,420,119);
        c.fillStyle='#BDEBF7';c.font='800 20px ui-monospace, monospace';c.fillText('MISI\u00d3N OPCIONAL',420,174);
        drawBar(c,838,155,306,m.collected/3*100,accent,'OPERACI\u00d3N');
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
        const point=p?{x:h.uv.x*p.canvas.width,y:(1-h.uv.y)*p.canvas.height}:null;
        const zone=p?.hitZones.find(z=>z.rect?pointInRect(point,z.rect):Math.hypot(point.x-z.circle.x,point.y-z.circle.y)<=z.circle.r);
        return zone?.key || (zone?.type==='destination'?`destination:${zone.index}`:zone?.type==='moon'?'moon:':'');
    }
    function clickHit(h) {
        if(!h || !meshes.includes(h.object)) return false;
        const key=keyFor(h);
        if(key.startsWith('destination:')) {void navigation?.travelTo(Number(key.split(':')[1]));}
        else if(key==='return') {mic.stop();guide.stop();onReturn?.();}
        else if(key==='talk') void mic.toggleMic();
        else if(key==='recenter') recenter();
        else if(key==='exit') {mic.stop();focus=true;refresh();}
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
    return {group,refresh,inputContext:{panelMesh:terminal.panelMesh,panelCanvas:terminal.panelCanvas,uiGroup:group,state,drawPanel:drawTerminal},click:ray=>clickHit(hit(ray)),setHover:ray=>hoverHit(hit(ray)),scroll,
        clickHit,hoverHit,getInteractiveMeshes:()=>meshes.filter(m=>m.visible && group.visible),
        stop:()=>{mic.stop();guide.stop();},canCollect:()=>started,
        onXRStart:()=>mic.onXRSessionStart(),onXREnd:()=>mic.stop()};
}
