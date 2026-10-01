import { APP_BASE, BG_IMAGE, MISSION_BG_DIR, MISSION_AUDIO_DIR, FLOATING_ASSETS, ASTRONAUT_SIDE_OFFSET, ASTRONAUT_SCALE_MULT, PANEL_DISTANCE_DEFAULT, PANEL_DISTANCE_XR_DEFAULT, HIT_ZONES, } from "./config.js";
import { createUIState, createPanel, drawPanelFactory, addBubble, clearBubblesBySource } from "./uiPanel.js";
import { createTTSPlayer, createVoiceGuide } from "./voice.js";
import { createMicChatController } from "./chat.js";
import { setupDesktopMobileInput } from "./inputDesktopMobile.js";
import { setupXRInput } from "./inputXR.js";
import { createFloatingMissionPanels } from "./floatingPanels.js";
import { createMissionDirector } from "./missionDirector.js";
import { createMissionWorld } from "./missionWorld.js";
import { getMissionAudioId } from "./missionAudioCatalog.js";
function isMobileUA() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}
function createDesktopHelp(renderer) {
    if (renderer.xr.isPresenting || isMobileUA() || localStorage.getItem("iastronaut_help_dismissed") === "1")
        return;
    const wrap = document.createElement("div");
    wrap.id = "vrDesktopHelp";
    wrap.style.position = "fixed";
    wrap.style.left = "16px";
    wrap.style.bottom = "16px";
    wrap.style.maxWidth = "500px";
    wrap.style.background = "rgba(7, 18, 34, 0.94)";
    wrap.style.color = "#fff";
    wrap.style.border = "1px solid rgba(83,225,255,0.38)";
    wrap.style.borderRadius = "14px";
    wrap.style.padding = "12px 14px";
    wrap.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";
    wrap.style.zIndex = "9999";
    wrap.style.backdropFilter = "blur(6px)";
    wrap.style.boxShadow = "0 10px 30px rgba(0,0,0,0.35)";
    wrap.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
      <div style="font-weight:800;font-size:14px">Controles de misión</div>
      <button id="vrHelpClose" style="cursor:pointer;border:0;background:rgba(255,255,255,.12);color:#fff;border-radius:10px;padding:6px 10px;font-weight:800">✕</button>
    </div>
    <div style="margin-top:8px;font-size:13px;line-height:1.45;color:rgba(255,255,255,.94)">
      <div><b>Interactuar:</b> apunta y haz clic una vez.</div>
      <div><b>Explorar:</b> gira para localizar objetivos alrededor de tu posición.</div>
      <div><b>Guía:</b> IAstronaut dará instrucciones de voz durante cada operación.</div>
      <div style="margin-top:6px;opacity:.85">En Quest usa el gatillo o la pinza. En escritorio, clic derecho o Shift + arrastrar permite mirar alrededor.</div>
    </div>`;
    document.body.appendChild(wrap);
    wrap.querySelector("#vrHelpClose")?.addEventListener("click", () => {
        localStorage.setItem("iastronaut_help_dismissed", "1");
        wrap.remove();
    });
}
(() => {
    const canvas = document.getElementById("renderCanvas");
    if (!canvas)
        return;
    const THREE = window.THREE;
    const VRButton = window.VRButton;
    if (!THREE || !VRButton) {
        console.error("Three.js o VRButton no están disponibles.");
        return;
    }
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(renderer.xr.isPresenting ? 1.25 : 2, window.devicePixelRatio || 1));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    renderer.domElement.style.touchAction = "none";
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 2000);
    camera.position.set(0, 1.6, 0);
    scene.add(camera);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x142033, 1.05));
    const keyLight = new THREE.DirectionalLight(0xbbeeff, 1.1);
    keyLight.position.set(1, 3, 2);
    scene.add(keyLight);
    const fadeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, depthWrite: false, toneMapped: false });
    const fadeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.9, 20, 14), fadeMaterial);
    fadeMesh.renderOrder = 10000;
    camera.add(fadeMesh);
    const fadeState = { target: 0, speed: 0, resolve: null };
    function fadeTo(target, duration = 0.35) {
        if (fadeState.resolve) {
            fadeState.resolve();
            fadeState.resolve = null;
        }
        fadeState.target = THREE.MathUtils.clamp(target, 0, 1);
        const distance = Math.abs(fadeState.target - fadeMaterial.opacity);
        if (distance < 0.001) {
            fadeMaterial.opacity = fadeState.target;
            return Promise.resolve();
        }
        fadeState.speed = distance / Math.max(0.05, duration);
        return new Promise((resolve) => { fadeState.resolve = resolve; });
    }
    function updateFade(delta) {
        const difference = fadeState.target - fadeMaterial.opacity;
        if (Math.abs(difference) < 0.002) {
            fadeMaterial.opacity = fadeState.target;
            fadeMaterial.visible = fadeMaterial.opacity > 0.001;
            if (fadeState.resolve) {
                const resolve = fadeState.resolve;
                fadeState.resolve = null;
                resolve();
            }
            return;
        }
        const step = Math.sign(difference) * fadeState.speed * delta;
        fadeMaterial.opacity = Math.abs(step) >= Math.abs(difference) ? fadeState.target : fadeMaterial.opacity + step;
        fadeMaterial.visible = fadeMaterial.opacity > 0.001;
    }
    function createTravelEffect() {
        const group = new THREE.Group();
        group.visible = false;
        camera.add(group);
        const streaks = [];
        for (let i = 0; i < 72; i++) {
            const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -0.35 - (i % 5) * 0.08)]);
            const material = new THREE.LineBasicMaterial({ color: i % 3 === 0 ? 0x7cecff : i % 3 === 1 ? 0xffffff : 0x8e9dff, transparent: true, opacity: 0.2 + (i % 7) * 0.08 });
            const line = new THREE.Line(geometry, material);
            const angle = (i / 72) * Math.PI * 2;
            const radius = 0.1 + ((i * 37) % 100) / 160;
            line.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.65, -0.2 - ((i * 19) % 100) / 80);
            group.add(line);
            streaks.push(line);
        }
        let active = false;
        function start() {
            active = true;
            group.visible = true;
        }
        function stop() {
            active = false;
            group.visible = false;
        }
        function update(delta) {
            if (!active)
                return;
            for (const line of streaks) {
                line.position.z += delta * 2.7;
                if (line.position.z > -0.05)
                    line.position.z = -1.5 - Math.random() * 0.9;
            }
            group.rotation.z += delta * 0.055;
        }
        return { start, stop, update };
    }
    const travelEffect = createTravelEffect();
    const sphereGeo = new THREE.SphereGeometry(450, 48, 32);
    sphereGeo.scale(-1, 1, 1);
    const texLoader = new THREE.TextureLoader();
    const bgTex = texLoader.load(BG_IMAGE, undefined, undefined, (error) => console.error("Error fondo:", error));
    bgTex.colorSpace = THREE.SRGBColorSpace;
    const bgMaterial = new THREE.MeshBasicMaterial({ map: bgTex });
    scene.add(new THREE.Mesh(sphereGeo, bgMaterial));
    let activeMissionTexture = null;
    let backgroundRequest = 0;
    let floatGroup = null;
    let astronautSprite = null;
    let originalSceneAssetsVisible = true;
    function setOriginalSceneAssetsVisible(value) {
        originalSceneAssetsVisible = !!value;
        if (floatGroup)
            floatGroup.visible = originalSceneAssetsVisible;
        if (astronautSprite)
            astronautSprite.visible = originalSceneAssetsVisible;
    }
    async function loadMissionBackground(stage) {
        const requestId = ++backgroundRequest;
        const travelStartedAt = performance.now();
        setOriginalSceneAssetsVisible(!!stage?.home);
        travelEffect.start();
        await fadeTo(0.82, 0.44);
        if (stage?.home || !stage?.background) {
            const previous = activeMissionTexture;
            activeMissionTexture = null;
            bgMaterial.map = bgTex;
            bgMaterial.needsUpdate = true;
            previous?.dispose?.();
            const remaining = Math.max(0, 1150 - (performance.now() - travelStartedAt));
            if (remaining)
                await new Promise((resolve) => setTimeout(resolve, remaining));
            if (requestId === backgroundRequest)
                await fadeTo(0, 0.62);
            travelEffect.stop();
            return { fallback: false, base: true, url: BG_IMAGE };
        }
        const url = `${MISSION_BG_DIR}/${stage.background}`;
        const result = await new Promise((resolve) => {
            texLoader.load(url, (texture) => {
                if (requestId !== backgroundRequest) {
                    texture.dispose();
                    resolve({ fallback: true, url });
                    return;
                }
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.wrapS = THREE.RepeatWrapping;
                texture.repeat.x = 1;
                const previous = activeMissionTexture;
                activeMissionTexture = texture;
                bgMaterial.map = texture;
                bgMaterial.needsUpdate = true;
                if (previous && previous !== texture)
                    previous.dispose();
                resolve({ fallback: false, url });
            }, undefined, () => {
                if (requestId === backgroundRequest) {
                    const previous = activeMissionTexture;
                    activeMissionTexture = null;
                    bgMaterial.map = bgTex;
                    bgMaterial.needsUpdate = true;
                    previous?.dispose?.();
                }
                resolve({ fallback: true, url });
            });
        });
        const remaining = Math.max(0, 1150 - (performance.now() - travelStartedAt));
        if (remaining)
            await new Promise((resolve) => setTimeout(resolve, remaining));
        if (requestId === backgroundRequest)
            await fadeTo(0, 0.62);
        travelEffect.stop();
        return result;
    }
    const uiState = createUIState();
    const { panelCanvas, ctx, panelTex, panelMesh, uiGroup } = createPanel({ THREE, scene });
    let panelDistance = PANEL_DISTANCE_DEFAULT;
    function applyPanelScale() {
        if (renderer.xr.isPresenting)
            uiGroup.scale.set(1, 1, 1);
        else if (isMobileUA())
            uiGroup.scale.set(0.75, 0.75, 0.75);
        else
            uiGroup.scale.set(1, 1, 1);
    }
    applyPanelScale();
    const drawPanel = drawPanelFactory({ THREE, panelCanvas, ctx, panelTex, state: uiState });
    const tts = createTTSPlayer();
    const voiceGuide = createVoiceGuide({ ttsPlayer: tts, localAudioBasePath: MISSION_AUDIO_DIR });
    const WELCOME_SESSION_KEY = "iastronaut.missionWelcomePlayed";
    let welcomeSpoken = false;
    let welcomeDismissed = false;
    let welcomePromise = null;
    const welcomeVoice = "Bienvenido a la Operación Helios. Soy IAstronaut y te acompañaré durante la misión. Antes de empezar, puedes revisar el objetivo, la información científica y la bitácora en los paneles. Cuando estés listo, selecciona Iniciar operación. A partir de ahí, te guiaré paso a paso.";
    function hasPlayedWelcome() {
        if (welcomeSpoken || welcomeDismissed || window.__iastronautWelcomePlayed)
            return true;
        try {
            return sessionStorage.getItem(WELCOME_SESSION_KEY) === "1";
        }
        catch (_) {
            return false;
        }
    }
    function markWelcomePlayed() {
        welcomeSpoken = true;
        window.__iastronautWelcomePlayed = true;
        try {
            sessionStorage.setItem(WELCOME_SESSION_KEY, "1");
        }
        catch (_) { }
    }
    function dismissPendingWelcome() {
        if (hasPlayedWelcome())
            return;
        welcomeDismissed = true;
        window.__iastronautWelcomePlayed = true;
        try {
            sessionStorage.setItem(WELCOME_SESSION_KEY, "1");
        }
        catch (_) { }
    }
    function startWelcomeVoice() {
        if (hasPlayedWelcome()) {
            welcomeSpoken = true;
            return Promise.resolve(true);
        }
        if (welcomePromise)
            return welcomePromise;
        welcomePromise = Promise.resolve(
            voiceGuide.playLocal("mission_welcome", { interrupt: false, remember: false })
        ).then((played) => {
            if (played && !welcomeDismissed)
                markWelcomePlayed();
            return !!played;
        }).finally(() => {
            welcomePromise = null;
        });
        return welcomePromise;
    }
    async function activateVoiceGuide() {
        await voiceGuide.unlock?.();
        if (hasPlayedWelcome()) {
            welcomeSpoken = true;
            return;
        }
        if (welcomePromise)
            await welcomePromise;
        if (!hasPlayedWelcome())
            await startWelcomeVoice();
    }
    if (!hasPlayedWelcome())
        startWelcomeVoice();
    voiceGuide.unlock?.();
    window.addEventListener("pointerdown", activateVoiceGuide, { once: true, capture: true });
    window.addEventListener("keydown", activateVoiceGuide, { once: true, capture: true });
    function createVRExitControl() {
        const controlCanvas = document.createElement("canvas");
        controlCanvas.width = 760;
        controlCanvas.height = 230;
        const controlCtx = controlCanvas.getContext("2d", { alpha: true });
        const texture = new THREE.CanvasTexture(controlCanvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.33), material);
        mesh.position.set(1.88, -1.72, 0.055);
        mesh.rotation.y = -0.11;
        mesh.renderOrder = 20;
        mesh.visible = false;
        mesh.userData.vrExitControl = true;
        uiGroup.add(mesh);
        let busy = false;
        let hovered = false;
        function roundedRect(x, y, w, h, r) {
            const radius = Math.min(r, w / 2, h / 2);
            controlCtx.beginPath();
            controlCtx.moveTo(x + radius, y);
            controlCtx.arcTo(x + w, y, x + w, y + h, radius);
            controlCtx.arcTo(x + w, y + h, x, y + h, radius);
            controlCtx.arcTo(x, y + h, x, y, radius);
            controlCtx.arcTo(x, y, x + w, y, radius);
            controlCtx.closePath();
        }
        function draw() {
            controlCtx.clearRect(0, 0, controlCanvas.width, controlCanvas.height);
            const gradient = controlCtx.createLinearGradient(0, 0, controlCanvas.width, controlCanvas.height);
            gradient.addColorStop(0, hovered ? "rgba(78,18,36,.99)" : "rgba(38,8,20,.98)");
            gradient.addColorStop(1, "rgba(8,20,36,.98)");
            controlCtx.save();
            controlCtx.shadowColor = hovered ? "rgba(255,255,255,.7)" : "rgba(255,79,120,.55)";
            controlCtx.shadowBlur = hovered ? 34 : 24;
            controlCtx.fillStyle = gradient;
            roundedRect(8, 8, 744, 214, 26);
            controlCtx.fill();
            controlCtx.restore();
            controlCtx.strokeStyle = hovered ? "#FFFFFF" : busy ? "rgba(255,190,88,.95)" : "rgba(255,93,132,.95)";
            controlCtx.lineWidth = hovered ? 7 : 5;
            roundedRect(8, 8, 744, 214, 26);
            controlCtx.stroke();
            controlCtx.fillStyle = "#FFB7C8";
            controlCtx.font = "900 28px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
            controlCtx.textAlign = "center";
            controlCtx.textBaseline = "middle";
            controlCtx.fillText("SISTEMA XR", 380, 62);
            controlCtx.fillStyle = "#FFFFFF";
            controlCtx.font = "900 48px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
            controlCtx.fillText(busy ? "SALIENDO..." : "SALIR DE VR", 380, 122);
            controlCtx.fillStyle = "#C9EFFF";
            controlCtx.font = "800 24px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
            controlCtx.fillText("VOLVER AL NAVEGADOR", 380, 174);
            texture.needsUpdate = true;
        }
        draw();
        return {
            mesh,
            setVisible(value) { mesh.visible = !!value; },
            setBusy(value) { busy = !!value; draw(); },
            setHovered(value) { if (hovered !== !!value) {
                hovered = !!value;
                draw();
            } },
        };
    }
    const vrExitControl = createVRExitControl();
    let missionWorld = null;
    let narrationSequence = 0;
    const blockingNarrationKinds = new Set([
        "operation_start",
        "target_success",
        "target_error",
        "scan_result",
        "decision_ready",
        "tune_feedback",
        "descent_move",
        "align_feedback"
    ]);
    const director = createMissionDirector({
        onSceneChange: loadMissionBackground,
        onMissionMessage: (message, meta = {}) => {
            const canonicalText = String(meta.voiceText || message || "").trim();
            if (!canonicalText)
                return;
            dismissPendingWelcome();
            if (meta.kind === "arrival")
                clearBubblesBySource(uiState, drawPanel, "mission");
            addBubble(uiState, drawPanel, canonicalText, "bot", { source: "mission" });
            const sequence = ++narrationSequence;
            const shouldBlock = blockingNarrationKinds.has(meta.kind);
            missionWorld?.setNarrationLocked?.(shouldBlock, canonicalText);
            const audioId = meta.audioId || getMissionAudioId(canonicalText);
            if (!audioId)
                console.warn("No existe un MP3 asociado a la narración de misión:", canonicalText);
            const speech = audioId
                ? voiceGuide.playLocal(audioId, { interrupt: true, remember: true })
                : Promise.resolve(false);
            Promise.resolve(speech).finally(() => {
                if (sequence === narrationSequence)
                    missionWorld?.setNarrationLocked?.(false);
            });
        },
    });
    const missionPanels = createFloatingMissionPanels({
        THREE,
        uiGroup,
        renderer,
        director,
        getWorldStatus: () => missionWorld?.getStatus?.() || {},
        mainPanelMesh: panelMesh,
    });
    missionWorld = createMissionWorld({ THREE, scene, camera, renderer, director });
    function syncVRExitVisibility() {
        vrExitControl.setVisible(renderer.xr.isPresenting && panelMesh.visible);
    }
    director.subscribe((nextState) => syncVRExitVisibility(nextState));
    if (!window.__iastronautWelcomeBubbleShown) {
        addBubble(uiState, drawPanel, welcomeVoice, "bot", { source: "mission" });
        window.__iastronautWelcomeBubbleShown = true;
    }
    function centerPanelDesktopLikeReload() {
        applyPanelScale();
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        forward.y = 0;
        if (forward.lengthSq() < 1e-6)
            forward.set(0, 0, -1);
        forward.normalize();
        const scale = uiGroup.scale.x || 1;
        const dist = panelDistance / Math.max(0.65, scale);
        uiGroup.position.copy(camera.position.clone().add(forward.multiplyScalar(dist)).add(new THREE.Vector3(0, 0.12, 0)));
        uiGroup.lookAt(camera.position);
        missionWorld?.recenter?.();
    }
    function recenterPanel() {
        if (!renderer.xr.isPresenting) {
            centerPanelDesktopLikeReload();
            return;
        }
        applyPanelScale();
        const xrCam = renderer.xr.getCamera(camera);
        const headPos = new THREE.Vector3();
        xrCam.getWorldPosition(headPos);
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(xrCam.quaternion).normalize();
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(xrCam.quaternion).normalize();
        uiGroup.position.copy(headPos.clone().add(forward.multiplyScalar(panelDistance)).add(up.multiplyScalar(-0.1)));
        uiGroup.lookAt(headPos);
        missionWorld?.recenter?.();
    }
    centerPanelDesktopLikeReload();
    async function exitAndRedirect() {
        const targetUrl = String(window.IASTRONAUT_EXIT_URL || "https://mechrobotix.com/");
        const session = renderer.xr.getSession?.();
        if (session) {
            try {
                await session.end();
            }
            catch (_) { }
        }
        setTimeout(() => { window.location.href = targetUrl; }, 120);
    }
    function canvasPoint(hit) {
        if (!hit?.uv)
            return null;
        return { x: hit.uv.x * panelCanvas.width, y: (1 - hit.uv.y) * panelCanvas.height };
    }
    function inRect(point, rect) {
        return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
    }
    function mainPanelHoverName(hit) {
        const point = canvasPoint(hit);
        if (!point)
            return "";
        if (inRect(point, HIT_ZONES.exit))
            return "exit";
        if (inRect(point, HIT_ZONES.recenter))
            return "recenter";
        if (inRect(point, HIT_ZONES.grab))
            return "grab";
        if (inRect(point, HIT_ZONES.talk))
            return "talk";
        if (inRect(point, HIT_ZONES.chat))
            return "chat";
        return "";
    }
    function handleMainPanelHover(hit) {
        const next = mainPanelHoverName(hit);
        if (uiState.hoverZone !== next) {
            uiState.hoverZone = next;
            drawPanel();
        }
    }
    async function handleActionFromHit(hit) {
        const point = canvasPoint(hit);
        if (!point)
            return;
        if (inRect(point, HIT_ZONES.exit))
            return exitAndRedirect();
        if (inRect(point, HIT_ZONES.recenter))
            return recenterPanel();
        if (inRect(point, HIT_ZONES.talk))
            return mic.toggleMic();
    }
    const mic = createMicChatController({
        state: uiState,
        drawPanel,
        ttsPlayer: tts,
        voiceGuide,
        getMissionContext: director.getContext,
        onAssistantAction: async (action) => {
            if (action?.type === "highlight_target")
                return missionWorld.suggestTarget();
            return director.runAction(action);
        },
    });
    // Solicita el permiso antes de entrar en XR, sin iniciar escucha ni enviar audio.
    mic.requestMicPermission?.();
    window.addEventListener("pointerdown", () => mic.requestMicPermission?.(), { once: true, capture: true });
    async function exitImmersiveVR() {
        const session = renderer.xr.getSession?.();
        if (!session) {
            vrExitControl.setVisible(false);
            return false;
        }
        vrExitControl.setBusy(true);
        try {
            await session.end();
            return true;
        }
        catch (_) {
            vrExitControl.setBusy(false);
            addBubble(uiState, drawPanel, "No fue posible cerrar la sesión VR. Presiona el botón Meta del controlador y selecciona Salir.", "bot");
            return false;
        }
    }
    function isVRExitHit(hit) {
        let object = hit?.object;
        while (object) {
            if (object === vrExitControl.mesh || object.userData?.vrExitControl)
                return true;
            object = object.parent;
        }
        return false;
    }
    function isMissionWorldHit(hit) {
        return !!missionWorld.findTarget(hit);
    }
    function handleInteractivePressStart(hit, source) {
        if (isVRExitHit(hit))
            return false;
        if (isMissionWorldHit(hit))
            return missionWorld.beginPress(hit, source);
        return false;
    }
    function handleInteractivePressEnd(hit) {
        if (isMissionWorldHit(hit))
            missionWorld.endPress();
    }
    async function handleInteractiveClick(hit) {
        if (isVRExitHit(hit)) {
            if (renderer.xr.isPresenting)
                await exitImmersiveVR();
            return true;
        }
        if (await missionPanels.handleHit(hit))
            return true;
        if (isMissionWorldHit(hit))
            return missionWorld.beginPress(hit, null);
        return false;
    }
    function handleInteractiveHover(hit) {
        const exitHover = isVRExitHit(hit);
        vrExitControl.setHovered(exitHover);
        if (exitHover) {
            missionPanels.setHoverHit(null);
            missionWorld.setHoverHit(null);
            return;
        }
        missionPanels.setHoverHit(hit);
        missionWorld.setHoverHit(hit);
    }
    function getInteractiveMeshes() {
        return [...missionPanels.getInteractiveMeshes(), ...missionWorld.getInteractiveMeshes(), vrExitControl.mesh];
    }
    setupDesktopMobileInput({
        THREE,
        renderer,
        camera,
        panelMesh,
        panelCanvas,
        uiGroup,
        state: uiState,
        drawPanel,
        recenterPanel,
        setPanelDistance: (value) => { panelDistance = value; },
        getPanelDistance: () => panelDistance,
        handleActionFromHit,
        getInteractiveMeshes,
        handleInteractiveClick,
        handleInteractivePressStart,
        handleInteractivePressEnd,
        handleInteractiveHover,
        handleMainPanelHover,
    });
    document.body.appendChild(VRButton.createButton(renderer, { optionalFeatures: ["hand-tracking", "local-floor", "bounded-floor"] }));
    renderer.xr.addEventListener("sessionstart", () => {
        renderer.setPixelRatio(Math.min(1.35, window.devicePixelRatio || 1));
        panelDistance = Math.max(panelDistance, PANEL_DISTANCE_XR_DEFAULT);
        vrExitControl.setBusy(false);
        syncVRExitVisibility();
        document.getElementById("vrDesktopHelp")?.remove();
        applyPanelScale();
        activateVoiceGuide();
        setTimeout(recenterPanel, 160);
        try {
            mic.onXRSessionStart?.();
        }
        catch (_) { }
    });
    renderer.xr.addEventListener("sessionend", () => {
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        vrExitControl.setVisible(false);
        vrExitControl.setBusy(false);
        applyPanelScale();
        centerPanelDesktopLikeReload();
        createDesktopHelp(renderer);
    });
    createDesktopHelp(renderer);
    const xr = setupXRInput({
        THREE,
        renderer,
        scene,
        camera,
        panelMesh,
        panelCanvas,
        uiGroup,
        state: uiState,
        drawPanel,
        handleActionFromHit,
        getInteractiveMeshes,
        handleInteractiveClick,
        handleInteractivePressStart,
        handleInteractivePressEnd,
        handleInteractiveHover,
        handleMainPanelHover,
    });
    floatGroup = new THREE.Group();
    scene.add(floatGroup);
    const floating = [];
    function makeSprite(url, size, opacity) {
        const texture = texLoader.load(url, (value) => { value.colorSpace = THREE.SRGBColorSpace; }, undefined, () => { });
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: typeof opacity === "number" ? opacity : 1, depthWrite: false, depthTest: true });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(size, size, 1);
        return sprite;
    }
    const astronautOffset = new THREE.Vector3(ASTRONAUT_SIDE_OFFSET.x, ASTRONAUT_SIDE_OFFSET.y, ASTRONAUT_SIDE_OFFSET.z);
    for (const config of FLOATING_ASSETS) {
        const sprite = makeSprite(config.url, config.size, config.opacity);
        sprite.name = config.id;
        if (config.id === "astronaut") {
            astronautSprite = sprite;
            astronautSprite.position.copy(astronautOffset);
            astronautSprite.scale.set(config.size * ASTRONAUT_SCALE_MULT, config.size * ASTRONAUT_SCALE_MULT, 1);
            astronautSprite.renderOrder = 3;
            uiGroup.add(astronautSprite);
            continue;
        }
        floatGroup.add(sprite);
        floating.push({ sprite, config });
    }
    const tempUser = new THREE.Vector3();
    function updateFloatingObjects(t) {
        if (!originalSceneAssetsVisible)
            return;
        const cam = renderer.xr.isPresenting ? renderer.xr.getCamera(camera) : camera;
        cam.getWorldPosition(tempUser);
        for (const item of floating) {
            const { sprite, config } = item;
            const angle = t * config.speed + config.phase;
            sprite.position.set(tempUser.x + Math.cos(angle) * config.radius, config.height + Math.sin(t * config.bobSpeed + config.phase) * config.bobAmp, tempUser.z + Math.sin(angle) * config.radius);
        }
        if (astronautSprite) {
            astronautSprite.position.set(astronautOffset.x + Math.sin(t * 0.85) * 0.03, astronautOffset.y + Math.sin(t * 1.15) * 0.05, astronautOffset.z);
            astronautSprite.material.rotation = Math.sin(t * 0.9) * 0.08;
        }
    }
    director.subscribe((missionState) => {
        const operationActive = missionState.task.started && !missionState.task.completed;
        setOriginalSceneAssetsVisible(!!missionState.current.home && !operationActive);
    });
    missionPanels.initialize();
    director.initialize();
    drawPanel();
    function onResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        applyPanelScale();
        if (!renderer.xr.isPresenting)
            centerPanelDesktopLikeReload();
    }
    window.addEventListener("resize", onResize);
    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
        const delta = Math.min(0.05, clock.getDelta());
        const t = clock.elapsedTime;
        updateFade(delta);
        travelEffect.update(delta);
        director.update(delta);
        xr.tickXR?.();
        if (Math.abs(uiState.scrollVel) > 0.01 && uiState.scrollMax > 0) {
            uiState.scrollY = THREE.MathUtils.clamp(uiState.scrollY + uiState.scrollVel, 0, uiState.scrollMax);
            uiState.scrollVel *= 0.86;
            if (uiState.scrollY <= 0 || uiState.scrollY >= uiState.scrollMax)
                uiState.scrollVel = 0;
            drawPanel();
        }
        updateFloatingObjects(t);
        missionWorld.update(t, delta);
        missionPanels.update(t);
        syncVRExitVisibility();
        renderer.render(scene, camera);
    });
})();
