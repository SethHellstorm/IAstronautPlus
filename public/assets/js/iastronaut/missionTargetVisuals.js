export function createTextSprite(THREE, width = 900, height = 320) {
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
    sprite.scale.set(1.1, 0.34, 1);
    return { canvas, ctx, texture, sprite, key: "" };
}

export function createInstructionSprite(THREE, width = 900, height = 320) {
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
    sprite.scale.set(1.26, 0.42, 1);
    return { canvas, ctx, texture, sprite, key: "" };
}

export function wrapText(ctx, text, maxWidth) {
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

export function drawCenteredWrapped(ctx, text, centerX, startY, maxWidth, lineHeight, maxLines = 2) {
    const lines = wrapText(ctx, text, maxWidth).slice(0, maxLines);
    for (let i = 0; i < lines.length; i++)
        ctx.fillText(lines[i], centerX, startY + i * lineHeight);
}

export function createTargetGeometry(THREE, kind, color) {
    const root = new THREE.Group();
    const base = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.62,
        roughness: 0.24,
        emissive: color,
        emissiveIntensity: 0.72,
        transparent: true,
        opacity: 0.94,
    });
    const dark = new THREE.MeshStandardMaterial({
        color: 0x06131f,
        metalness: 0.78,
        roughness: 0.3,
        emissive: 0x020a11,
        emissiveIntensity: 0.38,
    });
    const light = new THREE.MeshStandardMaterial({
        color: 0xdffaff,
        metalness: 0.34,
        roughness: 0.2,
        emissive: color,
        emissiveIntensity: 1.35,
        transparent: true,
        opacity: 0.92,
    });
    const glass = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
    let hitMesh = null;
    if (kind === "shield") {
        const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.1, 6), dark);
        frame.rotation.x = Math.PI / 2;
        hitMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.08, 6), base);
        hitMesh.rotation.x = Math.PI / 2;
        const field = new THREE.Mesh(new THREE.CircleGeometry(0.29, 6), glass);
        field.position.z = 0.06;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 10, 6), light.clone());
        ring.rotation.x = Math.PI / 2;
        root.add(frame, hitMesh, field, ring);
    }
    else if (kind === "sample") {
        hitMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 2), base);
        const haloA = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.025, 8, 30), light.clone());
        haloA.rotation.x = Math.PI / 2;
        const haloB = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.014, 8, 28), base.clone());
        haloB.rotation.y = Math.PI / 2;
        root.add(hitMesh, haloA, haloB);
    }
    else if (kind === "waypoint" || kind === "route") {
        hitMesh = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 12, 40), base);
        const inner = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.018, 8, 36), light.clone());
        const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 10), light.clone());
        arrow.rotation.z = -Math.PI / 2;
        arrow.position.x = 0.48;
        const spine = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.5, 0.08), dark);
        spine.position.y = -0.47;
        root.add(hitMesh, inner, arrow, spine);
    }
    else if (kind === "control") {
        const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.36, 0.11), dark);
        bezel.position.z = -0.055;
        hitMesh = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.27, 0.13), base);
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.045, 0.15), light.clone());
        const lens = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), light.clone());
        lens.position.set(0.21, 0.09, 0.09);
        root.add(bezel, hitMesh, bar, lens);
    }
    else if (kind === "scan") {
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.08, 12), dark);
        foot.position.y = -0.62;
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.62, 10), dark);
        mast.position.y = -0.3;
        hitMesh = new THREE.Mesh(new THREE.SphereGeometry(0.23, 18, 12), base);
        const scanRing = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.028, 8, 34), light.clone());
        scanRing.rotation.x = Math.PI / 2;
        const lens = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 10), light.clone());
        lens.position.y = 0.28;
        root.add(foot, mast, hitMesh, scanRing, lens);
    }
    else if (kind === "module") {
        const shell = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.31, 0.28), dark);
        hitMesh = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.24, 0.31), base);
        const connector = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.24, 12), light.clone());
        connector.rotation.z = Math.PI / 2;
        connector.position.x = 0.31;
        const lightBar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.325), light.clone());
        lightBar.position.y = 0.18;
        const sideA = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.19, 0.34), base.clone());
        sideA.position.x = -0.26;
        const node = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), light.clone());
        node.position.set(-0.18, -0.17, 0.17);
        root.add(shell, hitMesh, connector, lightBar, sideA, node);
    }
    else if (kind === "drill") {
        const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.21, 0.38, 14), dark);
        hitMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.34, 14), base);
        const collar = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.028, 8, 28), light.clone());
        collar.rotation.x = Math.PI / 2;
        collar.position.y = -0.16;
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 12), light.clone());
        tip.position.y = -0.34;
        tip.rotation.z = Math.PI;
        root.add(housing, hitMesh, collar, tip);
    }
    else if (kind === "beacon") {
        const basePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.12, 12), dark);
        basePlate.position.y = -0.28;
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.48, 10), base);
        mast.position.y = 0.0;
        hitMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10), light.clone());
        hitMesh.position.y = 0.28;
        const dish = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 8, 28, Math.PI), base.clone());
        dish.rotation.z = Math.PI / 2;
        dish.position.set(0, 0.32, 0);
        root.add(basePlate, mast, hitMesh, dish);
    }
    else {
        hitMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.42, 12), base);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), light.clone());
        cap.position.y = 0.28;
        root.add(hitMesh, cap);
    }
    const outer = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.018, 8, 48), light.clone());
    outer.rotation.x = Math.PI / 2;
    outer.material.transparent = true;
    outer.material.opacity = 0.34;
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

export function createFloor(THREE) {
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

export function pulseGamepad(source, intensity = 0.6, duration = 55) {
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
