import { APIConnectionError, APIError, APIUserAbortError } from "@anthropic-ai/sdk";

/**
 * Wiederholungen mit exponentiellem Backoff für vorübergehende Fehler
 * (429 Rate Limit, 408/409, 5xx inkl. 529 «overloaded», Verbindungsabbruch, Timeout).
 * Das SDK selbst wiederholt nicht (maxRetries: 0), damit Versuche und Wartezeiten hier
 * zentral gesteuert und protokolliert werden.
 */

export interface RetryOptions {
  /** Maximale Anzahl Versuche inkl. erstem Versuch */
  maxAttempts: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  signal?: AbortSignal;
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
  /** Für Tests austauschbar */
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof APIUserAbortError) return false;
  if (error instanceof APIConnectionError) return true;
  if (error instanceof APIError) {
    const status = error.status;
    if (status === undefined) return true;
    return status === 408 || status === 409 || status === 429 || status >= 500;
  }
  return false;
}

/** Wartezeit gemäss Retry-After-Header (falls vorhanden und plausibel). */
export function retryAfterMs(error: unknown): number | null {
  if (!(error instanceof APIError) || !error.headers) return null;
  const headers = error.headers as Headers;
  const ms = Number(headers.get("retry-after-ms"));
  if (Number.isFinite(ms) && ms > 0) return ms;
  const seconds = Number(headers.get("retry-after"));
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  return null;
}

/** Exponentieller Backoff mit Jitter: base · 2^(attempt−1), begrenzt auf maxDelay. */
export function backoffDelayMs(attempt: number, baseDelayMs = 1000, maxDelayMs = 20_000, random: () => number = Math.random): number {
  const exp = baseDelayMs * 2 ** Math.max(0, attempt - 1);
  const jitter = Math.floor(random() * 250);
  return Math.min(maxDelayMs, exp) + jitter;
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new APIUserAbortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new APIUserAbortError());
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function withRetry<T>(fn: (attempt: number) => Promise<T>, options: RetryOptions): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts);
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isRetryableError(error) || options.signal?.aborted) throw error;
      const hinted = retryAfterMs(error);
      const delayMs = Math.min(
        options.maxDelayMs ?? 20_000,
        hinted ?? backoffDelayMs(attempt, options.baseDelayMs, options.maxDelayMs, options.random),
      );
      options.onRetry?.({ attempt, delayMs, error });
      if (options.sleep) await options.sleep(delayMs);
      else await defaultSleep(delayMs, options.signal);
    }
  }
  throw lastError;
}
