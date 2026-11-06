import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import { AI_CONSENT_REQUIRED_MESSAGE } from "@/lib/ai/job-status";

/**
 * Einwilligung zur KI-Verarbeitung (user_preferences.ai_processing_consent, Standard: aus).
 * Geprüft wird serverseitig unmittelbar vor jedem Aufruf eines KI-Anbieters – auch in
 * Hintergrundaufträgen, falls die Einwilligung inzwischen widerrufen wurde.
 */

export { AI_CONSENT_REQUIRED_MESSAGE };

/** Erkennbarer Fehler: Die Oberfläche zeigt daraufhin den Einwilligungsdialog. */
export function aiConsentRequiredError(): AppError {
  return new AppError("invalid_state", AI_CONSENT_REQUIRED_MESSAGE, { consentRequired: true });
}

export function isAiConsentRequiredError(error: unknown): boolean {
  return error instanceof AppError && error.details?.consentRequired === true;
}

/** Liest die Einwilligung. Fehlende Zeile oder Lesefehler gelten als «keine Einwilligung». */
export async function readAiConsent(client: SupabaseClient<Database>, userId: string): Promise<boolean> {
  const { data, error } = await client.from("user_preferences").select("ai_processing_consent").eq("user_id", userId).maybeSingle();
  if (error) {
    console.error("[ai] Einwilligung konnte nicht gelesen werden", error.message);
    return false;
  }
  return data?.ai_processing_consent === true;
}

/**
 * Wirft aiConsentRequiredError(), wenn keine Einwilligung vorliegt. Ohne Benutzerbezug oder
 * ohne Möglichkeit zur Prüfung wird ebenfalls abgelehnt (lieber kein KI-Aufruf als ein ungeprüfter).
 */
export async function assertAiConsent(userId: string | null, client?: SupabaseClient<Database>): Promise<void> {
  if (!userId) throw aiConsentRequiredError();
  const db = client ?? (isServiceRoleConfigured() ? createAdminClient() : null);
  if (!db || !(await readAiConsent(db, userId))) throw aiConsentRequiredError();
}
