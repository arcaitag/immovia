import { serverEnv } from "@/lib/env";
import type { EmailAttachment } from "@/lib/email/layout";

/**
 * Versand über die Resend-REST-API (POST https://api.resend.com/emails).
 * - Authorization: Bearer RESEND_API_KEY
 * - Idempotency-Key: ID des Outbox-Eintrags (max. 256 Zeichen, 24 h gültig) verhindert Doppelversand
 * - User-Agent ist Pflicht (sonst 403 / Fehler 1010)
 * Kein «server-only», damit die Fehlerklassifizierung testbar bleibt; der Schlüssel
 * wird nur serverseitig gelesen und nie an den Browser gegeben.
 */

export const RESEND_ENDPOINT = "https://api.resend.com/emails";
const USER_AGENT = "immovia-mailer/1.0";
const TIMEOUT_MS = 15_000;

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  attachments?: EmailAttachment[];
  /** Für Auswertungen in Resend, z. B. { name: "template", value: "new_message" } */
  tags?: Array<{ name: string; value: string }>;
}

export type SendFailureReason = "not_configured" | "auth" | "invalid" | "rate_limited" | "conflict" | "server" | "network";

export type SendResult =
  | { ok: true; id: string | null; duplicate: boolean }
  | {
      ok: false;
      reason: SendFailureReason;
      /** Später erneut versuchen (mit Backoff) */
      retryable: boolean;
      /** Restliche E-Mails dieses Durchlaufs nicht mehr senden (Konfiguration, Kontingent, Netzwerk) */
      stopBatch: boolean;
      status: number | null;
      message: string;
      retryAfterMs?: number;
    };

export interface SendOptions {
  idempotencyKey?: string;
  apiKey?: string;
  from?: string;
  fetch?: typeof fetch;
}

const TAG_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;

export function buildResendBody(message: OutgoingEmail, from: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    from,
    to: [message.to],
    subject: message.subject,
    html: message.html,
    text: message.text,
  };
  if (message.replyTo) body.reply_to = [message.replyTo];
  if (message.attachments?.length) {
    body.attachments = message.attachments.map((a) => ({ filename: a.filename, content: a.content }));
  }
  const tags = (message.tags ?? []).filter((t) => TAG_PATTERN.test(t.name) && TAG_PATTERN.test(t.value));
  if (tags.length) body.tags = tags;
  return body;
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

async function readError(response: Response): Promise<{ name: string; message: string }> {
  try {
    const json = (await response.json()) as { name?: unknown; message?: unknown; error?: unknown };
    const name = typeof json.name === "string" ? json.name : "";
    const message = typeof json.message === "string" ? json.message : typeof json.error === "string" ? json.error : "";
    return { name, message };
  } catch {
    return { name: "", message: "" };
  }
}

/** Ordnet eine Fehlerantwort von Resend ein (Wiederholen, Abbrechen, endgültig). */
export function classifyResendError(status: number, name: string, message: string, retryAfterMs?: number): SendResult {
  const text = `Resend ${status}${name ? ` ${name}` : ""}${message ? `: ${message}` : ""}`.slice(0, 500);
  if (status === 409 && name === "invalid_idempotent_request") {
    // Gleicher Schlüssel innerhalb von 24 h mit anderem Inhalt: die erste Anfrage wurde bereits angenommen
    return { ok: true, id: null, duplicate: true };
  }
  if (status === 409) {
    return { ok: false, reason: "conflict", retryable: true, stopBatch: false, status, message: text, retryAfterMs: 60_000 };
  }
  if (status === 429) {
    const quota = name === "daily_quota_exceeded" || name === "monthly_quota_exceeded";
    return {
      ok: false,
      reason: "rate_limited",
      retryable: true,
      stopBatch: true,
      status,
      message: text,
      retryAfterMs: retryAfterMs ?? (quota ? 60 * 60_000 : 60_000),
    };
  }
  if (status === 401 || status === 403) {
    // Ungültiger Schlüssel, nicht verifizierte Absenderdomain oder fehlender User-Agent
    return { ok: false, reason: "auth", retryable: true, stopBatch: true, status, message: text };
  }
  if (status >= 500) {
    return { ok: false, reason: "server", retryable: true, stopBatch: false, status, message: text, retryAfterMs };
  }
  return { ok: false, reason: "invalid", retryable: false, stopBatch: false, status, message: text };
}

export async function sendEmail(message: OutgoingEmail, options: SendOptions = {}): Promise<SendResult> {
  const apiKey = options.apiKey ?? serverEnv.resendApiKey;
  if (!apiKey) {
    return {
      ok: false,
      reason: "not_configured",
      retryable: true,
      stopBatch: true,
      status: null,
      message: "RESEND_API_KEY ist nicht gesetzt.",
    };
  }
  const doFetch = options.fetch ?? fetch;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "User-Agent": USER_AGENT,
  };
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey.slice(0, 256);

  let response: Response;
  try {
    response = await doFetch(RESEND_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(buildResendBody(message, options.from ?? serverEnv.emailFrom)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    return {
      ok: false,
      reason: "network",
      retryable: true,
      stopBatch: true,
      status: null,
      message: `Netzwerkfehler: ${error instanceof Error ? error.message : String(error)}`.slice(0, 500),
    };
  }

  if (response.ok) {
    let id: string | null = null;
    try {
      const json = (await response.json()) as { id?: unknown };
      id = typeof json.id === "string" ? json.id : null;
    } catch {
      id = null;
    }
    return { ok: true, id, duplicate: false };
  }
  const { name, message: errorMessage } = await readError(response);
  return classifyResendError(response.status, name, errorMessage, parseRetryAfter(response.headers.get("retry-after")));
}
