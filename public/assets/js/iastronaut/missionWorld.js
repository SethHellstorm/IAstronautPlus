import { createProbeCompanion } from "./probeCompanion.js";
import { SOLAR_MISSION } from "./missionData.js";
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
function colorToHex(color, fallback = 0x3fe4ff) {
    try {
        return new color.constructor(color);
    }
    catch (_) {
        return fallback;
    }
}
function createTextSprite(THREE, width = 900, height = 320) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: true });
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.34, 0.48, 1);
    return { canvas, ctx, texture, sprite, key: "" };
}
function createInstructionSprite(THREE, width = 900, height = 320) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: true });
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.38, 0.49, 1);
    return { canvas, ctx, texture, sprite, key: "" };
}
function wrapText(ctx, text, maxWidth) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
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
    return lines;
}
function drawCenteredWrapped(ctx, text, centerX, startY, maxWidth, lineHeight, maxLines = 2) {
    const lines = wrapText(ctx, text, maxWidth).slice(0, maxLines);
    for (let i = 0; i < lines.length; i++)
        ctx.fillText(lines[i], centerX, startY + i * lineHeight);
}
function createTargetGeometry(THREE, kind, color) {
    const root = new THREE.Group();
    const base = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.52,
        roughness: 0.28,
        emissive: color,
        emissiveIntensity: 0.55,
        transparent: true,
        opacity: 0.9,
    });
    const dark = new THREE.MeshStandardMaterial({
        color: 0x071827,
        metalness: 0.66,
        roughness: 0.34,
        emissive: 0x03111d,
        emissiveIntensity: 0.4,
    });
    let hitMesh = null;
    if (kind === "shield") {
        hitMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 6), base);
        hitMesh.rotation.x = Math.PI / 2;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.035, 10, 6), base.clone());
        ring.rotation.x = Math.PI / 2;
        root.add(hitMesh, ring);
    }
    else if (kind === "sample") {
        hitMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.27, 2), base);
        const halo = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.025, 8, 28), base.clone());
        halo.rotation.x = Math.PI / 2;
        root.add(hitMesh, halo);
    }
    else if (kind === "waypoint" || kind === "route") {
        hitMesh = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.055, 12, 36), base);
        const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 10), base.clone());
        arrow.rotation.z = -Math.PI / 2;
        arrow.position.x = 0.42;
        root.add(hitMesh, arrow);
    }
    else if (kind === "frequency") {
        hitMesh = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.065, 12, 42), base);
        const inner = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 8, 32), base.clone());
        inner.rotation.x = Math.PI / 3;
        root.add(hitMesh, inner);
    }
    else if (kind === "control") {
        hitMesh = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.28, 0.13), base);
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.045, 0.15), dark);
        root.add(hitMesh, bar);
    }
    else if (kind === "axis") {
        hitMesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 14), base);
        const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.82, 10), base.clone());
        axis.rotation.z = Math.PI / 2;
        root.add(hitMesh, axis);
        root.userData.axisMesh = axis;
    }
    else if (kind === "probe") {
        hitMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 1), base);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 8, 28), base.clone());
        ring.rotation.x = Math.PI / 2;
        root.add(hitMesh, ring);
    }
    else if (kind === "scan") {
        hitMesh = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 12), base);
        const scanRing = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.028, 8, 32), base.clone());
        scanRing.rotation.x = Math.PI / 2;
        root.add(hitMesh, scanRing);
    }
    else {
        hitMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.42, 12), base);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), base.clone());
        cap.position.y = 0.28;
        root.add(hitMesh, cap);
    }
    const outer = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.018, 8, 48), base.clone());
    outer.rotation.x = Math.PI / 2;
    outer.material.transparent = true;
    outer.material.opacity = 0.38;
    root.add(outer);
    const visualGroup = new THREE.Group();
    while (root.children.length)
        visualGroup.add(root.children[0]);
    root.add(visualGroup);
    root.userData.visualGroup = visualGroup;
    root.userData.outerRing = outer;
    root.userData.materials = [];
    root.traverse((child) => {
        if (child.isMesh && child.material)
            root.userData.materials.push(child.material);
    });
    return { root, hitMesh };
}
function createFloor(THREE) {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: 0x36dff5, transparent: true, opacity: 0.075, depthWrite: false, side: THREE.DoubleSide });
    for (const radius of [0.72, 1.72]) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.008, radius + 0.008, 64), material.clone());
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = -1.48;
        group.add(ring);
    }
    return group;
}
function pulseGamepad(source, intensity = 0.6, duration = 55) {
    const gamepad = source?.userData?.gamepad || source?.gamepad || source?.inputSource?.gamepad;
    const actuator = gamepad?.hapticActuators?.[0] || gamepad?.vibrationActuator;
    try {
        if (actuator?.pulse)
            actuator.pulse(Math.max(0, Math.min(1, intensity)), duration);
        else if (actuator?.playEffect)
            actuator.playEffect("dual-rumble", { duration, strongMagnitude: intensity, weakMagnitude: intensity * 0.65 });
    }
    catch (_) { }
}
export function createMissionWorld({ THREE, scene, camera, renderer, director }) {
    const world = new THREE.Group();
    world.name = "operation-helios-world";
    scene.add(world);
    const floor = createFloor(THREE);
    world.add(floor);
    const probe = createProbeCompanion({ THREE, scene: world });
    const targetGroup = new THREE.Group();
    const archiveGroup = new THREE.Group();
    world.add(targetGroup, archiveGroup);
    const ambient = new THREE.PointLight(0x38dfff, 1.0, 6, 2);
    ambient.position.set(0, 0.6, 1.2);
    world.add(ambient);
    const particlesGeometry = new THREE.BufferGeometry();
    const particleCount = 36;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const radius = 0.6 + ((i * 17) % 100) / 45;
        positions[i * 3] = Math.cos(angle) * radius;
        positions[i * 3 + 1] = -0.25 + ((i * 29) % 100) / 120;
        positions[i * 3 + 2] = Math.sin(angle) * radius * 0.35;
    }
    particlesGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(particlesGeometry, new THREE.PointsMaterial({ color: 0x59e8ff, size: 0.014, transparent: true, opacity: 0.28, depthWrite: false }));
    world.add(particles);
    const targets = new Map();
    let interactiveMeshes = [probe.interactiveMesh];
    let hoveredTargetId = "";
    let pressedTargetId = "";
    let pressedSource = null;
    let holdProgress = 0;
    let lastHoldPercent = -1;
    let currentStageId = "";
    let latestState = director.getState();
    let anchored = false;
    let statusDirty = true;
    let lastEventSecond = -1;
    let archiveSignature = "";
    let guidedTargetId = "";
    let guidedUntil = 0;
    let interactionEnabled = false;
    let hoverHoldUntil = 0;
    let lastPressedSeenAt = 0;
    let lastFocusMode = latestState.focusMode;
    const tempHead = new THREE.Vector3();
    const tempForward = new THREE.Vector3();
    const tempRight = new THREE.Vector3();
    const tempUp = new THREE.Vector3(0, 1, 0);
    const tempScale = new THREE.Vector3(1, 1, 1);
    const tempProbeTarget = new THREE.Vector3();
    const tempTangent = new THREE.Vector3();
    function userCamera() {
        return renderer.xr.isPresenting ? renderer.xr.getCamera(camera) : camera;
    }
    function updateArchive(state) {
        const ids = SOLAR_MISSION.filter((item) => state.completed.has(item.id)).map((item) => item.id);
        const signature = ids.join("|");
        if (signature === archiveSignature)
            return;
        archiveSignature = signature;
        while (archiveGroup.children.length) {
            const child = archiveGroup.children[0];
            archiveGroup.remove(child);
            child.geometry?.dispose?.();
            child.material?.dispose?.();
        }
        ids.forEach((id, index) => {
            const stage = SOLAR_MISSION.find((item) => item.id === id);
            const material = new THREE.MeshStandardMaterial({
                color: stage?.accent || "#5CFF9D",
                emissive: stage?.accent || "#5CFF9D",
                emissiveIntensity: 1.65,
                metalness: 0.45,
                roughness: 0.24,
            });
            const capsule = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 1), material);
            const angle = ids.length > 1 ? (index / ids.length) * Math.PI * 2 : 0;
            capsule.position.set(Math.cos(angle) * 0.62, -0.37, 0.58 + Math.sin(angle) * 0.22);
            capsule.userData.phase = angle;
            archiveGroup.add(capsule);
        });
    }
    function suggestedTargetId() {
        const op = latestState.operation;
        const task = latestState.task;
        if (!op || task.completed)
            return "";
        if (op.type === "sequence")
            return op.sequence?.[task.sequenceIndex] || "";
        if (op.type === "survey") {
            const unscanned = op.targets.find((target) => !task.targets?.[target.id]?.scanned);
            return unscanned?.id || op.correctTarget || "";
        }
        if (op.type === "align") {
            const difference = op.targetAngle - (task.angle || 0);
            if (Math.abs(difference) <= 5)
                return "uranus-confirm";
            return difference > 0 ? "uranus-right" : "uranus-left";
        }
        return op.targets?.[0]?.id || "";
    }
    function anchorToView() {
        const cam = userCamera();
        cam.getWorldPosition(tempHead);
        tempForward.set(0, 0, -1).applyQuaternion(cam.quaternion);
        tempForward.y = 0;
        if (tempForward.lengthSq() < 0.001)
            tempForward.set(0, 0, -1);
        tempForward.normalize();
        world.position.copy(tempHead);
        world.rotation.set(0, Math.atan2(-tempForward.x, -tempForward.z), 0);
        anchored = true;
    }
    function targetLayoutAngles(total) {
        if (total <= 1)
            return [0];
        if (total === 2)
            return [-62, 62];
        if (total === 3)
            return [-100, 0, 100];
        if (total === 4)
            return [-96, -32, 32, 96];
        const start = -110;
        const end = 110;
        return Array.from({ length: total }, (_, index) => start + (end - start) * index / Math.max(1, total - 1));
    }
    function targetLayoutPosition(target, index, total) {
        const angles = targetLayoutAngles(total);
        const angle = THREE.MathUtils.degToRad(angles[index] || 0);
        const radius = total === 1 ? 3.0 : 3.25;
        const side = Math.abs(angles[index] || 0) > 40;
        const y = side ? 0.2 : 0.38;
        return new THREE.Vector3(Math.sin(angle) * radius, y, -Math.cos(angle) * radius);
    }
    function makeTarget(target, accent, index, total) {
        const color = new THREE.Color(target.color || accent || "#3FE4FF");
        const geometry = createTargetGeometry(THREE, target.kind, color);
        const root = geometry.root;
        root.position.copy(targetLayoutPosition(target, index, total));
        root.userData.targetId = target.id;
        root.userData.definition = target;
        geometry.hitMesh.userData.targetId = target.id;
        geometry.hitMesh.userData.missionWorldTarget = true;
        geometry.hitMesh.userData.targetRoot = root;
        const hitRadius = Math.max(0.72, Number(target.hitRadius || 0.76));
        const hitArea = new THREE.Mesh(new THREE.SphereGeometry(hitRadius, 18, 14), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, depthTest: false, colorWrite: false }));
        hitArea.userData.targetId = target.id;
        hitArea.userData.missionWorldTarget = true;
        hitArea.userData.targetRoot = root;
        root.add(hitArea);
        const label = createTextSprite(THREE);
        label.sprite.position.set(0, -0.68, 0.02);
        root.add(label.sprite);
        const instruction = createInstructionSprite(THREE);
        instruction.sprite.position.set(0, 0.9, 0.02);
        root.add(instruction.sprite);
        root.userData.label = label;
        root.userData.instruction = instruction;
        root.userData.hitArea = hitArea;
        root.userData.baseScale = 0.88;
        root.userData.basePosition = root.position.clone();
        targetGroup.add(root);
        root.rotation.y = Math.atan2(-root.position.x, -root.position.z);
        targets.set(target.id, root);
        return hitArea;
    }
    function clearTargets() {
        for (const root of targets.values()) {
            root.traverse((child) => {
                if (child.geometry)
                    child.geometry.dispose?.();
                if (child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    for (const material of materials) {
                        material.map?.dispose?.();
                        material.dispose?.();
                    }
                }
            });
            targetGroup.remove(root);
        }
        targets.clear();
        interactiveMeshes = [probe.interactiveMesh];
        hoverHoldUntil = 0;
        lastPressedSeenAt = 0;
        hoveredTargetId = "";
        pressedTargetId = "";
        holdProgress = 0;
        lastHoldPercent = -1;
    }
    function targetState(targetId) {
        return latestState.task?.targets?.[targetId] || {};
    }
    function expectedTargetId() {
        const op = latestState.operation;
        if (op?.type !== "sequence")
            return "";
        return op.sequence?.[latestState.task.sequenceIndex] || "";
    }
    function labelText(root) {
        const target = root.userData.definition;
        const state = targetState(target.id);
        const op = latestState.operation;
        let detail = target.detail || "";
        if (target.hiddenDetail && !state.scanned)
            detail = "LECTURA OCULTA";
        if (state.incorrect)
            detail = `${detail} · DESCARTADO`;
        if (state.complete)
            detail = `${detail} · CONFIRMADO`;
        if (op?.type === "sequence" && expectedTargetId() && expectedTargetId() !== target.id && !state.complete)
            detail = "EN ESPERA";
        if (op?.type === "align" && target.id === "uranus-confirm")
            detail = `ACTUAL ${Math.round(latestState.task.angle || 0)}° · META ${op.targetAngle}°`;
        if (guidedTargetId === target.id && pressedTargetId !== target.id)
            detail = `${detail} · OBJETIVO SUGERIDO`;
        if (pressedTargetId === target.id)
            detail = `MANTÉN PRESIONADO · ${Math.round(holdProgress * 100)}%`;
        return { label: target.label, detail };
    }
    function drawTargetLabel(root, force = false) {
        const target = root.userData.definition;
        const label = root.userData.label;
        const state = targetState(target.id);
        const text = labelText(root);
        const hovered = hoveredTargetId === target.id;
        const pressed = pressedTargetId === target.id;
        const guided = guidedTargetId === target.id;
        const expected = expectedTargetId() === target.id;
        const persistentResult = latestState.operation?.type === "survey" && !!state.scanned;
        const expanded = hovered || pressed || guided || persistentResult;
        const color = state.complete ? "#5CFF9D" : state.incorrect ? "#FF718D" : latestState.current.accent;
        const key = `${text.label}|${text.detail}|${hovered}|${pressed}|${guided}|${expected}|${expanded}|${persistentResult}|${state.scanned}|${state.complete}|${state.incorrect}|${Math.round(holdProgress * 100)}`;
        if (!force && key === label.key)
            return;
        label.key = key;
        const { ctx, canvas, texture } = label;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, "rgba(4, 27, 48, 0.98)");
        gradient.addColorStop(1, "rgba(2, 10, 22, 0.98)");
        const box = expanded ? { x: 10, y: 10, w: canvas.width - 20, h: canvas.height - 20, r: 28 } : { x: 90, y: 66, w: canvas.width - 180, h: 166, r: 26 };
        ctx.fillStyle = gradient;
        roundRect(ctx, box.x, box.y, box.w, box.h, box.r);
        ctx.fill();
        ctx.strokeStyle = hovered || pressed ? "#FFFFFF" : expected || guided ? color : `${color}D0`;
        ctx.lineWidth = hovered || pressed ? 8 : expected || guided ? 6 : 4;
        roundRect(ctx, box.x, box.y, box.w, box.h, box.r);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = expanded ? "900 49px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" : "900 43px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text.label, canvas.width / 2, expanded ? 82 : 149);
        if (expanded) {
            ctx.fillStyle = "#F3FCFF";
            ctx.font = "850 38px system-ui, -apple-system, Segoe UI, Roboto, Arial";
            drawCenteredWrapped(ctx, text.detail, canvas.width / 2, 164, canvas.width - 92, 44, 3);
        }
        label.sprite.scale.set(expanded ? 1.58 : 1.2, expanded ? 0.58 : 0.35, 1);
        label.sprite.position.y = expanded ? -0.9 : -0.68;
        texture.needsUpdate = true;
    }
    function instructionText(root) {
        const target = root.userData.definition;
        const state = targetState(target.id);
        const op = latestState.operation;
        const index = Math.max(0, op.targets.findIndex((item) => item.id === target.id));
        let title = `OBJETIVO ${index + 1} DE ${op.targets.length}`;
        let detail = "APUNTA Y MANTÉN EL GATILLO";
        if (state.complete)
            detail = "COMPLETADO · CONTINÚA LA EXPLORACIÓN";
        else if (pressedTargetId === target.id)
            detail = `MANTÉN EL PUNTERO ESTABLE · ${Math.round(holdProgress * 100)}%`;
        else if (op.type === "sequence") {
            const expected = expectedTargetId();
            if (expected && expected !== target.id) {
                const expectedTarget = op.targets.find((item) => item.id === expected);
                title = "OBJETIVO EN ESPERA";
                detail = `PRIMERO COMPLETA ${expectedTarget?.label || "EL PASO ACTUAL"}`;
            }
            else {
                title = `PASO ${latestState.task.sequenceIndex + 1} DE ${op.sequence.length}`;
                detail = "APUNTA Y MANTÉN EL GATILLO";
            }
        }
        else if (op.type === "survey") {
            const allRead = op.targets.every((item) => targetState(item.id).scanned);
            if (!state.scanned)
                detail = "ESCANEA PARA REVELAR LA LECTURA";
            else if (!allRead)
                detail = "LECTURA GUARDADA · GIRA Y BUSCA LAS DEMÁS";
            else {
                title = state.incorrect ? "OPCIÓN DESCARTADA" : "DECISIÓN FINAL";
                detail = state.incorrect ? op.retryPrompt || op.selectionPrompt || "REVISA LOS RESULTADOS Y ELIGE OTRA OPCIÓN" : op.selectionPrompt || "COMPARA LOS RESULTADOS Y SELECCIONA LA OPCIÓN CORRECTA";
            }
        }
        else if (op.type === "align") {
            if (target.id === "uranus-confirm")
                detail = `CONFIRMA CUANDO EL EJE ESTÉ CERCA DE ${op.targetAngle}°`;
            else
                detail = `AJUSTA EL EJE · ACTUAL ${Math.round(latestState.task.angle || 0)}°`;
        }
        if (guidedTargetId === target.id && pressedTargetId !== target.id)
            title = "OBJETIVO RECOMENDADO";
        return { title, detail };
    }
    function drawTargetInstruction(root, force = false) {
        const target = root.userData.definition;
        const instruction = root.userData.instruction;
        const state = targetState(target.id);
        const text = instructionText(root);
        const hovered = hoveredTargetId === target.id;
        const pressed = pressedTargetId === target.id;
        const guided = guidedTargetId === target.id;
        const color = state.complete ? "#5CFF9D" : state.incorrect ? "#FF718D" : latestState.current.accent;
        const key = `${text.title}|${text.detail}|${hovered}|${pressed}|${guided}|${state.complete}|${state.scanned}|${Math.round(holdProgress * 100)}`;
        if (!force && key === instruction.key)
            return;
        instruction.key = key;
        const { ctx, canvas, texture } = instruction;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, "rgba(10, 42, 69, 0.98)");
        gradient.addColorStop(1, "rgba(2, 12, 25, 0.98)");
        ctx.fillStyle = gradient;
        roundRect(ctx, 10, 10, canvas.width - 20, canvas.height - 20, 28);
        ctx.fill();
        ctx.strokeStyle = hovered || pressed ? "#FFFFFF" : color;
        ctx.lineWidth = hovered || pressed ? 8 : guided ? 6 : 4;
        roundRect(ctx, 10, 10, canvas.width - 20, canvas.height - 20, 28);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = "900 34px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text.title, canvas.width / 2, 72);
        ctx.fillStyle = "#F5FCFF";
        ctx.font = "850 35px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        drawCenteredWrapped(ctx, text.detail, canvas.width / 2, 150, canvas.width - 90, 42, 3);
        instruction.sprite.scale.set(hovered || pressed || guided ? 1.58 : 1.42, hovered || pressed || guided ? 0.57 : 0.51, 1);
        instruction.sprite.position.y = hovered || pressed || guided ? 1.05 : 0.93;
        texture.needsUpdate = true;
    }
    function styleTarget(root) {
        const id = root.userData.targetId;
        const state = targetState(id);
        const hovered = hoveredTargetId === id;
        const pressed = pressedTargetId === id;
        const expected = expectedTargetId();
        const guided = guidedTargetId === id;
        const locked = latestState.operation?.type === "sequence" && expected && expected !== id && !state.complete;
        const active = latestState.task.started && !latestState.task.completed;
        const materials = root.userData.materials || [];
        for (const material of materials) {
            if (!("emissiveIntensity" in material))
                continue;
            material.emissiveIntensity = state.complete ? 2.1 : pressed ? 3.3 : hovered || guided ? 2.6 : active && !locked ? 1.05 : 0.35;
            material.opacity = locked ? 0.32 : active ? 0.92 : 0.48;
            material.transparent = true;
        }
        const baseScale = root.userData.baseScale || 0.84;
        const targetScale = state.complete ? baseScale * 0.92 : pressed ? baseScale * 1.18 : hovered || guided ? baseScale * 1.12 : baseScale;
        tempScale.setScalar(targetScale);
        root.scale.lerp(tempScale, 0.24);
        const ring = root.userData.outerRing;
        if (ring) {
            ring.material.opacity = state.complete ? 0.58 : hovered || pressed || guided ? 0.72 : locked ? 0.08 : 0.2;
            ring.material.color.set(state.complete ? "#52FF99" : latestState.current.accent);
        }
        drawTargetLabel(root);
        drawTargetInstruction(root);
    }
    function applyWorldVisibility(state) {
        interactionEnabled = !!state.focusMode && !!state.task.started && !state.task.completed && !state.traveling;
        world.visible = interactionEnabled;
        targetGroup.visible = interactionEnabled;
        archiveGroup.visible = false;
        floor.visible = interactionEnabled;
        particles.visible = interactionEnabled;
        ambient.visible = interactionEnabled;
        probe.setVisible(interactionEnabled);
        if (!interactionEnabled) {
            hoveredTargetId = "";
            pressedTargetId = "";
            pressedSource = null;
            holdProgress = 0;
            lastHoldPercent = -1;
            hoverHoldUntil = 0;
            lastPressedSeenAt = 0;
        }
    }
    function rebuild(state) {
        clearTargets();
        latestState = state;
        currentStageId = state.current.id;
        const op = state.operation;
        if (!op)
            return;
        const operationTargets = op.targets || [];
        operationTargets.forEach((target, index) => interactiveMeshes.push(makeTarget(target, state.current.accent, index, operationTargets.length)));
        probe.setState("SONDA HELIOS", state.task.completed ? "REGISTRO RECUPERADO" : state.task.started ? "OPERACIÓN ACTIVA" : "ESPERANDO ORDEN", state.task.completed ? "#5CFF9D" : state.current.accent);
        probe.setHome(new THREE.Vector3(0, -1.12, -2.3));
        updateArchive(state);
        applyWorldVisibility(state);
        statusDirty = true;
        anchored = false;
    }
    function refreshState(state) {
        const stageChanged = state.current.id !== currentStageId;
        const focusChanged = state.focusMode !== lastFocusMode;
        lastFocusMode = state.focusMode;
        latestState = state;
        if (stageChanged || targets.size !== (state.operation?.targets?.length || 0))
            rebuild(state);
        else
            applyWorldVisibility(state);
        updateArchive(state);
        if (state.task.completed) {
            guidedTargetId = "";
            guidedUntil = 0;
        }
        if (stageChanged || focusChanged || state.traveling)
            anchored = false;
        statusDirty = true;
        if (!state.task.started) {
            probe.setState("SONDA HELIOS", "SELECCIONA INICIAR OPERACIÓN", state.current.accent);
            probe.setTarget(null);
        }
        else if (state.task.completed) {
            probe.setState("SONDA HELIOS", "REGISTRO RECUPERADO", "#5CFF9D");
            probe.setTarget(null);
        }
        else if (state.task.eventActive) {
            probe.setState("ALERTA ACTIVA", `${state.operation.event.label} · ${Math.ceil(state.task.eventRemaining)} s`, "#FFB24F");
        }
        else {
            probe.setState("SONDA HELIOS", state.operation.tool.toUpperCase(), state.current.accent);
        }
    }
    director.subscribe(refreshState);
    function findTarget(hit) {
        let object = hit?.object || null;
        while (object) {
            if (object.userData?.targetId)
                return object.userData.targetId;
            if (object.userData?.probeControl)
                return "__probe__";
            object = object.parent;
        }
        return "";
    }
    function probeTargetPosition(root) {
        tempProbeTarget.copy(root.position).multiplyScalar(0.78);
        tempTangent.set(-root.position.z, 0, root.position.x);
        if (tempTangent.lengthSq() < 0.001)
            tempTangent.set(1, 0, 0);
        tempTangent.normalize().multiplyScalar(1.45);
        tempProbeTarget.add(tempTangent);
        tempProbeTarget.y = -1.34;
        return tempProbeTarget;
    }
    function applyHoverId(id) {
        if (hoveredTargetId === id)
            return id;
        const previous = hoveredTargetId;
        hoveredTargetId = id;
        if (previous && targets.has(previous)) {
            drawTargetLabel(targets.get(previous), true);
            drawTargetInstruction(targets.get(previous), true);
        }
        if (id && targets.has(id)) {
            drawTargetLabel(targets.get(id), true);
            drawTargetInstruction(targets.get(id), true);
            probe.setTarget(probeTargetPosition(targets.get(id)), "OBJETIVO FIJADO", targets.get(id).userData.definition.label);
        }
        else if (guidedTargetId && targets.has(guidedTargetId) && performance.now() < guidedUntil) {
            const root = targets.get(guidedTargetId);
            probe.setTarget(probeTargetPosition(root), "RUTA SUGERIDA", root.userData.definition.label);
        }
        else {
            probe.setTarget(null, "SONDA HELIOS", latestState.task.started ? latestState.operation.tool.toUpperCase() : "ESPERANDO ORDEN");
        }
        probe.setHovered(id === "__probe__");
        statusDirty = true;
        return id;
    }
    function setHoverHit(hit) {
        if (!interactionEnabled)
            return applyHoverId("");
        const now = performance.now();
        const id = findTarget(hit);
        if (id) {
            hoverHoldUntil = now + 260;
            if (pressedTargetId === id)
                lastPressedSeenAt = now;
            return applyHoverId(id);
        }
        if (pressedTargetId && now - lastPressedSeenAt < 650)
            return applyHoverId(pressedTargetId);
        if (hoveredTargetId && now < hoverHoldUntil)
            return hoveredTargetId;
        return applyHoverId("");
    }
    function suggestTarget() {
        if (!latestState.task.started)
            director.startOperation();
        const id = suggestedTargetId();
        if (!id || !targets.has(id))
            return false;
        const previous = guidedTargetId;
        guidedTargetId = id;
        guidedUntil = performance.now() + 9000;
        if (previous && targets.has(previous)) {
            drawTargetLabel(targets.get(previous), true);
            drawTargetInstruction(targets.get(previous), true);
        }
        const root = targets.get(id);
        drawTargetLabel(root, true);
        drawTargetInstruction(root, true);
        probe.setTarget(probeTargetPosition(root), "RUTA SUGERIDA", root.userData.definition.label);
        statusDirty = true;
        return true;
    }
    function beginPress(hit, source = null) {
        if (!interactionEnabled)
            return false;
        const id = findTarget(hit);
        if (!id)
            return false;
        if (id === "__probe__") {
            director.startOperation();
            pulseGamepad(source, 0.35, 45);
            return true;
        }
        if (!latestState.task.started)
            director.startOperation();
        if (latestState.task.completed)
            return true;
        pressedTargetId = id;
        pressedSource = source;
        holdProgress = 0;
        lastHoldPercent = -1;
        lastPressedSeenAt = performance.now();
        hoverHoldUntil = lastPressedSeenAt + 650;
        applyHoverId(id);
        if (targets.has(id)) {
            drawTargetLabel(targets.get(id), true);
            drawTargetInstruction(targets.get(id), true);
        }
        pulseGamepad(source, 0.18, 25);
        return true;
    }
    function endPress() {
        const id = pressedTargetId;
        pressedTargetId = "";
        pressedSource = null;
        holdProgress = 0;
        lastHoldPercent = -1;
        if (id && targets.has(id)) {
            drawTargetLabel(targets.get(id), true);
            drawTargetInstruction(targets.get(id), true);
        }
    }
    function cancelPress() {
        endPress();
    }
    function completePressedTarget() {
        const id = pressedTargetId;
        const source = pressedSource;
        if (!id)
            return;
        const result = director.interactTarget(id);
        pulseGamepad(source, result?.completed ? 0.95 : result?.accepted ? 0.62 : 0.28, result?.completed ? 120 : 70);
        if (result?.completed) {
            const root = targets.get(id);
            if (root) {
                probe.setTarget(probeTargetPosition(root), "OPERACIÓN COMPLETA", "RECUPERANDO REGISTRO");
            }
        }
        endPress();
    }
    function update(t, delta) {
        if (!interactionEnabled)
            return;
        if (!anchored)
            anchorToView();
        particles.rotation.y = t * 0.035;
        particles.material.opacity = latestState.task.eventActive ? 0.48 : 0.22 + Math.sin(t * 0.7) * 0.04;
        ambient.intensity = latestState.task.eventActive ? 1.45 + Math.sin(t * 6) * 0.3 : 0.72 + Math.sin(t * 1.5) * 0.12;
        floor.rotation.y = t * 0.04;
        archiveGroup.children.forEach((capsule, index) => {
            capsule.rotation.x += delta * 0.55;
            capsule.rotation.y += delta * 0.82;
            capsule.position.y = -0.37 + Math.sin(t * 1.4 + capsule.userData.phase + index * 0.3) * 0.012;
        });
        const now = performance.now();
        if (guidedTargetId && now >= guidedUntil) {
            const previous = guidedTargetId;
            guidedTargetId = "";
            guidedUntil = 0;
            if (targets.has(previous)) {
                drawTargetLabel(targets.get(previous), true);
                drawTargetInstruction(targets.get(previous), true);
            }
            if (!hoveredTargetId)
                probe.setTarget(null, "SONDA HELIOS", latestState.task.started ? latestState.operation.tool.toUpperCase() : "ESPERANDO ORDEN");
        }
        if (latestState.task.eventActive) {
            const second = Math.ceil(latestState.task.eventRemaining);
            if (second !== lastEventSecond) {
                lastEventSecond = second;
                statusDirty = true;
            }
        }
        const aimStable = pressedTargetId && (hoveredTargetId === pressedTargetId || now - lastPressedSeenAt < 650);
        if (aimStable && latestState.task.started && !latestState.task.completed) {
            const target = targets.get(pressedTargetId)?.userData?.definition;
            const duration = Math.max(0.12, Number(target?.hold || 0.7));
            holdProgress = Math.min(1, holdProgress + delta / duration);
            const percent = Math.round(holdProgress * 100);
            if (percent !== lastHoldPercent) {
                lastHoldPercent = percent;
                const root = targets.get(pressedTargetId);
                if (root) {
                    drawTargetLabel(root, true);
                    drawTargetInstruction(root, true);
                }
            }
            if (holdProgress >= 1)
                completePressedTarget();
        }
        let targetIndex = 0;
        for (const root of targets.values()) {
            const phase = targetIndex * 0.8;
            const basePosition = root.userData.basePosition;
            if (basePosition)
                root.position.copy(basePosition);
            const ring = root.userData.outerRing;
            if (ring)
                ring.rotation.z = t * (latestState.task.eventActive ? 1.8 : 0.55) + phase;
            const visualGroup = root.userData.visualGroup;
            if (root.userData.definition.kind === "sample" && visualGroup)
                visualGroup.rotation.y += delta * 0.28;
            if (root.userData.definition.kind === "frequency" && visualGroup)
                visualGroup.rotation.z += delta * 0.16;
            if (root.userData.definition.kind === "axis" && visualGroup)
                visualGroup.rotation.z = THREE.MathUtils.degToRad(latestState.task.angle || 0);
            styleTarget(root);
            targetIndex += 1;
        }
        probe.update(t, delta);
    }
    function getStatus() {
        const target = hoveredTargetId && targets.get(hoveredTargetId)?.userData?.definition;
        const targetInfo = target ? labelText(targets.get(hoveredTargetId)) : null;
        return {
            hoveredTargetId,
            pressedTargetId,
            holdProgress,
            targetLabel: targetInfo?.label || "",
            targetDetail: targetInfo?.detail || "",
            active: latestState.task.started,
            completed: latestState.task.completed,
            guidedTargetId,
            recoveredRecords: latestState.completed.size,
        };
    }
    function recenter() {
        anchored = false;
        anchorToView();
    }
    rebuild(latestState);
    return {
        update,
        recenter,
        setHoverHit,
        beginPress,
        endPress,
        cancelPress,
        getStatus,
        suggestTarget,
        getInteractiveMeshes: () => interactionEnabled ? interactiveMeshes : [],
        findTarget,
    };
}
