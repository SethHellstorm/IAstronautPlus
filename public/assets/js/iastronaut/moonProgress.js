export const MOON_PROGRESS_KEY = 'iastronaut_sidequest_moon_v1';
export function isMoonUnlocked(state) {
    return !!state?.completed?.has('earth');
}
export function createMoonProgress(storage) {
    let saved = {};
    try { saved = JSON.parse(storage?.getItem(MOON_PROGRESS_KEY) || '{}') || {}; } catch (_) {}
    const collected = new Set((Array.isArray(saved.collected) ? saved.collected : [])
        .filter(id => Number.isInteger(id) && id >= 0 && id < 3));
    let started = saved.started === true || collected.size > 0;
    let persistent = true;
    function save() {
        try {
            if (!storage) throw new Error('Storage unavailable');
            storage.setItem(MOON_PROGRESS_KEY, JSON.stringify({version:1, started, collected:[...collected]}));
        } catch (_) { persistent = false; }
    }
    return {
        getState: () => ({started, collected:[...collected], completed:collected.size===3, persistent}),
        start() { started=true; save(); },
        collect(id) {
            if (!started || !Number.isInteger(id) || id<0 || id>2 || collected.has(id)) return false;
            collected.add(id); save(); return true;
        }
    };
}
