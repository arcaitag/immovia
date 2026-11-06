import "server-only";

import { AppError, fromDbError } from "@/lib/errors";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Erteilt die Einwilligung zur KI-Verarbeitung (nur die eigene Zeile, Benutzer-Client mit RLS).
 * Der Widerruf erfolgt in den Einstellungen.
 */
export async function grantAiConsent(supabase: ServerSupabaseClient, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("user_preferences")
    .update({ ai_processing_consent: true })
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new AppError("not_found", "Ihre Einstellungen wurden nicht gefunden. Bitte laden Sie die Seite neu.");
}
