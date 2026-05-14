import {
  HIT_ZONES,
  MAX_BUBBLES,
  PANEL_CANVAS_W,
  PANEL_CANVAS_H,
} from "./config.js";

export function createUIState() {
  return {
    bubbles: [],
    listening: false,
    aiSpeaking: false,
    scrollY: 0,
    scrollMax: 0,
    scrollVel: 0,
    autoScroll: false,
    imgCache: new Map(),
  };
}

export function enforceMaxBubbles(state) {
  while (state.bubbles.length > MAX_BUBBLES) state.bubbles.shift();
}

export function addBubble(state, drawPanel, text, who) {
  state.bubbles.push({ kind: "text", text: String(text || ""), who: who === "user" ? "user" : "bot" });
  enforceMaxBubbles(state);
  state.autoScroll = true;
  drawPanel();
}

export function addImagesBubble(state, drawPanel, images) {
  if (!Array.isArray(images) || images.length === 0) return;
  state.bubbles.push({ kind: "images", images: images.slice(0, 6) });
  enforceMaxBubbles(state);
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

export function createPanel({ THREE, scene, camera }) {
  // Canvas 2D
  const panelCanvas = document.createElement("canvas");
  panelCanvas.width = PANEL_CANVAS_W;
  panelCanvas.height = PANEL_CANVAS_H;

  const ctx = panelCanvas.getContext("2d", { alpha: true });

  // Textura Three
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

  const panelMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.90, 1.55), panelMat);
  panelMesh.renderOrder = 2;

  const uiGroup = new THREE.Group();
  uiGroup.add(panelMesh);
  scene.add(uiGroup);

  return { panelCanvas, ctx, panelTex, panelMesh, uiGroup };
}

// -------------------------
// Helpers de dibujo
// -------------------------
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
  const words = (text || "").split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width <= maxWidth) line = test;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function getCachedImage(state, url, invalidate) {
  if (!url) return null;
  const existing = state.imgCache.get(url);
  if (existing) return existing;

  const img = new Image();
  img.crossOrigin = "anonymous";
  const rec = { img, loaded: false, failed: false };
  state.imgCache.set(url, rec);

  img.onload = () => { rec.loaded = true; invalidate(); };
  img.onerror = () => { rec.failed = true; invalidate(); };
  img.src = url;

  return rec;
}

export function canRecord() {
  return !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
}

