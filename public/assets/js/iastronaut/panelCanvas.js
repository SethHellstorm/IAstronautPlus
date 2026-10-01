import { roundRect } from "./canvasUtils.js";
export function drawShell(ctx, w, h, title, accent = "#3FDCFF") {
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
export function drawDot(ctx, x, y, color, radius = 8, glow = 18) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}
export function wrapLines(ctx, text, maxWidth) {
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
export function drawWrapped(ctx, text, x, y, maxWidth, lineHeight, maxLines = 5) {
    const lines = wrapLines(ctx, text, maxWidth).slice(0, maxLines);
    for (let i = 0; i < lines.length; i++)
        ctx.fillText(lines[i], x, y + i * lineHeight);
    return lines.length;
}
export function drawBar(ctx, x, y, w, value, color, label) {
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
    ctx.font = "800 23px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    ctx.textBaseline = "bottom";
    ctx.fillText(label, x, y - 9);
    ctx.textAlign = "right";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(`${Math.round(v)}%`, x + w, y - 9);
    ctx.textAlign = "left";
}
export function drawButton(ctx, rect, label, active, accent, disabled = false, size = 23, hovered = false) {
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
export function drawPrimaryButton(ctx, rect, label, hovered = false, t = 0) {
    const accent = "#FF5A36";
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.15);
    const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    gradient.addColorStop(0, hovered ? "#FF7558" : "#FF5A36");
    gradient.addColorStop(1, hovered ? "#FF9A55" : "#E7462D");
    ctx.save();
    ctx.shadowColor = hovered ? "rgba(255,255,255,0.72)" : `rgba(255,90,54,${0.42 + pulse * 0.26})`;
    ctx.shadowBlur = hovered ? 38 : 24 + pulse * 14;
    ctx.fillStyle = gradient;
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 18);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = hovered ? "#FFFFFF" : "#FFB29D";
    ctx.lineWidth = hovered ? 7 : 5;
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 18);
    ctx.stroke();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 32px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.textAlign = "left";
}
export function makePanel({ THREE, uiGroup, id, canvasW, canvasH, width, height, x, y, z, rotationY = 0 }) {
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
export function pointInRect(point, rect, padding = 0) {
    return point.x >= rect.x - padding && point.x <= rect.x + rect.w + padding && point.y >= rect.y - padding && point.y <= rect.y + rect.h + padding;
}
export function circleContains(point, circle, padding = 0) {
    const dx = point.x - circle.x;
    const dy = point.y - circle.y;
    const radius = circle.r + padding;
    return dx * dx + dy * dy <= radius * radius;
}
