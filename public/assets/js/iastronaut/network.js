export function createTimeoutSignal(timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

export async function fetchWithTimeout(url, options, timeoutMs) {
    const timeout = createTimeoutSignal(timeoutMs);
    try {
        return await fetch(url, { ...options, signal: timeout.signal });
    }
    finally {
        timeout.clear();
    }
}

export async function readJsonResponse(response) {
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
