import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { processPendingJobs } from "@/lib/jobs/queue";
import { processEmailOutbox } from "@/lib/email/outbox";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { runScheduledTasks } from "@/lib/jobs/scheduled";

export const maxDuration = 300;

/**
 * Cron-Endpoint für Hintergrundaufgaben, geschützt mit CRON_SECRET (vercel.json).
 * - Ohne Parameter (alle 5 Minuten): Jobs nachholen und E-Mails versenden.
 * - Mit ?scheduled=1 (stündlich; auf Vercel Hobby nur täglich möglich): zusätzlich Erinnerungen,
 *   Zusammenfassungen und Aufräumarbeiten. Alle Aufgaben sind wiederholbar und laufen ohne Doppelversand.
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
  const full = request.nextUrl.searchParams.get("scheduled") === "1";
  const jobs = await processPendingJobs(10);
  const scheduled = full ? await runScheduledTasks() : null;
  const emails = await processEmailOutbox(50);
  if (full) await createAdminClient().rpc("cleanup_rate_limits");

  return NextResponse.json({ ok: true, jobs, scheduled, emails, durationMs: Date.now() - started });
}
