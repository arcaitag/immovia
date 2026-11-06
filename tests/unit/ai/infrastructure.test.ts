import { APIConnectionError, AuthenticationError, BadRequestError, InternalServerError, RateLimitError } from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_AI_MODEL, resolveModel, supportsEffort } from "@/lib/ai/config";
import { estimateCostUsd, parsePricingOverrides, pricingFor } from "@/lib/ai/cost";
import { backoffDelayMs, isRetryableError, withRetry } from "@/lib/ai/retry";
import { buildQuotaStatus, parseAiQuotas, parseFeatureFlags, quotaPeriod } from "@/lib/ai/settings";
import { isJobFinished } from "@/lib/ai/job-status";

// Die SDK-Konstruktoren erwarten Literal-Statuscodes (z. B. 429); für Tests reicht eine lose Signatur.
type ApiErrorConstructor<T> = new (...args: never[]) => T;

function apiError<T>(Ctor: ApiErrorConstructor<T>, status: number, headers = new Headers()): T {
  const Factory = Ctor as unknown as new (status: number, error: object, message: string, headers: Headers) => T;
  return new Factory(status, { type: "error" }, "Fehler", headers);
}

describe("Konfiguration", () => {
  it("verwendet claude-sonnet-5-5 als Standardmodell", () => {
    expect(DEFAULT_AI_MODEL).toBe("claude-sonnet-5-5");
    expect(resolveModel(undefined)).toBe("claude-sonnet-5-5");
    expect(resolveModel("  claude-opus-5-5 ")).toBe("claude-opus-5-5");
  });

  it("sendet den Aufwand nur an Modelle, die ihn unterstützen", () => {
    expect(supportsEffort("claude-sonnet-5-5")).toBe(true);
    expect(supportsEffort("claude-haiku-5-5")).toBe(true);
    expect(supportsEffort("claude-opus-4-6")).toBe(true);
    expect(supportsEffort("claude-3-haiku-20240307")).toBe(false);
  });
});

describe("Kostenschätzung", () => {
  it("rechnet mit der Preistabelle (USD pro Mio. Tokens)", () => {
    expect(estimateCostUsd("claude-sonnet-5-5", { inputTokens: 1_000_000, outputTokens: 100_000 })).toBe(3);
    expect(estimateCostUsd("claude-opus-5-5", { inputTokens: 10_000, outputTokens: 2_000 })).toBe(0.08);
  });

  it("berücksichtigt die Langkontext-Preise von Haiku 5.5", () => {
    expect(estimateCostUsd("claude-haiku-5-5", { inputTokens: 50_000, outputTokens: 1_000 })).toBeCloseTo(0.0055, 5);
    expect(estimateCostUsd("claude-haiku-5-5", { inputTokens: 200_000, outputTokens: 1_000 })).toBeCloseTo(0.1025, 5);
  });

  it("findet Modelle mit Datumssuffix und fällt sonst auf das Standardmodell zurück", () => {
    expect(pricingFor("claude-sonnet-4-5-20250929")).toEqual({ input: 3, output: 15 });
    expect(pricingFor("unbekanntes-modell")).toEqual(pricingFor(DEFAULT_AI_MODEL));
  });

  it("übernimmt gültige Preis-Überschreibungen aus feature_settings", () => {
    const overrides = parsePricingOverrides({ "claude-sonnet-5-5": { input: 1, output: 5 }, kaputt: { input: "x" } });
    expect(overrides).toEqual({ "claude-sonnet-5-5": { input: 1, output: 5 } });
    expect(estimateCostUsd("claude-sonnet-5-5", { inputTokens: 1_000_000, outputTokens: 0 }, overrides)).toBe(1);
  });
});

