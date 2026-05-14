import {
  APP_BASE,
  BG_IMAGE,
  FLOATING_ASSETS,
  ASTRONAUT_SIDE_OFFSET,
  ASTRONAUT_SCALE_MULT,
  PANEL_DISTANCE_DEFAULT,
  HIT_ZONES,
} from "./config.js";

import {
  createUIState,
  createPanel,
  drawPanelFactory,
  addBubble,
} from "./uiPanel.js";

import { createTTSPlayer, createMicChatController } from "./chat.js";
import { setupDesktopMobileInput } from "./inputDesktopMobile.js";
import { setupXRInput } from "./inputXR.js";

// -------------------------
// UA helpers
// -------------------------
function isMobileUA() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}

// -------------------------
// Desktop help overlay
// -------------------------
function createDesktopHelp(renderer) {
  if (renderer.xr.isPresenting) return;
  if (isMobileUA()) return;
  if (localStorage.getItem("astronauta_help_dismissed") === "1") return;

  const wrap = document.createElement("div");
  wrap.id = "vrDesktopHelp";
  wrap.style.position = "fixed";
  wrap.style.left = "16px";
  wrap.style.bottom = "16px";
  wrap.style.maxWidth = "460px";
  wrap.style.background = "rgba(11, 18, 32, 0.92)";
  wrap.style.color = "#fff";
  wrap.style.border = "1px solid rgba(255,255,255,0.18)";
  wrap.style.borderRadius = "14px";
  wrap.style.padding = "12px 14px";
  wrap.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";
  wrap.style.zIndex = "9999";
  wrap.style.backdropFilter = "blur(6px)";
  wrap.style.boxShadow = "0 10px 30px rgba(0,0,0,0.35)";
  wrap.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
      <div style="font-weight:700; font-size:14px;">Controles (Escritorio)</div>
      <button id="vrHelpClose"
        style="cursor:pointer; border:0; background:rgba(255,255,255,0.12); color:#fff;
              border-radius:10px; padding:6px 10px; font-weight:700;">
        ✕
      </button>
    </div>
    <div style="margin-top:8px; font-size:13px; line-height:1.35; color:rgba(255,255,255,0.92);">
      <div>🖱️ <b>Mover panel:</b> Arrastra desde el botón con flechas</div>
      <div>🧾 <b>Scroll chat:</b> Rueda del mouse sobre el chat</div>
      <div>🔎 <b>Zoom panel:</b> <b>Shift</b> + rueda</div>
      <div>🧭 <b>Mirar alrededor:</b> Click derecho + arrastrar <i>o</i> <b>Shift</b> + arrastrar</div>
      <div style="margin-top:6px; opacity:0.85;">En Quest: apunta al chat y usa el thumbstick para hacer scroll.</div>
      <div style="margin-top:6px; opacity:0.85;">Con manos: haz <b>pinch</b> y arrastra dentro del chat.</div>
    </div>
  `;
  document.body.appendChild(wrap);
  wrap.querySelector("#vrHelpClose")?.addEventListener("click", () => {
    localStorage.setItem("astronauta_help_dismissed", "1");
    wrap.remove();
  });
}

// -------------------------
// Main
// -------------------------
(() => {
  const canvas = document.getElementById("renderCanvas");
  if (!canvas) return;

  const THREE = window.THREE;
  const VRButton = window.VRButton;
  if (!THREE || !VRButton) {
    console.error("Three.js o VRButton no están disponibles. Revisa los imports del PHP.");
    return;
  }

  // Renderer / Scene / Camera
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.domElement.style.touchAction = "none";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 2000);
  camera.position.set(0, 1.6, 0);
  scene.add(camera);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x202020, 1.1));

  // Background sphere
  const sphereGeo = new THREE.SphereGeometry(450, 48, 32);
  sphereGeo.scale(-1, 1, 1);

  const texLoader = new THREE.TextureLoader();
  const bgTex = texLoader.load(BG_IMAGE, undefined, undefined, (e) => console.error("Error fondo:", e));
  bgTex.colorSpace = THREE.SRGBColorSpace;

  scene.add(new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ map: bgTex })));

  // Panel UI
  const state = createUIState();
  const { panelCanvas, ctx, panelTex, panelMesh, uiGroup } = createPanel({ THREE, scene, camera });

  let panelDistance = PANEL_DISTANCE_DEFAULT;

  function applyPanelScale() {
    if (renderer.xr.isPresenting) {
      uiGroup.scale.set(1, 1, 1);
      return;
    }
    if (isMobileUA()) uiGroup.scale.set(0.75, 0.75, 0.75);
    else uiGroup.scale.set(1.00, 1.00, 1.00);
  }
  applyPanelScale();

  const drawPanel = drawPanelFactory({ THREE, panelCanvas, ctx, panelTex, state });

  // First bubble
  addBubble(state, drawPanel, "¡Hola! Soy IAstronauta. Presiona “Hablar” y dime tu pregunta. La conversacion será continua, cuando quieras terminar presiona “Detener”", "bot");

  // Center / recenter
  function centerPanelDesktopLikeReload() {
    applyPanelScale();

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();

    const scale = uiGroup.scale.x || 1;
    const dist = panelDistance / Math.max(0.65, scale);

    const target = camera.position
      .clone()
      .add(forward.multiplyScalar(dist))
      .add(new THREE.Vector3(0, 0.12, 0));

    uiGroup.position.copy(target);
    uiGroup.lookAt(camera.position);
  }

  function recenterPanel() {
    const inXR = renderer.xr.isPresenting === true;
    if (!inXR) return centerPanelDesktopLikeReload();

    applyPanelScale();

    const xrCam = renderer.xr.getCamera(camera);
    const headPos = new THREE.Vector3();
    xrCam.getWorldPosition(headPos);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(xrCam.quaternion).normalize();
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(xrCam.quaternion).normalize();

    const target = headPos.clone().add(forward.multiplyScalar(panelDistance)).add(up.multiplyScalar(-0.10));

    uiGroup.position.copy(target);
    uiGroup.lookAt(headPos);
  }

  centerPanelDesktopLikeReload();

  async function exitAndRedirect() {
    const targetUrl = `https://mechrobotix.com/`;

    const session = renderer.xr.getSession?.();
    if (session) {
      try { await session.end(); } catch (e) { console.warn("No pude salir de VR:", e); }
    }

    setTimeout(() => { window.location.href = targetUrl; }, 120);
  }

  // Actions from hit
  async function handleActionFromHit(hit) {
    const p = hit?.uv
      ? { x: hit.uv.x * panelCanvas.width, y: (1 - hit.uv.y) * panelCanvas.height }
      : null;
    if (!p) return;

    const inRect = (pt, r) =>
      pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h;

    if (inRect(p, HIT_ZONES.exit)) return exitAndRedirect();
    if (inRect(p, HIT_ZONES.recenter)) return recenterPanel();
    if (inRect(p, HIT_ZONES.talk)) return mic.toggleMic();
  }

  // Mic/chat
  const tts = createTTSPlayer();
  const mic = createMicChatController({ state, drawPanel, ttsPlayer: tts });

  // Inputs (desktop/mobile)
  setupDesktopMobileInput({
    THREE,
    renderer,
    camera,
    panelMesh,
    panelCanvas,
    uiGroup,
    state,
    drawPanel,
    recenterPanel,
    setPanelDistance: (v) => { panelDistance = v; },
    getPanelDistance: () => panelDistance,
    handleActionFromHit,
  });

  // Boton XR
  document.body.appendChild(VRButton.createButton(renderer, { optionalFeatures: ["hand-tracking"] }));

  renderer.xr.addEventListener("sessionstart", () => {
    document.getElementById("vrDesktopHelp")?.remove();
    applyPanelScale();
    setTimeout(recenterPanel, 120);
    try { mic?.onXRSessionStart?.(); } catch (_) {}
  });

  renderer.xr.addEventListener("sessionend", () => {
    applyPanelScale();
    centerPanelDesktopLikeReload();
    createDesktopHelp(renderer);
  });

  createDesktopHelp(renderer);

  // Entradas XR
  const xr = setupXRInput({
    THREE,
    renderer,
    scene,
    camera,
    panelMesh,
    panelCanvas,
    uiGroup,
    state,
    drawPanel,
    handleActionFromHit,
  });

  // -------------------------
  // Sprites flotantes
  // -------------------------
  const floatGroup = new THREE.Group();
  scene.add(floatGroup);

  const floating = [];

  function makeSprite(url, size, opacity) {
    const tex = texLoader.load(
      url,
      (t) => { t.colorSpace = THREE.SRGBColorSpace; },
      undefined,
      (e) => console.warn("No pude cargar sprite:", url, e)
    );

    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: typeof opacity === "number" ? opacity : 1.0,
      depthWrite: false,
      depthTest: true,
    });

    const sp = new THREE.Sprite(mat);
    sp.scale.set(size, size, 1);
    return sp;
  }

  let astronautSprite = null;
  const AOFF = new THREE.Vector3(ASTRONAUT_SIDE_OFFSET.x, ASTRONAUT_SIDE_OFFSET.y, ASTRONAUT_SIDE_OFFSET.z);

  for (const cfg of FLOATING_ASSETS) {
    const sp = makeSprite(cfg.url, cfg.size, cfg.opacity);
    sp.name = cfg.id;

    if (cfg.id === "astronaut") {
      astronautSprite = sp;
      astronautSprite.position.copy(AOFF);
      astronautSprite.scale.set(cfg.size * ASTRONAUT_SCALE_MULT, cfg.size * ASTRONAUT_SCALE_MULT, 1);
      astronautSprite.renderOrder = 3;
      astronautSprite.material.depthWrite = false;
      uiGroup.add(astronautSprite);
      continue;
    }

    floatGroup.add(sp);
    floating.push({ sprite: sp, cfg });
  }

  const _tmpPos = new THREE.Vector3();
  function getUserWorldPos(out) {
    const cam = renderer.xr.isPresenting ? renderer.xr.getCamera(camera) : camera;
    cam.getWorldPosition(out);
    return out;
  }

  function updateFloatingObjects(tSec) {
    const userPos = getUserWorldPos(_tmpPos);

    for (const o of floating) {
      const { sprite, cfg } = o;

      const ang = tSec * cfg.speed + cfg.phase;
      const x = Math.cos(ang) * cfg.radius;
      const z = Math.sin(ang) * cfg.radius;
      const bob = Math.sin(tSec * cfg.bobSpeed + cfg.phase) * cfg.bobAmp;

      sprite.position.set(userPos.x + x, cfg.height + bob, userPos.z + z);
    }

    if (astronautSprite) {
      const bobLocal = Math.sin(tSec * 1.15) * 0.05;
      const sway = Math.sin(tSec * 0.85) * 0.03;

      astronautSprite.position.set(AOFF.x + sway, AOFF.y + bobLocal, AOFF.z);
      astronautSprite.material.rotation = Math.sin(tSec * 0.9) * 0.08;
    }
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);

    applyPanelScale();
    if (!renderer.xr.isPresenting) centerPanelDesktopLikeReload();
  }
  window.addEventListener("resize", onResize);

  drawPanel();

  const clock = new THREE.Clock();

  renderer.setAnimationLoop(() => {
    const t = clock.getElapsedTime();

    xr.tickXR?.();

    if (Math.abs(state.scrollVel) > 0.01 && state.scrollMax > 0) {
      state.scrollY = THREE.MathUtils.clamp(state.scrollY + state.scrollVel, 0, state.scrollMax);
      state.scrollVel *= 0.86;
      if (state.scrollY <= 0 || state.scrollY >= state.scrollMax) state.scrollVel = 0;
      drawPanel();
    }

    updateFloatingObjects(t);
    renderer.render(scene, camera);
  });
})();
