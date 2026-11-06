import { CACHE_READ_FACTOR, CACHE_WRITE_FACTOR, DEFAULT_MODEL_PRICING, FALLBACK_PRICING_MODEL, type ModelPricing } from "@/lib/ai/config";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
}

/** Sucht die Preise eines Modells (exakt oder über das Präfix, z. B. mit Datumssuffix). */
export function pricingFor(model: string, overrides: Record<string, ModelPricing> = {}): ModelPricing {
  const table = { ...DEFAULT_MODEL_PRICING, ...overrides };
  if (table[model]) return table[model];
  const prefix = Object.keys(table)
    .filter((key) => model.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];
  if (prefix && table[prefix]) return table[prefix];
  return table[FALLBACK_PRICING_MODEL] ?? { input: 3, output: 15 };
}

/**
 * Kostenschätzung in USD (5 Nachkommastellen, passend zu ai_usage_events.cost_usd).
 * Keine Abrechnung – nur zur Kostenkontrolle.
 */
export function estimateCostUsd(model: string, usage: TokenUsage, overrides: Record<string, ModelPricing> = {}): number {
  const pricing = pricingFor(model, overrides);
  const cacheRead = usage.cacheReadInputTokens ?? 0;
  const cacheWrite = usage.cacheCreationInputTokens ?? 0;
  const promptTokens = usage.inputTokens + cacheRead + cacheWrite;
  const long = pricing.longContextThreshold !== undefined && promptTokens > pricing.longContextThreshold;
  const inputPrice = long ? (pricing.longContextInput ?? pricing.input) : pricing.input;
  const outputPrice = long ? (pricing.longContextOutput ?? pricing.output) : pricing.output;
  const cost =
    (usage.inputTokens * inputPrice +
      cacheRead * inputPrice * CACHE_READ_FACTOR +
      cacheWrite * inputPrice * CACHE_WRITE_FACTOR +
      usage.outputTokens * outputPrice) /
    1_000_000;
  return Math.round(cost * 100_000) / 100_000;
}

/** Liest Preis-Überschreibungen aus feature_settings.ai_pricing (ungültige Einträge werden ignoriert). */
export function parsePricingOverrides(value: unknown): Record<string, ModelPricing> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, ModelPricing> = {};
  for (const [model, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    const input = Number(entry.input);
    const output = Number(entry.output);
    if (Number.isFinite(input) && Number.isFinite(output) && input >= 0 && output >= 0) {
      out[model] = { input, output };
    }
  }
  return out;
}
