"use server";

import { assertUser } from "@/lib/auth/session";
import { runAction, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { runAiAction, type AiActionResult } from "@/services/ai/action";
import { applyDescriptionSection, confirmListingTexts, requestDescriptionJob, type ApplyResult } from "@/services/ai/descriptions";

/** Texte erstellen bzw. einen Abschnitt neu formulieren (Hintergrundauftrag). */
export async function requestDescriptionAction(input: unknown): Promise<AiActionResult<{ jobId: string }>> {
  return runAiAction(async () => {
    const user = await assertUser();
    const supabase = await createClient();
    return requestDescriptionJob(supabase, user, input);
  });
}

/** Einen Abschnitt ins Inserat übernehmen (mit Schutz vor dem Überschreiben eigener Texte). */
export async function applyDescriptionSectionAction(input: unknown): Promise<ActionResult<ApplyResult>> {
  return runAction(async () => {
    const user = await assertUser();
    const supabase = await createClient();
    return applyDescriptionSection(supabase, user, input);
  });
}

/** Inseratetexte bestätigen (Voraussetzung für die Veröffentlichung). */
export async function confirmListingTextsAction(propertyId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const supabase = await createClient();
    await confirmListingTexts(supabase, user, propertyId);
    return null;
  }, "Die Texte sind bestätigt.");
}
