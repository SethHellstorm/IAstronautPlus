import { ENDPOINT } from "./config.js";
import { addBubble, setListening, setAISpeaking, canRecord, enforceMaxBubbles } from "./uiPanel.js";
function base64ToBytes(value) {
    const bin = atob(value);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++)
        bytes[i] = bin.charCodeAt(i);
    return bytes;
}
function createTimeoutSignal(timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return { signal: controller.signal, clear: () => clearTimeout(timer) };
}
async function fetchWithTimeout(url, options, timeoutMs) {
    const timeout = createTimeoutSignal(timeoutMs);
    try {
        return await fetch(url, { ...options, signal: timeout.signal });
    }
    finally {
        timeout.clear();
    }
}
async function readJsonResponse(response) {
    const raw = await response.text();
    let data = null;
    try {
        data = raw ? JSON.parse(raw) : {};
    }
    catch (_) {
        throw new Error(`Respuesta inválida del servidor (${response.status})`);
    }
    if (!response.ok) {
        const detail = data?.detail || data?.error || raw || `HTTP ${response.status}`;
        throw new Error(String(detail));
    }
    return data;
}
function fileExtensionForMime(mime) {
    const value = String(mime || "").toLowerCase();
    if (value.includes("mp4") || value.includes("m4a"))
        return "m4a";
    if (value.includes("ogg"))
        return "ogg";
    if (value.includes("mpeg") || value.includes("mp3"))
        return "mp3";
    return "webm";
}
export function createTTSPlayer() {
    let currentAudio = null;
    let currentSource = null;
    let audioContext = null;
    let onSpeakingChange = null;
    function notifySpeaking(value) {
        try {
            onSpeakingChange?.(!!value);
        }
        catch (_) { }
    }
    function setSpeakingChangeHandler(handler) {
        onSpeakingChange = typeof handler === "function" ? handler : null;
    }
    async function ensureAudioContext() {
        if (!audioContext || audioContext.state === "closed") {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass)
                return null;
            audioContext = new AudioContextClass();
        }
        if (audioContext.state === "suspended") {
            try {
                await audioContext.resume();
            }
            catch (_) { }
        }
        return audioContext;
    }
    async function unlock() {
        const context = await ensureAudioContext();
        if (!context)
            return;
        try {
            const buffer = context.createBuffer(1, 1, context.sampleRate);
            const source = context.createBufferSource();
            source.buffer = buffer;
            source.connect(context.destination);
            source.start(0);
        }
        catch (_) { }
    }
    function stop() {
        try {
            currentSource?.stop?.();
        }
        catch (_) { }
        try {
            currentSource?.disconnect?.();
        }
        catch (_) { }
        currentSource = null;
        try {
            currentAudio?.pause?.();
        }
        catch (_) { }
        if (currentAudio?.src?.startsWith("blob:")) {
            try {
                URL.revokeObjectURL(currentAudio.src);
            }
            catch (_) { }
        }
        currentAudio = null;
        notifySpeaking(false);
    }
    async function playWithAudioElement(bytes) {
        return new Promise((resolve) => {
            const blob = new Blob([bytes], { type: "audio/mpeg" });
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            currentAudio = audio;
            const finish = () => {
                try {
                    URL.revokeObjectURL(url);
                }
                catch (_) { }
                if (currentAudio === audio)
                    currentAudio = null;
                notifySpeaking(false);
                resolve();
            };
            audio.onended = finish;
            audio.onerror = finish;
            notifySpeaking(true);
            audio.play().catch(finish);
        });
    }
    async function playBase64Mp3(audioBase64) {
        if (!audioBase64)
            return;
        stop();
        const bytes = base64ToBytes(audioBase64);
        const context = await ensureAudioContext();
        if (!context) {
            await playWithAudioElement(bytes);
            return;
        }
        try {
            const audioBuffer = await context.decodeAudioData(bytes.buffer.slice(0));
            await new Promise((resolve) => {
                const source = context.createBufferSource();
                currentSource = source;
                source.buffer = audioBuffer;
                source.connect(context.destination);
                source.onended = () => {
                    if (currentSource === source)
                        currentSource = null;
                    try {
                        source.disconnect();
                    }
                    catch (_) { }
                    notifySpeaking(false);
                    resolve();
                };
                notifySpeaking(true);
                source.start(0);
            });
        }
        catch (_) {
            await playWithAudioElement(bytes);
        }
    }
    return { playBase64Mp3, stop, unlock, setSpeakingChangeHandler };
}
export function createMicChatController({ state, drawPanel, ttsPlayer, getMissionContext, onAssistantAction }) {
    let micStream = null;
    let audioContext = null;
    let analyser = null;
    let sourceNode = null;
    let mediaRecorder = null;
    let chunks = [];
    let recording = false;
    let armed = false;
    let requestInFlight = false;
    let vadIntervalId = 0;
    let aboveSince = 0;
    let belowSince = 0;
    let idleSince = 0;
    let recordingStartedAt = 0;
    let sendOnStop = false;
    let micRearmInProgress = false;
    const conversationHistory = [];
    const VAD_INTERVAL_MS = 40;
    const VAD_THRESHOLD = 0.018;
    const MIN_SPEECH_MS = 120;
    const SILENCE_MS = 760;
    const MAX_RECORDING_MS = 20000;
    const AUTO_DISARM_MS = 120000;
    ttsPlayer?.setSpeakingChangeHandler?.((isSpeaking) => {
        setAISpeaking(state, drawPanel, isSpeaking || requestInFlight);
    });
    function preferredMediaRecorderOptions() {
        const preferredTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
        for (const type of preferredTypes) {
            if (MediaRecorder.isTypeSupported?.(type))
                return { mimeType: type };
        }
        return {};
    }
    function rmsFromAnalyser(target) {
        const buffer = new Uint8Array(target.fftSize);
        target.getByteTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
            const value = (buffer[i] - 128) / 128;
            sum += value * value;
        }
        return Math.sqrt(sum / buffer.length);
    }
    function stopVADLoop() {
        if (!vadIntervalId)
            return;
        clearInterval(vadIntervalId);
        vadIntervalId = 0;
    }
    function startVADLoop() {
        stopVADLoop();
        if (armed)
            vadIntervalId = setInterval(vadTick, VAD_INTERVAL_MS);
    }
    function detachTrackWatchers() {
        const track = micStream?.getAudioTracks?.()?.[0];
        if (!track)
            return;
        track.onended = null;
        track.onmute = null;
        track.onunmute = null;
    }
    function attachTrackWatchers() {
        const track = micStream?.getAudioTracks?.()?.[0];
        if (!track)
            return;
        track.onended = () => rearmMicBestEffort();
        track.onmute = () => {
            if (!requestInFlight && !state.aiSpeaking)
                rearmMicBestEffort();
        };
        track.onunmute = null;
    }
    function stopRecorderWithoutSending() {
        const recorder = mediaRecorder;
        mediaRecorder = null;
        sendOnStop = false;
        chunks = [];
        if (!recorder || recorder.state === "inactive")
            return;
        recorder.ondataavailable = null;
        recorder.onstop = null;
        try {
            recorder.stop();
        }
        catch (_) { }
    }
    function cleanupArmedMode() {
        stopVADLoop();
        stopRecorderWithoutSending();
        detachTrackWatchers();
        try {
            sourceNode?.disconnect?.();
        }
        catch (_) { }
        sourceNode = null;
        analyser = null;
        try {
            audioContext?.close?.();
        }
        catch (_) { }
        audioContext = null;
        try {
            micStream?.getTracks?.().forEach((track) => track.stop());
        }
        catch (_) { }
        micStream = null;
        recording = false;
        armed = false;
        aboveSince = 0;
        belowSince = 0;
        idleSince = 0;
        setListening(state, drawPanel, false);
    }
    async function requestSpeechAudio(text) {
        const clean = String(text || "").trim();
        if (!clean)
            return;
        try {
            const response = await fetchWithTimeout(ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tts_only: true, text: clean }),
            }, 45000);
            const data = await readJsonResponse(response);
            if (data.audio_base64)
                await ttsPlayer?.playBase64Mp3?.(data.audio_base64);
        }
        catch (error) {
            console.warn("TTS request failed:", error);
        }
    }
    function replaceBubble(target, text, who = "bot") {
        const index = state.bubbles.indexOf(target);
        const bubble = { kind: "text", text: String(text || ""), who: who === "user" ? "user" : "bot" };
        if (index >= 0)
            state.bubbles[index] = bubble;
        else
            state.bubbles.push(bubble);
        enforceMaxBubbles(state);
        state.autoScroll = true;
        drawPanel();
        return bubble;
    }
    async function sendAudioBlob(blob, mime) {
        const placeholder = { kind: "text", text: "Procesando transmisión…", who: "bot" };
        state.bubbles.push(placeholder);
        enforceMaxBubbles(state);
        state.autoScroll = true;
        requestInFlight = true;
        setListening(state, drawPanel, false);
        setAISpeaking(state, drawPanel, true);
        try {
            if (!blob || blob.size < 800)
                throw new Error("La grabación quedó vacía o fue demasiado corta");
            const formData = new FormData();
            formData.append("audio", blob, `voice.${fileExtensionForMime(mime)}`);
            formData.append("want_audio", "0");
            try {
                const missionContext = getMissionContext?.();
                if (missionContext)
                    formData.append("mission_context", JSON.stringify(missionContext));
                if (conversationHistory.length)
                    formData.append("history", JSON.stringify(conversationHistory.slice(-8)));
            }
            catch (_) { }
            const response = await fetchWithTimeout(ENDPOINT, { method: "POST", body: formData }, 75000);
            const data = await readJsonResponse(response);
            const transcript = String(data.transcript || "").trim();
            const reply = String(data.reply || "No pude responder en este momento.").trim();
            const placeholderIndex = state.bubbles.indexOf(placeholder);
            if (transcript && placeholderIndex >= 0) {
                state.bubbles.splice(placeholderIndex, 0, { kind: "text", text: transcript, who: "user" });
                enforceMaxBubbles(state);
            }
            replaceBubble(placeholder, reply, "bot");
            if (transcript)
                conversationHistory.push({ role: "user", content: transcript });
            conversationHistory.push({ role: "assistant", content: reply });
            while (conversationHistory.length > 8)
                conversationHistory.shift();
            if (data.action) {
                try {
                    await onAssistantAction?.(data.action);
                }
                catch (_) { }
            }
            requestInFlight = false;
            setAISpeaking(state, drawPanel, false);
            await requestSpeechAudio(reply);
        }
        catch (error) {
            console.error("sendAudioBlob failed:", error);
            const message = error?.name === "AbortError"
                ? "La respuesta tardó demasiado. Intenta nuevamente con una frase más corta."
                : "No pude procesar tu voz. Verifica la conexión e intenta de nuevo.";
            replaceBubble(placeholder, message, "bot");
        }
        finally {
            requestInFlight = false;
            setAISpeaking(state, drawPanel, false);
            if (armed) {
                const track = micStream?.getAudioTracks?.()?.[0];
                if (!track || track.readyState !== "live")
                    await rearmMicBestEffort();
                else {
                    setListening(state, drawPanel, true);
                    idleSince = performance.now();
                    startVADLoop();
                }
            }
        }
    }
    function startCapture() {
        if (!armed || recording || requestInFlight || state.aiSpeaking || !micStream)
            return false;
        const options = preferredMediaRecorderOptions();
        const recorder = new MediaRecorder(micStream, options);
        mediaRecorder = recorder;
        chunks = [];
        sendOnStop = false;
        recording = true;
        recordingStartedAt = performance.now();
        belowSince = 0;
        recorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0)
                chunks.push(event.data);
        };
        recorder.onstop = () => {
            const shouldSend = sendOnStop;
            sendOnStop = false;
            const captured = chunks;
            chunks = [];
            const mime = recorder.mimeType || options.mimeType || "audio/webm";
            if (mediaRecorder === recorder)
                mediaRecorder = null;
            recording = false;
            if (!shouldSend)
                return;
            const blob = new Blob(captured, { type: mime });
            sendAudioBlob(blob, mime);
        };
        try {
            recorder.start(250);
            setListening(state, drawPanel, true);
            return true;
        }
        catch (error) {
            mediaRecorder = null;
            recording = false;
            addBubble(state, drawPanel, `No pude iniciar la grabación: ${error?.message || "error desconocido"}`, "bot");
            return false;
        }
    }
    function stopCapture(send = true) {
        const recorder = mediaRecorder;
        if (!recorder || recorder.state === "inactive") {
            recording = false;
            return;
        }
        sendOnStop = !!send;
        recording = false;
        stopVADLoop();
        setListening(state, drawPanel, false);
        try {
            recorder.requestData?.();
        }
        catch (_) { }
        try {
            recorder.stop();
        }
        catch (_) {
            sendOnStop = false;
            mediaRecorder = null;
        }
    }
    function vadTick() {
        if (!armed || !analyser || requestInFlight || state.aiSpeaking)
            return;
        if (audioContext?.state === "suspended")
            audioContext.resume().catch(() => { });
        const now = performance.now();
        const voice = rmsFromAnalyser(analyser) >= VAD_THRESHOLD;
        if (!recording) {
            if (!idleSince)
                idleSince = now;
            if (!voice && now - idleSince >= AUTO_DISARM_MS) {
                cleanupArmedMode();
                return;
            }
            if (voice) {
                idleSince = now;
                if (!aboveSince)
                    aboveSince = now;
                if (now - aboveSince >= MIN_SPEECH_MS) {
                    aboveSince = 0;
                    startCapture();
                }
            }
            else {
                aboveSince = 0;
            }
            return;
        }
        if (now - recordingStartedAt >= MAX_RECORDING_MS) {
            stopCapture(true);
            return;
        }
        if (voice) {
            belowSince = 0;
            return;
        }
        if (!belowSince)
            belowSince = now;
        if (now - belowSince >= SILENCE_MS) {
            belowSince = 0;
            stopCapture(true);
        }
    }
    async function ensureMicArmed() {
        if (!window.isSecureContext) {
            addBubble(state, drawPanel, "El micrófono requiere una conexión HTTPS segura.", "bot");
            return false;
        }
        if (!canRecord()) {
            addBubble(state, drawPanel, "Este navegador no soporta grabación de audio con MediaRecorder.", "bot");
            return false;
        }
        let track = micStream?.getAudioTracks?.()?.[0] || null;
        if (!track || track.readyState !== "live") {
            micStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            });
            track = micStream.getAudioTracks?.()?.[0] || null;
        }
        attachTrackWatchers();
        if (!audioContext || audioContext.state === "closed") {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            audioContext = new AudioContextClass();
        }
        if (audioContext.state === "suspended") {
            try {
                await audioContext.resume();
            }
            catch (_) { }
        }
        try {
            sourceNode?.disconnect?.();
        }
        catch (_) { }
        sourceNode = audioContext.createMediaStreamSource(micStream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        sourceNode.connect(analyser);
        armed = true;
        aboveSince = 0;
        belowSince = 0;
        idleSince = performance.now();
        setListening(state, drawPanel, true);
        startVADLoop();
        return true;
    }
    async function rearmMicBestEffort() {
        if (!armed || micRearmInProgress)
            return;
        micRearmInProgress = true;
        try {
            stopVADLoop();
            stopRecorderWithoutSending();
            detachTrackWatchers();
            try {
                sourceNode?.disconnect?.();
            }
            catch (_) { }
            sourceNode = null;
            analyser = null;
            try {
                micStream?.getTracks?.().forEach((track) => track.stop());
            }
            catch (_) { }
            micStream = null;
            await ensureMicArmed();
        }
        catch (error) {
            console.error("Mic rearm failed:", error);
            cleanupArmedMode();
            addBubble(state, drawPanel, "Se perdió el acceso al micrófono. Pulsa INICIAR TRANSMISIÓN para reactivarlo.", "bot");
        }
        finally {
            micRearmInProgress = false;
        }
    }
    async function toggleMic() {
        if (requestInFlight || state.aiSpeaking)
            return;
        await ttsPlayer?.unlock?.();
        if (armed) {
            cleanupArmedMode();
            return;
        }
        try {
            await ensureMicArmed();
        }
        catch (error) {
            console.error("Microphone start failed:", error);
            cleanupArmedMode();
            const name = error?.name || "";
            const message = name === "NotAllowedError"
                ? "Permiso de micrófono denegado."
                : name === "NotFoundError"
                    ? "No se encontró un micrófono disponible."
                    : "No pude iniciar el micrófono.";
            addBubble(state, drawPanel, message, "bot");
        }
    }
    async function startRecording() {
        await ttsPlayer?.unlock?.();
        const ready = armed || await ensureMicArmed();
        if (ready)
            startCapture();
    }
    async function startRecordingUsingExistingStream() {
        const ready = armed || await ensureMicArmed();
        if (ready)
            startCapture();
    }
    async function onXRSessionStart() {
        try {
            await ttsPlayer?.unlock?.();
        }
        catch (_) { }
        if (audioContext?.state === "suspended") {
            try {
                await audioContext.resume();
            }
            catch (_) { }
        }
        if (!armed)
            return;
        const track = micStream?.getAudioTracks?.()?.[0];
        if (!track || track.readyState !== "live" || track.muted)
            await rearmMicBestEffort();
        else
            startVADLoop();
    }
    return {
        toggleMic,
        isRecording: () => recording,
        stop: () => {
            requestInFlight = false;
            setAISpeaking(state, drawPanel, false);
            try {
                ttsPlayer?.stop?.();
            }
            catch (_) { }
            cleanupArmedMode();
        },
        startRecording,
        startRecordingUsingExistingStream,
        onXRSessionStart,
    };
}
