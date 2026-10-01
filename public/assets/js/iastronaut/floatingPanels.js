import { SOLAR_MISSION, MISSION_TOPIC_ORDER } from "./missionData.js";
import { roundRect } from "./canvasUtils.js";
import { drawShell, drawDot, drawWrapped, drawBar, drawButton, drawPrimaryButton, makePanel, pointInRect, circleContains } from "./panelCanvas.js";
export function createFloatingMissionPanels({ THREE, uiGroup, renderer, director, getWorldStatus, mainPanelMesh }) {
    const status = makePanel({ THREE, uiGroup, id: "status", canvasW: 1180, canvasH: 230, width: 2.12, height: 0.42, x: 0, y: -1.35, z: 0.02 });
    const controls = makePanel({ THREE, uiGroup, id: "controls", canvasW: 760, canvasH: 900, width: 1.28, height: 1.52, x: 2.02, y: -0.08, z: 0.015, rotationY: -0.08 });
    const dossier = makePanel({ THREE, uiGroup, id: "dossier", canvasW: 760, canvasH: 760, width: 1.28, height: 1.28, x: -2.02, y: -0.08, z: 0.018, rotationY: 0.08 });
    const solarMap = makePanel({ THREE, uiGroup, id: "solarMap", canvasW: 1400, canvasH: 430, width: 2.58, height: 0.79, x: 0, y: 1.31, z: 0.012 });
    const focusReturn = makePanel({ THREE, uiGroup, id: "focusReturn", canvasW: 680, canvasH: 180, width: 1.06, height: 0.28, x: -2.22, y: -1.42, z: 0.072, rotationY: 0.07 });
    focusReturn.mesh.material.depthTest = false;
    focusReturn.mesh.material.depthWrite = false;
    focusReturn.mesh.renderOrder = 120;
    const panels = [status, controls, dossier, solarMap, focusReturn];
    const mainPanelHome = mainPanelMesh ? { position: mainPanelMesh.position.clone(), rotationY: mainPanelMesh.rotation.y } : null;
    if (mainPanelMesh && mainPanelHome) {
        mainPanelHome.position.y = -0.08;
        mainPanelMesh.position.y = -0.08;
    }
    let state = director.getState();
    let hoverKey = "";
    let dossierMode = state.objectivesMode === "log" ? "log" : "mission";
    let previousObjectivesMode = state.objectivesMode;
    let previousCompleted = !!state.task.completed;
    let completionPanelsHiddenUntil = 0;
    function markAll() {
        for (const panel of panels)
            panel.dirty = true;
    }
    director.subscribe((next) => {
        state = next;
        if (next.objectivesMode !== previousObjectivesMode) {
            previousObjectivesMode = next.objectivesMode;
            dossierMode = next.objectivesMode === "log" ? "log" : "mission";
        }
        if (next.task.completed && !previousCompleted)
            completionPanelsHiddenUntil = performance.now() + 1850;
        previousCompleted = !!next.task.completed;
        markAll();
        applyVisibility();
    });
    function isHovered(panel, type, extra = "") {
        return hoverKey === `${panel.id}:${type}:${extra}`;
    }
    function applyVisibility() {
        const focus = state.focusMode && state.task.started && !state.task.completed;
        const completionHold = state.task.completed && performance.now() < completionPanelsHiddenUntil;
        status.mesh.visible = !focus && !completionHold;
        dossier.mesh.visible = !focus && !completionHold;
        solarMap.mesh.visible = !focus && !completionHold;
        controls.mesh.visible = !focus && !completionHold;
        focusReturn.mesh.visible = focus && !completionHold;
        controls.mesh.scale.set(1, 1, 1);
        if (mainPanelMesh && mainPanelHome) {
            mainPanelMesh.visible = !focus && !completionHold;
            if (!mainPanelMesh.userData.missionTargetPosition)
                mainPanelMesh.userData.missionTargetPosition = mainPanelHome.position.clone();
            mainPanelMesh.userData.missionTargetPosition.copy(mainPanelHome.position);
            mainPanelMesh.userData.missionTargetRotationY = mainPanelHome.rotationY;
        }
        const base = controls.mesh.userData.basePosition;
        base.set(1.94, 0, 0.015);
        if (focus && hoverKey && !hoverKey.startsWith("focusReturn:"))
            hoverKey = "";
    }
    function drawStatus(t) {
        const { ctx, canvas, texture } = status;
        drawShell(ctx, canvas.width, canvas.height, "ESTADO DE MISIÓN", state.current.accent);
        const taskLabel = state.task.completed ? "COMPLETA" : state.task.started ? "EN CURSO" : "LISTA";
        ctx.strokeStyle = "rgba(106, 205, 237, 0.25)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(390, 92);
        ctx.lineTo(390, 202);
        ctx.moveTo(800, 92);
        ctx.lineTo(800, 202);
        ctx.stroke();
        ctx.fillStyle = state.current.accent;
        ctx.font = "900 23px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.textBaseline = "top";
        ctx.fillText("DESTINO", 42, 95);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "900 31px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        ctx.fillText(state.current.home ? "TIERRA · CASA" : state.current.name.toUpperCase(), 42, 130);
        ctx.fillStyle = "#A9E3F2";
        ctx.font = "800 23px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.fillText(`${state.operation.title} · ${taskLabel}`, 42, 175);
        ctx.fillStyle = state.task.eventActive ? "#FFBE66" : state.current.accent;
        ctx.font = "900 23px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.fillText(state.task.eventActive ? "ALERTA" : "PROGRESO", 430, 95);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "900 31px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.fillText(state.task.eventActive ? `${Math.ceil(state.task.eventRemaining)} s` : `${Math.round(state.progress * 100)} %`, 430, 130);
        ctx.fillStyle = "#A9E3F2";
        ctx.font = "800 23px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.fillText(state.task.eventActive ? state.operation.event.label : "RED HELIOS", 430, 175);
        drawBar(ctx, 840, 145, 285, state.progress * 100, state.current.accent, "OPERACIÓN");
        texture.needsUpdate = true;
    }
    function drawControls(t = 0) {
        const { ctx, canvas, texture } = controls;
        const current = state.current;
        const world = getWorldStatus?.() || {};
        drawShell(ctx, canvas.width, canvas.height, state.focusMode ? "GUÍA DE OPERACIÓN" : "CONTROL DE VUELO", current.accent);
        controls.hitZones = [];

        if (state.focusMode && state.task.started && !state.task.completed) {
            ctx.fillStyle = current.accent;
            ctx.font = "900 29px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
            ctx.textBaseline = "top";
            ctx.fillText(state.operation.title, 36, 104);
            ctx.fillStyle = "#FFFFFF";
            ctx.font = "900 38px system-ui, -apple-system, Segoe UI, Roboto, Arial";
            ctx.fillText(world.targetLabel || "SIGUIENTE ACCIÓN", 36, 158);
            ctx.fillStyle = "#CDEFFA";
            ctx.font = "750 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
            const guidance = world.targetDetail || state.guidanceText || state.operation.hint;
            drawWrapped(ctx, guidance, 36, 216, 688, 34, 2);
            drawBar(ctx, 38, 328, 684, state.progress * 100, current.accent, "PROGRESO");
            if (state.task.eventActive) {
                ctx.fillStyle = "rgba(88, 47, 13, 0.68)";
                roundRect(ctx, 34, 392, 688, 78, 16);
                ctx.fill();
                ctx.strokeStyle = "#FFB454";
                ctx.lineWidth = 3;
                roundRect(ctx, 34, 392, 688, 78, 16);
                ctx.stroke();
                ctx.fillStyle = "#FFD28B";
                ctx.font = "900 23px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
                ctx.fillText(`${state.operation.event.label} · ${Math.ceil(state.task.eventRemaining)} s`, 58, 421);
            }
            const focusRect = { x: 64, y: 500, w: 632, h: 86 };
            drawButton(ctx, focusRect, "MOSTRAR PANELES", true, "#78E8FF", false, 24, isHovered(controls, "focus", ""));
            controls.hitZones.push({ type: "focus", rect: focusRect });
            texture.needsUpdate = true;
            return;
        }

        ctx.fillStyle = current.accent;
        ctx.font = "900 45px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        ctx.textBaseline = "top";
        ctx.fillText(current.home ? "TIERRA · CASA" : current.name.toUpperCase(), 34, 96);
        ctx.fillStyle = "#BDEBF7";
        ctx.font = "800 23px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.fillText(state.operation.title, 36, 148);
        ctx.fillStyle = "rgba(8, 39, 64, 0.96)";
        roundRect(ctx, 28, 196, 704, 174, 18);
        ctx.fill();
        ctx.strokeStyle = state.task.completed ? "#59F49B" : `${current.accent}A8`;
        ctx.lineWidth = 3;
        roundRect(ctx, 28, 196, 704, 174, 18);
        ctx.stroke();
        ctx.fillStyle = state.task.completed ? "#65F2A0" : current.accent;
        ctx.font = "900 22px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.fillText(state.task.completed ? "OPERACIÓN COMPLETA" : state.task.started ? "OPERACIÓN EN PAUSA" : "SIGUIENTE PASO", 52, 221);
        ctx.fillStyle = "#EDF9FF";
        ctx.font = "750 27px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        const instruction = state.task.completed
            ? "Registro recuperado. Selecciona el siguiente destino desbloqueado en la ruta holográfica."
            : state.task.started
                ? "Retoma la exploración para continuar con el objetivo actual."
                : state.guidanceText || "Inicia la operación y sigue las instrucciones de IAstronaut.";
        drawWrapped(ctx, instruction, 52, 270, 654, 33, 3);
        drawBar(ctx, 36, 424, 688, state.progress * 100, current.accent, "PROGRESO DE OPERACIÓN");
        const actionRect = { x: 28, y: 510, w: 704, h: 112 };
        if (!state.task.started && !state.task.completed) {
            drawPrimaryButton(ctx, actionRect, "INICIAR OPERACIÓN", isHovered(controls, "start", ""), t);
            controls.hitZones.push({ type: "start", rect: actionRect });
        }
        else if (state.task.started && !state.task.completed) {
            drawButton(ctx, actionRect, "RETOMAR OPERACIÓN", true, "#78E8FF", state.traveling, 31, isHovered(controls, "start", ""));
            controls.hitZones.push({ type: "start", rect: actionRect });
        }
        else {
            drawButton(ctx, actionRect, "OPERACIÓN COMPLETA", true, "#59F49B", true, 31, false);
        }
        const atNeptune = current.id === "neptune";
        if (atNeptune) {
            const restartRect = { x: 88, y: 654, w: 584, h: 78 };
            drawButton(ctx, restartRect, "REINICIAR MISIÓN", false, "#FF8A65", false, 27, isHovered(controls, "restart", ""));
            controls.hitZones.push({ type: "restart", rect: restartRect });
        }
        ctx.fillStyle = "#93CADB";
        ctx.font = "800 23px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.fillText(state.task.completed ? "CONTINÚA DESDE LA RUTA HOLOGRÁFICA" : "VIAJE Y PROGRESO EN LA RUTA HOLOGRÁFICA", canvas.width / 2, atNeptune ? 785 : 704);
        ctx.textAlign = "left";
        texture.needsUpdate = true;
    }
    function drawFocusReturn() {
        const { ctx, canvas, texture } = focusReturn;
        focusReturn.hitZones = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const hovered = isHovered(focusReturn, "focus", "");
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, hovered ? "rgba(30,104,137,0.98)" : "rgba(7,39,62,0.94)");
        gradient.addColorStop(1, hovered ? "rgba(14,73,104,0.98)" : "rgba(3,20,36,0.94)");
        ctx.save();
        ctx.shadowColor = hovered ? "rgba(255,255,255,0.62)" : `${state.current.accent}70`;
        ctx.shadowBlur = hovered ? 28 : 18;
        ctx.fillStyle = gradient;
        roundRect(ctx, 8, 8, canvas.width - 16, canvas.height - 16, 28);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = hovered ? "#FFFFFF" : state.current.accent;
        ctx.lineWidth = hovered ? 7 : 4;
        roundRect(ctx, 8, 8, canvas.width - 16, canvas.height - 16, 28);
        ctx.stroke();
        ctx.fillStyle = state.current.accent;
        ctx.font = "900 42px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("←  VOLVER A PANELES", canvas.width / 2, canvas.height / 2);
        ctx.textAlign = "left";
        focusReturn.hitZones.push({ type: "focus", rect: { x: 0, y: 0, w: canvas.width, h: canvas.height } });
        texture.needsUpdate = true;
    }
    function drawMissionDossier(ctx) {
        const current = state.current;
        const op = state.operation;
        ctx.fillStyle = current.accent;
        ctx.font = "900 27px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.textBaseline = "top";
        ctx.fillText(`ETAPA ${String(state.currentIndex).padStart(2, "0")} · ${current.code}`, 34, 176);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "900 37px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        drawWrapped(ctx, op.title, 34, 220, 690, 40, 2);
        ctx.fillStyle = "rgba(7, 38, 63, 0.96)";
        roundRect(ctx, 30, 310, 700, 176, 18);
        ctx.fill();
        ctx.strokeStyle = `${current.accent}AA`;
        ctx.lineWidth = 3;
        roundRect(ctx, 30, 310, 700, 176, 18);
        ctx.stroke();
        ctx.fillStyle = current.accent;
        ctx.font = "900 23px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.fillText("OBJETIVO ACTUAL", 54, 336);
        ctx.fillStyle = "#E8FAFF";
        ctx.font = "750 27px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        drawWrapped(ctx, current.objective, 54, 382, 650, 34, 3);
        drawBar(ctx, 36, 548, 688, state.progress * 100, current.accent, "PROGRESO DE OPERACIÓN");
        ctx.fillStyle = state.task.completed ? "#71F0A5" : state.task.eventActive ? "#FFC56B" : "#BDEBF7";
        ctx.font = "900 23px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        const status = state.task.completed
            ? "REGISTRO RECUPERADO"
            : state.task.eventActive
                ? `${op.event.label} · ${Math.ceil(state.task.eventRemaining)} s`
                : state.task.started
                    ? "OPERACIÓN EN CURSO"
                    : "LISTA PARA INICIAR";
        ctx.fillText(status, 40, 620);
        ctx.fillStyle = "#DDF6FF";
        ctx.font = "700 24px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        drawWrapped(ctx, state.task.completed ? current.discovery : state.guidanceText, 40, 660, 682, 31, 2);
    }
    function drawScienceDossier(ctx) {
        const current = state.current;
        const selected = current.topics[state.selectedTopic];
        ctx.fillStyle = current.accent;
        ctx.font = "900 38px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        ctx.textBaseline = "top";
        ctx.fillText(current.name.toUpperCase(), 34, 174);
        ctx.fillStyle = "#A5DDEE";
        ctx.font = "800 22px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.fillText(current.type.toUpperCase(), 36, 220);
        const topicRects = [];
        for (let i = 0; i < MISSION_TOPIC_ORDER.length; i++) {
            const key = MISSION_TOPIC_ORDER[i];
            const col = i % 2;
            const row = Math.floor(i / 2);
            const rect = { x: 30 + col * 356, y: 260 + row * 72, w: i === 4 ? 700 : 338, h: 60 };
            drawButton(ctx, rect, current.topics[key].label, key === state.selectedTopic, current.accent, false, 23, isHovered(dossier, "topic", key));
            dossier.hitZones.push({ type: "topic", key, rect });
            topicRects.push(rect);
        }
        ctx.fillStyle = "rgba(7, 38, 63, 0.96)";
        roundRect(ctx, 28, 486, 704, 226, 18);
        ctx.fill();
        ctx.strokeStyle = `${current.accent}AA`;
        ctx.lineWidth = 3;
        roundRect(ctx, 28, 486, 704, 226, 18);
        ctx.stroke();
        ctx.fillStyle = current.accent;
        ctx.font = "900 27px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.fillText(selected.value.toUpperCase(), 54, 514);
        ctx.fillStyle = "#E8FAFF";
        ctx.font = "700 25px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        drawWrapped(ctx, selected.detail, 54, 558, 650, 32, 4);
    }
    function drawLogDossier(ctx) {
        const completedCount = SOLAR_MISSION.filter((item) => state.completed.has(item.id)).length;
        drawBar(ctx, 36, 184, 688, completedCount / SOLAR_MISSION.length * 100, "#35DFF2", "RED HELIOS RESTAURADA");
        let y = 246;
        for (let i = 0; i < SOLAR_MISSION.length; i++) {
            const item = SOLAR_MISSION[i];
            const done = state.completed.has(item.id);
            const active = i === state.currentIndex;
            const unlocked = director.isUnlocked(i);
            ctx.fillStyle = active ? `${item.accent}38` : "rgba(15, 51, 76, 0.62)";
            roundRect(ctx, 30, y, 700, 46, 11);
            ctx.fill();
            drawDot(ctx, 58, y + 23, done ? "#16E06B" : active ? item.accent : unlocked ? "#5EAFC8" : "#415664", 7, done || active ? 12 : 0);
            ctx.fillStyle = unlocked ? "#E6F8FF" : "#718995";
            ctx.font = "800 23px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
            ctx.textBaseline = "middle";
            ctx.fillText(`${String(i).padStart(2, "0")} · ${item.name.toUpperCase()}`, 84, y + 23);
            ctx.textAlign = "right";
            ctx.fillStyle = done ? "#77F4A8" : active ? item.accent : unlocked ? "#91D3E7" : "#617782";
            ctx.fillText(done ? "COMPLETA" : active ? "ACTUAL" : unlocked ? "DISPONIBLE" : "BLOQUEADA", 702, y + 23);
            ctx.textAlign = "left";
            y += 50;
        }
    }
    function drawDossier() {
        const { ctx, canvas, texture } = dossier;
        drawShell(ctx, canvas.width, canvas.height, "CENTRO DE MISIÓN", state.current.accent);
        dossier.hitZones = [];
        const modes = [
            { mode: "mission", label: "OBJETIVO", x: 28 },
            { mode: "science", label: "CIENCIA", x: 269 },
            { mode: "log", label: "BITÁCORA", x: 510 },
        ];
        for (const item of modes) {
            const rect = { x: item.x, y: 92, w: 222, h: 58 };
            drawButton(ctx, rect, item.label, dossierMode === item.mode, state.current.accent, false, 24, isHovered(dossier, "dossierMode", item.mode));
            dossier.hitZones.push({ type: "dossierMode", mode: item.mode, rect });
        }
        if (dossierMode === "science")
            drawScienceDossier(ctx);
        else if (dossierMode === "log")
            drawLogDossier(ctx);
        else
            drawMissionDossier(ctx);
        texture.needsUpdate = true;
    }
    function drawSolarMap(t) {
        const { ctx, canvas, texture } = solarMap;
        drawShell(ctx, canvas.width, canvas.height, "RUTA HOLOGRÁFICA", state.current.accent);
        solarMap.hitZones = [];
        const startX = 108;
        const gap = 148;
        const y = 236;
        let nextIndex = -1;
        if (state.task.completed) {
            for (let i = 1; i < SOLAR_MISSION.length; i++) {
                if (!state.completed.has(SOLAR_MISSION[i].id) && director.isUnlocked(i)) {
                    nextIndex = i;
                    break;
                }
            }
        }
        ctx.strokeStyle = "rgba(75, 206, 239, 0.30)";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(startX + gap * (SOLAR_MISSION.length - 1), y);
        ctx.stroke();
        if (nextIndex >= 0) {
            const routeStart = startX + gap * state.currentIndex;
            const routeEnd = startX + gap * nextIndex;
            ctx.save();
            ctx.shadowColor = "rgba(255,184,77,0.9)";
            ctx.shadowBlur = 24;
            ctx.strokeStyle = "#FFB84D";
            ctx.lineWidth = 10;
            ctx.beginPath();
            ctx.moveTo(routeStart, y);
            ctx.lineTo(routeEnd, y);
            ctx.stroke();
            ctx.restore();
        }
        for (let i = 0; i < SOLAR_MISSION.length; i++) {
            const item = SOLAR_MISSION[i];
            const x = startX + gap * i;
            const unlocked = director.isUnlocked(i);
            const done = state.completed.has(item.id);
            const active = i === state.currentIndex;
            const next = i === nextIndex;
            const hovered = isHovered(solarMap, "destination", i);
            if (next) {
                const pulse = 1 + Math.sin(t * 2.1) * 0.07;
                ctx.save();
                ctx.shadowColor = "rgba(255,184,77,0.95)";
                ctx.shadowBlur = 34;
                ctx.strokeStyle = "#FFB84D";
                ctx.lineWidth = 7;
                ctx.beginPath();
                ctx.arc(x, y, 45 * pulse, 0, Math.PI * 2);
                ctx.stroke();
                ctx.strokeStyle = "rgba(255,218,157,0.78)";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(x, y, 57 * pulse, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
                ctx.fillStyle = "#FFD89B";
                ctx.font = "900 23px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
                ctx.textAlign = "center";
                ctx.fillText("SIGUIENTE DESTINO", x, y - 82);
                ctx.fillStyle = "#FFB84D";
                ctx.beginPath();
                ctx.moveTo(x, y - 58);
                ctx.lineTo(x - 10, y - 72);
                ctx.lineTo(x + 10, y - 72);
                ctx.closePath();
                ctx.fill();
            }
            if (hovered || active) {
                ctx.save();
                ctx.shadowColor = hovered ? "rgba(255,255,255,0.95)" : item.accent;
                ctx.shadowBlur = hovered ? 30 : 20;
                ctx.strokeStyle = hovered ? "#FFFFFF" : item.accent;
                ctx.lineWidth = hovered ? 7 : 5;
                ctx.beginPath();
                ctx.arc(x, y, active ? 36 + Math.sin(t * 2.3) * 2 : 36, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
            ctx.save();
            if (next) {
                ctx.shadowColor = "rgba(255,184,77,0.92)";
                ctx.shadowBlur = 24;
            }
            ctx.fillStyle = unlocked ? item.accent : "#405865";
            ctx.beginPath();
            ctx.arc(x, y, next ? (item.id === "sun" ? 30 : 25) : item.id === "sun" ? 23 : 17, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            if (done) {
                ctx.strokeStyle = "#5CFF9D";
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(x, y, next ? 35 : 28, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.fillStyle = hovered || next ? "#FFFFFF" : unlocked ? "#E8FAFF" : "#6E838D";
            ctx.font = `${next ? "900 24px" : "800 22px"} ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
            ctx.textAlign = "center";
            ctx.fillText(item.name.toUpperCase(), x, y + 64);
            solarMap.hitZones.push({ type: "destination", index: i, circle: { x, y, r: next ? 60 : 48 } });
        }
        ctx.textAlign = "center";
        ctx.fillStyle = nextIndex >= 0 ? "#FFD89B" : "#BCEBFA";
        ctx.font = "850 25px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        const footer = nextIndex >= 0
            ? `SIGUIENTE DESTINO: ${SOLAR_MISSION[nextIndex].name.toUpperCase()} · SELECCIÓNALO PARA CONTINUAR`
            : state.currentIndex === SOLAR_MISSION.length - 1 && state.task.completed
                ? "RUTA HELIOS COMPLETA · PUEDES VOLVER A CUALQUIER DESTINO DESBLOQUEADO"
                : "LOS DESTINOS DESBLOQUEADOS PUEDEN SELECCIONARSE EN CUALQUIER MOMENTO";
        ctx.fillText(footer, canvas.width / 2, 377);
        ctx.textAlign = "left";
        texture.needsUpdate = true;
    }
    function drawPanelWhenNeeded(panel, t, interval, draw) {
        if (!panel.mesh.visible)
            return;
        if (!panel.dirty && t - panel.lastDraw < interval)
            return;
        draw();
        panel.dirty = false;
        panel.lastDraw = t;
    }
    function drawDirty(t) {
        drawPanelWhenNeeded(status, t, 0.35, () => drawStatus(t));
        drawPanelWhenNeeded(controls, t, 0.08, () => drawControls(t));
        drawPanelWhenNeeded(dossier, t, 0.25, drawDossier);
        drawPanelWhenNeeded(solarMap, t, 0.25, () => drawSolarMap(t));
        drawPanelWhenNeeded(focusReturn, t, 0.08, drawFocusReturn);
    }
    function findZone(panel, point) {
        return panel.hitZones.find((zone) => zone.rect ? pointInRect(point, zone.rect, 7) : zone.circle ? circleContains(point, zone.circle, 5) : false) || null;
    }
    function zoneKey(panel, zone) {
        if (!zone)
            return "";
        const extra = zone.key ?? zone.mode ?? zone.index ?? "";
        return `${panel.id}:${zone.type}:${extra}`;
    }
    function setHoverHit(hit) {
        const panelId = hit?.object?.userData?.missionPanelId || "";
        const panel = panels.find((item) => item.id === panelId && item.mesh.visible);
        let next = "";
        if (panel && hit?.uv) {
            const point = { x: hit.uv.x * panel.canvas.width, y: (1 - hit.uv.y) * panel.canvas.height };
            next = zoneKey(panel, findZone(panel, point));
        }
        if (next !== hoverKey) {
            hoverKey = next;
            markAll();
        }
        return !!next;
    }
    async function handleHit(hit) {
        const panelId = hit?.object?.userData?.missionPanelId;
        const panel = panels.find((item) => item.id === panelId && item.mesh.visible);
        if (!panel || !hit.uv)
            return false;
        const point = { x: hit.uv.x * panel.canvas.width, y: (1 - hit.uv.y) * panel.canvas.height };
        const zone = findZone(panel, point);
        if (!zone)
            return false;
        if (zone.type === "topic") {
            dossierMode = "science";
            director.setSelectedTopic(zone.key);
        }
        else if (zone.type === "dossierMode") {
            dossierMode = zone.mode;
            if (zone.mode === "log")
                director.setObjectivesMode("log");
            else if (zone.mode === "mission")
                director.setObjectivesMode("mission");
            markAll();
        }
        else if (zone.type === "start") {
            if (state.task.started && !state.task.completed)
                director.setFocusMode(true);
            else
                director.startOperation();
        }
        else if (zone.type === "focus")
            director.setFocusMode(!state.focusMode);
        else if (zone.type === "home")
            await director.home();
        else if (zone.type === "previous")
            await director.previous();
        else if (zone.type === "next")
            await director.next();
        else if (zone.type === "destination")
            await director.travelTo(zone.index);
        else if (zone.type === "restart")
            await director.restartMission();
        else
            return false;
        return true;
    }
    function update(t) {
        applyVisibility();
        for (const panel of panels) {
            if (!panel.mesh.visible)
                continue;
            const base = panel.mesh.userData.basePosition;
            panel.mesh.position.x += (base.x - panel.mesh.position.x) * 0.2;
            panel.mesh.position.y += (base.y - panel.mesh.position.y) * 0.2;
            panel.mesh.position.z += (base.z - panel.mesh.position.z) * 0.2;
        }
        if (mainPanelMesh?.visible && mainPanelMesh.userData.missionTargetPosition) {
            const target = mainPanelMesh.userData.missionTargetPosition;
            mainPanelMesh.position.x += (target.x - mainPanelMesh.position.x) * 0.2;
            mainPanelMesh.position.y += (target.y - mainPanelMesh.position.y) * 0.2;
            mainPanelMesh.position.z += (target.z - mainPanelMesh.position.z) * 0.2;
            const targetRotation = Number(mainPanelMesh.userData.missionTargetRotationY || 0);
            mainPanelMesh.rotation.y += (targetRotation - mainPanelMesh.rotation.y) * 0.2;
        }
        drawDirty(t);
    }
    function initialize() {
        markAll();
        applyVisibility();
        drawDirty(0);
    }
    return {
        update,
        initialize,
        handleHit,
        setHoverHit,
        getInteractiveMeshes: () => panels.filter((panel) => panel.mesh.visible).map((panel) => panel.mesh),
    };
}