describe("Wiederholungen mit Backoff", () => {
  it("erkennt wiederholbare Fehler", () => {
    expect(isRetryableError(apiError(RateLimitError, 429))).toBe(true);
    expect(isRetryableError(apiError(InternalServerError, 529))).toBe(true);
    expect(isRetryableError(new APIConnectionError({ message: "weg" }))).toBe(true);
    expect(isRetryableError(apiError(BadRequestError, 400))).toBe(false);
    expect(isRetryableError(apiError(AuthenticationError, 401))).toBe(false);
    expect(isRetryableError(new Error("x"))).toBe(false);
  });

  it("wartet exponentiell länger und respektiert retry-after", async () => {
    expect(backoffDelayMs(1, 1000, 20_000, () => 0)).toBe(1000);
    expect(backoffDelayMs(3, 1000, 20_000, () => 0)).toBe(4000);
    expect(backoffDelayMs(10, 1000, 20_000, () => 0)).toBe(20_000);

    const sleep = vi.fn(async () => undefined);
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls === 1) throw apiError(RateLimitError, 429, new Headers({ "retry-after": "2" }));
        if (calls === 2) throw apiError(InternalServerError, 503);
        return "ok";
      },
      { maxAttempts: 3, sleep, random: () => 0 },
    );
    expect(result).toBe("ok");
    expect(sleep).toHaveBeenNthCalledWith(1, 2000);
    expect(sleep).toHaveBeenNthCalledWith(2, 2000);
  });

  it("wiederholt keine Konfigurationsfehler und gibt nach maxAttempts auf", async () => {
    const sleep = vi.fn(async () => undefined);
    await expect(withRetry(async () => Promise.reject(apiError(AuthenticationError, 401)), { maxAttempts: 3, sleep })).rejects.toBeInstanceOf(AuthenticationError);
    expect(sleep).not.toHaveBeenCalled();
    await expect(withRetry(async () => Promise.reject(apiError(RateLimitError, 429)), { maxAttempts: 2, sleep, random: () => 0 })).rejects.toBeInstanceOf(RateLimitError);
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});

describe("Einstellungen und Kontingente", () => {
  it("liest Kontingente und Schalter mit Standardwerten", () => {
    expect(parseAiQuotas({ description_per_month: 5, assistant_messages_per_day: -1 })).toMatchObject({ description_per_month: 5, assistant_messages_per_day: 40 });
    expect(parseFeatureFlags({ assistant: false, valuation: "ja" })).toMatchObject({ assistant: false, valuation: true });
  });

  it("berechnet Tages- und Monatszeiträume in Zürcher Zeit", () => {
    const now = new Date("2026-11-06T23:30:00Z"); // 07.11.2026 00:30 in Zürich
    expect(quotaPeriod("day", now).start.toISOString()).toBe("2026-11-06T23:00:00.000Z");
    expect(quotaPeriod("day", now).end.toISOString()).toBe("2026-11-07T23:00:00.000Z");
    expect(quotaPeriod("month", now).start.toISOString()).toBe("2026-10-31T23:00:00.000Z");
    expect(quotaPeriod("month", now).end.toISOString()).toBe("2026-11-30T23:00:00.000Z");
    const summer = quotaPeriod("month", new Date("2026-07-15T10:00:00Z"));
    expect(summer.start.toISOString()).toBe("2026-06-30T22:00:00.000Z");
  });

  it("berechnet den verbleibenden Verbrauch", () => {
    const status = buildQuotaStatus("description", parseAiQuotas({}), 28, new Date("2026-11-06T10:00:00Z"));
    expect(status).toMatchObject({ used: 28, limit: 30, remaining: 2, period: "month" });
    expect(buildQuotaStatus("assistant", parseAiQuotas({}), 50).remaining).toBe(0);
  });

  it("erkennt abgeschlossene Jobs", () => {
    expect(isJobFinished("succeeded")).toBe(true);
    expect(isJobFinished("failed")).toBe(true);
    expect(isJobFinished("running")).toBe(false);
    expect(isJobFinished(undefined)).toBe(false);
  });
});
