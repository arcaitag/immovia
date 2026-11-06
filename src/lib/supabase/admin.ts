import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { publicEnv, serverEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

let adminClient: ReturnType<typeof createSupabaseClient<Database>> | undefined;

export function isServiceRoleConfigured(): boolean {
  return Boolean(serverEnv.supabaseSecretKey && publicEnv.supabaseUrl);
}

/**
 * Service-Role-Client. Umgeht RLS – nur für klar begrenzte Systemaufgaben verwenden
 * (Bewertungen schreiben, Jobs, E-Mail-Outbox, Aufrufstatistik, Cron, Kontolöschung).
 * Vorher IMMER die Berechtigung mit dem Benutzer-Client prüfen.
 */
export function createAdminClient() {
  const key = serverEnv.supabaseSecretKey;
  if (!key || !publicEnv.supabaseUrl) {
    throw new AppError("service_unavailable", "Der Server-Schlüssel (SUPABASE_SECRET_KEY) ist nicht konfiguriert.");
  }
  if (!adminClient) {
    adminClient = createSupabaseClient<Database>(publicEnv.supabaseUrl, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return adminClient;
}

export type AdminSupabaseClient = ReturnType<typeof createAdminClient>;
