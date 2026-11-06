"use server";

import { assertUser } from "@/lib/auth/session";
import { runAction, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { runAiAction, type AiActionResult } from "@/services/ai/action";
import {
  acceptImageEnhancement,
  renderImagePreview,
  requestImageAi,
  restoreOriginalImage,
  suggestImageAdjustments,
  type AdjustmentsInput,
} from "@/services/ai/images";

/** Vorschau der Optimierung (nicht gespeichert, Bildverarbeitung auf dem Server). */
export async function previewImageAction(imageId: string, adjustments: unknown): Promise<ActionResult<{ dataUrl: string; width: number; height: number }>> {
  return runAction(async () => {
    const user = await assertUser();
    const supabase = await createClient();
    return renderImagePreview(supabase, user, imageId, adjustments);
  });
}

/** «Automatisch optimieren»: Vorschlag aus der Bildstatistik (keine KI). */
export async function suggestAdjustmentsAction(imageId: string): Promise<ActionResult<AdjustmentsInput>> {
  return runAction(async () => {
    const user = await assertUser();
    const supabase = await createClient();
    return suggestImageAdjustments(supabase, user, imageId);
  });
}

/** «Übernehmen»: optimierte Varianten speichern, das Original bleibt erhalten. */
export async function acceptEnhancementAction(imageId: string, adjustments: unknown): Promise<ActionResult<{ displayPath: string }>> {
  return runAction(async () => {
    const user = await assertUser();
    const supabase = await createClient();
    return acceptImageEnhancement(supabase, user, imageId, adjustments);
  }, "Die Optimierung wurde übernommen.");
}

/** «Original wiederherstellen». */
export async function restoreOriginalAction(imageId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const supabase = await createClient();
    await restoreOriginalImage(supabase, user, imageId);
    return null;
  }, "Das Original wird wieder angezeigt.");
}

/** Auftrag an einen externen Bild-KI-Anbieter (nur wenn eingerichtet; Ergebnis als neues Bild). */
export async function requestImageAiAction(input: unknown): Promise<AiActionResult<{ jobId: string }>> {
  return runAiAction(async () => {
    const user = await assertUser();
    const supabase = await createClient();
    return requestImageAi(supabase, user, input);
  });
}
