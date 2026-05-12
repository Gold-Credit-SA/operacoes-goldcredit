// HTTP client com timeout, retry exponencial controlado e telemetria.
// Retry SÓ acontece em network_error (timeout, 5xx) — nunca em 4xx,
// para não duplicar consultas pagas por erro nosso.

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface FetchResult {
  ok: boolean;
  status: number;
  bodyText: string;
  bodyJson: unknown;
  latencyMs: number;
  attempts: number;
  networkError?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export async function fetchWithRetry(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
  const {
    timeoutMs = 30_000,
    maxRetries = 2,
    retryDelayMs = 1_000,
    ...init
  } = opts;

  const started = performance.now();
  let lastNetworkError: string | undefined;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      const bodyText = await res.text();
      let bodyJson: unknown = null;
      try { bodyJson = JSON.parse(bodyText); } catch { /* deixa null */ }
      const latencyMs = Math.round(performance.now() - started);

      // Retry só em 5xx
      if (res.status >= 500 && attempt <= maxRetries) {
        lastNetworkError = `HTTP ${res.status}`;
        await sleep(retryDelayMs * Math.pow(2, attempt - 1));
        continue;
      }
      return { ok: res.ok, status: res.status, bodyText, bodyJson, latencyMs, attempts: attempt };
    } catch (err) {
      clearTimeout(timer);
      lastNetworkError = err instanceof Error ? err.message : String(err);
      if (attempt <= maxRetries) {
        await sleep(retryDelayMs * Math.pow(2, attempt - 1));
        continue;
      }
      const latencyMs = Math.round(performance.now() - started);
      return {
        ok: false,
        status: 0,
        bodyText: '',
        bodyJson: null,
        latencyMs,
        attempts: attempt,
        networkError: lastNetworkError,
      };
    }
  }

  // Inalcançável, mas TypeScript exige
  return { ok: false, status: 0, bodyText: '', bodyJson: null, latencyMs: 0, attempts: maxRetries + 1, networkError: lastNetworkError };
}
