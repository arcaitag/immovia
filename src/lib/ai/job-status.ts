import type { Enums, Json } from "@/types/database";

/**
 * Meldung bei fehlender Einwilligung zur KI-Verarbeitung (auch als Fehlertext eines Auftrags,
 * daran erkennt die Oberfläche den Fall und zeigt den Einwilligungsdialog).
 */
export const AI_CONSENT_REQUIRED_MESSAGE =
  "Für diese KI-Funktion braucht es Ihre Einwilligung zur Datenverarbeitung durch unseren KI-Anbieter.";

/** Wie oben, für die Bild-KI (eigene Einwilligung, weil Fotos an einen anderen Anbieter gehen). */
export const AI_IMAGE_CONSENT_REQUIRED_MESSAGE =
  "Für die Bild-KI braucht es Ihre Einwilligung, dass das Foto an den Bild-KI-Anbieter übermittelt wird.";

export function isConsentRequiredMessage(message: string | null | undefined): boolean {
  return message === AI_CONSENT_REQUIRED_MESSAGE || message === AI_IMAGE_CONSENT_REQUIRED_MESSAGE;
}

/** Antwort von GET /api/jobs/[jobId] (auch im Browser verwendet). */
export interface JobStatusDto {
  id: string;
  type: Enums<"job_type">;
  status: Enums<"job_status">;
  result: Json | null;
  error: string | null;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  /** Läuft der Auftrag ungewöhnlich lange (Hinweis für die Oberfläche) */
  stale: boolean;
  /** Fehlgeschlagen, weil die Einwilligung zur KI-Verarbeitung fehlt (z. B. inzwischen widerrufen) */
  consentRequired: boolean;
}

export function isJobFinished(status: JobStatusDto["status"] | undefined): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled";
}
