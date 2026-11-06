import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

vi.mock("server-only", () => ({}));

const { AI_CONSENT_REQUIRED_MESSAGE, aiConsentRequiredError, assertAiConsent, isAiConsentRequiredError, readAiConsent } = await import(
  "@/lib/ai/consent"
);
const { runAiAction } = await import("@/services/ai/action");
const { AppError } = await import("@/lib/errors");

/** Minimaler Supabase-Ersatz für user_preferences.select().eq().maybeSingle(). */
function fakeClient(result: { data: { ai_processing_consent: boolean } | null; error: { message: string } | null }) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => result,
  };
  return { from: () => chain } as unknown as SupabaseClient<Database>;
}

describe("Einwilligung zur KI-Verarbeitung", () => {
  it("gilt nur bei ausdrücklichem true als erteilt", async () => {
    expect(await readAiConsent(fakeClient({ data: { ai_processing_consent: true }, error: null }), "u1")).toBe(true);
    expect(await readAiConsent(fakeClient({ data: { ai_processing_consent: false }, error: null }), "u1")).toBe(false);
    // Fehlende Zeile oder Lesefehler: keine Einwilligung (Standard ist «aus»)
    expect(await readAiConsent(fakeClient({ data: null, error: null }), "u1")).toBe(false);
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await readAiConsent(fakeClient({ data: null, error: { message: "kaputt" } }), "u1")).toBe(false);
    spy.mockRestore();
  });

  it("blockiert KI-Aufrufe ohne Einwilligung oder ohne Benutzerbezug", async () => {
    await expect(assertAiConsent("u1", fakeClient({ data: { ai_processing_consent: true }, error: null }))).resolves.toBeUndefined();
    await expect(assertAiConsent("u1", fakeClient({ data: { ai_processing_consent: false }, error: null }))).rejects.toMatchObject({
      code: "invalid_state",
      message: AI_CONSENT_REQUIRED_MESSAGE,
      details: { consentRequired: true },
    });
    await expect(assertAiConsent(null, fakeClient({ data: { ai_processing_consent: true }, error: null }))).rejects.toSatisfy(isAiConsentRequiredError);
  });

  it("meldet die fehlende Einwilligung erkennbar an die Oberfläche", async () => {
    const missing = await runAiAction(async () => {
      throw aiConsentRequiredError();
    });
    expect(missing).toMatchObject({ ok: false, code: "invalid_state", consentRequired: true, error: AI_CONSENT_REQUIRED_MESSAGE });

    const other = await runAiAction(async () => {
      throw new AppError("quota_exceeded");
    });
    expect(other).toMatchObject({ ok: false, code: "quota_exceeded" });
    expect("consentRequired" in other).toBe(false);

    expect(await runAiAction(async () => 42)).toEqual({ ok: true, data: 42, message: undefined });
    expect(isAiConsentRequiredError(new AppError("invalid_state"))).toBe(false);
  });
});
