import { roundRect } from "./canvasUtils.js";
function makeLabel(THREE) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext("2d", { alpha: true });
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.62, 0.19, 1);
    sprite.position.set(0, 0.5, 0);
    return { canvas, ctx, texture, sprite };
}
export function createProbeCompanion({ THREE, scene }) {
    const group = new THREE.Group();
    group.name = "helios-probe";
    scene.add(group);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x15364f, metalness: 0.72, roughness: 0.26, emissive: 0x06233a, emissiveIntensity: 0.75 });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: 0x5be9ff, metalness: 0.4, roughness: 0.2, emissive: 0x1bd8ff, emissiveIntensity: 1.8 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x07131f, metalness: 0.65, roughness: 0.34, emissive: 0x04101a, emissiveIntensity: 0.4 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 14), bodyMaterial);
    body.scale.set(1.15, 0.78, 1.15);
    group.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.028, 10, 32), accentMaterial);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), accentMaterial);
    lens.position.set(0, 0, 0.24);
    group.add(lens);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.28, 10), darkMaterial);
    antenna.position.set(0, 0.28, 0);
    group.add(antenna);
    const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), accentMaterial);
    antennaTip.position.set(0, 0.43, 0);
    group.add(antennaTip);
    const wingGeometry = new THREE.BoxGeometry(0.42, 0.04, 0.18);
    const leftWing = new THREE.Mesh(wingGeometry, darkMaterial);
    leftWing.position.set(-0.38, 0, 0);
    const rightWing = leftWing.clone();
    rightWing.position.x = 0.38;
    group.add(leftWing, rightWing);
    const light = new THREE.PointLight(0x38dfff, 1.2, 2.5, 2);
    light.position.set(0, 0.05, 0.2);
    group.add(light);
    const label = makeLabel(THREE);
    group.add(label.sprite);
    const homePosition = new THREE.Vector3();
    const targetPosition = new THREE.Vector3();
    let hasTarget = false;
    let status = "SONDA HELIOS";
    let detail = "LISTA";
    let color = "#4BE7FF";
    let labelKey = "";
    let visible = true;
    const animatedTarget = new THREE.Vector3();
    const animatedScale = new THREE.Vector3(1, 1, 1);
    let hovered = false;
    function drawLabel() {
        const key = `${status}|${detail}|${color}|${hovered}`;
        if (key === labelKey)
            return;
        labelKey = key;
        const { ctx, canvas, texture } = label;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, "rgba(4, 25, 43, 0.96)");
        gradient.addColorStop(1, "rgba(2, 10, 22, 0.96)");
        const box = hovered ? { x: 8, y: 8, w: 496, h: 144, r: 22 } : { x: 74, y: 38, w: 364, h: 84, r: 20 };
        ctx.fillStyle = gradient;
        roundRect(ctx, box.x, box.y, box.w, box.h, box.r);
        ctx.fill();
        ctx.strokeStyle = hovered ? "#FFFFFF" : color;
        ctx.lineWidth = hovered ? 6 : 3;
        roundRect(ctx, box.x, box.y, box.w, box.h, box.r);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = hovered ? "900 36px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" : "900 32px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(status, 256, hovered ? 55 : 80);
        if (hovered) {
            ctx.fillStyle = "#DDF8FF";
            ctx.font = "800 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
            ctx.fillText(detail, 256, 105);
        }
        label.sprite.scale.set(hovered ? 1.0 : 0.72, hovered ? 0.32 : 0.22, 1);
        label.sprite.position.y = hovered ? 0.58 : 0.5;
        texture.needsUpdate = true;
    }
    function setHome(position) {
        homePosition.copy(position);
        if (!hasTarget)
            targetPosition.copy(position);
    }
    function setTarget(position, nextStatus = "ANALIZANDO", nextDetail = "SIGUIENDO OBJETIVO") {
        if (position) {
            targetPosition.copy(position);
            hasTarget = true;
        }
        else {
            targetPosition.copy(homePosition);
            hasTarget = false;
        }
        status = nextStatus;
        detail = nextDetail;
        drawLabel();
    }
    function setState(nextStatus, nextDetail, nextColor = "#4BE7FF") {
        status = nextStatus || status;
        detail = nextDetail || detail;
        color = nextColor;
        drawLabel();
    }
    function setHovered(value) {
        hovered = !!value;
        drawLabel();
    }
    function setVisible(value) {
        visible = !!value;
        group.visible = visible;
    }
    function update(t, delta) {
        if (!visible)
            return;
        const desired = hasTarget ? targetPosition : homePosition;
        animatedTarget.copy(desired);
        animatedTarget.y += hovered ? 0 : Math.sin(t * 1.5) * 0.006;
        group.position.lerp(animatedTarget, 1 - Math.pow(0.001, Math.max(0.001, delta)));
        ring.rotation.z = t * 0.65;
        antennaTip.scale.setScalar(1 + Math.sin(t * 4.2) * 0.12);
        light.intensity = 1.1 + Math.sin(t * 4.2) * 0.25;
        bodyMaterial.emissiveIntensity = hovered ? 1.5 : 0.75;
        accentMaterial.emissiveIntensity = hovered ? 3.2 : 1.8;
        animatedScale.setScalar(hovered ? 1.04 : 0.9);
        group.scale.lerp(animatedScale, 0.2);
    }
    drawLabel();
    return {
        group,
        setHome,
        setTarget,
        setState,
        setHovered,
        setVisible,
        update,
    };
}
