"use server";

import { revalidatePath } from "next/cache";
import { assertUser } from "@/lib/auth/session";
import { runAction, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { grantAiConsent } from "@/services/ai/consent";

/**
 * «Zustimmen und fortfahren» im Einwilligungsdialog: setzt ai_processing_consent (KI-Texte)
 * bzw. ai_image_consent (Bild-KI) auf true.
 */
export async function grantAiConsentAction(kind: unknown = "text"): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const supabase = await createClient();
    await grantAiConsent(supabase, user.id, kind === "image" ? "image" : "text");
    revalidatePath("/dashboard/einstellungen");
    return null;
  }, "Einwilligung gespeichert.");
}
