import "server-only";

import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { AppError, fromDbError } from "@/lib/errors";
import type { Json } from "@/types/database";
import { JOB_HANDLERS } from "@/lib/jobs/handlers";
import { PermanentJobError, type JobRow, type JobType } from "@/lib/jobs/types";

/**
 * Job-Warteschlange in PostgreSQL (Tabelle ai_generation_jobs).
 * Ablauf: enqueueJob() → runJobNow() via after() → bei Fehlern Wiederholung
 * mit Backoff durch den Cron-Endpoint (processPendingJobs).
 */

export interface EnqueueInput {
  userId: string;
  type: JobType;
  propertyId?: string | null;
  listingId?: string | null;
  input?: Json;
  idempotencyKey?: string;
  maxAttempts?: number;
}

export async function enqueueJob(input: EnqueueInput): Promise<JobRow> {
  if (!isServiceRoleConfigured()) {
    throw new AppError("service_unavailable", "Hintergrundaufträge sind nicht konfiguriert (SUPABASE_SECRET_KEY fehlt).");
  }
  const admin = createAdminClient();
  if (input.idempotencyKey) {
    const { data: existing } = await admin
      .from("ai_generation_jobs")
      .select("*")
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing && existing.status !== "failed" && existing.status !== "cancelled") return existing;
  }
  const { data, error } = await admin
    .from("ai_generation_jobs")
    .insert({
      user_id: input.userId,
      job_type: input.type,
      property_id: input.propertyId ?? null,
      listing_id: input.listingId ?? null,
      input: input.input ?? {},
      idempotency_key: input.idempotencyKey ?? null,
      max_attempts: input.maxAttempts ?? 3,
    })
    .select("*")
    .single();
  if (error || !data) throw fromDbError(error);
  return data;
}

const WORKER_ID = `worker-${Math.random().toString(36).slice(2, 8)}`;

async function finishJob(job: JobRow, outcome: { ok: true; result: Json } | { ok: false; error: unknown }): Promise<JobRow> {
  const admin = createAdminClient();
  if (outcome.ok) {
    const { data } = await admin
      .from("ai_generation_jobs")
      .update({ status: "succeeded", result: outcome.result, error_message: null, finished_at: new Date().toISOString(), locked_at: null })
      .eq("id", job.id)
      .select("*")
      .single();
    return data ?? job;
  }
  const permanent = outcome.error instanceof PermanentJobError || outcome.error instanceof AppError;
  const message = outcome.error instanceof Error ? outcome.error.message : "Unbekannter Fehler";
  const retry = !permanent && job.attempts < job.max_attempts;
  const backoffSeconds = 30 * 2 ** Math.max(0, job.attempts - 1);
  const { data } = await admin
    .from("ai_generation_jobs")
    .update({
      status: retry ? "queued" : "failed",
      error_message: message.slice(0, 1000),
      run_after: new Date(Date.now() + backoffSeconds * 1000).toISOString(),
      finished_at: retry ? null : new Date().toISOString(),
      locked_at: null,
    })
    .eq("id", job.id)
    .select("*")
    .single();
  if (!permanent) console.error(`[jobs] ${job.job_type} ${job.id} fehlgeschlagen (Versuch ${job.attempts})`, outcome.error);
  return data ?? job;
}

async function executeJob(job: JobRow): Promise<JobRow> {
  const handler = JOB_HANDLERS[job.job_type];
  if (!handler) {
    return finishJob(job, { ok: false, error: new PermanentJobError(`Kein Handler für ${job.job_type}`) });
  }
  try {
    const result = await handler({ job, admin: createAdminClient() });
    return finishJob(job, { ok: true, result });
  } catch (error) {
    return finishJob(job, { ok: false, error });
  }
}

/** Führt einen bestimmten Job sofort aus (typischerweise innerhalb von after()). */
export async function runJobNow(jobId: string): Promise<JobRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_job", { p_job_id: jobId, p_worker: WORKER_ID });
  if (error) throw fromDbError(error);
  const job = (data as JobRow[] | null)?.[0];
  if (!job) return null;
  return executeJob(job);
}

/** Verarbeitet fällige und hängengebliebene Jobs (Cron). */
export async function processPendingJobs(limit = 5): Promise<{ processed: number; failed: number }> {
  if (!isServiceRoleConfigured()) return { processed: 0, failed: 0 };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_jobs", { p_limit: limit, p_worker: WORKER_ID });
  if (error) throw fromDbError(error);
  let failed = 0;
  for (const job of (data as JobRow[] | null) ?? []) {
    const result = await executeJob(job);
    if (result.status === "failed") failed++;
  }
  return { processed: (data as JobRow[] | null)?.length ?? 0, failed };
}
