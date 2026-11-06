"use server";

import { assertUser } from "@/lib/auth/session";
import { runAction, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { requestValuationJob } from "@/services/ai/valuations";

/** Startet eine Bewertung (Hintergrundauftrag, Status über /api/jobs/[jobId]). */
export async function startValuationAction(propertyId: string): Promise<ActionResult<{ jobId: string }>> {
  return runAction(async () => {
    const user = await assertUser();
    const supabase = await createClient();
    return requestValuationJob(supabase, user, propertyId);
  });
}
