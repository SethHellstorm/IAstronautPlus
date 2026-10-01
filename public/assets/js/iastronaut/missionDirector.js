import { SOLAR_MISSION, MISSION_TOPIC_ORDER } from "./missionData.js";
import { MISSION_OPERATIONS } from "./missionOperations.js";
import { resonanceInWindow } from "./missionMath.js";
function readSaved() {
    const keys = ["iastronaut_operation_helios_v2", "iastronaut_operation_helios_v1", "iastronaut_solar_mission_v2"];
    for (const key of keys) {
        try {
            const parsed = JSON.parse(localStorage.getItem(key) || "{}");
            if (parsed && typeof parsed === "object" && Object.keys(parsed).length)
                return { data: parsed, legacy: key !== keys[0] };
        }
        catch (_) { }
    }
    return { data: {}, legacy: false };
}
function clone(value) {
    return JSON.parse(JSON.stringify(value));
}
export function createMissionDirector({ onSceneChange, onMissionMessage }) {
    const homeIndex = SOLAR_MISSION.findIndex((item) => item.home);
    const savedRecord = readSaved();
    const saved = savedRecord.data;
    const validIds = new Set(SOLAR_MISSION.map((item) => item.id));
    const legacyCompleted = new Set(savedRecord.legacy && Array.isArray(saved.completed) ? saved.completed.filter((id) => validIds.has(id)) : []);
    const completed = new Set(!savedRecord.legacy && Array.isArray(saved.completed) ? saved.completed.filter((id) => validIds.has(id)) : []);
    const visited = new Set(Array.isArray(saved.visited) ? saved.visited.filter((id) => validIds.has(id)) : []);
    if (savedRecord.legacy) {
        for (const id of legacyCompleted) {
            const index = SOLAR_MISSION.findIndex((item) => item.id === id);
            if (index >= 0)
                visited.add(id);
            if (index >= 0 && SOLAR_MISSION[index + 1])
                visited.add(SOLAR_MISSION[index + 1].id);
        }
    }
    if (completed.size && !completed.has("earth"))
        completed.add("earth");
    const taskStates = !savedRecord.legacy && saved.taskStates && typeof saved.taskStates === "object" ? saved.taskStates : {};
    let currentIndex = homeIndex >= 0 ? homeIndex : 0;
    let selectedTopic = MISSION_TOPIC_ORDER.includes(saved.topic) ? saved.topic : MISSION_TOPIC_ORDER[0];
    let objectivesMode = saved.mode === "log" ? "log" : "mission";
    let focusMode = false;
    let traveling = false;
    let backgroundFallback = false;
    let sceneRequest = 0;
    let lastEventSecond = -1;
    let idleSeconds = 0;
    let idleHintLevel = 0;
    let guidanceText = "IAstronaut te guiará paso a paso durante la misión.";
    const announcedEventWarnings = new Set();
    const listeners = new Set();
    visited.add(SOLAR_MISSION[currentIndex].id);
    function current() {
        return SOLAR_MISSION[currentIndex];
    }
    function operation() {
        return MISSION_OPERATIONS[current().id];
    }
    function defaultCustomState(op) {
        if (!op)
            return {};
        if (op.type === "descent")
            return { level: 0, sampleIndex: 0, samples: [], announcedLevel: -1 };
        if (op.type === "resonance")
            return { mechanicVersion: 1, bandIndex: 0, resonanceStartedAt: Date.now(), misses: 0 };
        if (op.type === "routePlan")
            return { routeStep: 0 };
        return {};
    }
    function createTaskState(id) {
        const op = MISSION_OPERATIONS[id];
        return {
            started: false,
            completed: completed.has(id),
            sequenceIndex: 0,
            targets: {},
            angle: 0,
            eventRemaining: op?.event?.duration || 0,
            eventActive: false,
            attempts: 0,
            lastResult: "",
            alignVoiceState: "",
            custom: defaultCustomState(op),
        };
    }
    function taskState(id = current().id) {
        if (!taskStates[id] || typeof taskStates[id] !== "object")
            taskStates[id] = createTaskState(id);
        const value = taskStates[id];
        if (!value.targets || typeof value.targets !== "object")
            value.targets = {};
        if (!Number.isFinite(value.sequenceIndex))
            value.sequenceIndex = 0;
        if (!Number.isFinite(value.angle))
            value.angle = 0;
        if (!Number.isFinite(value.eventRemaining))
            value.eventRemaining = MISSION_OPERATIONS[id]?.event?.duration || 0;
        if (!value.custom || typeof value.custom !== "object")
            value.custom = defaultCustomState(MISSION_OPERATIONS[id]);
        const op = MISSION_OPERATIONS[id];
        const defaults = defaultCustomState(op);
        if (op?.type === "resonance" && value.custom.mechanicVersion !== 1)
            value.custom = clone(defaults);
        for (const [key, defaultValue] of Object.entries(defaults)) {
            if (value.custom[key] === undefined)
                value.custom[key] = clone(defaultValue);
        }
        value.completed = completed.has(id) || !!value.completed;
        return value;
    }
    function save() {
        try {
            localStorage.setItem("iastronaut_operation_helios_v2", JSON.stringify({
                completed: Array.from(completed),
                visited: Array.from(visited),
                topic: selectedTopic,
                mode: objectivesMode,
                taskStates,
            }));
        }
        catch (_) { }
    }
    function notify(message, voiceText = message, kind = "mission") {
        const spokenText = String(voiceText || message || "").replace(/\s+/g, " ").trim();
        if (!spokenText)
            return;
        if (kind !== "timer_warning")
            guidanceText = spokenText;
        try {
            // La narración natural es la fuente única para voz y terminal.
            onMissionMessage?.(spokenText, { voiceText: spokenText, kind, detailText: String(message || "").trim() });
        }
        catch (_) { }
        emit();
    }
    function resetIdleGuide() {
        idleSeconds = 0;
        idleHintLevel = 0;
    }
    function firstPendingTarget() {
        const op = operation();
        const task = taskState();
        if (!op)
            return null;
        if (op.type === "defense" || op.type === "pilot")
            return targetDefinition(op.sequence?.[task.sequenceIndex] || "");
        if (op.type === "assembly")
            return op.targets.find((target) => !task.targets?.[target.id]?.complete) || null;
        if (op.type === "search") {
            const scanned = op.targets.filter((target) => task.targets?.[target.id]?.scanned).length;
            const correct = targetDefinition(op.correctTarget);
            if (scanned >= (op.requiredScans || 1) && task.targets?.[op.correctTarget]?.scanned)
                return correct;
            return op.targets.find((target) => !task.targets?.[target.id]?.scanned) || correct || null;
        }
        if (op.type === "triangulation") {
            const station = (op.stations || []).find((id) => !task.targets?.[id]?.complete);
            return station ? targetDefinition(station) : targetDefinition(op.confirmTarget);
        }
        if (op.type === "descent") {
            const sampleLevels = op.levels.map((level, index) => ({ ...level, index })).filter((level) => level.sample);
            const next = sampleLevels[task.custom.sampleIndex];
            if (!next)
                return null;
            return task.custom.level < next.index ? targetDefinition("venus-down") : targetDefinition("venus-sample");
        }
        if (op.type === "resonance")
            return targetDefinition("saturn-capture");
        if (op.type === "routePlan")
            return null;
        return null;
    }
    function spokenName(target) {
        return target?.voiceName || target?.label || "el siguiente objetivo";
    }
    function voiceTemplate(text, values = {}) {
        return String(text || "").replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "").replace(/\s+/g, " ").trim();
    }
    function spokenDestination(stage) {
        if (!stage)
            return "el siguiente destino";
        if (stage.id === "sun")
            return "el Sol";
        if (stage.id === "earth")
            return "la Tierra";
        return stage.name;
    }
    function startVoiceInstruction() {
        const op = operation();
        if (!op)
            return "Cuando estés listo, podemos comenzar.";
        if (op.voice?.start)
            return op.voice.start;
        return op.briefing;
    }
    function idleVoiceInstruction(level = 1) {
        const op = operation();
        const task = taskState();
        if (!op)
            return "Continúa con la misión.";
        if (op.type === "defense" || op.type === "pilot") {
            const target = firstPendingTarget();
            const name = spokenName(target);
            if (op.type === "pilot")
                return level === 1 ? `La ruta activa sigue en ${name}. Localiza la puerta iluminada.` : `Selecciona ${name} para que la sonda la atraviese.`;
            if (op.type === "defense")
                return level === 1 ? `Observa la onda que se aproxima. Debes proteger ${name}.` : `Activa el escudo de ${name} antes del impacto.`;
            return level === 1 ? `Todavía falta ${name}. Mira a tu alrededor si no está frente a ti.` : `Busca ${name} y selecciónalo cuando esté frente a ti.`;
        }
        if (op.type === "assembly") {
            const target = firstPendingTarget();
            return target ? `Todavía falta instalar ${spokenName(target)}. Puedes seleccionarlo directamente.` : "Los módulos están listos.";
        }
        if (op.type === "search") {
            const scanned = op.targets.filter((target) => task.targets?.[target.id]?.scanned).length;
            if (scanned >= (op.requiredScans || 1) && task.targets?.[op.correctTarget]?.scanned)
                return op.voice?.confirmCold || "Vuelve a la región más fría y confirma el despliegue.";
            return level === 1 ? "Explora otro punto del cráter. Busca una lectura mucho más fría." : "Las depresiones más profundas reciben menos luz. Prueba una zona interior que permanezca en sombra.";
        }
        if (op.type === "descent") {
            const target = firstPendingTarget();
            if (target?.id === "venus-sample")
                return "Estás en la capa correcta. Toma la muestra antes de continuar el descenso.";
            return target?.id === "venus-sample" ? "La capa actual está lista. Toma la muestra." : "Desciende a la siguiente capa desbloqueada.";
        }
        if (op.type === "triangulation") {
            const target = firstPendingTarget();
            return target?.id === op.confirmTarget ? "Las señales ya convergen. Marca el punto central de perforación." : `Todavía necesitamos ${spokenName(target)} para cerrar la triangulación.`;
        }
        if (op.type === "resonance")
            return "Espera a que el indicador entre en la zona central y pulsa capturar.";
        if (op.type === "routePlan")
            return task.custom.routeStep === 0 ? "Compara los tres corredores de la izquierda y elige el más estable." : "El primer tramo ya está fijado. Elige ahora una salida entre los corredores de la derecha.";
        if (op.type === "align") {
            const difference = op.targetAngle - (task.angle || 0);
            if (difference <= 20)
                return op.voice?.nearRight || "Casi está. Un poco más hacia la derecha.";
            return op.voice?.turnRight || "Sigue girando hacia la derecha.";
        }
        return op.hint || "Continúa con la misión.";
    }
    function snapshot() {
        const stage = current();
        const op = operation();
        const task = taskState();
        const totalTargets = op?.targets?.length || 0;
        let progress = 0;
        if (task.completed) {
            progress = 1;
        }
        else if (op?.type === "defense" || op?.type === "pilot") {
            progress = (task.sequenceIndex || 0) / Math.max(1, op.sequence?.length || 1);
        }
        else if (op?.type === "assembly") {
            progress = op.targets.filter((target) => task.targets?.[target.id]?.complete).length / Math.max(1, totalTargets);
        }
        else if (op?.type === "search") {
            const scanned = op.targets.filter((target) => task.targets?.[target.id]?.scanned).length;
            const base = Math.min(0.72, scanned / Math.max(1, op.requiredScans || 1) * 0.72);
            progress = base + (task.targets?.[op.correctTarget]?.scanned ? 0.16 : 0);
        }
        else if (op?.type === "descent") {
            const required = op.levels.filter((level) => level.sample).length;
            progress = (task.custom.sampleIndex || 0) / Math.max(1, required);
        }
        else if (op?.type === "triangulation") {
            const stations = (op.stations || []).filter((id) => task.targets?.[id]?.complete).length;
            progress = stations / Math.max(1, (op.stations?.length || 1) + 1);
        }
        else if (op?.type === "resonance") {
            progress = (task.custom.bandIndex || 0) / Math.max(1, op.bands?.length || 1);
        }
        else if (op?.type === "routePlan") {
            progress = (task.custom.routeStep || 0) / Math.max(1, op.routes?.length || 1);
        }
        else if (op?.type === "align") {
            progress = Math.min(0.92, Math.abs(task.angle || 0) / Math.max(1, Math.abs(op.targetAngle)) * 0.92);
        }
        else {
            const doneTargets = Object.values(task.targets).filter((value) => value?.complete || value?.scanned).length;
            progress = totalTargets ? doneTargets / totalTargets : 0;
        }
        progress = task.completed ? 1 : Math.max(0, Math.min(0.98, progress));
        return {
            currentIndex,
            current: stage,
            operation: op,
            task: clone(task),
            completed: new Set(completed),
            visited: new Set(visited),
            selectedTopic,
            objectivesMode,
            focusMode,
            traveling,
            backgroundFallback,
            guidanceText,
            progress,
            canAdvance: currentIndex < SOLAR_MISSION.length - 1 && isUnlocked(currentIndex + 1) && !traveling,
            canPrevious: currentIndex > homeIndex && !traveling,
        };
    }
    function emit() {
        const value = snapshot();
        for (const listener of listeners) {
            try {
                listener(value);
            }
            catch (_) { }
        }
    }
    function subscribe(listener) {
        if (typeof listener !== "function")
            return () => { };
        listeners.add(listener);
        listener(snapshot());
        return () => listeners.delete(listener);
    }
    function isUnlocked(index) {
        if (index < 0 || index >= SOLAR_MISSION.length)
            return false;
        if (index === homeIndex)
            return true;
        if (index === homeIndex + 1)
            return completed.has(SOLAR_MISSION[homeIndex].id) || visited.has(SOLAR_MISSION[index].id);
        return completed.has(SOLAR_MISSION[index - 1].id) || visited.has(SOLAR_MISSION[index].id);
    }
    function resetTask(id = current().id, keepStarted = false) {
        const wasCompleted = completed.has(id);
        taskStates[id] = createTaskState(id);
        taskStates[id].started = keepStarted;
        taskStates[id].completed = wasCompleted;
        if (keepStarted) {
            taskStates[id].eventActive = !!MISSION_OPERATIONS[id]?.event;
            taskStates[id].eventRemaining = MISSION_OPERATIONS[id]?.event?.duration || 0;
        }
        resetIdleGuide();
        announcedEventWarnings.clear();
        save();
        emit();
    }
    function startOperation({ announce = true } = {}) {
        if (traveling)
            return false;
        const task = taskState();
        const op = operation();
        if (!op)
            return false;
        if (task.completed || completed.has(current().id)) {
            if (announce)
                notify(`La operación de ${current().name} ya está completa. Puedes revisar la bitácora o continuar la ruta.`, `La operación de ${current().name} ya está completa. Selecciona otro destino en el mapa.`);
            return false;
        }
        if (!task.started) {
            task.started = true;
            if (op.type === "resonance")
                task.custom.resonanceStartedAt = Date.now();
            task.eventActive = !!op.event;
            task.eventRemaining = op.event?.duration || 0;
            task.lastResult = "";
            lastEventSecond = Math.ceil(task.eventRemaining);
            resetIdleGuide();
            announcedEventWarnings.clear();
            focusMode = true;
            save();
            emit();
            if (announce)
                notify(`${op.title}. ${op.briefing}`, startVoiceInstruction(), "operation_start");
        }
        return true;
    }
    function targetDefinition(targetId) {
        return operation()?.targets?.find((target) => target.id === targetId) || null;
    }
    function setTarget(targetId, patch) {
        const task = taskState();
        task.targets[targetId] = { ...(task.targets[targetId] || {}), ...patch };
    }
    function completeOperation() {
        const stage = current();
        const op = operation();
        const task = taskState();
        task.completed = true;
        task.started = true;
        task.eventActive = false;
        task.eventRemaining = 0;
        completed.add(stage.id);
        focusMode = false;
        resetIdleGuide();
        save();
        emit();
        const next = SOLAR_MISSION[currentIndex + 1];
        const route = next ? ` La ruta hacia ${next.name} quedó desbloqueada.` : " Has restaurado toda la red Helios y completado la misión principal.";
        const baseVoice = op.voice?.complete || op.success;
        const factVoice = op.voice?.fact || stage.discovery || "";
        const voice = [
            baseVoice,
            factVoice,
            next ? `He resaltado ${spokenDestination(next)} en el mapa.` : ""
        ].filter(Boolean).join(" ");
        notify(`${op.success} ${stage.discovery}${route}`, voice, "operation_complete");
        return { completed: true, targetId: null, message: op.success };
    }
    function interactOrderedTarget(targetId) {
        const op = operation();
        const task = taskState();
        const expected = op.sequence[task.sequenceIndex];
        if (targetId !== expected) {
            resetIdleGuide();
            task.attempts += 1;
            task.lastResult = `Secuencia incorrecta. Siguiente objetivo: ${targetDefinition(expected)?.label || expected}.`;
            save();
            emit();
            const expectedTarget = targetDefinition(expected);
            const errorVoice = voiceTemplate(op.voice?.sequenceError || "Todavía no. Primero necesitamos {next}.", { next: spokenName(expectedTarget) });
            notify(task.lastResult, errorVoice, "target_error");
            return { completed: false, accepted: false, message: task.lastResult };
        }
        resetIdleGuide();
        setTarget(targetId, { complete: true, scanned: true });
        task.sequenceIndex += 1;
        task.lastResult = `${targetDefinition(targetId)?.label || "Objetivo"} confirmado.`;
        if (task.sequenceIndex >= op.sequence.length)
            return completeOperation();
        const next = targetDefinition(op.sequence[task.sequenceIndex]);
        save();
        emit();
        const completedTarget = targetDefinition(targetId);
        const completedVoice = completedTarget?.voiceDone || `${spokenName(completedTarget)} listo.`;
        let transitionVoice = `${completedVoice} Ahora busca ${spokenName(next)}.`;
        if (op.type === "defense" && Array.isArray(op.voice?.next))
            transitionVoice = `${completedVoice} ${op.voice.next[Math.max(0, task.sequenceIndex - 1)] || `Protege ahora ${spokenName(next)}.`}`;
        else if (op.type === "pilot")
            transitionVoice = op.voice?.next?.[Math.max(0, task.sequenceIndex - 1)] || `${completedVoice} Sigue la puerta iluminada hasta ${spokenName(next)}.`;
        const transitionKind = op.type === "pilot" ? "pilot_feedback" : "target_success";
        notify(`${task.lastResult} Continúa con ${next?.label || "el siguiente objetivo"}.`, transitionVoice, transitionKind);
        return { completed: false, accepted: true, message: task.lastResult };
    }
    function interactAssembly(targetId) {
        const op = operation();
        const task = taskState();
        const target = targetDefinition(targetId);
        const existing = task.targets?.[targetId] || {};
        if (existing.complete)
            return { completed: false, accepted: false, locked: true };
        resetIdleGuide();
        setTarget(targetId, { complete: true, scanned: true });
        task.lastResult = `${target.label} acoplado a Helios.`;
        const remaining = op.targets.filter((item) => !task.targets?.[item.id]?.complete && item.id !== targetId);
        save();
        emit();
        if (!remaining.length)
            return completeOperation();
        const voice = `${target.voiceDone || `${spokenName(target)} instalado.`} ${op.voice?.afterPart || "Elige otro módulo para continuar."}`;
        notify(task.lastResult, voice, "target_success");
        return { completed: false, accepted: true, message: task.lastResult };
    }
    function interactSearch(targetId) {
        const op = operation();
        const task = taskState();
        const target = targetDefinition(targetId);
        const existing = task.targets?.[targetId] || {};
        const scannedCount = op.targets.filter((item) => task.targets?.[item.id]?.scanned).length;
        const required = Math.max(1, op.requiredScans || 1);
        if (existing.scanned) {
            if (targetId === op.correctTarget && scannedCount >= required) {
                setTarget(targetId, { complete: true, selected: true });
                return completeOperation();
            }
            return { completed: false, accepted: false, locked: true };
        }
        resetIdleGuide();
        setTarget(targetId, { scanned: true, revealed: true });
        task.lastResult = `${target.label}: ${target.detail}.`;
        save();
        emit();
        const countAfter = scannedCount + 1;
        const correctScanned = targetId === op.correctTarget || !!task.targets?.[op.correctTarget]?.scanned;
        const resultVoice = target.voiceResult || `${spokenName(target)} analizado.`;
        if (countAfter >= required && correctScanned) {
            notify(task.lastResult, `${resultVoice} ${op.voice?.confirmCold || "Ya tenemos suficiente información. Vuelve a la región más fría para confirmar."}`, "decision_ready");
        }
        else if (targetId === op.correctTarget) {
            notify(task.lastResult, `${resultVoice} ${op.voice?.coldFoundEarly || "Es una señal prometedora. Compara otras zonas antes de confirmar."}`, "scan_result");
        }
        else {
            notify(task.lastResult, `${resultVoice} ${op.voice?.afterScan || "Explora otra zona."}`, "scan_result");
        }
        return { completed: false, accepted: true, scanned: true, message: task.lastResult };
    }
    function interactDescent(targetId) {
        const op = operation();
        const task = taskState();
        const custom = task.custom;
        const levels = op.levels || [];
        const sampleLevels = levels.map((level, index) => ({ ...level, index })).filter((level) => level.sample);
        const nextSample = sampleLevels[custom.sampleIndex];
        resetIdleGuide();
        if (!nextSample)
            return { completed: false, accepted: false, locked: true };
        if (targetId === "venus-down") {
            if (custom.level >= nextSample.index)
                return { completed: false, accepted: false, locked: true, message: "Toma primero la muestra de esta capa." };
            custom.level = Math.min(nextSample.index, custom.level + 1);
            task.lastResult = `${levels[custom.level].name} · ${levels[custom.level].altitude}.`;
            save();
            emit();
            const voice = custom.level === nextSample.index && levels[custom.level].voice
                ? levels[custom.level].voice
                : (op.voice?.moveDown || "Descendiendo a la siguiente capa.");
            notify(task.lastResult, voice, "descent_move");
            return { completed: false, accepted: true, message: task.lastResult };
        }
        if (targetId !== "venus-sample")
            return { completed: false, accepted: false };
        if (custom.level !== nextSample.index)
            return { completed: false, accepted: false, locked: true, message: "Primero desciende a la capa desbloqueada." };
        custom.samples.push(nextSample.index);
        custom.sampleIndex += 1;
        task.lastResult = `${nextSample.sample} · muestra registrada en ${nextSample.name}.`;
        save();
        emit();
        if (custom.sampleIndex >= sampleLevels.length)
            return completeOperation();
        const upcoming = sampleLevels[custom.sampleIndex];
        notify(task.lastResult, `${nextSample.sample} lista. Ahora desciende a ${upcoming.name.toLowerCase()}.`, "target_success");
        return { completed: false, accepted: true, message: task.lastResult };
    }
    function interactTriangulation(targetId) {
        const op = operation();
        const task = taskState();
        resetIdleGuide();
        if (targetId === op.confirmTarget) {
            const ready = (op.stations || []).every((id) => task.targets?.[id]?.complete);
            if (!ready) {
                task.lastResult = "Triangulación incompleta.";
                notify(task.lastResult, op.voice?.drillEarly || "Completa primero las tres lecturas de radar.", "target_error");
                return { completed: false, accepted: false, message: task.lastResult };
            }
            setTarget(targetId, { complete: true, selected: true });
            return completeOperation();
        }
        if (!(op.stations || []).includes(targetId))
            return { completed: false, accepted: false };
        if (task.targets?.[targetId]?.complete)
            return { completed: false, accepted: false, locked: true };
        const target = targetDefinition(targetId);
        setTarget(targetId, { complete: true, scanned: true });
        task.lastResult = `${target.label} · lectura registrada.`;
        save();
        emit();
        const ready = op.stations.every((id) => task.targets?.[id]?.complete);
        const voice = ready
            ? `${target.voiceResult || "Lectura registrada."} ${op.voice?.ready || "Las señales convergen. Marca el punto de perforación."}`
            : `${target.voiceResult || "Lectura registrada."} ${op.voice?.afterStation || "Necesitamos otra lectura desde un ángulo diferente."}`;
        notify(task.lastResult, voice, ready ? "decision_ready" : "scan_result");
        return { completed: false, accepted: true, message: task.lastResult };
    }
    function interactResonance(targetId) {
        const op = operation();
        const task = taskState();
        const custom = task.custom;
        if (targetId !== "saturn-capture" || custom.bandIndex >= (op.bands?.length || 0))
            return { completed: false, accepted: false };
        resetIdleGuide();
        if (!resonanceInWindow(custom, op)) {
            custom.misses = (custom.misses || 0) + 1;
            task.lastResult = "El pulso quedó fuera de la zona de resonancia.";
            save();
            emit();
            if (custom.misses === 1 || custom.misses % 3 === 0)
                notify(task.lastResult, op.voice?.miss || "Espera a que el pulso vuelva al centro.", "resonance_miss");
            return { completed: false, accepted: false, message: task.lastResult };
        }
        const completedBand = op.bands[custom.bandIndex];
        custom.bandIndex += 1;
        custom.misses = 0;
        task.lastResult = `${completedBand} · resonancia capturada.`;
        if (custom.bandIndex >= op.bands.length) {
            save();
            return completeOperation();
        }
        custom.resonanceStartedAt = Date.now();
        save();
        emit();
        notify(task.lastResult, op.voice?.nextBands?.[custom.bandIndex - 1] || "Resonancia capturada. Continúa con la siguiente banda.", "resonance_feedback");
        return { completed: false, accepted: true, message: task.lastResult };
    }
    function interactRoutePlan(targetId) {
        const op = operation();
        const task = taskState();
        const custom = task.custom;
        const target = targetDefinition(targetId);
        const step = op.routes?.[custom.routeStep];
        if (!target || !step || !step.choices.includes(targetId))
            return { completed: false, accepted: false, locked: true };
        if (task.targets?.[targetId]?.selected)
            return { completed: false, accepted: false, locked: true };
        resetIdleGuide();
        if (targetId !== step.correct) {
            setTarget(targetId, { selected: true, incorrect: true });
            task.attempts += 1;
            task.lastResult = `${target.label} descartado por exceso de viento.`;
            save();
            emit();
            notify(task.lastResult, op.voice?.wrong || "Ese corredor es demasiado inestable. Prueba otra trayectoria.", "target_error");
            return { completed: false, accepted: false, message: task.lastResult };
        }
        setTarget(targetId, { selected: true, complete: true });
        custom.routeStep += 1;
        task.lastResult = `${step.label} fijado por ${target.label}.`;
        save();
        emit();
        if (custom.routeStep >= op.routes.length)
            return completeOperation();
        notify(task.lastResult, op.voice?.next || "Primer tramo fijado. Elige ahora la salida.", "target_success");
        return { completed: false, accepted: true, message: task.lastResult };
    }
    function interactAlign(targetId) {
        const op = operation();
        const task = taskState();
        if (targetId !== "uranus-right")
            return { completed: false, accepted: false };
        task.angle = Math.min(op.targetAngle, task.angle + op.step);
        resetIdleGuide();
        const distance = Math.abs(op.targetAngle - task.angle);
        task.lastResult = `Orientación ajustada a ${Math.round(task.angle)}°. Objetivo: ${op.targetAngle}°.`;
        if (distance <= 5) {
            save();
            emit();
            return completeOperation();
        }
        const voiceState = distance <= 20 ? "near-right" : "right";
        const voiceText = distance <= 20 ? op.voice?.nearRight : op.voice?.turnRight;
        const shouldSpeak = voiceText && task.alignVoiceState !== voiceState;
        task.alignVoiceState = voiceState;
        save();
        emit();
        if (shouldSpeak)
            notify(task.lastResult, voiceText, "align_feedback");
        return { completed: false, accepted: true, message: task.lastResult };
    }
    function interactTarget(targetId) {
        if (!startOperation({ announce: false }))
            return { completed: false, accepted: false };
        const target = targetDefinition(targetId);
        if (!target)
            return { completed: false, accepted: false };
        const task = taskState();
        const op = operation();
        if (task.completed)
            return { completed: true, accepted: false };
        const state = task.targets?.[targetId] || {};
        if ((op.type === "defense" || op.type === "pilot") && state.complete)
            return { completed: false, accepted: false, locked: true };
        if (op.type === "assembly")
            return interactAssembly(targetId);
        if (op.type === "search")
            return interactSearch(targetId);
        if (op.type === "descent")
            return interactDescent(targetId);
        if (op.type === "triangulation")
            return interactTriangulation(targetId);
        if (op.type === "resonance")
            return interactResonance(targetId);
        if (op.type === "routePlan")
            return interactRoutePlan(targetId);
        if (op.type === "defense" || op.type === "pilot")
            return interactOrderedTarget(targetId);
        if (op.type === "align")
            return interactAlign(targetId);
        return { completed: false, accepted: false };
    }
    async function applyScene(announce) {
        const requestId = ++sceneRequest;
        traveling = true;
        backgroundFallback = false;
        focusMode = false;
        resetIdleGuide();
        emit();
        let result = null;
        try {
            result = await onSceneChange?.(current());
        }
        catch (_) {
            result = { fallback: true };
        }
        if (requestId !== sceneRequest)
            return false;
        traveling = false;
        backgroundFallback = !!result?.fallback;
        emit();
        if (announce) {
            const op = operation();
            const arrivalVoice = op?.voice?.arrival || `Llegamos a ${current().name}. Cuando estés listo, podemos comenzar.`;
            notify(`${current().intro} ${op?.briefing || ""}`, arrivalVoice, "arrival");
        }
        return true;
    }
    async function travelTo(index, announce = true) {
        if (traveling || index < 0 || index >= SOLAR_MISSION.length)
            return false;
        if (!isUnlocked(index)) {
            const previous = SOLAR_MISSION[Math.max(homeIndex, index - 1)];
            notify(`El destino ${SOLAR_MISSION[index].name} está bloqueado. Completa la operación de ${previous.name} para abrir la ruta.`, `${SOLAR_MISSION[index].name} sigue bloqueado. Completa primero la operación de ${previous.name}.`, "route_locked");
            return false;
        }
        if (index === currentIndex)
            return true;
        currentIndex = index;
        visited.add(current().id);
        selectedTopic = MISSION_TOPIC_ORDER[0];
        objectivesMode = "mission";
        taskState();
        save();
        emit();
        return applyScene(announce);
    }
    async function next() {
        if (currentIndex >= SOLAR_MISSION.length - 1)
            return false;
        return travelTo(currentIndex + 1);
    }
    async function previous() {
        if (currentIndex <= homeIndex)
            return false;
        return travelTo(currentIndex - 1);
    }
    async function home() {
        return travelTo(homeIndex);
    }
    async function restartMission() {
        completed.clear();
        visited.clear();
        for (const key of Object.keys(taskStates))
            delete taskStates[key];
        currentIndex = homeIndex >= 0 ? homeIndex : 0;
        visited.add(current().id);
        selectedTopic = MISSION_TOPIC_ORDER[0];
        objectivesMode = "mission";
        focusMode = false;
        traveling = false;
        backgroundFallback = false;
        lastEventSecond = -1;
        guidanceText = "IAstronaut te guiará paso a paso durante la misión.";
        announcedEventWarnings.clear();
        resetIdleGuide();
        taskState();
        save();
        emit();
        await applyScene(false);
        notify("Operación Helios reiniciada desde la Tierra.", "Reiniciamos Operación Helios. Estamos de vuelta en la Tierra y podemos comenzar desde el principio.", "mission_restart");
        return true;
    }
    function setSelectedTopic(value) {
        if (!MISSION_TOPIC_ORDER.includes(value))
            return;
        selectedTopic = value;
        save();
        emit();
    }
    function setObjectivesMode(value) {
        objectivesMode = value === "log" ? "log" : "mission";
        save();
        emit();
    }
    function setFocusMode(value) {
        focusMode = !!value;
        resetIdleGuide();
        emit();
    }
    function update(delta) {
        const op = operation();
        const task = taskState();
        if (task.started && !task.completed && focusMode && !traveling) {
            idleSeconds += delta;
            if (idleHintLevel === 0 && idleSeconds >= 18) {
                idleHintLevel = 1;
                const hint = idleVoiceInstruction(1);
                notify(hint, hint, "idle_hint");
            }
            else if (idleHintLevel === 1 && idleSeconds >= 38) {
                idleHintLevel = 2;
                const hint = idleVoiceInstruction(2);
                notify(hint, hint, "idle_hint");
            }
        }
        if (!task.started || task.completed || !task.eventActive || !op?.event || traveling)
            return;
        task.eventRemaining = Math.max(0, task.eventRemaining - delta);
        const currentSecond = Math.ceil(task.eventRemaining);
        if (task.eventRemaining > 0) {
            if (currentSecond !== lastEventSecond) {
                lastEventSecond = currentSecond;
                emit();
                if ((currentSecond === 15 || currentSecond === 5) && !announcedEventWarnings.has(currentSecond)) {
                    announcedEventWarnings.add(currentSecond);
                    const pending = firstPendingTarget();
                    const warningTemplate = currentSecond === 15
                        ? (op.voice?.timer15 || "Quedan quince segundos.")
                        : (op.voice?.timer5 || "Cinco segundos. Termina la acción actual.");
                    const warningVoice = voiceTemplate(warningTemplate, { next: spokenName(pending) });
                    notify(`Quedan ${currentSecond} segundos para ${op.event.label.toLowerCase()}.`, warningVoice, "timer_warning");
                }
            }
            return;
        }
        lastEventSecond = -1;
        task.eventActive = false;
        if (op.event.resetOnTimeout) {
            notify(`${op.event.label}: la ventana se cerró. La operación se reiniciará para proteger la sonda.`, op.voice?.timeout || "La ventana se cerró. Reiniciamos la operación para intentarlo de nuevo.", "timer_end");
            resetTask(current().id, true);
        }
        else {
            notify(`${op.event.label}: la ventana principal terminó, pero puedes continuar el análisis sin penalización.`, op.voice?.timeout || "La ventana principal terminó. Puedes continuar el análisis sin prisa.", "timer_end");
            save();
            emit();
        }
    }
    function getContext() {
        const stage = current();
        const op = operation();
        const task = taskState();
        return {
            scene_id: stage.id,
            scene_name: stage.name,
            scene_type: stage.type,
            at_home: !!stage.home,
            mission_stage: currentIndex,
            mission_total: SOLAR_MISSION.length - 1,
            objective: stage.objective,
            operation_title: op?.title || "",
            operation_briefing: op?.briefing || "",
            operation_started: !!task.started,
            operation_complete: !!task.completed,
            operation_progress: Math.round(snapshot().progress * 100),
            event_label: task.eventActive ? op?.event?.label || "" : "",
            event_seconds: task.eventActive ? Math.ceil(task.eventRemaining) : 0,
            selected_topic: stage.topics[selectedTopic]?.label || "",
            scan_target: stage.scanTarget,
            scan_complete: !!task.completed,
            discovery: task.completed ? stage.discovery : "",
            completed_destinations: SOLAR_MISSION.filter((item) => completed.has(item.id)).map((item) => item.name),
            next_destination: SOLAR_MISSION[currentIndex + 1]?.name || "",
            hint: op?.hint || "",
            last_result: task.lastResult || "",
        };
    }
    async function runAction(action) {
        const type = typeof action === "string" ? action : action?.type;
        const target = typeof action === "object" ? action?.target : "";
        if (type === "start_operation" || type === "deploy_probe")
            return startOperation();
        if (type === "next_destination")
            return next();
        if (type === "previous_destination")
            return previous();
        if (type === "go_home")
            return home();
        if (type === "restart_mission")
            return restartMission();
        if (type === "show_log") {
            setObjectivesMode("log");
            setFocusMode(false);
            return true;
        }
        if (type === "show_objective") {
            setObjectivesMode("mission");
            setFocusMode(false);
            return true;
        }
        if (type === "select_topic") {
            const key = MISSION_TOPIC_ORDER.includes(target) ? target : MISSION_TOPIC_ORDER.find((item) => current().topics[item]?.label.toLowerCase().includes(String(target || "").toLowerCase()));
            if (key)
                setSelectedTopic(key);
            return !!key;
        }
        if (type === "repeat_briefing") {
            notify(`${operation()?.title || "MISIÓN"}. ${operation()?.briefing || current().objective} ${operation()?.hint || ""}`, startVoiceInstruction(), "repeat");
            return true;
        }
        return false;
    }
    async function initialize() {
        taskState();
        save();
        emit();
        return applyScene(false);
    }
    return {
        subscribe,
        initialize,
        update,
        startOperation,
        interactTarget,
        travelTo,
        next,
        previous,
        home,
        isUnlocked,
        setSelectedTopic,
        setObjectivesMode,
        setFocusMode,
        resetTask,
        restartMission,
        getState: snapshot,
        getContext,
        runAction,
    };
}
