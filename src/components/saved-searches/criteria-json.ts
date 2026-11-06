import { searchCriteriaSchema, toSavedCriteria, type SearchCriteria } from "@/lib/search/criteria";

/**
 * Liest gespeicherte Suchkriterien (saved_searches.criteria, JSON) feldweise ein.
 * Ungültige oder unbekannte Felder werden verworfen, statt den ganzen Suchauftrag unbrauchbar zu machen.
 */
export function criteriaFromJson(value: unknown): SearchCriteria {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const shape = searchCriteriaSchema.shape;
  const result: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const fieldSchema = shape[key as keyof typeof shape];
    if (!fieldSchema) continue;
    const parsed = fieldSchema.safeParse(raw);
    if (parsed.success && parsed.data !== undefined) result[key] = parsed.data;
  }
  return result as SearchCriteria;
}

/** Bereinigte Kriterien für die Speicherung (nur gültige, gesetzte Werte). */
export function criteriaForStorage(value: unknown): Record<string, unknown> {
  return toSavedCriteria(criteriaFromJson(value));
}

export const ALERT_FREQUENCIES = {
  instant: { label: "Sofort", description: "Sobald ein passendes Inserat veröffentlicht wird" },
  daily: { label: "Täglich", description: "Eine Zusammenfassung pro Tag" },
  weekly: { label: "Wöchentlich", description: "Eine Zusammenfassung pro Woche" },
} as const;
export type AlertFrequency = keyof typeof ALERT_FREQUENCIES;

export function isAlertFrequency(value: unknown): value is AlertFrequency {
  return typeof value === "string" && value in ALERT_FREQUENCIES;
}
