/**
 * Konfiguration der KI-Schicht (ohne Server-Abhängigkeiten, damit testbar).
 *
 * Modell: ANTHROPIC_MODEL, sonst DEFAULT_AI_MODEL.
 * Preise: konfigurierbare SCHÄTZUNG in USD pro 1 Mio. Tokens (Stand Planung, Quelle:
 * platform.claude.com/docs/en/about-claude/pricing). Massgebend ist die Rechnung von Anthropic.
 * Überschreibbar ohne Deployment über feature_settings.ai_pricing
 * (z. B. {"claude-sonnet-5-5": {"input": 2, "output": 10}}).
 */

export const DEFAULT_AI_MODEL = "claude-sonnet-5-5";

/** Aktuelle Modell-IDs (Auswahl, für Hinweise in der Administration). */
export const KNOWN_AI_MODELS = ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"] as const;

export type AiFeature = "description" | "valuation_explanation" | "assistant" | "image_enhance" | "virtual_staging" | "perspective";

/** Aufwand (Denktiefe) der Modelle der 5er-Generation. Geringer = schneller und günstiger. */
export type AiEffort = "low" | "medium" | "high";

export interface ModelPricing {
  /** USD pro 1 Mio. Input-Tokens */
  input: number;
  /** USD pro 1 Mio. Output-Tokens (inkl. Denk-Tokens) */
  output: number;
  /** Optional: höhere Preise ab dieser Prompt-Länge (Tokens) */
  longContextThreshold?: number;
  longContextInput?: number;
  longContextOutput?: number;
}

/** SCHÄTZUNG – siehe Kommentar oben. */
export const DEFAULT_MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, longContextThreshold: 100_000, longContextInput: 0.5, longContextOutput: 2.5 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-opus-4-5": { input: 5, output: 25 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

/** Für unbekannte Modelle wird vorsichtig mit den Preisen des Standardmodells gerechnet. */
export const FALLBACK_PRICING_MODEL = DEFAULT_AI_MODEL;

/** Faktoren für Prompt-Caching (relativ zum Input-Preis). */
export const CACHE_READ_FACTOR = 0.1;
export const CACHE_WRITE_FACTOR = 1.25;

/** Unterstützt das Modell den Parameter output_config.effort? */
export function supportsEffort(model: string): boolean {
  return /^claude-(opus|sonnet|haiku|fable|mythos)-5(\b|-|$)/.test(model) || /^claude-(opus-4-[5-8]|sonnet-4-6)/.test(model);
}

/** Zeitlimits und Wiederholungen. */
export const AI_LIMITS = {
  /** Timeout pro Anfrage in Millisekunden (ohne Streaming) */
  requestTimeoutMs: 120_000,
  /** Timeout bis zur ersten Antwort beim Streaming */
  streamTimeoutMs: 180_000,
  /** Maximale Versuche pro Anfrage (inkl. erstem Versuch) */
  maxAttempts: 3,
} as const;

export function resolveModel(envModel: string | undefined): string {
  const value = envModel?.trim();
  return value ? value : DEFAULT_AI_MODEL;
}
