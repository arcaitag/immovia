import "server-only";

import { fail, ok, type ActionResult } from "@/lib/errors";
import { isAiConsentRequiredError } from "@/lib/ai/consent";

/**
 * Ergebnis von Server Actions mit KI-Bezug. Zusätzlich zu ActionResult wird eine fehlende
 * Einwilligung erkennbar gemeldet, damit die Oberfläche den Einwilligungsdialog zeigen und
 * die Aktion danach erneut auslösen kann.
 */
export type AiActionResult<T> = ActionResult<T> & { consentRequired?: boolean };

export async function runAiAction<T>(fn: () => Promise<T>, message?: string): Promise<AiActionResult<T>> {
  try {
    return ok(await fn(), message);
  } catch (error) {
    const result = fail(error);
    return isAiConsentRequiredError(error) ? { ...result, consentRequired: true } : result;
  }
}
