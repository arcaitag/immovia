import "server-only";

import type { SessionUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { isAiConfigured } from "@/lib/ai/provider";
import { checkValuationPrerequisites } from "@/lib/valuation/prerequisites";
import {
  assertAvailable,
  enforceRateLimit,
  enqueueAndRun,
  getFeatureAvailability,
  hasAiConsent,
  requireManagedProperty,
} from "@/services/ai/access";
import { toValuationSubject } from "@/services/ai/property-data";

/** Startet eine Bewertung als Hintergrundauftrag (Berechtigung mit dem Benutzer-Client geprüft). */
export async function requestValuationJob(supabase: ServerSupabaseClient, user: SessionUser, propertyId: string): Promise<{ jobId: string }> {
  const property = await requireManagedProperty(supabase, user, propertyId);
  assertAvailable(
    await getFeatureAvailability({
      supabase,
      userId: user.id,
      flag: "valuation",
      quotaFeature: "valuation",
      requiresAi: false,
      requiresConsent: false,
    }),
  );
  const prerequisites = checkValuationPrerequisites(toValuationSubject(property));
  if (!prerequisites.ready) {
    const missing = prerequisites.items.filter((i) => !i.ok && i.blocking).map((i) => i.hint);
    throw new AppError("validation", `Für eine Bewertung fehlen noch Angaben: ${missing.join(" ")}`);
  }
  await enforceRateLimit(`valuation:${user.id}`, 4, 60);
  // KI-Erklärung nur mit konfiguriertem KI-Dienst und Einwilligung (Zahlen liefert immer der Provider)
  const withExplanation = isAiConfigured() && (await hasAiConsent(supabase, user.id));
  const job = await enqueueAndRun({ userId: user.id, type: "valuation", propertyId, input: { withExplanation }, maxAttempts: 3 });
  return { jobId: job.id };
}
