import { SOLAR_MISSION } from './missionData.js';
import { createMoonProgress } from './moonProgress.js';
import { drawBar, drawButton, drawDot } from './panelCanvas.js';
export function drawMissionLog({ctx,state,isUnlocked,section='main',moonCount,activeMoon=false,onZone,hover=''}) {
    const options=[['main','RUTA PRINCIPAL'],['optional','LOCALIZACIONES OPCIONALES']];
    options.forEach(([key,label],i)=>{
        const rect={x:30+i*356,y:168,w:338,h:55};
        drawButton(ctx,rect,label,section===key,'#35DFF2',false,i?17:21,hover===key);
        onZone(key,rect);
    });
    if(moonCount===undefined) {
        try {moonCount=createMoonProgress(window.localStorage).getState().collected.length;} catch(_){moonCount=0;}
    }
    const extra=[['Luna','earth'],['Corona solar','sun'],['Plut\u00f3n','mercury'],['Estaci\u00f3n espacial','venus'],['Cintur\u00f3n principal','mars'],['Europa','jupiter'],['Tit\u00e1n','saturn'],['Cometa','uranus'],['Cintur\u00f3n de Kuiper','neptune']];
    const optional=section==='optional';
    const percent=optional?moonCount/3/extra.length*100:SOLAR_MISSION.filter(p=>state.completed.has(p.id)).length/SOLAR_MISSION.length*100;
    drawBar(ctx,36,266,688,percent,'#35DFF2',optional?'AVANCE OPCIONAL (9 DESTINOS)':'RED HELIOS RESTAURADA');
    const rows=optional?extra:SOLAR_MISSION.map(p=>[p.name,p.id]);
    rows.forEach(([name,parent],i)=>{
        const y=310+i*45,ready=!optional || i===0;
        const unlocked=optional?state.completed.has(parent):isUnlocked(i);
        const done=optional?i===0&&moonCount===3:state.completed.has(parent);
        const active=optional?i===0&&activeMoon:!activeMoon&&i===state.currentIndex;
        ctx.fillStyle=active?'#154658':'#0F334C';ctx.beginPath();ctx.roundRect(30,y,700,39,10);ctx.fill();
        drawDot(ctx,55,y+19,done?'#16E06B':unlocked&&ready?'#5EAFC8':'#415664',6);
        ctx.textAlign='left';ctx.textBaseline='middle';ctx.font='800 20px ui-monospace, monospace';
        ctx.fillStyle=unlocked&&ready?'#E6F8FF':'#8DA3AE';ctx.fillText(name.toUpperCase(),76,y+19);
        ctx.textAlign='right';ctx.font='800 16px ui-monospace, monospace';
        const status=!ready?'PR\u00d3XIMAMENTE':done?'COMPLETA':active?'ACTUAL':unlocked?'DISPONIBLE':'BLOQUEADA';
        ctx.fillText(optional?`${status}  ${i===0?Math.round(moonCount/3*100):0}%`:status,710,y+19);
    });
    ctx.textAlign='left';ctx.textBaseline='top';
}
