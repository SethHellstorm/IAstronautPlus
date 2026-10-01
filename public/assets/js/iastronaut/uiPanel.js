import { roundRect } from "./canvasUtils.js";
import { HIT_ZONES, MAX_BUBBLES, PANEL_CANVAS_W, PANEL_CANVAS_H, MAIN_PANEL_WIDTH, MAIN_PANEL_HEIGHT, } from "./config.js";
const STAR_FIELD = Array.from({ length: 54 }, (_, i) => ({
    x: 64 + ((i * 197) % 1268),
    y: 166 + ((i * 131) % 770),
    r: 0.7 + ((i * 17) % 4) * 0.35,
    a: 0.08 + ((i * 29) % 8) * 0.025,
}));
export function createUIState() {
    return {
        bubbles: [],
        listening: false,
        aiSpeaking: false,
        scrollY: 0,
        scrollMax: 0,
        scrollVel: 0,
        autoScroll: false,
        hoverZone: "",
    };
}
export function enforceMaxBubbles(state) {
    while (state.bubbles.length > MAX_BUBBLES)
        state.bubbles.shift();
}
export function addBubble(state, drawPanel, text, who, meta = {}) {
    state.bubbles.push({
        kind: "text",
        text: String(text || ""),
        who: who === "user" ? "user" : "bot",
        source: String(meta.source || "chat"),
    });
    enforceMaxBubbles(state);
    state.autoScroll = true;
    drawPanel();
}
export function clearBubblesBySource(state, drawPanel, source) {
    const key = String(source || "");
    if (!key)
        return;
    state.bubbles = state.bubbles.filter((bubble) => bubble?.source !== key);
    state.scrollY = 0;
    state.scrollVel = 0;
    state.autoScroll = true;
    drawPanel();
}
export function setListening(state, drawPanel, v) {
    state.listening = !!v;
    drawPanel();
}
export function setAISpeaking(state, drawPanel, v) {
    state.aiSpeaking = !!v;
    drawPanel();
}
export function createPanel({ THREE, scene }) {
    const panelCanvas = document.createElement("canvas");
    panelCanvas.width = PANEL_CANVAS_W;
    panelCanvas.height = PANEL_CANVAS_H;
    const ctx = panelCanvas.getContext("2d", { alpha: true });
    const panelTex = new THREE.CanvasTexture(panelCanvas);
    panelTex.colorSpace = THREE.SRGBColorSpace;
    panelTex.minFilter = THREE.LinearFilter;
    panelTex.magFilter = THREE.LinearFilter;
    const panelMat = new THREE.MeshBasicMaterial({
        map: panelTex,
        transparent: true,
        depthTest: true,
        depthWrite: false,
    });
    const panelMesh = new THREE.Mesh(new THREE.PlaneGeometry(MAIN_PANEL_WIDTH, MAIN_PANEL_HEIGHT), panelMat);
    panelMesh.renderOrder = 2;
    const uiGroup = new THREE.Group();
    uiGroup.add(panelMesh);
    scene.add(uiGroup);
    return { panelCanvas, ctx, panelTex, panelMesh, uiGroup };
}
function splitLongWord(ctx, word, maxWidth) {
    const parts = [];
    let current = "";
    for (const char of word) {
        const test = current + char;
        if (current && ctx.measureText(test).width > maxWidth) {
            parts.push(current);
            current = char;
        }
        else {
            current = test;
        }
    }
    if (current)
        parts.push(current);
    return parts;
}
function wrapText(ctx, text, maxWidth) {
    const paragraphs = String(text || "").split(/\r?\n/);
    const lines = [];
    for (let p = 0; p < paragraphs.length; p++) {
        const words = paragraphs[p].trim().split(/\s+/).filter(Boolean);
        let line = "";
        for (const word of words) {
            const pieces = ctx.measureText(word).width > maxWidth ? splitLongWord(ctx, word, maxWidth) : [word];
            for (const piece of pieces) {
                const test = line ? `${line} ${piece}` : piece;
                if (ctx.measureText(test).width <= maxWidth) {
                    line = test;
                }
                else {
                    if (line)
                        lines.push(line);
                    line = piece;
                }
            }
        }
        if (line)
            lines.push(line);
        if (words.length === 0)
            lines.push("");
        if (p < paragraphs.length - 1)
            lines.push("");
    }
    return lines.length ? lines : [""];
}
function drawMicIcon(ctx, x, y, scale, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 5 * scale;
    ctx.lineCap = "round";
    roundRect(ctx, x - 10 * scale, y - 22 * scale, 20 * scale, 34 * scale, 10 * scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y - 3 * scale, 19 * scale, 0, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + 16 * scale);
    ctx.lineTo(x, y + 27 * scale);
    ctx.moveTo(x - 13 * scale, y + 27 * scale);
    ctx.lineTo(x + 13 * scale, y + 27 * scale);
    ctx.stroke();
    ctx.restore();
}
function drawStatusDot(ctx, x, y, color, glow) {
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 22;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}
function drawStars(ctx) {
    ctx.save();
    for (const star of STAR_FIELD) {
        ctx.globalAlpha = star.a;
        ctx.fillStyle = "#8BE9FF";
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}
function drawCornerMarks(ctx, x, y, w, h) {
    const size = 26;
    ctx.save();
    ctx.strokeStyle = "rgba(55, 225, 255, 0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y + size);
    ctx.lineTo(x, y);
    ctx.lineTo(x + size, y);
    ctx.moveTo(x + w - size, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + size);
    ctx.moveTo(x + w, y + h - size);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w - size, y + h);
    ctx.moveTo(x + size, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + h - size);
    ctx.stroke();
    ctx.restore();
}
export function canRecord() {
    return !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
}
export function drawPanelFactory({ THREE, panelCanvas, ctx, panelTex, state }) {
    return function drawPanel() {
        const W = panelCanvas.width;
        const H = panelCanvas.height;
        ctx.clearRect(0, 0, W, H);
        const shellGradient = ctx.createLinearGradient(0, 18, 0, H - 18);
        shellGradient.addColorStop(0, "rgba(7, 20, 39, 0.985)");
        shellGradient.addColorStop(0.42, "rgba(2, 8, 20, 0.98)");
        shellGradient.addColorStop(1, "rgba(1, 5, 14, 0.99)");
        ctx.save();
        ctx.shadowColor = "rgba(0, 214, 255, 0.28)";
        ctx.shadowBlur = 34;
        ctx.fillStyle = shellGradient;
        roundRect(ctx, 18, 18, W - 36, H - 36, 30);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = "rgba(55, 225, 255, 0.55)";
        ctx.lineWidth = 3;
        roundRect(ctx, 18, 18, W - 36, H - 36, 30);
        ctx.stroke();
        ctx.fillStyle = "rgba(11, 31, 57, 0.93)";
        roundRect(ctx, 20, 20, W - 40, 128, 28);
        ctx.fill();
        ctx.fillRect(20, 112, W - 40, 36);
        ctx.strokeStyle = "rgba(65, 157, 224, 0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(20, 148);
        ctx.lineTo(W - 20, 148);
        ctx.stroke();
        ctx.save();
        const exitHovered = state.hoverZone === "exit";
        ctx.shadowColor = exitHovered ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0)";
        ctx.shadowBlur = exitHovered ? 24 : 0;
        ctx.fillStyle = exitHovered ? "rgba(239, 68, 68, 0.32)" : "rgba(239, 68, 68, 0.1)";
        ctx.strokeStyle = exitHovered ? "#FFFFFF" : "rgba(248, 113, 113, 0.8)";
        ctx.lineWidth = exitHovered ? 5 : 2;
        roundRect(ctx, HIT_ZONES.exit.x, HIT_ZONES.exit.y, HIT_ZONES.exit.w, HIT_ZONES.exit.h, 15);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#FCA5A5";
        ctx.font = "800 26px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.textBaseline = "middle";
        ctx.fillText("CERRAR ENLACE", HIT_ZONES.exit.x + 25, HIT_ZONES.exit.y + HIT_ZONES.exit.h / 2);
        ctx.restore();
        drawStatusDot(ctx, 318, 76, "#12E05B", "rgba(18, 224, 91, 0.95)");
        ctx.fillStyle = "#E6F4FF";
        ctx.font = "800 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        ctx.textBaseline = "middle";
        ctx.fillText("TERMINAL DE COMUNICACIÓN", 348, 69);
        ctx.fillStyle = "rgba(97, 218, 251, 0.82)";
        ctx.font = "700 23px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.fillText("IASTRONAUT · CANAL DE MISIÓN XR", 349, 106);
        ctx.save();
        const recenterHovered = state.hoverZone === "recenter";
        ctx.shadowColor = recenterHovered ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0)";
        ctx.shadowBlur = recenterHovered ? 24 : 0;
        ctx.fillStyle = recenterHovered ? "rgba(35, 140, 198, 0.52)" : "rgba(22, 92, 143, 0.24)";
        ctx.strokeStyle = recenterHovered ? "#FFFFFF" : "rgba(80, 183, 255, 0.9)";
        ctx.lineWidth = recenterHovered ? 5 : 2;
        roundRect(ctx, HIT_ZONES.recenter.x, HIT_ZONES.recenter.y, HIT_ZONES.recenter.w, HIT_ZONES.recenter.h, 15);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#A7E8FF";
        ctx.font = "800 22px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.fillText("RECALIBRAR", HIT_ZONES.recenter.x + HIT_ZONES.recenter.w / 2, HIT_ZONES.recenter.y + HIT_ZONES.recenter.h / 2);
        ctx.textAlign = "left";
        ctx.restore();
        ctx.save();
        const grabHovered = state.hoverZone === "grab";
        ctx.shadowColor = grabHovered ? "rgba(255,255,255,0.72)" : "rgba(0,0,0,0)";
        ctx.shadowBlur = grabHovered ? 26 : 0;
        ctx.fillStyle = grabHovered ? "rgba(45, 168, 220, 0.78)" : "rgba(27, 105, 151, 0.58)";
        ctx.strokeStyle = grabHovered ? "#FFFFFF" : "rgba(95, 225, 255, 0.95)";
        ctx.lineWidth = grabHovered ? 5 : 2;
        roundRect(ctx, HIT_ZONES.grab.x, HIT_ZONES.grab.y, HIT_ZONES.grab.w, HIT_ZONES.grab.h, 15);
        ctx.fill();
        ctx.stroke();
        const gx = HIT_ZONES.grab.x + HIT_ZONES.grab.w / 2;
        const gy = HIT_ZONES.grab.y + HIT_ZONES.grab.h / 2;
        ctx.strokeStyle = "#C5F5FF";
        ctx.fillStyle = "#C5F5FF";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(gx - 23, gy - 7);
        ctx.lineTo(gx + 23, gy - 7);
        ctx.moveTo(gx, gy - 28);
        ctx.lineTo(gx, gy + 14);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(gx - 23, gy - 7);
        ctx.lineTo(gx - 14, gy - 15);
        ctx.moveTo(gx - 23, gy - 7);
        ctx.lineTo(gx - 14, gy + 1);
        ctx.moveTo(gx + 23, gy - 7);
        ctx.lineTo(gx + 14, gy - 15);
        ctx.moveTo(gx + 23, gy - 7);
        ctx.lineTo(gx + 14, gy + 1);
        ctx.moveTo(gx, gy - 28);
        ctx.lineTo(gx - 8, gy - 19);
        ctx.moveTo(gx, gy - 28);
        ctx.lineTo(gx + 8, gy - 19);
        ctx.moveTo(gx, gy + 14);
        ctx.lineTo(gx - 8, gy + 5);
        ctx.moveTo(gx, gy + 14);
        ctx.lineTo(gx + 8, gy + 5);
        ctx.stroke();
        ctx.font = "800 22px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("MOVER", gx, gy + 29);
        ctx.textAlign = "left";
        ctx.restore();
        const frameX = HIT_ZONES.chat.x;
        const frameY = HIT_ZONES.chat.y + 18;
        const frameW = HIT_ZONES.chat.w;
        const frameH = HIT_ZONES.chat.h - 30;
        ctx.fillStyle = "rgba(0, 4, 14, 0.76)";
        roundRect(ctx, frameX, frameY, frameW, frameH, 18);
        ctx.fill();
        ctx.strokeStyle = "rgba(38, 103, 151, 0.62)";
        ctx.lineWidth = 2;
        roundRect(ctx, frameX, frameY, frameW, frameH, 18);
        ctx.stroke();
        drawCornerMarks(ctx, frameX + 12, frameY + 12, frameW - 24, frameH - 24);
        drawStars(ctx);
        const areaX = frameX + 24;
        const areaY = frameY + 26;
        const areaW = frameW - 48;
        const areaH = frameH - 52;
        ctx.save();
        ctx.beginPath();
        ctx.rect(areaX, areaY, areaW, areaH);
        ctx.clip();
        const bubblePadX = 22;
        const bubblePadY = 18;
        const bubbleMaxW = Math.floor(areaW * 0.82);
        const labelH = 25;
        const lineH = 45;
        const gap = 18;
        ctx.font = "33px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        ctx.textBaseline = "top";
        let contentH = 0;
        for (const bubble of state.bubbles) {
            const lines = wrapText(ctx, bubble.text, bubbleMaxW - bubblePadX * 2);
            contentH += labelH + lines.length * lineH + bubblePadY * 2 + gap;
        }
        const innerTopPad = 10;
        const innerBottomPad = 10;
        const visibleH = areaH - innerTopPad - innerBottomPad;
        state.scrollMax = Math.max(0, contentH - visibleH);
        if (state.autoScroll) {
            state.scrollY = state.scrollMax;
            state.autoScroll = false;
            state.scrollVel = 0;
        }
        else {
            state.scrollY = THREE.MathUtils.clamp(state.scrollY, 0, state.scrollMax);
            if (state.scrollY <= 0 || state.scrollY >= state.scrollMax)
                state.scrollVel = 0;
        }
        let y = areaY + innerTopPad - state.scrollY;
        for (const bubble of state.bubbles) {
            const isUser = bubble.who === "user";
            ctx.font = "33px system-ui, -apple-system, Segoe UI, Roboto, Arial";
            const lines = wrapText(ctx, bubble.text, bubbleMaxW - bubblePadX * 2);
            const textH = lines.length * lineH;
            const bubbleH = labelH + textH + bubblePadY * 2;
            const measuredWidths = lines.map((line) => ctx.measureText(line).width + bubblePadX * 2);
            const bubbleW = Math.min(bubbleMaxW, Math.max(270, ...measuredWidths));
            const x = isUser ? areaX + areaW - bubbleW - 12 : areaX + 12;
            if (isUser) {
                const userGradient = ctx.createLinearGradient(x, y, x + bubbleW, y + bubbleH);
                userGradient.addColorStop(0, "rgba(45, 224, 247, 0.96)");
                userGradient.addColorStop(1, "rgba(49, 180, 255, 0.96)");
                ctx.fillStyle = userGradient;
                roundRect(ctx, x, y, bubbleW, bubbleH, 18);
                ctx.fill();
                ctx.strokeStyle = "rgba(178, 248, 255, 0.9)";
            }
            else {
                ctx.fillStyle = "rgba(6, 25, 45, 0.96)";
                roundRect(ctx, x, y, bubbleW, bubbleH, 18);
                ctx.fill();
                ctx.strokeStyle = "rgba(61, 220, 255, 0.55)";
            }
            ctx.lineWidth = 2;
            roundRect(ctx, x, y, bubbleW, bubbleH, 18);
            ctx.stroke();
            ctx.fillStyle = isUser ? "rgba(0, 35, 45, 0.72)" : "#34E8FF";
            ctx.font = "800 23px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
            ctx.fillText(isUser ? "TRIPULANTE" : "IASTRONAUT", x + bubblePadX, y + bubblePadY - 1);
            ctx.fillStyle = isUser ? "#00131A" : "#DDF8FF";
            ctx.font = "33px system-ui, -apple-system, Segoe UI, Roboto, Arial";
            let ty = y + bubblePadY + labelH;
            for (const line of lines) {
                ctx.fillText(line, x + bubblePadX, ty);
                ty += lineH;
            }
            y += bubbleH + gap;
        }
        ctx.restore();
        if (state.scrollMax > 0) {
            const barX = frameX + frameW - 14;
            const barY = frameY + 28;
            const barH = frameH - 56;
            const thumbH = Math.max(46, Math.floor(barH * (barH / (barH + state.scrollMax))));
            const t = state.scrollY / state.scrollMax;
            const thumbY = barY + (barH - thumbH) * t;
            ctx.fillStyle = "rgba(50, 151, 208, 0.18)";
            roundRect(ctx, barX - 5, barY, 6, barH, 4);
            ctx.fill();
            ctx.fillStyle = "rgba(72, 225, 255, 0.72)";
            roundRect(ctx, barX - 5, thumbY, 6, thumbH, 4);
            ctx.fill();
        }
        const micAvailable = canRecord();
        const talkLabel = !micAvailable
            ? "MICRÓFONO NO DISPONIBLE"
            : state.aiSpeaking
                ? "IASTRONAUT HABLANDO"
                : state.listening
                    ? "IASTRONAUT ESCUCHANDO · PULSA PARA DETENER"
                    : "HABLAR CON IASTRONAUT";
        const talkGradient = ctx.createLinearGradient(HIT_ZONES.talk.x, HIT_ZONES.talk.y, HIT_ZONES.talk.x + HIT_ZONES.talk.w, HIT_ZONES.talk.y + HIT_ZONES.talk.h);
        const talkHovered = state.hoverZone === "talk";
        if (!micAvailable) {
            talkGradient.addColorStop(0, "rgba(71, 85, 105, 0.72)");
            talkGradient.addColorStop(1, "rgba(51, 65, 85, 0.72)");
        }
        else if (state.aiSpeaking) {
            talkGradient.addColorStop(0, "rgba(35, 113, 183, 0.78)");
            talkGradient.addColorStop(1, "rgba(31, 82, 154, 0.82)");
        }
        else if (state.listening) {
            talkGradient.addColorStop(0, "rgba(239, 68, 68, 0.9)");
            talkGradient.addColorStop(1, "rgba(190, 24, 93, 0.9)");
        }
        else {
            talkGradient.addColorStop(0, "rgba(39, 230, 244, 0.98)");
            talkGradient.addColorStop(1, "rgba(45, 177, 255, 0.98)");
        }
        ctx.save();
        ctx.shadowColor = talkHovered ? "rgba(255,255,255,0.72)" : micAvailable && !state.aiSpeaking ? "rgba(48, 220, 255, 0.44)" : "rgba(0, 0, 0, 0)";
        ctx.shadowBlur = talkHovered ? 34 : 22;
        ctx.fillStyle = talkGradient;
        roundRect(ctx, HIT_ZONES.talk.x, HIT_ZONES.talk.y, HIT_ZONES.talk.w, HIT_ZONES.talk.h, 20);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = talkHovered ? "#FFFFFF" : micAvailable ? "rgba(178, 248, 255, 0.82)" : "rgba(148, 163, 184, 0.5)";
        ctx.lineWidth = talkHovered ? 5 : 2;
        roundRect(ctx, HIT_ZONES.talk.x, HIT_ZONES.talk.y, HIT_ZONES.talk.w, HIT_ZONES.talk.h, 20);
        ctx.stroke();
        const talkTextColor = !micAvailable || state.aiSpeaking || state.listening ? "#F8FAFC" : "#00141B";
        drawMicIcon(ctx, HIT_ZONES.talk.x + 72, HIT_ZONES.talk.y + HIT_ZONES.talk.h / 2 - 2, 1, talkTextColor);
        ctx.fillStyle = talkTextColor;
        ctx.font = "900 34px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.textBaseline = "middle";
        ctx.fillText(talkLabel, HIT_ZONES.talk.x + 126, HIT_ZONES.talk.y + HIT_ZONES.talk.h / 2);
        const statusColor = !micAvailable ? "#94A3B8" : state.aiSpeaking ? "#60A5FA" : state.listening ? "#FCA5A5" : "#16A34A";
        drawStatusDot(ctx, HIT_ZONES.talk.x + HIT_ZONES.talk.w - 52, HIT_ZONES.talk.y + HIT_ZONES.talk.h / 2, statusColor, statusColor);
        panelTex.needsUpdate = true;
    };
}
