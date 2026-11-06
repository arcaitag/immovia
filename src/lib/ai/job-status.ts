import type { Enums, Json } from "@/types/database";

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
}

export function isJobFinished(status: JobStatusDto["status"] | undefined): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled";
}
