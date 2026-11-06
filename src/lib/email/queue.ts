import "server-only";

import type { AdminSupabaseClient } from "@/lib/supabase/admin";
import type { Json, Tables } from "@/types/database";
import type { EmailTemplateKey } from "@/lib/email/templates";

/**
 * E-Mails aus dem Anwendungscode in die Outbox legen (Service Role).
 * Entspricht public.queue_email() in der Datenbank: Benachrichtigungseinstellungen
 * werden respektiert, dedupeKey verhindert Doppelversand.
 *
 * Beispiel (Dossier fertig):
 *   await queueEmail(admin, { userId, template: "dossier_ready", setting: "email_listing_updates",
 *     payload: { property_id, dossier_id, title, version }, dedupeKey: `dossier_ready:${dossierId}` });
 */

type SettingsRow = Tables<"user_notification_settings">;
export type NotificationSettingKey = {
  [K in keyof SettingsRow]: SettingsRow[K] extends boolean ? K : never;
}[keyof SettingsRow];

export interface QueueEmailInput {
  userId?: string | null;
  toEmail?: string | null;
  template: EmailTemplateKey;
  payload: Json;
  /** Spalte in user_notification_settings; ist sie false, wird nichts eingereiht. */
  setting?: NotificationSettingKey;
  dedupeKey?: string;
  delaySeconds?: number;
}

/** Liefert true, wenn ein Eintrag angelegt wurde (oder durch dedupeKey bereits existiert). */
export async function queueEmail(admin: AdminSupabaseClient, input: QueueEmailInput): Promise<boolean> {
  if (!input.userId && !input.toEmail) return false;
  if (input.setting && input.userId) {
    const { data } = await admin
      .from("user_notification_settings")
      .select(input.setting)
      .eq("user_id", input.userId)
      .maybeSingle();
    const value = data ? (data as Record<string, unknown>)[input.setting] : undefined;
    if (value === false) return false;
  }
  const row = {
    user_id: input.userId ?? null,
    to_email: input.toEmail ?? null,
    template: input.template,
    payload: input.payload,
    dedupe_key: input.dedupeKey ?? null,
    scheduled_at: new Date(Date.now() + Math.max(0, input.delaySeconds ?? 0) * 1000).toISOString(),
  };
  const query = input.dedupeKey
    ? admin.from("email_outbox").upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true })
    : admin.from("email_outbox").insert(row);
  const { error } = await query;
  if (error) {
    console.error("[email] Einreihen fehlgeschlagen", input.template, error.message);
    return false;
  }
  return true;
}
