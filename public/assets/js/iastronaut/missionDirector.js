import { SOLAR_MISSION, MISSION_TOPIC_ORDER } from "./missionData.js";
import { MISSION_OPERATIONS } from "./missionOperations.js";
function readSaved() {
    const keys = ["iastronaut_operation_helios_v1", "iastronaut_solar_mission_v2"];
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
    const listeners = new Set();
    visited.add(SOLAR_MISSION[currentIndex].id);
    function current() {
        return SOLAR_MISSION[currentIndex];
    }
    function operation() {
        return MISSION_OPERATIONS[current().id];
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
        value.completed = completed.has(id) || !!value.completed;
        return value;
    }
    function save() {
        try {
            localStorage.setItem("iastronaut_operation_helios_v1", JSON.stringify({
                completed: Array.from(completed),
                visited: Array.from(visited),
                topic: selectedTopic,
                mode: objectivesMode,
                taskStates,
            }));
        }
        catch (_) { }
    }
    function notify(message) {
        if (!message)
            return;
        try {
            onMissionMessage?.(message);
        }
        catch (_) { }
    }
    function snapshot() {
        const stage = current();
        const op = operation();
        const task = taskState();
        const totalTargets = op?.targets?.length || 0;
        let doneTargets = Object.values(task.targets).filter((value) => value?.complete || value?.scanned).length;
        if (op?.type === "align")
            doneTargets = task.completed ? totalTargets : Math.min(totalTargets - 1, Math.round(Math.abs(task.angle) / Math.max(1, op.step)));
        const progress = task.completed ? 1 : Math.max(0, Math.min(0.98, totalTargets ? doneTargets / totalTargets : 0));
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
                notify(`La operación de ${current().name} ya está completa. Puedes revisar la bitácora o continuar la ruta.`);
            return false;
        }
        if (!task.started) {
            task.started = true;
            task.eventActive = !!op.event;
            task.eventRemaining = op.event?.duration || 0;
            task.lastResult = "";
            lastEventSecond = Math.ceil(task.eventRemaining);
            focusMode = true;
            save();
            emit();
            if (announce)
                notify(`${op.title}. ${op.briefing}`);
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
    function allSurveyed() {
        const op = operation();
        const task = taskState();
        return !!op?.targets?.length && op.targets.every((target) => task.targets[target.id]?.scanned);
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
        save();
        emit();
        const next = SOLAR_MISSION[currentIndex + 1];
        const route = next ? ` La ruta hacia ${next.name} quedó desbloqueada.` : " Has restaurado toda la red Helios y completado la misión principal.";
        notify(`${op.success} ${stage.discovery}${route}`);
        return { completed: true, targetId: null, message: op.success };
    }
    function interactSequence(targetId) {
        const op = operation();
        const task = taskState();
        const expected = op.sequence[task.sequenceIndex];
        if (targetId !== expected) {
            task.attempts += 1;
            task.lastResult = `Secuencia incorrecta. Siguiente objetivo: ${targetDefinition(expected)?.label || expected}.`;
            save();
            emit();
            notify(task.lastResult);
            return { completed: false, accepted: false, message: task.lastResult };
        }
        setTarget(targetId, { complete: true, scanned: true });
        task.sequenceIndex += 1;
        task.lastResult = `${targetDefinition(targetId)?.label || "Objetivo"} confirmado.`;
        if (task.sequenceIndex >= op.sequence.length)
            return completeOperation();
        const next = targetDefinition(op.sequence[task.sequenceIndex]);
        save();
        emit();
        notify(`${task.lastResult} Continúa con ${next?.label || "el siguiente objetivo"}.`);
        return { completed: false, accepted: true, message: task.lastResult };
    }
    function interactSurvey(targetId) {
        const task = taskState();
        const target = targetDefinition(targetId);
        const existing = task.targets[targetId] || {};
        if (!existing.scanned) {
            setTarget(targetId, { scanned: true, complete: false, revealed: true });
            task.lastResult = `${target.label}: ${target.detail}.`;
            save();
            emit();
            if (allSurveyed())
                notify(`${task.lastResult} Todas las lecturas están disponibles. ${operation().selectionPrompt || "Compara los resultados y selecciona nuevamente la opción correcta."}`);
            else
                notify(`${task.lastResult} Continúa analizando las demás regiones.`);
            return { completed: false, accepted: true, scanned: true, message: task.lastResult };
        }
        if (!allSurveyed()) {
            task.lastResult = "Aún faltan lecturas. Analiza todos los objetivos antes de confirmar.";
            emit();
            notify(task.lastResult);
            return { completed: false, accepted: false, message: task.lastResult };
        }
        if (targetId === operation().correctTarget) {
            setTarget(targetId, { complete: true, selected: true });
            return completeOperation();
        }
        task.attempts += 1;
        setTarget(targetId, { selected: true, incorrect: true });
        task.lastResult = `${target.label} no cumple los parámetros de la misión. ${operation().retryPrompt || operation().selectionPrompt || "Revisa las lecturas e intenta de nuevo."}`;
        save();
        emit();
        notify(task.lastResult);
        return { completed: false, accepted: false, message: task.lastResult };
    }
    function interactAlign(targetId) {
        const op = operation();
        const task = taskState();
        if (targetId === "uranus-left")
            task.angle = Math.max(-168, task.angle - op.step);
        if (targetId === "uranus-right")
            task.angle = Math.min(168, task.angle + op.step);
        if (targetId === "uranus-confirm") {
            const difference = Math.abs(op.targetAngle - task.angle);
            if (difference <= 5)
                return completeOperation();
            task.attempts += 1;
            task.lastResult = `Orientación actual: ${Math.round(task.angle)}°. Ajusta el eje hasta ${op.targetAngle}°.`;
            save();
            emit();
            notify(task.lastResult);
            return { completed: false, accepted: false, message: task.lastResult };
        }
        task.lastResult = `Orientación ajustada a ${Math.round(task.angle)}°. Objetivo: ${op.targetAngle}°.`;
        save();
        emit();
        return { completed: false, accepted: true, message: task.lastResult };
    }
    function interactTarget(targetId) {
        if (!startOperation({ announce: false }))
            return { completed: false, accepted: false };
        const target = targetDefinition(targetId);
        if (!target)
            return { completed: false, accepted: false };
        const task = taskState();
        if (task.completed)
            return { completed: true, accepted: false };
        if (operation().type === "sequence")
            return interactSequence(targetId);
        if (operation().type === "survey")
            return interactSurvey(targetId);
        if (operation().type === "align")
            return interactAlign(targetId);
        return { completed: false, accepted: false };
    }
    async function applyScene(announce) {
        const requestId = ++sceneRequest;
        traveling = true;
        backgroundFallback = false;
        focusMode = false;
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
        if (announce)
            notify(`${current().intro} ${operation()?.briefing || ""}`);
        return true;
    }
    async function travelTo(index, announce = true) {
        if (traveling || index < 0 || index >= SOLAR_MISSION.length)
            return false;
        if (!isUnlocked(index)) {
            const previous = SOLAR_MISSION[Math.max(homeIndex, index - 1)];
            notify(`El destino ${SOLAR_MISSION[index].name} está bloqueado. Completa la operación de ${previous.name} para abrir la ruta.`);
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
        emit();
    }
    function update(delta) {
        const op = operation();
        const task = taskState();
        if (!task.started || task.completed || !task.eventActive || !op?.event || traveling)
            return;
        task.eventRemaining = Math.max(0, task.eventRemaining - delta);
        const currentSecond = Math.ceil(task.eventRemaining);
        if (task.eventRemaining > 0) {
            if (currentSecond !== lastEventSecond) {
                lastEventSecond = currentSecond;
                emit();
            }
            return;
        }
        lastEventSecond = -1;
        task.eventActive = false;
        if (op.event.resetOnTimeout) {
            notify(`${op.event.label}: la ventana se cerró. La operación se reiniciará para proteger la sonda.`);
            resetTask(current().id, true);
        }
        else {
            notify(`${op.event.label}: la ventana principal terminó, pero puedes continuar el análisis sin penalización.`);
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
            notify(`${operation()?.title || "MISIÓN"}. ${operation()?.briefing || current().objective} ${operation()?.hint || ""}`);
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
        getState: snapshot,
        getContext,
        runAction,
    };
}
