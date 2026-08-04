import { SOLAR_MISSION, MISSION_TOPIC_ORDER } from "./missionData.js";
function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + rr, y, rr);
    ctx.closePath();
}
function drawShell(ctx, w, h, title, accent = "#3FDCFF") {
    ctx.clearRect(0, 0, w, h);
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, "rgba(8, 29, 52, 0.985)");
    gradient.addColorStop(1, "rgba(1, 7, 18, 0.992)");
    ctx.save();
    ctx.shadowColor = `${accent}55`;
    ctx.shadowBlur = 24;
    ctx.fillStyle = gradient;
    roundRect(ctx, 8, 8, w - 16, h - 16, 24);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = `${accent}D8`;
    ctx.lineWidth = 4;
    roundRect(ctx, 8, 8, w - 16, h - 16, 24);
    ctx.stroke();
    ctx.fillStyle = "rgba(12, 49, 82, 0.92)";
    roundRect(ctx, 10, 10, w - 20, 66, 21);
    ctx.fill();
    ctx.fillRect(10, 48, w - 20, 28);
    ctx.strokeStyle = `${accent}77`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, 76);
    ctx.lineTo(w - 10, 76);
    ctx.stroke();
    ctx.fillStyle = "#E8FAFF";
    ctx.font = "900 32px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    ctx.textBaseline = "middle";
    ctx.fillText(title, 30, 43);
}
function drawDot(ctx, x, y, color, radius = 8, glow = 18) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}
function wrapLines(ctx, text, maxWidth) {
    const paragraphs = String(text || "").split(/\r?\n/);
    const lines = [];
    for (let p = 0; p < paragraphs.length; p++) {
        const words = paragraphs[p].split(/\s+/).filter(Boolean);
        let line = "";
        for (const word of words) {
            const test = line ? `${line} ${word}` : word;
            if (!line || ctx.measureText(test).width <= maxWidth)
                line = test;
            else {
                lines.push(line);
                line = word;
            }
        }
        if (line)
            lines.push(line);
        if (p < paragraphs.length - 1)
            lines.push("");
    }
    return lines;
}
function drawWrapped(ctx, text, x, y, maxWidth, lineHeight, maxLines = 5) {
    const lines = wrapLines(ctx, text, maxWidth).slice(0, maxLines);
    for (let i = 0; i < lines.length; i++)
        ctx.fillText(lines[i], x, y + i * lineHeight);
    return lines.length;
}
function drawBar(ctx, x, y, w, value, color, label) {
    const v = Math.max(0, Math.min(100, value));
    ctx.fillStyle = "rgba(58, 113, 148, 0.25)";
    roundRect(ctx, x, y, w, 24, 12);
    ctx.fill();
    if (v > 0) {
        ctx.fillStyle = color;
        roundRect(ctx, x, y, Math.max(22, w * v / 100), 24, 12);
        ctx.fill();
    }
    ctx.fillStyle = "#B9EAF7";
    ctx.font = "800 21px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    ctx.textBaseline = "bottom";
    ctx.fillText(label, x, y - 9);
    ctx.textAlign = "right";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(`${Math.round(v)}%`, x + w, y - 9);
    ctx.textAlign = "left";
}
function drawButton(ctx, rect, label, active, accent, disabled = false, size = 23, hovered = false) {
    ctx.save();
    ctx.shadowColor = hovered && !disabled ? accent : "rgba(0,0,0,0)";
    ctx.shadowBlur = hovered && !disabled ? 28 : 0;
    ctx.fillStyle = disabled
        ? "rgba(42, 58, 72, 0.38)"
        : hovered
            ? `${accent}66`
            : active
                ? `${accent}3D`
                : "rgba(18, 69, 102, 0.62)";
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 15);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = disabled ? "rgba(104,126,142,0.3)" : hovered ? "#FFFFFF" : active ? accent : "rgba(82,203,242,0.68)";
    ctx.lineWidth = hovered ? 6 : active ? 4 : 3;
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 15);
    ctx.stroke();
    ctx.fillStyle = disabled ? "rgba(180,194,202,0.5)" : hovered ? "#FFFFFF" : active ? "#F5FDFF" : "#C8F3FC";
    ctx.font = `900 ${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.textAlign = "left";
}
function makePanel({ THREE, uiGroup, id, canvasW, canvasH, width, height, x, y, z, rotationY = 0 }) {
    const canvas = document.createElement("canvas");
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext("2d", { alpha: true });
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false, toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotationY;
    mesh.renderOrder = 2.5;
    mesh.userData.basePosition = mesh.position.clone();
    mesh.userData.missionPanelId = id;
    uiGroup.add(mesh);
    return { id, canvas, ctx, texture, mesh, hitZones: [], dirty: true, lastDraw: -Infinity };
}
function pointInRect(point, rect, padding = 0) {
    return point.x >= rect.x - padding && point.x <= rect.x + rect.w + padding && point.y >= rect.y - padding && point.y <= rect.y + rect.h + padding;
}
function circleContains(point, circle, padding = 0) {
    const dx = point.x - circle.x;
    const dy = point.y - circle.y;
    const radius = circle.r + padding;
    return dx * dx + dy * dy <= radius * radius;
}
function isQuestUA() {
    return /OculusBrowser|Meta Quest|Quest 2|Quest 3|Quest Pro/i.test(navigator.userAgent || "");
}
function isMobileUA() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}
function formatMissionTime(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const h = String(Math.floor(total / 3600)).padStart(2, "0");
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
}
export function createFloatingMissionPanels({ THREE, uiGroup, renderer, director, getWorldStatus, mainPanelMesh }) {
    const status = makePanel({ THREE, uiGroup, id: "status", canvasW: 1180, canvasH: 230, width: 2.12, height: 0.42, x: 0, y: 1.25, z: 0.02 });
    const controls = makePanel({ THREE, uiGroup, id: "controls", canvasW: 760, canvasH: 900, width: 1.28, height: 1.52, x: 1.94, y: 0, z: 0.015, rotationY: -0.08 });
    const dossier = makePanel({ THREE, uiGroup, id: "dossier", canvasW: 760, canvasH: 760, width: 1.28, height: 1.28, x: -1.94, y: 0, z: 0.018, rotationY: 0.08 });
    const solarMap = makePanel({ THREE, uiGroup, id: "solarMap", canvasW: 1120, canvasH: 330, width: 1.92, height: 0.57, x: 0, y: -1.30, z: 0.018 });
    const panels = [status, controls, dossier, solarMap];
    const mainPanelHome = mainPanelMesh ? { position: mainPanelMesh.position.clone(), rotationY: mainPanelMesh.rotation.y } : null;
    const startAt = performance.now();
    let state = director.getState();
    let hoverKey = "";
    let dossierMode = state.objectivesMode === "log" ? "log" : "mission";
    let previousObjectivesMode = state.objectivesMode;
    const device = { checking: true, supportsVR: false, isQuest: isQuestUA(), isMobile: isMobileUA(), presenting: renderer.xr.isPresenting };
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
        markAll();
        applyVisibility();
    });
    function isHovered(panel, type, extra = "") {
        return hoverKey === `${panel.id}:${type}:${extra}`;
    }
    function applyVisibility() {
        const focus = state.focusMode && state.task.started && !state.task.completed;
        status.mesh.visible = !focus;
        dossier.mesh.visible = !focus;
        solarMap.mesh.visible = !focus;
        controls.mesh.visible = true;
        if (mainPanelMesh && mainPanelHome) {
            mainPanelMesh.visible = !focus;
            if (!mainPanelMesh.userData.missionTargetPosition)
                mainPanelMesh.userData.missionTargetPosition = mainPanelHome.position.clone();
            mainPanelMesh.userData.missionTargetPosition.copy(mainPanelHome.position);
            mainPanelMesh.userData.missionTargetRotationY = mainPanelHome.rotationY;
        }
        const base = controls.mesh.userData.basePosition;
        base.set(focus ? 2.16 : 1.94, 0, 0.015);
        if (focus && hoverKey && !hoverKey.startsWith("controls:"))
            hoverKey = "";
    }
    function helmetStatus() {
        if (device.presenting)
            return { color: "#16E06B", title: "CASCO EN LÍNEA", detail: device.isQuest ? "META QUEST · XR ACTIVO" : "VISOR XR · SEGUIMIENTO ACTIVO" };
        if (device.checking)
            return { color: "#F2C94C", title: "VERIFICANDO XR", detail: "ESCANEANDO COMPATIBILIDAD" };
        if (device.isQuest && device.supportsVR)
            return { color: "#16E06B", title: "CASCO LISTO", detail: "META QUEST · WEBXR OPERATIVO" };
        if (device.supportsVR)
            return { color: "#53D8FF", title: "VISOR COMPATIBLE", detail: "MODO INMERSIVO DISPONIBLE" };
        return { color: "#FFB454", title: "CASCO NO DETECTADO", detail: device.isMobile ? "TELÉFONO O TABLET" : "COMPUTADORA · USA META QUEST" };
    }
    function drawStatus(t) {
        const helmet = helmetStatus();
        const { ctx, canvas, texture } = status;
        drawShell(ctx, canvas.width, canvas.height, "SISTEMAS DE MISIÓN", state.current.accent);
        const elapsed = (performance.now() - startAt) / 1000;
        const taskLabel = state.task.completed ? "COMPLETA" : state.task.started ? "ACTIVA" : "EN ESPERA";
        ctx.strokeStyle = "rgba(106, 205, 237, 0.25)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(500, 92);
        ctx.lineTo(500, 202);
        ctx.moveTo(845, 92);
        ctx.lineTo(845, 202);
        ctx.stroke();
        drawDot(ctx, 58, 142, helmet.color, 9 + Math.sin(t * 3.2) * 1.2, 26);
        ctx.fillStyle = helmet.color;
        ctx.font = "900 29px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.textBaseline = "top";
        ctx.fillText(helmet.title, 96, 96);
        ctx.fillStyle = "#C9F1FA";
        ctx.font = "800 20px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.fillText(helmet.detail, 96, 142);
        ctx.fillStyle = state.current.accent;
        ctx.font = "900 24px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.fillText("DESTINO", 535, 94);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "900 31px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        ctx.fillText(state.current.home ? "TIERRA · CASA" : state.current.name.toUpperCase(), 535, 127);
        ctx.fillStyle = "#A9E3F2";
        ctx.font = "800 19px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.fillText(`${state.current.code} · ${taskLabel}`, 535, 172);
        ctx.fillStyle = state.task.eventActive ? "#FFBE66" : state.current.accent;
        ctx.font = "900 24px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.fillText(state.task.eventActive ? "ALERTA" : "TIEMPO DE MISIÓN", 880, 94);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "900 31px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.fillText(state.task.eventActive ? `${Math.ceil(state.task.eventRemaining)} s` : formatMissionTime(elapsed), 880, 127);
        ctx.fillStyle = "#A9E3F2";
        ctx.font = "800 19px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.fillText(state.task.eventActive ? state.operation.event.label : "ENLACE ESTABLE", 880, 172);
        texture.needsUpdate = true;
    }
    function drawControls() {
        const { ctx, canvas, texture } = controls;
        const current = state.current;
        const next = SOLAR_MISSION[state.currentIndex + 1] || null;
        const world = getWorldStatus?.() || {};
        const surveyDecisionReady = state.operation.type === "survey" && state.operation.targets.every((target) => state.task.targets?.[target.id]?.scanned);
        drawShell(ctx, canvas.width, canvas.height, "CONTROL DE VUELO", current.accent);
        controls.hitZones = [];
        ctx.fillStyle = current.accent;
        ctx.font = "900 45px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        ctx.textBaseline = "top";
        ctx.fillText(current.home ? "TIERRA · CASA" : current.name.toUpperCase(), 34, 91);
        ctx.fillStyle = "#BDEBF7";
        ctx.font = "800 23px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.fillText(state.operation.title, 36, 140);
        ctx.fillStyle = "rgba(8, 39, 64, 0.96)";
        roundRect(ctx, 28, 180, 704, 132, 18);
        ctx.fill();
        ctx.strokeStyle = state.task.eventActive ? "#FFB454" : `${current.accent}A8`;
        ctx.lineWidth = 3;
        roundRect(ctx, 28, 180, 704, 132, 18);
        ctx.stroke();
        ctx.fillStyle = state.task.completed ? "#65F2A0" : state.task.started ? current.accent : "#FFCE73";
        ctx.font = "900 22px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.fillText(state.task.completed ? "OPERACIÓN FINALIZADA" : state.task.started ? "MODO EXPLORACIÓN ACTIVO" : "PASO 1 · DESPLEGAR SONDA", 52, 202);
        ctx.fillStyle = "#EDF9FF";
        ctx.font = "750 25px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        const instruction = state.task.completed
            ? next ? `Registro recuperado. Selecciona SIGUIENTE para viajar a ${next.name}.` : "La red Helios está restaurada. Puedes volver a la Tierra."
            : state.task.started
                ? state.focusMode
                    ? surveyDecisionReady
                        ? "Todas las lecturas están visibles. Compáralas y selecciona de nuevo la opción que cumple el criterio indicado."
                        : "Los objetivos están distribuidos alrededor de tu posición. Gira para localizarlos y sigue las burbujas de ayuda."
                    : "La exploración está pausada. Selecciona INICIAR EXPLORACIÓN para volver a los objetivos."
                : "Inicia la operación. La terminal se ocultará y aparecerán ayudas junto a cada objetivo.";
        drawWrapped(ctx, instruction, 52, 240, 654, 29, 2);
        ctx.fillStyle = "rgba(4, 26, 45, 0.98)";
        roundRect(ctx, 28, 330, 704, 142, 18);
        ctx.fill();
        ctx.strokeStyle = world.pressedTargetId ? "#FFFFFF" : `${current.accent}8F`;
        ctx.lineWidth = world.pressedTargetId ? 5 : 3;
        roundRect(ctx, 28, 330, 704, 142, 18);
        ctx.stroke();
        const cx = 88;
        const cy = 401;
        ctx.strokeStyle = world.completed ? "#5CFF9D" : world.pressedTargetId ? "#FFFFFF" : current.accent;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(cx, cy, 40, 0, Math.PI * 2);
        ctx.stroke();
        if (world.pressedTargetId) {
            ctx.strokeStyle = current.accent;
            ctx.lineWidth = 11;
            ctx.beginPath();
            ctx.arc(cx, cy, 53, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * world.holdProgress);
            ctx.stroke();
        }
        ctx.fillStyle = world.completed ? "#5CFF9D" : current.accent;
        ctx.font = "900 22px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(world.completed ? "OK" : world.pressedTargetId ? `${Math.round(world.holdProgress * 100)}%` : "SCAN", cx, cy);
        ctx.textAlign = "left";
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "900 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        ctx.textBaseline = "top";
        ctx.fillText(world.targetLabel || (surveyDecisionReady ? "DECISIÓN FINAL" : state.task.started ? "BUSCA UN OBJETIVO" : "SONDA EN ESPERA"), 160, 350);
        ctx.fillStyle = "#BFEAF7";
        ctx.font = "750 23px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        drawWrapped(ctx, world.targetDetail || (surveyDecisionReady ? state.operation.selectionPrompt : state.operation.hint), 160, 390, 536, 29, 3);
        const actionRect = { x: 28, y: 492, w: 704, h: 96 };
        const actionLabel = state.task.completed ? "OPERACIÓN COMPLETA" : state.task.started ? "SONDA DESPLEGADA" : "INICIAR OPERACIÓN";
        drawButton(ctx, actionRect, actionLabel, state.task.started, current.accent, state.traveling || state.task.completed, 31, isHovered(controls, "start", ""));
        controls.hitZones.push({ type: "start", rect: actionRect });
        const focusRect = { x: 28, y: 608, w: 704, h: 72 };
        drawButton(ctx, focusRect, state.focusMode ? "MOSTRAR TERMINAL Y PANELES" : "INICIAR EXPLORACIÓN", state.focusMode, "#78E8FF", false, 23, isHovered(controls, "focus", ""));
        controls.hitZones.push({ type: "focus", rect: focusRect });
        const homeRect = { x: 28, y: 700, w: 704, h: 68 };
        drawButton(ctx, homeRect, current.home ? "EN CASA" : "VOLVER A CASA", current.home, "#39DFF5", current.home || state.traveling, 25, isHovered(controls, "home", ""));
        controls.hitZones.push({ type: "home", rect: homeRect });
        const prevRect = { x: 28, y: 790, w: 338, h: 74 };
        const nextRect = { x: 394, y: 790, w: 338, h: 74 };
        drawButton(ctx, prevRect, "ANTERIOR", false, current.accent, !state.canPrevious, 25, isHovered(controls, "previous", ""));
        drawButton(ctx, nextRect, next ? "SIGUIENTE" : "FIN DE RUTA", state.canAdvance, current.accent, !state.canAdvance, 25, isHovered(controls, "next", ""));
        controls.hitZones.push({ type: "previous", rect: prevRect });
        controls.hitZones.push({ type: "next", rect: nextRect });
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
        drawWrapped(ctx, op.title, 34, 216, 690, 40, 2);
        ctx.fillStyle = "#DDF6FF";
        ctx.font = "750 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        drawWrapped(ctx, op.briefing, 34, 302, 690, 34, 4);
        drawBar(ctx, 36, 466, 688, state.progress * 100, current.accent, "PROGRESO DE OPERACIÓN");
        ctx.fillStyle = "rgba(8, 42, 68, 0.92)";
        roundRect(ctx, 30, 536, 700, 176, 18);
        ctx.fill();
        ctx.strokeStyle = state.task.completed ? "#59F49B" : `${current.accent}99`;
        ctx.lineWidth = 3;
        roundRect(ctx, 30, 536, 700, 176, 18);
        ctx.stroke();
        ctx.fillStyle = state.task.completed ? "#71F0A5" : state.task.eventActive ? "#FFC56B" : current.accent;
        ctx.font = "900 24px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.fillText(state.task.completed ? "REGISTRO RECUPERADO" : state.task.eventActive ? `${op.event.label} · ${Math.ceil(state.task.eventRemaining)} s` : state.task.started ? "SONDA DESPLEGADA" : "OPERACIÓN NO INICIADA", 54, 560);
        ctx.fillStyle = "#E7F9FF";
        ctx.font = "700 25px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        drawWrapped(ctx, state.task.completed ? current.discovery : op.hint, 54, 602, 650, 32, 3);
    }
    function drawScienceDossier(ctx) {
        const current = state.current;
        const selected = current.topics[state.selectedTopic];
        ctx.fillStyle = current.accent;
        ctx.font = "900 38px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        ctx.textBaseline = "top";
        ctx.fillText(current.name.toUpperCase(), 34, 174);
        ctx.fillStyle = "#A5DDEE";
        ctx.font = "800 19px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.fillText(current.type.toUpperCase(), 36, 220);
        const topicRects = [];
        for (let i = 0; i < MISSION_TOPIC_ORDER.length; i++) {
            const key = MISSION_TOPIC_ORDER[i];
            const col = i % 2;
            const row = Math.floor(i / 2);
            const rect = { x: 30 + col * 356, y: 260 + row * 72, w: i === 4 ? 700 : 338, h: 60 };
            drawButton(ctx, rect, current.topics[key].label, key === state.selectedTopic, current.accent, false, 21, isHovered(dossier, "topic", key));
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
            ctx.font = "800 21px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
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
            { mode: "mission", label: "MISIÓN", x: 28 },
            { mode: "science", label: "CIENCIA", x: 269 },
            { mode: "log", label: "BITÁCORA", x: 510 },
        ];
        for (const item of modes) {
            const rect = { x: item.x, y: 92, w: 222, h: 58 };
            drawButton(ctx, rect, item.label, dossierMode === item.mode, state.current.accent, false, 22, isHovered(dossier, "dossierMode", item.mode));
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
        const startX = 76;
        const gap = 121;
        const y = 190;
        ctx.strokeStyle = "rgba(75, 206, 239, 0.38)";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(startX + gap * (SOLAR_MISSION.length - 1), y);
        ctx.stroke();
        for (let i = 0; i < SOLAR_MISSION.length; i++) {
            const item = SOLAR_MISSION[i];
            const x = startX + gap * i;
            const unlocked = director.isUnlocked(i);
            const done = state.completed.has(item.id);
            const active = i === state.currentIndex;
            const hovered = isHovered(solarMap, "destination", i);
            if (hovered || active) {
                ctx.save();
                ctx.shadowColor = hovered ? "rgba(255,255,255,0.95)" : item.accent;
                ctx.shadowBlur = hovered ? 28 : 18;
                ctx.strokeStyle = hovered ? "#FFFFFF" : item.accent;
                ctx.lineWidth = hovered ? 7 : 5;
                ctx.beginPath();
                ctx.arc(x, y, active ? 34 + Math.sin(t * 2.3) * 2 : 34, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
            ctx.fillStyle = unlocked ? item.accent : "#405865";
            ctx.beginPath();
            ctx.arc(x, y, item.id === "sun" ? 21 : 15, 0, Math.PI * 2);
            ctx.fill();
            if (done) {
                ctx.strokeStyle = "#5CFF9D";
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(x, y, 25, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.fillStyle = hovered ? "#FFFFFF" : unlocked ? "#E8FAFF" : "#6E838D";
            ctx.font = "800 15px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
            ctx.textAlign = "center";
            ctx.fillText(item.name.toUpperCase(), x, y + 55);
            solarMap.hitZones.push({ type: "destination", index: i, circle: { x, y, r: 42 } });
        }
        ctx.textAlign = "left";
        ctx.fillStyle = "#BCEBFA";
        ctx.font = "800 19px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        ctx.fillText("Selecciona un destino desbloqueado. Los registros recuperados aparecen en verde.", 40, 286);
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
        drawPanelWhenNeeded(controls, t, 0.08, drawControls);
        drawPanelWhenNeeded(dossier, t, 0.25, drawDossier);
        drawPanelWhenNeeded(solarMap, t, 0.25, () => drawSolarMap(t));
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
        else if (zone.type === "start")
            director.startOperation();
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
        else
            return false;
        return true;
    }
    async function detectXR() {
        let supported = false;
        try {
            supported = !!navigator.xr && await navigator.xr.isSessionSupported("immersive-vr");
        }
        catch (_) { }
        device.supportsVR = supported;
        device.checking = false;
        markAll();
    }
    function setXRPresenting(value) {
        device.presenting = !!value;
        markAll();
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
        detectXR();
        applyVisibility();
        drawDirty(0);
    }
    return {
        update,
        initialize,
        handleHit,
        setHoverHit,
        setXRPresenting,
        getInteractiveMeshes: () => panels.filter((panel) => panel.mesh.visible).map((panel) => panel.mesh),
    };
}
