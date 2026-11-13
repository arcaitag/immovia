import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import { AI_CONSENT_REQUIRED_MESSAGE, AI_IMAGE_CONSENT_REQUIRED_MESSAGE } from "@/lib/ai/job-status";

/**
 * Einwilligungen zur KI-Verarbeitung (user_preferences, Standard: aus):
 * - text:  ai_processing_consent – KI-Texte, Bewertungserklärung, Assistent (Anthropic)
 * - image: ai_image_consent – Bild-KI im Bilderstudio (Fotos gehen an den Bild-KI-Anbieter)
 * Geprüft wird serverseitig unmittelbar vor jedem Aufruf eines KI-Anbieters – auch in
 * Hintergrundaufträgen, falls die Einwilligung inzwischen widerrufen wurde.
 */

export { AI_CONSENT_REQUIRED_MESSAGE, AI_IMAGE_CONSENT_REQUIRED_MESSAGE };

export type AiConsentKind = "text" | "image";

const CONSENT_COLUMN = { text: "ai_processing_consent", image: "ai_image_consent" } as const;

/** Erkennbarer Fehler: Die Oberfläche zeigt daraufhin den passenden Einwilligungsdialog. */
export function aiConsentRequiredError(kind: AiConsentKind = "text"): AppError {
  return new AppError("invalid_state", kind === "image" ? AI_IMAGE_CONSENT_REQUIRED_MESSAGE : AI_CONSENT_REQUIRED_MESSAGE, {
    consentRequired: true,
    consentKind: kind,
  });
}

export function isAiConsentRequiredError(error: unknown): boolean {
  return error instanceof AppError && error.details?.consentRequired === true;
}

/** Liest die Einwilligung. Fehlende Zeile oder Lesefehler gelten als «keine Einwilligung». */
export async function readAiConsent(client: SupabaseClient<Database>, userId: string, kind: AiConsentKind = "text"): Promise<boolean> {
  const column = CONSENT_COLUMN[kind];
  const { data, error } = await client.from("user_preferences").select(column).eq("user_id", userId).maybeSingle();
  if (error) {
    console.error("[ai] Einwilligung konnte nicht gelesen werden", error.message);
    return false;
  }
  return (data as Record<string, unknown> | null)?.[column] === true;
}

/**
 * Wirft aiConsentRequiredError(), wenn keine Einwilligung vorliegt. Ohne Benutzerbezug oder
 * ohne Möglichkeit zur Prüfung wird ebenfalls abgelehnt (lieber kein KI-Aufruf als ein ungeprüfter).
 */
export async function assertAiConsent(userId: string | null, client?: SupabaseClient<Database>, kind: AiConsentKind = "text"): Promise<void> {
  if (!userId) throw aiConsentRequiredError(kind);
  const db = client ?? (isServiceRoleConfigured() ? createAdminClient() : null);
  if (!db || !(await readAiConsent(db, userId, kind))) throw aiConsentRequiredError(kind);
}
