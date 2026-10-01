export function resonancePosition(custom = {}, operation = {}, now = Date.now()) {
    const bandIndex = Math.max(0, Number(custom.bandIndex || 0));
    const startedAt = Number(custom.resonanceStartedAt || now);
    const speeds = operation.resonanceSpeeds || [0.42, 0.58, 0.74];
    const offsets = operation.resonanceOffsets || [0.08, 0.31, 0.57];
    const speed = Number(speeds[bandIndex] ?? speeds[speeds.length - 1] ?? 0.5);
    const offset = Number(offsets[bandIndex] ?? 0);
    const elapsed = Math.max(0, now - startedAt) / 1000;
    return (Math.sin((elapsed * speed + offset) * Math.PI * 2) + 1) / 2;
}

export function resonanceInWindow(custom = {}, operation = {}, now = Date.now()) {
    const position = resonancePosition(custom, operation, now);
    const center = Number(operation.resonanceCenter ?? 0.5);
    const halfWidth = Number(operation.resonanceHalfWidth ?? 0.1);
    return Math.abs(position - center) <= halfWidth;
}
