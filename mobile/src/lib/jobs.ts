/**
 * Hintergrundaufträge (KI-Texte, Bewertung, Dossier, Bild-KI) und Aufrufe an den Server der Website.
 *
 * Öffentliche API (klein halten, wird von mehreren Bereichen importiert):
 *
 *   fetchWithAuth(path, init?)            → Response
 *     fetch gegen `${CONFIG.siteUrl}${path}` mit «Authorization: Bearer <Access-Token>».
 *     Wirft ApiError(401), wenn niemand angemeldet ist. Prüft den Status NICHT.
 *
 *   apiJson<T>(path, { method?, body?, signal? }) → T
 *     Wie fetchWithAuth, sendet/liest JSON und wirft bei Fehlerstatus einen ApiError mit der
 *     Meldung des Servers (`error`), dem HTTP-Status und `consentRequired`.
 *
 *   fetchJob(jobId, signal?)              → JobStatus      (ein einzelner Abruf von GET /api/jobs/{id})
 *
 *   pollJob(jobId, { onUpdate?, signal?, intervalMs? }) → JobStatus
 *     Fragt alle 1.5 s ab, bis der Auftrag abgeschlossen ist (succeeded | failed | cancelled), und
 *     gibt den letzten Stand zurück. Wirft NICHT bei «failed» – status/error/consentRequired prüfen.
 *     Wirft nur bei Abbruch (AbortError) oder wenn der Status wiederholt nicht abrufbar ist.
 *
 *   useJob(jobId | null, { onSuccess?, onError? }) → { job, running, error }
 *     React-Hook (gleiches Verhalten wie src/components/ai/use-job.ts der Website);
 *     onSuccess/onError werden genau einmal pro Auftrag aufgerufen.
 *
 *   isJobFinished(status), jobProgressText(job) (Statuszeile wie auf der Website)
 */
import { useQuery } from "@tanstack/react-query";
import * as React from "react";

import { CONFIG } from "@/lib/config";
import { supabase, type Enums } from "@/lib/supabase";

/** Antwort von GET /api/jobs/{jobId} (entspricht JobStatusDto in src/lib/ai/job-status.ts). */
export interface JobStatus {
  id: string;
  type: Enums<"job_type">;
  status: Enums<"job_status">;
  /** Nur bei «succeeded» gesetzt; Form je nach Auftragstyp */
  result: unknown;
  error: string | null;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  /** Läuft ungewöhnlich lange */
  stale: boolean;
  /** Fehlgeschlagen, weil die Einwilligung zur KI-Verarbeitung fehlt */
  consentRequired: boolean;
}

export class ApiError extends Error {
  readonly status: number;
  readonly consentRequired: boolean;
  constructor(message: string, status: number, consentRequired = false) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.consentRequired = consentRequired;
  }
}

export function isJobFinished(status: JobStatus["status"] | undefined): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled";
}

export async function fetchWithAuth(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError("Bitte melden Sie sich an.", 401);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  try {
    return await fetch(`${CONFIG.siteUrl}${path}`, { ...init, headers });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError("Der Server ist nicht erreichbar. Bitte prüfen Sie Ihre Internetverbindung.", 0);
  }
}

export async function apiJson<T>(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const response = await fetchWithAuth(path, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });
  const json = (await response.json().catch(() => null)) as ({ error?: string; consentRequired?: boolean } & Record<string, unknown>) | null;
  if (!response.ok) {
    throw new ApiError(json?.error ?? "Die Anfrage ist fehlgeschlagen. Bitte versuchen Sie es erneut.", response.status, json?.consentRequired === true);
  }
  return (json ?? {}) as T;
}

export async function fetchJob(jobId: string, signal?: AbortSignal): Promise<JobStatus> {
  try {
    return await apiJson<JobStatus>(`/api/jobs/${jobId}`, { signal });
  } catch (error) {
    if (error instanceof ApiError && error.status !== 401 && error.status !== 0) {
      throw new ApiError(error.status === 404 ? "Der Auftrag wurde nicht gefunden." : error.message, error.status);
    }
    throw error;
  }
}

function abortError(): Error {
  const error = new Error("Abgebrochen");
  error.name = "AbortError";
  return error;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function pollJob(
  jobId: string,
  options: { onUpdate?: (job: JobStatus) => void; signal?: AbortSignal; intervalMs?: number } = {},
): Promise<JobStatus> {
  const interval = options.intervalMs ?? 1500;
  let failures = 0;
  for (;;) {
    if (options.signal?.aborted) throw abortError();
    try {
      const job = await fetchJob(jobId, options.signal);
      failures = 0;
      options.onUpdate?.(job);
      if (isJobFinished(job.status)) return job;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      // 401/404 ändern sich durch Wiederholen nicht; sonst bis zu drei Fehlversuche in Folge dulden
      if (error instanceof ApiError && (error.status === 401 || error.status === 404)) throw error;
      failures += 1;
      if (failures > 3) throw error;
    }
    await wait(interval, options.signal);
  }
}

export function useJob(
  jobId: string | null,
  handlers: { onSuccess?: (job: JobStatus) => void; onError?: (job: JobStatus) => void } = {},
): { job: JobStatus | undefined; running: boolean; error: Error | null } {
  const handlersRef = React.useRef(handlers);
  React.useEffect(() => {
    handlersRef.current = handlers;
  });
  const handled = React.useRef<string | null>(null);

  const query = useQuery({
    queryKey: ["ai-job", jobId],
    enabled: Boolean(jobId),
    queryFn: ({ signal }) => fetchJob(jobId!, signal),
    refetchInterval: (q) => (isJobFinished(q.state.data?.status) ? false : 1500),
    staleTime: 0,
    gcTime: 60_000,
    retry: 3,
  });

  const job = query.data;
  React.useEffect(() => {
    if (!job || !isJobFinished(job.status) || handled.current === job.id) return;
    handled.current = job.id;
    if (job.status === "succeeded") handlersRef.current.onSuccess?.(job);
    else handlersRef.current.onError?.(job);
  }, [job]);

  const running = Boolean(jobId) && !isJobFinished(job?.status) && !query.isError;
  return { job, running, error: query.error };
}

/** Statuszeile eines laufenden Auftrags (Wortlaut wie src/components/ai/job-progress.tsx). */
export function jobProgressText(job: JobStatus | undefined): string {
  if (job?.status === "queued" && job.attempts > 0) {
    return "Ein vorübergehender Fehler ist aufgetreten – der Auftrag wird automatisch erneut versucht.";
  }
  if (job?.stale) return "Das dauert ungewöhnlich lange. Sie können die Seite verlassen; das Ergebnis wird gespeichert.";
  if (job?.status === "running") return "Wird verarbeitet …";
  return "Auftrag ist eingereiht …";
}
