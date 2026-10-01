import { createProbeCompanion } from "./probeCompanion.js";
import { SOLAR_MISSION } from "./missionData.js";
import { roundRect } from "./canvasUtils.js";
import { createTextSprite, createInstructionSprite, drawCenteredWrapped, createTargetGeometry, createFloor, pulseGamepad } from "./missionTargetVisuals.js";
import { createMissionEnvironment } from "./missionEnvironment.js";
import { resonanceInWindow, resonancePosition } from "./missionMath.js";
function createTelemetrySprite(THREE) {
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 220;
    const ctx = canvas.getContext("2d", { alpha: true });
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.65, 0.36, 1);
    sprite.position.set(0, 1.62, -2.4);
    sprite.renderOrder = 130;
    return { canvas, ctx, texture, sprite, key: "" };
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
    const environmentGroup = new THREE.Group();
    const successGroup = new THREE.Group();
    const environment = createMissionEnvironment({ THREE, environmentGroup, successGroup });
    const telemetry = createTelemetrySprite(THREE);
    world.add(environmentGroup, targetGroup, archiveGroup, successGroup, telemetry.sprite);
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
    let interactiveMeshes = [];
    let hoveredTargetId = "";
    let currentStageId = "";
    let latestState = director.getState();
    let anchored = false;
    let statusDirty = true;
    let lastEventSecond = -1;
    let archiveSignature = "";
    let guidedTargetId = "";
    let guidedUntil = 0;
    let operationVisible = false;
    let interactionEnabled = false;
    let narrationLocked = false;
    let narrationLockText = "";
    let hoverHoldUntil = 0;
    let lastFocusMode = latestState.focusMode;
    let wasCompleted = !!latestState.task.completed;
    const tempHead = new THREE.Vector3();
    const tempForward = new THREE.Vector3();
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
        if (op.type === "defense" || op.type === "pilot")
            return op.sequence?.[task.sequenceIndex] || "";
        if (op.type === "assembly")
            return op.targets.find((target) => !task.targets?.[target.id]?.complete)?.id || "";
        if (op.type === "search") {
            const scanned = op.targets.filter((target) => task.targets?.[target.id]?.scanned).length;
            if (scanned >= (op.requiredScans || 1) && task.targets?.[op.correctTarget]?.scanned)
                return op.correctTarget;
            return op.targets.find((target) => !task.targets?.[target.id]?.scanned)?.id || "";
        }
        if (op.type === "descent") {
            const sampleLevels = op.levels.map((level, index) => ({ ...level, index })).filter((level) => level.sample);
            const next = sampleLevels[task.custom?.sampleIndex || 0];
            if (!next)
                return "";
            return (task.custom?.level || 0) < next.index ? "venus-down" : "venus-sample";
        }
        if (op.type === "triangulation") {
            const station = (op.stations || []).find((id) => !task.targets?.[id]?.complete);
            return station || op.confirmTarget || "";
        }
        if (op.type === "resonance")
            return "saturn-capture";
        if (op.type === "routePlan")
            return "";
        if (op.type === "align")
            return "uranus-right";
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
        if (Array.isArray(target.world) && target.world.length >= 3)
            return new THREE.Vector3(Number(target.world[0]) || 0, Number(target.world[1]) || 0, Number(target.world[2]) || -3);
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
        const labelY = target.kind === "scan" ? 0.78 : -0.68;
        label.sprite.position.set(0, labelY, 0.02);
        root.add(label.sprite);
        const instruction = createInstructionSprite(THREE);
        const instructionY = target.kind === "scan" ? 1.38 : 0.9;
        instruction.sprite.position.set(0, instructionY, 0.02);
        root.add(instruction.sprite);
        root.userData.label = label;
        root.userData.instruction = instruction;
        root.userData.hitArea = hitArea;
        root.userData.baseScale = target.kind === "route" ? 0.8 : 0.88;
        root.userData.basePosition = root.position.clone();
        root.userData.installedPosition = Array.isArray(target.installedWorld) && target.installedWorld.length >= 3
            ? new THREE.Vector3(Number(target.installedWorld[0]) || 0, Number(target.installedWorld[1]) || 0, Number(target.installedWorld[2]) || -3)
            : null;
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
        interactiveMeshes = [];
        hoverHoldUntil = 0;
        hoveredTargetId = "";
    }
    function targetState(targetId) {
        return latestState.task?.targets?.[targetId] || {};
    }
    function expectedTargetId() {
        const op = latestState.operation;
        if (op?.type !== "defense" && op?.type !== "pilot")
            return "";
        return op.sequence?.[latestState.task.sequenceIndex] || "";
    }
    function isTargetLocked(targetId) {
        const op = latestState.operation;
        const state = targetState(targetId);
        if (!op || !targetId)
            return false;
        if (op.type === "defense" || op.type === "pilot" || op.type === "assembly")
            return !!state.complete;
        if (op.type === "search") {
            if (!state.scanned)
                return false;
            const scanned = op.targets.filter((item) => targetState(item.id).scanned).length;
            const decisionReady = scanned >= (op.requiredScans || 1) && targetState(op.correctTarget).scanned;
            return targetId !== op.correctTarget || !decisionReady || !!state.complete;
        }
        if (op.type === "triangulation")
            return (op.stations || []).includes(targetId) ? !!state.complete : false;
        if (op.type === "descent") {
            const sampleLevels = op.levels.map((level, index) => ({ ...level, index })).filter((level) => level.sample);
            const next = sampleLevels[latestState.task.custom?.sampleIndex || 0];
            if (!next)
                return true;
            if (targetId === "venus-down")
                return (latestState.task.custom?.level || 0) >= next.index;
            if (targetId === "venus-sample")
                return (latestState.task.custom?.level || 0) !== next.index;
        }
        if (op.type === "resonance")
            return targetId !== "saturn-capture";
        if (op.type === "align" && targetId === "uranus-right")
            return (latestState.task.angle || 0) >= (op.targetAngle || 0);
        if (op.type === "routePlan") {
            const step = latestState.task.custom?.routeStep || 0;
            const target = op.targets.find((item) => item.id === targetId);
            return !!state.selected || target?.routeStep !== step;
        }
        return false;
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
        if ((op?.type === "defense" || op?.type === "pilot") && expectedTargetId() && expectedTargetId() !== target.id && !state.complete)
            detail = "EN ESPERA";
        if (op?.type === "search" && state.scanned)
            detail = `${target.detail} · REGISTRADO`;
        if (op?.type === "descent") {
            const level = op.levels?.[latestState.task.custom?.level || 0];
            if (target.id === "venus-sample")
                detail = level ? `${level.name} · ${level.altitude}` : detail;
        }
        if (op?.type === "triangulation" && target.id === op.confirmTarget) {
            const ready = (op.stations || []).every((id) => targetState(id).complete);
            detail = ready ? "SEÑALES CONVERGENTES" : "ESPERANDO 3 LECTURAS";
        }
        if (op?.type === "routePlan") {
            const step = latestState.task.custom?.routeStep || 0;
            if (target.routeStep !== step && !state.complete && !state.incorrect)
                detail = target.routeStep < step ? "TRAMO FIJADO" : "ESPERANDO TRAMO ANTERIOR";
        }
        if (guidedTargetId === target.id)
            detail = `${detail} · OBJETIVO SUGERIDO`;
        return { label: target.label, detail };
    }
    function drawTargetLabel(root, force = false) {
        const target = root.userData.definition;
        const label = root.userData.label;
        const state = targetState(target.id);
        const text = labelText(root);
        const hovered = hoveredTargetId === target.id;
        const guided = guidedTargetId === target.id;
        const expected = expectedTargetId() === target.id;
        const persistentResult = latestState.operation?.type === "search" && !!state.scanned;
        const compactDetail = latestState.operation?.type === "routePlan" || (latestState.operation?.type === "search" && !!state.scanned);
        const expanded = hovered || guided;
        const color = state.complete ? "#5CFF9D" : state.incorrect ? "#FF718D" : latestState.current.accent;
        const key = `${text.label}|${text.detail}|${hovered}|${guided}|${expected}|${expanded}|${persistentResult}|${state.scanned}|${state.complete}|${state.incorrect}`;
        if (!force && key === label.key)
            return;
        label.key = key;
        const { ctx, canvas, texture } = label;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, "rgba(4, 27, 48, 0.98)");
        gradient.addColorStop(1, "rgba(2, 10, 22, 0.98)");
        const box = expanded
            ? { x: 18, y: 18, w: canvas.width - 36, h: canvas.height - 36, r: 26 }
            : compactDetail
                ? { x: 105, y: 58, w: canvas.width - 210, h: 190, r: 24 }
                : { x: 150, y: 86, w: canvas.width - 300, h: 132, r: 24 };
        ctx.fillStyle = gradient;
        roundRect(ctx, box.x, box.y, box.w, box.h, box.r);
        ctx.fill();
        ctx.strokeStyle = hovered ? "#FFFFFF" : expected || guided ? color : `${color}D0`;
        ctx.lineWidth = hovered ? 8 : expected || guided ? 6 : 4;
        roundRect(ctx, box.x, box.y, box.w, box.h, box.r);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = expanded ? "900 52px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" : "900 39px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text.label, canvas.width / 2, expanded ? 86 : compactDetail ? 116 : 150);
        if (expanded) {
            ctx.fillStyle = "#F3FCFF";
            ctx.font = "850 39px system-ui, -apple-system, Segoe UI, Roboto, Arial";
            drawCenteredWrapped(ctx, text.detail, canvas.width / 2, 162, canvas.width - 120, 40, 3);
        }
        else if (compactDetail) {
            ctx.fillStyle = "#EAFBFF";
            ctx.font = "900 35px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
            drawCenteredWrapped(ctx, text.detail.replace(/ · REGISTRADO$/, ""), canvas.width / 2, 184, canvas.width - 180, 34, 2);
        }
        label.sprite.scale.set(expanded ? 1.46 : compactDetail ? 1.2 : 1.03, expanded ? 0.53 : compactDetail ? 0.38 : 0.27, 1);
        const elevatedLabel = target.kind === "scan";
        label.sprite.position.y = elevatedLabel ? (expanded ? 0.96 : 0.76) : (expanded ? -0.84 : -0.58);
        texture.needsUpdate = true;
    }
    function instructionText(root) {
        const target = root.userData.definition;
        const state = targetState(target.id);
        const op = latestState.operation;
        const index = Math.max(0, op.targets.findIndex((item) => item.id === target.id));
        let title = `OBJETIVO ${index + 1}/${op.targets.length}`;
        let detail = "ACTIVAR";
        if (state.complete) {
            detail = "COMPLETADO";
        }
        else if (op.type === "defense" || op.type === "pilot") {
            const expected = expectedTargetId();
            if (expected && expected !== target.id) {
                title = op.type === "pilot" ? "FUERA DE RUTA" : "EN ESPERA";
                detail = "OTRO PASO PRIMERO";
            }
            else {
                title = op.type === "pilot" ? `PUERTA ${latestState.task.sequenceIndex + 1}/${op.sequence.length}` : `ONDA ${latestState.task.sequenceIndex + 1}/${op.sequence.length}`;
                detail = op.type === "pilot" ? "ATRAVESAR" : "PROTEGER";
            }
        }
        else if (op.type === "assembly") {
            title = state.complete ? "MÓDULO INSTALADO" : "MÓDULO DISPONIBLE";
            detail = state.complete ? "ACOPLADO" : "INSTALAR";
        }
        else if (op.type === "search") {
            const scanned = op.targets.filter((item) => targetState(item.id).scanned).length;
            const decisionReady = scanned >= (op.requiredScans || 1) && targetState(op.correctTarget).scanned;
            if (!state.scanned) {
                title = "MAPA TÉRMICO";
                detail = "ESCANEAR";
            }
            else if (target.id === op.correctTarget && decisionReady) {
                title = "ZONA MÁS FRÍA";
                detail = "DESPLEGAR BALIZA";
            }
            else {
                title = "LECTURA GUARDADA";
                detail = "COMPARAR OTRA ZONA";
            }
        }
        else if (op.type === "descent") {
            const level = op.levels?.[latestState.task.custom?.level || 0];
            const sampleLevels = op.levels.map((item, index) => ({ ...item, index })).filter((item) => item.sample);
            const next = sampleLevels[latestState.task.custom?.sampleIndex || 0];
            if (target.id === "venus-sample") {
                title = level?.name || "CAPA ATMOSFÉRICA";
                detail = next && (latestState.task.custom?.level || 0) === next.index ? "TOMAR MUESTRA" : "BLOQUEADO";
            }
            else {
                title = "SIGUIENTE CAPA";
                detail = next && (latestState.task.custom?.level || 0) < next.index ? "DESCENDER" : "BLOQUEADO";
            }
        }
        else if (op.type === "triangulation") {
            if (target.id === op.confirmTarget) {
                const ready = (op.stations || []).every((id) => targetState(id).complete);
                title = ready ? "CONVERGENCIA LOCALIZADA" : "PUNTO DE PERFORACIÓN";
                detail = ready ? "MARCAR" : "ESPERA 3 RADARES";
            }
            else {
                title = state.complete ? "RADAR REGISTRADO" : "ESTACIÓN DE RADAR";
                detail = state.complete ? "LECTURA LISTA" : "ACTIVAR";
            }
        }
        else if (op.type === "resonance") {
            title = `RESONANCIA ${(latestState.task.custom?.bandIndex || 0) + 1}/${op.bands.length}`;
            detail = resonanceInWindow(latestState.task.custom, op) ? "CAPTURAR AHORA" : "ESPERA LA ZONA CENTRAL";
        }
        else if (op.type === "routePlan") {
            const step = latestState.task.custom?.routeStep || 0;
            if (target.routeStep !== step) {
                title = target.routeStep < step ? "TRAMO CERRADO" : "SIGUIENTE TRAMO";
                detail = target.routeStep < step ? "FIJADO" : "EN ESPERA";
            }
            else if (state.incorrect) {
                title = "CORREDOR DESCARTADO";
                detail = "DEMASIADO VIENTO";
            }
            else {
                title = `TRAMO ${step + 1}/${op.routes.length}`;
                detail = "TRAZAR RUTA";
            }
        }
        else if (op.type === "align") {
            const difference = (op.targetAngle || 0) - (latestState.task.angle || 0);
            detail = difference > 0 ? `+${Math.min(op.step || 14, difference)}°` : "ALINEADO";
        }
        if (guidedTargetId === target.id)
            title = "RECOMENDADO";
        return { title, detail };
    }
    function drawTargetInstruction(root, force = false) {
        const target = root.userData.definition;
        const instruction = root.userData.instruction;
        const state = targetState(target.id);
        const text = instructionText(root);
        const hovered = hoveredTargetId === target.id;
        const guided = guidedTargetId === target.id;
        const expected = expectedTargetId() === target.id;
        instruction.sprite.visible = hovered || guided || expected;
        const color = state.complete ? "#5CFF9D" : state.incorrect ? "#FF718D" : latestState.current.accent;
        const key = `${text.title}|${text.detail}|${hovered}|${guided}|${state.complete}|${state.scanned}`;
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
        ctx.strokeStyle = hovered ? "#FFFFFF" : color;
        ctx.lineWidth = hovered ? 8 : guided ? 6 : 4;
        roundRect(ctx, 10, 10, canvas.width - 20, canvas.height - 20, 28);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = "900 39px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text.title, canvas.width / 2, 72);
        ctx.fillStyle = "#F5FCFF";
        ctx.font = "850 40px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        drawCenteredWrapped(ctx, text.detail, canvas.width / 2, 150, canvas.width - 90, 42, 3);
        instruction.sprite.scale.set(hovered || guided ? 1.44 : 1.22, hovered || guided ? 0.5 : 0.39, 1);
        const elevatedInstruction = target.kind === "scan";
        instruction.sprite.position.y = elevatedInstruction
            ? (hovered || guided ? 1.6 : 1.42)
            : (hovered || guided ? 1.0 : 0.86);
        texture.needsUpdate = true;
    }
    function telemetryData() {
        const op = latestState.operation;
        const task = latestState.task;
        if (!operationVisible || !op || task.completed)
            return null;
        if (narrationLocked)
            return { title: "IASTRONAUT · INSTRUCCIÓN", detail: "LAS ACCIONES SE ACTIVAN AL TERMINAR", accent: "#FFD166" };
        if (op.type === "align") {
            const current = Math.round(task.angle || 0);
            const remaining = Math.abs((op.targetAngle || 0) - current);
            return { title: `ÁNGULO ${current}°`, detail: `OBJETIVO ${op.targetAngle}° · FALTAN ${remaining}° · CONFIRMACIÓN AUTOMÁTICA` };
        }
        if (op.type === "resonance") {
            const bandIndex = task.custom?.bandIndex || 0;
            const position = resonancePosition(task.custom, op);
            const inWindow = resonanceInWindow(task.custom, op);
            return {
                title: `${op.bands?.[bandIndex] || "RESONANCIA"} · ${bandIndex + 1}/${op.bands.length}`,
                detail: inWindow ? "AHORA · PULSA CAPTURAR" : "ESPERA A QUE EL INDICADOR ENTRE EN LA ZONA",
                accent: inWindow ? "#74FFB0" : latestState.current.accent,
                meter: position,
                meterCenter: Number(op.resonanceCenter ?? 0.5),
                meterHalfWidth: Number(op.resonanceHalfWidth ?? 0.1),
            };
        }
        if (op.type === "descent") {
            const level = op.levels?.[task.custom?.level || 0];
            const sampleLevels = op.levels.map((item, index) => ({ ...item, index })).filter((item) => item.sample);
            const next = sampleLevels[task.custom?.sampleIndex || 0];
            const nextAction = next && (task.custom?.level || 0) === next.index ? "TOMA LA MUESTRA" : "DESCENDER A LA SIGUIENTE CAPA";
            return { title: `${level?.name || "DESCENSO"} · ${level?.altitude || ""}`, detail: `MUESTRAS ${task.custom?.sampleIndex || 0}/${sampleLevels.length} · ${nextAction}` };
        }
        if (op.type === "search") {
            const scans = op.targets.filter((item) => task.targets?.[item.id]?.scanned).length;
            return { title: `LECTURAS ${scans}/${op.requiredScans || op.targets.length}`, detail: scans ? "LAS TEMPERATURAS QUEDAN VISIBLES EN CADA REGIÓN" : "SELECCIONA UNA REGIÓN PARA MEDIR" };
        }
        if (op.type === "routePlan")
            return { title: `TRAMO ${(task.custom?.routeStep || 0) + 1}/${op.routes.length}`, detail: "COMPARA LAS VELOCIDADES DEL VIENTO" };
        return null;
    }
    function drawTelemetry(force = false) {
        const data = telemetryData();
        telemetry.sprite.visible = !!data;
        if (!data)
            return;
        const accent = data.accent || latestState.current.accent || "#49E8FF";
        const meterKey = Number.isFinite(data.meter) ? Math.round(data.meter * 100) : "";
        const key = `${data.title}|${data.detail}|${accent}|${meterKey}`;
        if (!force && telemetry.key === key)
            return;
        telemetry.key = key;
        const { ctx, canvas, texture } = telemetry;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, "rgba(4,28,48,.93)");
        gradient.addColorStop(1, "rgba(2,12,24,.93)");
        ctx.save();
        ctx.shadowColor = `${accent}88`;
        ctx.shadowBlur = 22;
        ctx.fillStyle = gradient;
        roundRect(ctx, 10, 10, canvas.width - 20, canvas.height - 20, 28);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 5;
        roundRect(ctx, 10, 10, canvas.width - 20, canvas.height - 20, 28);
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = accent;
        ctx.font = "900 46px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.fillText(data.title, canvas.width / 2, 76);
        ctx.fillStyle = "#F4FCFF";
        ctx.font = "850 34px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.fillText(data.detail, canvas.width / 2, Number.isFinite(data.meter) ? 128 : 150);
        if (Number.isFinite(data.meter)) {
            const meterX = 105;
            const meterY = 172;
            const meterW = 790;
            const meterH = 20;
            ctx.fillStyle = "rgba(80,135,165,.28)";
            roundRect(ctx, meterX, meterY, meterW, meterH, 10);
            ctx.fill();
            const center = Number(data.meterCenter ?? 0.5);
            const halfWidth = Number(data.meterHalfWidth ?? 0.1);
            const zoneX = meterX + Math.max(0, center - halfWidth) * meterW;
            const zoneW = Math.min(1, halfWidth * 2) * meterW;
            ctx.fillStyle = "rgba(116,255,176,.42)";
            roundRect(ctx, zoneX, meterY - 4, zoneW, meterH + 8, 12);
            ctx.fill();
            ctx.save();
            ctx.shadowColor = "#FFFFFF";
            ctx.shadowBlur = 16;
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(meterX + Math.max(0, Math.min(1, data.meter)) * meterW, meterY + meterH / 2, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        ctx.textAlign = "left";
        texture.needsUpdate = true;
    }

    function styleTarget(root) {
        const id = root.userData.targetId;
        const state = targetState(id);
        const hovered = hoveredTargetId === id;
        const expected = expectedTargetId();
        const guided = guidedTargetId === id;
        const sequentialType = ["defense", "pilot"].includes(latestState.operation?.type);
        const locked = sequentialType && expected && expected !== id && !state.complete;
        const interactionLocked = isTargetLocked(id);
        const active = latestState.task.started && !latestState.task.completed;
        const installedModule = latestState.operation?.type === "assembly" && !!state.complete;
        const materials = root.userData.materials || [];
        for (const material of materials) {
            if (!("emissiveIntensity" in material))
                continue;
            material.emissiveIntensity = installedModule ? 1.15 : state.complete ? 1.65 : interactionLocked ? 0.5 : hovered || guided ? 2.6 : active && !locked ? 1.05 : 0.35;
            material.opacity = installedModule ? 0.96 : state.complete ? 0.68 : interactionLocked ? 0.42 : locked ? 0.32 : active ? 0.92 : 0.48;
            material.transparent = true;
        }
        const baseScale = root.userData.baseScale || 0.84;
        const targetScale = installedModule ? baseScale : state.complete ? baseScale * 0.92 : hovered || guided ? baseScale * 1.12 : baseScale;
        tempScale.setScalar(targetScale);
        root.scale.lerp(tempScale, 0.24);
        const ring = root.userData.outerRing;
        if (ring) {
            ring.material.opacity = state.complete ? 0.42 : interactionLocked ? 0.1 : hovered || guided ? 0.72 : locked ? 0.08 : 0.2;
            ring.material.color.set(state.complete ? "#52FF99" : latestState.current.accent);
        }
        root.userData.label.sprite.visible = !installedModule;
        if (installedModule) {
            root.userData.instruction.sprite.visible = false;
        }
        else {
            drawTargetLabel(root);
            drawTargetInstruction(root);
        }
    }
    function applyWorldVisibility(state) {
        operationVisible = !!state.focusMode && !!state.task.started && !state.task.completed && !state.traveling;
        interactionEnabled = operationVisible && !narrationLocked;
        const successVisible = environment.isSuccessActive();
        world.visible = operationVisible || successVisible;
        targetGroup.visible = operationVisible;
        environmentGroup.visible = operationVisible || successVisible;
        successGroup.visible = successVisible;
        archiveGroup.visible = false;
        floor.visible = operationVisible;
        particles.visible = operationVisible || successVisible;
        ambient.visible = operationVisible || successVisible;
        telemetry.sprite.visible = operationVisible && !!telemetryData();
        probe.setVisible(operationVisible || successVisible);
        if (!interactionEnabled) {
            hoveredTargetId = "";
                        hoverHoldUntil = 0;
            }
    }
    function probeHomeForStage(stageId = latestState.current?.id) {
        if (stageId === "mercury")
            return new THREE.Vector3(0, -0.18, -2.05);
        if (stageId === "mars")
            return new THREE.Vector3(0, -0.20, -2.05);
        return new THREE.Vector3(0, -1.12, -2.3);
    }
    function probeFlightHeight(stageId = latestState.current?.id) {
        return stageId === "mercury" || stageId === "mars" ? -0.28 : -1.34;
    }
    function rebuild(state) {
        clearTargets();
        latestState = state;
        currentStageId = state.current.id;
        const op = state.operation;
        if (!op)
            return;
        environment.rebuild(state);
        const operationTargets = op.targets || [];
        operationTargets.forEach((target, index) => interactiveMeshes.push(makeTarget(target, state.current.accent, index, operationTargets.length)));
        probe.setState("SONDA HELIOS", state.task.completed ? "REGISTRO RECUPERADO" : state.task.started ? "OPERACIÓN ACTIVA" : "ESPERANDO ORDEN", state.task.completed ? "#5CFF9D" : state.current.accent);
        probe.setHome(probeHomeForStage(state.current.id));
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
        if (state.task.completed && !wasCompleted)
            environment.triggerSuccess(state);
        wasCompleted = !!state.task.completed;
        if (stageChanged || targets.size !== (state.operation?.targets?.length || 0) || environment.getStageId() !== state.current.id)
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
        tempProbeTarget.y = probeFlightHeight();
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
            return applyHoverId(id);
        }
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
        if (!latestState.task.started)
            director.startOperation();
        if (latestState.task.completed)
            return true;
        if (isTargetLocked(id)) {
            pulseGamepad(source, 0.14, 28);
            return true;
        }
        applyHoverId(id);
        const result = director.interactTarget(id);
        pulseGamepad(source, result?.completed ? 0.95 : result?.accepted ? 0.62 : 0.28, result?.completed ? 120 : 70);
        if (result?.completed) {
            const root = targets.get(id);
            if (root)
                probe.setTarget(probeTargetPosition(root), "OPERACIÓN COMPLETA", "RECUPERANDO REGISTRO");
        }
        if (targets.has(id)) {
            drawTargetLabel(targets.get(id), true);
            drawTargetInstruction(targets.get(id), true);
        }
        return true;
    }
    function endPress() { }

    function update(t, delta) {
        const successActive = environment.isSuccessActive();
        if (!operationVisible && !successActive) {
            world.visible = false;
            return;
        }
        world.visible = true;
        successGroup.visible = successActive;
        environmentGroup.visible = operationVisible || successActive;
        if (!anchored)
            anchorToView();
        environment.update(t, delta, latestState);
        particles.rotation.y = t * 0.035;
        particles.material.opacity = latestState.task.eventActive ? 0.48 : 0.22 + Math.sin(t * 0.7) * 0.04;
        ambient.intensity = latestState.task.eventActive ? 1.45 + Math.sin(t * 6) * 0.3 : 0.72 + Math.sin(t * 1.5) * 0.12;
        floor.rotation.y = t * 0.04;
        archiveGroup.children.forEach((capsule, index) => {
            capsule.rotation.x += delta * 0.55;
            capsule.rotation.y += delta * 0.82;
            capsule.position.y = -0.37 + Math.sin(t * 1.4 + capsule.userData.phase + index * 0.3) * 0.012;
        });
        drawTelemetry();
        if (!interactionEnabled) {
            let lockedIndex = 0;
            for (const root of targets.values()) {
                styleTarget(root);
                lockedIndex += 1;
            }
            probe.update(t, delta);
            return;
        }
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
        let targetIndex = 0;
        for (const root of targets.values()) {
            const phase = targetIndex * 0.8;
            const basePosition = root.userData.basePosition;
            const targetStateValue = targetState(root.userData.targetId);
            const installedAssembly = latestState.operation?.type === "assembly" && !!targetStateValue.complete;
            if (basePosition && !installedAssembly)
                root.position.copy(basePosition);
            if (latestState.operation?.type === "routePlan") {
                const activeStep = latestState.task.custom?.routeStep || 0;
                const targetStep = root.userData.definition?.routeStep;
                root.visible = typeof targetStep !== "number" || targetStep === activeStep;
                if (!root.visible) {
                    targetIndex += 1;
                    continue;
                }
            }
            else {
                root.visible = true;
            }
            if (latestState.operation?.type === "assembly" && targetStateValue.complete) {
                const destination = root.userData.installedPosition;
                if (destination)
                    root.position.lerp(destination, Math.min(1, delta * 4.6));
                root.rotation.y += (0 - root.rotation.y) * Math.min(1, delta * 4.2);
            }
            if (latestState.operation?.type === "pilot" && root.userData.definition.drift && !targetStateValue.complete) {
                const drift = root.userData.definition.drift;
                root.position.x += Math.sin(t * 1.25 + targetIndex * 1.7) * drift[0];
                root.position.y += Math.cos(t * 1.55 + targetIndex * 1.3) * drift[1];
            }
            const ring = root.userData.outerRing;
            if (ring)
                ring.rotation.z = t * (latestState.task.eventActive ? 1.8 : 0.55) + phase;
            const visualGroup = root.userData.visualGroup;
            if (root.userData.definition.kind === "sample" && visualGroup)
                visualGroup.rotation.y += delta * 0.28;
            styleTarget(root);
            targetIndex += 1;
        }
        probe.update(t, delta);
    }
    function setNarrationLocked(value, text = "") {
        narrationLocked = !!value;
        narrationLockText = String(text || "");
        applyWorldVisibility(latestState);
        drawTelemetry(true);
        for (const root of targets.values())
            styleTarget(root);
    }

    function getStatus() {
        const target = hoveredTargetId && targets.get(hoveredTargetId)?.userData?.definition;
        const targetInfo = target ? labelText(targets.get(hoveredTargetId)) : null;
        let targetLabel = targetInfo?.label || "";
        let targetDetail = targetInfo?.detail || "";
        const op = latestState.operation;
        const task = latestState.task;
        if (!targetLabel && op && task.started && !task.completed) {
            if (op.type === "assembly") {
                const done = op.targets.filter((item) => task.targets?.[item.id]?.complete).length;
                targetLabel = `MÓDULOS ${done}/${op.targets.length}`;
                targetDetail = "INSTALA LAS PIEZAS EN CUALQUIER ORDEN";
            }
            else if (op.type === "search") {
                const done = op.targets.filter((item) => task.targets?.[item.id]?.scanned).length;
                targetLabel = `LECTURAS ${done}/${op.requiredScans}`;
                targetDetail = task.targets?.[op.correctTarget]?.scanned && done >= op.requiredScans ? "CONFIRMA LA ZONA MÁS FRÍA" : "EXPLORA EL CRÁTER";
            }
            else if (op.type === "descent") {
                const level = op.levels?.[task.custom?.level || 0];
                targetLabel = level?.name || "DESCENSO";
                targetDetail = `${level?.altitude || ""} · MUESTRAS ${task.custom?.sampleIndex || 0}/${op.levels.filter((item) => item.sample).length}`;
            }
            else if (op.type === "triangulation") {
                const done = (op.stations || []).filter((id) => task.targets?.[id]?.complete).length;
                targetLabel = done === op.stations.length ? "PUNTO LOCALIZADO" : `RADARES ${done}/${op.stations.length}`;
                targetDetail = done === op.stations.length ? "MARCA LA ZONA DE PERFORACIÓN" : "ACTIVA OTRA ESTACIÓN";
            }
            else if (op.type === "pilot") {
                targetLabel = `PUERTA ${Math.min(task.sequenceIndex + 1, op.sequence.length)}/${op.sequence.length}`;
                targetDetail = "SIGUE EL CORREDOR ILUMINADO";
            }
            else if (op.type === "resonance") {
                const bandIndex = task.custom?.bandIndex || 0;
                targetLabel = op.bands?.[bandIndex] || "RESONANCIA";
                targetDetail = resonanceInWindow(task.custom, op) ? "CAPTURA AHORA" : "SIGUE EL INDICADOR";
            }
            else if (op.type === "routePlan") {
                targetLabel = `TRAMO ${(task.custom?.routeStep || 0) + 1}/${op.routes.length}`;
                targetDetail = "ELIGE UN CORREDOR ESTABLE";
            }
        }
        return {
            hoveredTargetId,
            targetLabel,
            targetDetail,
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
        getStatus,
        suggestTarget,
        setNarrationLocked,
        getInteractiveMeshes: () => interactionEnabled
            ? interactiveMeshes.filter((mesh) => !mesh.userData?.targetId || !isTargetLocked(mesh.userData.targetId))
            : [],
        findTarget,
    };
}
