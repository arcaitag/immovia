import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { processPendingJobs } from "@/lib/jobs/queue";
import { processEmailOutbox } from "@/lib/email/outbox";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { runScheduledTasks } from "@/lib/jobs/scheduled";

export const maxDuration = 300;

/**
 * Cron-Endpoint für Hintergrundaufgaben: Jobs nachholen, E-Mails versenden,
 * Erinnerungen und Zusammenfassungen, Aufräumen. Geschützt mit CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const secret = serverEnv.cronSecret;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  if (!isServiceRoleConfigured()) {
    return NextResponse.json({ error: "SUPABASE_SECRET_KEY fehlt" }, { status: 503 });
  }

  const started = Date.now();
  const jobs = await processPendingJobs(10);
  const scheduled = await runScheduledTasks();
  const emails = await processEmailOutbox(50);
  await createAdminClient().rpc("cleanup_rate_limits");

  return NextResponse.json({ ok: true, jobs, scheduled, emails, durationMs: Date.now() - started });
}
