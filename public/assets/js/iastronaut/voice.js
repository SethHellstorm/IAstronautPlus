import { ENDPOINT } from "./config.js";
import { readJsonResponse } from "./network.js";

function base64ToBytes(value) {
    const bin = atob(value);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++)
        bytes[i] = bin.charCodeAt(i);
    return bytes;
}
export function createTTSPlayer() {
    let currentAudio = null;
    let currentSource = null;
    let currentFinish = null;
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
        const finish = currentFinish;
        currentFinish = null;
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
        try {
            finish?.();
        }
        catch (_) { }
    }
    async function playWithAudioElement(bytes, rate = 1) {
        return new Promise((resolve) => {
            const blob = new Blob([bytes], { type: "audio/mpeg" });
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.playbackRate = Math.max(0.8, Math.min(1.35, Number(rate) || 1));
            currentAudio = audio;
            let finished = false;
            const finish = () => {
                if (finished)
                    return;
                finished = true;
                if (currentFinish === finish)
                    currentFinish = null;
                try {
                    URL.revokeObjectURL(url);
                }
                catch (_) { }
                if (currentAudio === audio)
                    currentAudio = null;
                notifySpeaking(false);
                resolve();
            };
            currentFinish = finish;
            audio.onended = finish;
            audio.onerror = finish;
            notifySpeaking(true);
            audio.play().catch(finish);
        });
    }
    async function playBase64Mp3(audioBase64, { rate = 1 } = {}) {
        if (!audioBase64)
            return;
        stop();
        const bytes = base64ToBytes(audioBase64);
        const context = await ensureAudioContext();
        if (!context) {
            await playWithAudioElement(bytes, rate);
            return;
        }
        try {
            const audioBuffer = await context.decodeAudioData(bytes.buffer.slice(0));
            await new Promise((resolve) => {
                const source = context.createBufferSource();
                currentSource = source;
                source.buffer = audioBuffer;
                source.playbackRate.value = Math.max(0.8, Math.min(1.35, Number(rate) || 1));
                source.connect(context.destination);
                let finished = false;
                const finish = () => {
                    if (finished)
                        return;
                    finished = true;
                    if (currentFinish === finish)
                        currentFinish = null;
                    if (currentSource === source)
                        currentSource = null;
                    try {
                        source.disconnect();
                    }
                    catch (_) { }
                    notifySpeaking(false);
                    resolve();
                };
                currentFinish = finish;
                source.onended = finish;
                notifySpeaking(true);
                source.start(0);
            });
        }
        catch (_) {
            await playWithAudioElement(bytes, rate);
        }
    }
    return { playBase64Mp3, stop, unlock, setSpeakingChangeHandler };
}
export function createVoiceGuide({ ttsPlayer }) {
    let queue = Promise.resolve();
    let muted = false;
    let lastText = "";
    let generation = 0;
    let activeRequestController = null;
    async function requestAudio(text, requestController) {
        const timeoutId = setTimeout(() => requestController.abort(), 45000);
        try {
            const response = await fetch(ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tts_only: true, text }),
                signal: requestController.signal,
            });
            const data = await readJsonResponse(response);
            return data.audio_base64 || "";
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    function cancelCurrent() {
        generation += 1;
        try {
            activeRequestController?.abort?.();
        }
        catch (_) { }
        activeRequestController = null;
        ttsPlayer?.stop?.();
        queue = Promise.resolve();
    }
    function speak(text, { interrupt = true, remember = true } = {}) {
        const clean = String(text || "").replace(/\s+/g, " ").trim();
        if (!clean || muted)
            return Promise.resolve(false);
        if (remember)
            lastText = clean;
        if (interrupt)
            cancelCurrent();
        const requestGeneration = generation;
        queue = queue.then(async () => {
            if (muted || requestGeneration !== generation)
                return false;
            const requestController = new AbortController();
            activeRequestController = requestController;
            try {
                const audioBase64 = await requestAudio(clean, requestController);
                if (activeRequestController === requestController)
                    activeRequestController = null;
                if (muted || requestGeneration !== generation)
                    return false;
                if (audioBase64)
                    await ttsPlayer?.playBase64Mp3?.(audioBase64, { rate: 1.12 });
                return true;
            }
            catch (error) {
                if (activeRequestController === requestController)
                    activeRequestController = null;
                if (error?.name !== "AbortError")
                    console.warn("Voice guide request failed:", error);
                return false;
            }
        });
        return queue;
    }
    function stop() {
        cancelCurrent();
    }
    function setMuted(value) {
        muted = !!value;
        if (muted)
            stop();
        return muted;
    }
    function repeat() {
        return lastText ? speak(lastText, { interrupt: true, remember: false }) : Promise.resolve(false);
    }
    return {
        speak,
        repeat,
        stop,
        setMuted,
        isMuted: () => muted,
        unlock: () => ttsPlayer?.unlock?.(),
    };
}