export function drawPanelFactory({ THREE, panelCanvas, ctx, panelTex, state }) {
  // Retorna una función drawPanel()
  return function drawPanel() {
    const W = panelCanvas.width;
    const H = panelCanvas.height;
    ctx.clearRect(0, 0, W, H);

    // Fondo del panel
    ctx.save();
    ctx.globalAlpha = 0.94;
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, 18, 18, W - 36, H - 36, 26);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 3;
    roundRect(ctx, 18, 18, W - 36, H - 36, 26);
    ctx.stroke();

    // Header
    ctx.fillStyle = "#0B1220";
    ctx.font = "800 46px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textBaseline = "middle";
    ctx.fillText("IAstronauta (VR)", 320, 82);

    // Botón Salir
    ctx.save();
    ctx.fillStyle = "#EF4444";
    roundRect(ctx, HIT_ZONES.exit.x, HIT_ZONES.exit.y, HIT_ZONES.exit.w, HIT_ZONES.exit.h, 16);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "800 32px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("🚪 Salir", HIT_ZONES.exit.x + 22, HIT_ZONES.exit.y + HIT_ZONES.exit.h / 2);
    ctx.restore();

    // Botón Centrar
    ctx.save();
    ctx.fillStyle = "#0d6efd";
    roundRect(ctx, HIT_ZONES.recenter.x, HIT_ZONES.recenter.y, HIT_ZONES.recenter.w, HIT_ZONES.recenter.h, 16);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "800 32px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("📍 Centrar", HIT_ZONES.recenter.x + 22, HIT_ZONES.recenter.y + HIT_ZONES.recenter.h / 2);
    ctx.restore();

    // Handle (grab)
    ctx.save();
    ctx.fillStyle = "rgba(11,18,32,0.10)";
    roundRect(ctx, HIT_ZONES.grab.x, HIT_ZONES.grab.y, HIT_ZONES.grab.w, HIT_ZONES.grab.h, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(11,18,32,0.28)";
    ctx.lineWidth = 3;
    roundRect(ctx, HIT_ZONES.grab.x, HIT_ZONES.grab.y, HIT_ZONES.grab.w, HIT_ZONES.grab.h, 18);
    ctx.stroke();

    const cx = HIT_ZONES.grab.x + HIT_ZONES.grab.w / 2;
    const cy = HIT_ZONES.grab.y + HIT_ZONES.grab.h / 2;
    ctx.strokeStyle = "rgba(11,18,32,0.75)";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx, HIT_ZONES.grab.y + 26);
    ctx.lineTo(cx, HIT_ZONES.grab.y + HIT_ZONES.grab.h - 26);
    ctx.moveTo(HIT_ZONES.grab.x + 14, cy);
    ctx.lineTo(HIT_ZONES.grab.x + HIT_ZONES.grab.w - 14, cy);
    ctx.stroke();

    ctx.fillStyle = "rgba(11,18,32,0.75)";
    function tri(ax, ay, bx, by, cx2, cy2) {
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.lineTo(cx2, cy2);
      ctx.closePath();
      ctx.fill();
    }
    tri(cx, HIT_ZONES.grab.y + 14, cx - 10, HIT_ZONES.grab.y + 32, cx + 10, HIT_ZONES.grab.y + 32);
    tri(cx, HIT_ZONES.grab.y + HIT_ZONES.grab.h - 14, cx - 10, HIT_ZONES.grab.y + HIT_ZONES.grab.h - 32, cx + 10, HIT_ZONES.grab.y + HIT_ZONES.grab.h - 32);
    tri(HIT_ZONES.grab.x + 10, cy, HIT_ZONES.grab.x + 26, cy - 10, HIT_ZONES.grab.x + 26, cy + 10);
    tri(HIT_ZONES.grab.x + HIT_ZONES.grab.w - 10, cy, HIT_ZONES.grab.x + HIT_ZONES.grab.w - 26, cy - 10, HIT_ZONES.grab.x + HIT_ZONES.grab.w - 26, cy + 10);
    ctx.restore();

    // Área chat (clip)
    const areaX = HIT_ZONES.chat.x;
    const areaY = HIT_ZONES.chat.y;
    const areaW = HIT_ZONES.chat.w;
    const areaH = HIT_ZONES.chat.h;

    ctx.save();
    ctx.beginPath();
    ctx.rect(areaX, areaY, areaW, areaH);
    ctx.clip();

    const bubblePadX = 18;
    const bubblePadY = 14;
    const bubbleMaxW = Math.floor(areaW * 0.84);
    const lineH = 44;
    const gap = 14;

    const imgCols = 2;
    const imgGap = 14;
    const imgCardW = Math.floor((bubbleMaxW - imgGap) / 2);
    const imgCardH = 210;
    const imgMetaH = 40;
    const imgBlockPad = 12;

    ctx.font = "36px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textBaseline = "top";

    // Calcular alto del contenido
    let contentH = 0;
    for (const b of state.bubbles) {
      if (b.kind === "images") {
        const count = (b.images || []).length;
        const rows = Math.ceil(count / imgCols) || 1;
        const blockH = imgBlockPad * 2 + rows * (imgCardH + imgMetaH) + (rows - 1) * imgGap;
        contentH += blockH + gap;
      } else {
        const lines = wrapText(ctx, b.text, bubbleMaxW - bubblePadX * 2);
        const textH = lines.length * lineH;
        const bubbleH = textH + bubblePadY * 2;
        contentH += bubbleH + gap;
      }
    }

    const innerTopPad = 10;
    const innerBottomPad = 10;
    const visibleH = areaH - innerTopPad - innerBottomPad;
    state.scrollMax = Math.max(0, contentH - visibleH);

    if (state.autoScroll) {
      state.scrollY = state.scrollMax;
      state.autoScroll = false;
      state.scrollVel = 0;
    } else {
      state.scrollY = THREE.MathUtils.clamp(state.scrollY, 0, state.scrollMax);
      if (state.scrollY <= 0 || state.scrollY >= state.scrollMax) state.scrollVel = 0;
    }

    // Render burbujas
    let y = areaY + innerTopPad - state.scrollY;

    for (const b of state.bubbles) {
      if (b.kind === "images") {
        const count = (b.images || []).length;
        const rows = Math.ceil(count / imgCols) || 1;
        const blockW = Math.min(bubbleMaxW, areaW - 20);
        const blockX = areaX + 10;
        const blockH = imgBlockPad * 2 + rows * (imgCardH + imgMetaH) + (rows - 1) * imgGap;

        let ix = blockX + imgBlockPad;
        let iy = y + imgBlockPad;

        for (let i = 0; i < count; i++) {
          const col = i % imgCols;
          const row = Math.floor(i / imgCols);

          const cardX = ix + col * (imgCardW + imgGap);
          const cardY = iy + row * (imgCardH + imgMetaH + imgGap);

          ctx.save();
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#E5E7EB";
          roundRect(ctx, cardX, cardY, imgCardW, imgCardH + imgMetaH, 14);
          ctx.fill();
          ctx.restore();

          ctx.save();
          ctx.beginPath();
          roundRect(ctx, cardX + 8, cardY + 8, imgCardW - 16, imgCardH - 16, 12);
          ctx.clip();

          const item = b.images[i];
          const url = item?.url || "";
          const alt = (item?.alt || "Imagen").toString();

          const rec = getCachedImage(state, url, () => drawPanel());

          if (rec && rec.loaded && !rec.failed) {
            const img = rec.img;

            const targetW = imgCardW - 16;
            const targetH = imgCardH - 16;
            const ir = img.width / Math.max(1, img.height);
            const tr = targetW / Math.max(1, targetH);

            let sx = 0, sy = 0, sw = img.width, sh = img.height;
            if (ir > tr) {
              sh = img.height;
              sw = Math.floor(tr * sh);
              sx = Math.floor((img.width - sw) / 2);
            } else {
              sw = img.width;
              sh = Math.floor(sw / tr);
              sy = Math.floor((img.height - sh) / 2);
            }

            ctx.drawImage(img, sx, sy, sw, sh, cardX + 8, cardY + 8, targetW, targetH);
          } else {
            ctx.fillStyle = "rgba(0,0,0,0.08)";
            ctx.fillRect(cardX + 8, cardY + 8, imgCardW - 16, imgCardH - 16);
            ctx.fillStyle = "rgba(11,18,32,0.65)";
            ctx.font = "700 24px system-ui, -apple-system, Segoe UI, Roboto, Arial";
            ctx.fillText(rec?.failed ? "No se pudo cargar" : "Cargando…", cardX + 18, cardY + 22);
          }

          ctx.restore();

          ctx.fillStyle = "#0B1220";
          ctx.font = "700 24px system-ui, -apple-system, Segoe UI, Roboto, Arial";
          const altLine = alt.replace(/^File:/i, "").slice(0, 42);
          ctx.fillText(altLine, cardX + 12, cardY + imgCardH + 6);
        }

        y += blockH + gap;
        continue;
      }

      const isUser = b.who === "user";
      const lines = wrapText(ctx, b.text, bubbleMaxW - bubblePadX * 2);
      const textH = lines.length * lineH;
      const bubbleH = textH + bubblePadY * 2;

      const bubbleW = Math.min(
        bubbleMaxW,
        Math.max(220, ...lines.map((l) => ctx.measureText(l).width + bubblePadX * 2))
      );

      const x = isUser ? areaX + areaW - bubbleW - 10 : areaX + 10;

      ctx.fillStyle = isUser ? "#2563EB" : "#E5E7EB";
      roundRect(ctx, x, y, bubbleW, bubbleH, 18);
      ctx.fill();

      ctx.fillStyle = isUser ? "#FFFFFF" : "#0B1220";
      ctx.font = "36px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      let ty = y + bubblePadY;
      for (const line of lines) {
        ctx.fillText(line, x + bubblePadX, ty);
        ty += lineH;
      }

      y += bubbleH + gap;
    }

    ctx.restore();

    // Scrollbar
    if (state.scrollMax > 0) {
      const barX = areaX + areaW - 10;
      const barY = areaY + 10;
      const barH = areaH - 20;
      const thumbH = Math.max(40, Math.floor(barH * (barH / (barH + state.scrollMax))));
      const t = state.scrollY / state.scrollMax;
      const thumbY = barY + (barH - thumbH) * t;

      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      roundRect(ctx, barX - 6, barY, 6, barH, 4);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      roundRect(ctx, barX - 6, thumbY, 6, thumbH, 4);
      ctx.fill();
      ctx.restore();
    }

    // Botón Hablar
    const talkLabel = !canRecord()
      ? "Mic no disponible"
      : (state.aiSpeaking ? "🔊 Hablando" : (state.listening ? "⏹️ Detener" : "🎙️ Hablar"));

    ctx.save();
    ctx.fillStyle = !canRecord()
      ? "#6B7280"
      : (state.aiSpeaking ? "#9CA3AF" : (state.listening ? "#EF4444" : "#10B981"));
    roundRect(ctx, HIT_ZONES.talk.x, HIT_ZONES.talk.y, HIT_ZONES.talk.w, HIT_ZONES.talk.h, 20);
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textBaseline = "middle";
    ctx.fillText(talkLabel, HIT_ZONES.talk.x + 34, HIT_ZONES.talk.y + HIT_ZONES.talk.h / 2);
    ctx.restore();

    panelTex.needsUpdate = true;
  };
}
