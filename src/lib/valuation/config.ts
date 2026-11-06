import type { PropertyType } from "@/lib/constants";

/**
 * Parameter und Texte der Immobilienbewertung (ohne Server-Abhängigkeiten).
 */

export interface ValuationParams {
  /** Mindestanzahl Vergleichsobjekte, sonst keine Zahl */
  min_comparables: number;
  /** Maximales Alter eines Inserats (ab Erstveröffentlichung) */
  max_age_days: number;
  /** Umkreis um die Objektkoordinaten */
  radius_km: number;
  /** Zulässige Abweichung der Fläche (0.35 = ±35 %) */
  area_tolerance: number;
}

export const DEFAULT_VALUATION_PARAMS: ValuationParams = {
  min_comparables: 5,
  max_age_days: 365,
  radius_km: 15,
  area_tolerance: 0.35,
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (value === null || value === undefined || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Liest feature_settings.valuation. Unter 3 Vergleichsobjekten wird nie gerechnet. */
export function parseValuationParams(value: unknown): ValuationParams {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    min_comparables: Math.round(clampNumber(raw.min_comparables, 3, 100, DEFAULT_VALUATION_PARAMS.min_comparables)),
    max_age_days: Math.round(clampNumber(raw.max_age_days, 30, 1095, DEFAULT_VALUATION_PARAMS.max_age_days)),
    radius_km: clampNumber(raw.radius_km, 1, 100, DEFAULT_VALUATION_PARAMS.radius_km),
    area_tolerance: clampNumber(raw.area_tolerance, 0.05, 0.8, DEFAULT_VALUATION_PARAMS.area_tolerance),
  };
}

/**
 * Vergleichsgruppen: nur ähnliche Objektarten werden verglichen.
 * Neubauprojekte und «Weitere» sind nicht sinnvoll pro m² vergleichbar.
 */
export type ValuationGroup = "apartment" | "house" | "multi_family" | "plot" | "commercial";

export const VALUATION_GROUPS: Record<ValuationGroup, { label: string; types: PropertyType[]; area: "living" | "usable" | "plot" }> = {
  apartment: { label: "Wohnungen", types: ["apartment"], area: "living" },
  house: { label: "Einfamilien-, Doppel- und Reihenhäuser", types: ["single_family_house", "semi_detached_house", "terraced_house"], area: "living" },
  multi_family: { label: "Mehrfamilienhäuser", types: ["multi_family_house"], area: "living" },
  plot: { label: "Grundstücke", types: ["plot"], area: "plot" },
  commercial: { label: "Gewerbe- und Büroflächen", types: ["commercial", "office"], area: "usable" },
};

export function valuationGroupFor(type: PropertyType): ValuationGroup | null {
  for (const [group, def] of Object.entries(VALUATION_GROUPS) as [ValuationGroup, (typeof VALUATION_GROUPS)[ValuationGroup]][]) {
    if (def.types.includes(type)) return group;
  }
  return null;
}

export const AREA_LABELS: Record<"living" | "usable" | "plot", string> = {
  living: "Wohnfläche",
  usable: "Nutzfläche",
  plot: "Grundstücksfläche",
};

export const PLATFORM_OFFERS_PROVIDER = {
  id: "platform_offers",
  label: "Vergleich mit Angebotspreisen auf Immovia",
  method: "Median der Angebotspreise pro m² vergleichbarer Inserate",
  sourceName: "Angebotspreise auf Immovia",
  sourceDescription:
    "Veröffentlichte, echte Inserate auf Immovia (ohne Demo-Inserate) mit vergleichbarer Objektart, Fläche und Lage. Es handelt sich um Angebotspreise, keine Transaktionspreise.",
  licenseNote: "Eigene Plattformdaten. Angebotspreise sind keine Transaktionspreise.",
} as const;

export const VALUATION_DISCLAIMER =
  "Diese Schätzung basiert ausschliesslich auf Angebotspreisen vergleichbarer Inserate auf Immovia und nicht auf tatsächlich bezahlten Kaufpreisen (Transaktionspreisen). Sie ersetzt keine professionelle Verkehrswertschätzung durch eine unabhängige Fachperson und ist keine Grundlage für Finanzierungs-, Steuer- oder Rechtsentscheide. Alle Angaben ohne Gewähr.";

export const NO_DATA_DISCLAIMER =
  "Ohne ausreichend vergleichbare Daten zeigt Immovia bewusst keine Zahl an. Eine professionelle Verkehrswertschätzung erhalten Sie bei einer unabhängigen Fachperson.";
