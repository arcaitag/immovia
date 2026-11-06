import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";

/**
 * Anonymer Supabase-Client ohne Cookies für öffentliche Daten
 * (statische/ISR-Seiten, Sitemap, Metadaten). RLS wie für Besucher.
 */
export function createPublicClient() {
  if (!isSupabaseConfigured()) return null;
  return createSupabaseClient<Database>(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type PublicSupabaseClient = NonNullable<ReturnType<typeof createPublicClient>>;
