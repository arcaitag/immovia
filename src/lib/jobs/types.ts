import type { Enums, Json, Tables } from "@/types/database";
import type { AdminSupabaseClient } from "@/lib/supabase/admin";

export type JobType = Enums<"job_type">;
export type JobRow = Tables<"ai_generation_jobs">;

export interface JobContext {
  job: JobRow;
  /** Service-Role-Client. Berechtigung wurde beim Einreihen geprüft. */
  admin: AdminSupabaseClient;
}

/** Ein Handler liefert das Ergebnis (wird als JSON in result gespeichert) oder wirft einen Fehler. */
export type JobHandler = (ctx: JobContext) => Promise<Json>;

/** Fehler, die nicht wiederholt werden sollen (z. B. fehlende Daten, Kontingent). */
export class PermanentJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentJobError";
  }
}
