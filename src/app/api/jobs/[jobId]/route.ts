import { NextResponse, after, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { runJobNow } from "@/lib/jobs/queue";
import type { JobStatusDto } from "@/lib/ai/job-status";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 300;

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Status eines eigenen Jobs (Benutzer-Client, RLS: eigene Jobs bzw. verwaltbare Objekte).
 * Fällige, wartende Jobs (z. B. nach einem vorübergehenden Fehler) werden dabei direkt
 * wieder angestossen – so hängt die Verarbeitung nicht nur am täglichen Cron.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!isUuid(jobId)) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404, headers: NO_STORE });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Bitte melden Sie sich an." }, { status: 401, headers: NO_STORE });

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("ai_generation_jobs")
    .select("id, user_id, job_type, status, result, error_message, attempts, max_attempts, created_at, started_at, finished_at, run_after, locked_at")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404, headers: NO_STORE });

  if (job.status === "queued" && job.user_id === user.id && new Date(job.run_after).getTime() <= Date.now() && isServiceRoleConfigured()) {
    after(async () => {
      try {
        await runJobNow(job.id);
      } catch (error) {
        console.error(`[jobs] Nachholen von ${job.id} fehlgeschlagen`, error);
      }
    });
  }

  const stale = job.status === "running" && job.locked_at !== null && Date.now() - new Date(job.locked_at).getTime() > 5 * 60_000;
  const body: JobStatusDto = {
    id: job.id,
    type: job.job_type,
    status: job.status,
    result: job.status === "succeeded" ? job.result : null,
    error: job.status === "failed" || job.status === "queued" ? (job.error_message ?? null) : null,
    attempts: job.attempts,
    maxAttempts: job.max_attempts,
    createdAt: job.created_at,
    startedAt: job.started_at,
    finishedAt: job.finished_at,
    stale,
  };
  return NextResponse.json(body, { headers: NO_STORE });
}
