import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** Gemeinsamer Typ für Benutzer-, öffentlichen und Service-Role-Client. */
export type DbClient = SupabaseClient<Database>;
