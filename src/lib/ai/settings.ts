import { utcToZurichParts, zurichLocalToUtc } from "@/lib/format";

/**
 * Plattform-Einstellungen für KI-Funktionen (feature_settings), ohne Server-Abhängigkeiten.
 * Ungültige oder fehlende Werte fallen auf die Standardwerte der Referenzdaten zurück.
 */

export interface AiQuotas {
  description_per_month: number;
  valuation_per_month: number;
  image_enhance_per_month: number;
  virtual_staging_per_month: number;
  assistant_messages_per_day: number;
}

export const DEFAULT_AI_QUOTAS: AiQuotas = {
  description_per_month: 30,
  valuation_per_month: 10,
  image_enhance_per_month: 200,
  virtual_staging_per_month: 0,
  assistant_messages_per_day: 40,
};

export interface FeatureFlags {
  valuation: boolean;
  ai_descriptions: boolean;
  image_ai: boolean;
  assistant: boolean;
  dossiers: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  valuation: true,
  ai_descriptions: true,
  image_ai: true,
  assistant: true,
  dossiers: true,
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function parseAiQuotas(value: unknown): AiQuotas {
  const raw = asRecord(value);
  const out = { ...DEFAULT_AI_QUOTAS };
  for (const key of Object.keys(DEFAULT_AI_QUOTAS) as (keyof AiQuotas)[]) {
    const n = Number(raw[key]);
    if (raw[key] !== undefined && raw[key] !== null && Number.isFinite(n) && n >= 0) out[key] = Math.floor(n);
  }
  return out;
}

export function parseFeatureFlags(value: unknown): FeatureFlags {
  const raw = asRecord(value);
  const out = { ...DEFAULT_FEATURE_FLAGS };
  for (const key of Object.keys(DEFAULT_FEATURE_FLAGS) as (keyof FeatureFlags)[]) {
    if (typeof raw[key] === "boolean") out[key] = raw[key] as boolean;
  }
  return out;
}

/** Kontingente je Funktion: Schlüssel in ai_quotas und Zeitraum. */
export type QuotaFeature = "description" | "valuation" | "image_enhance" | "virtual_staging" | "assistant";

export const QUOTA_RULES: Record<QuotaFeature, { key: keyof AiQuotas; period: "day" | "month"; unit: string }> = {
  description: { key: "description_per_month", period: "month", unit: "Texterstellungen" },
  valuation: { key: "valuation_per_month", period: "month", unit: "Bewertungen" },
  image_enhance: { key: "image_enhance_per_month", period: "month", unit: "Bildoptimierungen" },
  virtual_staging: { key: "virtual_staging_per_month", period: "month", unit: "KI-Visualisierungen" },
  assistant: { key: "assistant_messages_per_day", period: "day", unit: "Nachrichten" },
};

/** Beginn und Ende des aktuellen Kontingent-Zeitraums (Kalendertag bzw. -monat in Zürcher Zeit). */
export function quotaPeriod(period: "day" | "month", now: Date = new Date()): { start: Date; end: Date } {
  const { date } = utcToZurichParts(now);
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  if (period === "day") {
    const start = zurichLocalToUtc(date, "00:00");
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    const nextDate = next.toISOString().slice(0, 10);
    return { start, end: zurichLocalToUtc(nextDate, "00:00") };
  }
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextMonth = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  return { start: zurichLocalToUtc(monthStart, "00:00"), end: zurichLocalToUtc(nextMonth, "00:00") };
}

export interface QuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  period: "day" | "month";
  resetsAt: string;
  unit: string;
}

export function buildQuotaStatus(feature: QuotaFeature, quotas: AiQuotas, used: number, now: Date = new Date()): QuotaStatus {
  const rule = QUOTA_RULES[feature];
  const limit = quotas[rule.key];
  const { end } = quotaPeriod(rule.period, now);
  return { used, limit, remaining: Math.max(0, limit - used), period: rule.period, resetsAt: end.toISOString(), unit: rule.unit };
}
