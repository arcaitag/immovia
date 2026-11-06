import { PROPERTY_TYPES, cantonName, type OfferType, type PropertyType } from "@/lib/constants";
import { formatArea, formatChf } from "@/lib/format";
import { AREA_LABELS } from "@/lib/valuation/config";
import { CONFIDENCE_LABELS } from "@/lib/valuation/labels";
import { formatPercent } from "@/lib/valuation/stats";
import type { ValuationEstimate, ValuationFactor } from "@/lib/valuation/types";

/**
 * Optionale KI-Erklärung einer bereits berechneten Bewertung.
 * Das Modell rechnet nichts und erhält nur die berechneten Daten.
 */

export const VALUATION_EXPLANATION_SYSTEM_PROMPT = [
  "Sie erklären Privatpersonen in der Schweiz eine bereits berechnete Immobilien-Schätzung von Immovia.",
  "Regeln:",
  "- Verwenden Sie nur die Angaben in DATEN. Rechnen Sie nichts neu und nennen Sie keine Zahl, die nicht in DATEN steht.",
  "- Machen Sie klar, dass die Schätzung auf Angebotspreisen beruht und nicht auf tatsächlich bezahlten Preisen.",
  "- Erklären Sie Spanne und Vertrauensgrad verständlich. Die Wertfaktoren sind qualitativ und nicht eingerechnet.",
  "- Keine verbindliche Finanz-, Steuer- oder Rechtsberatung, keine Kaufs- oder Verkaufsempfehlung.",
  "- 4 bis 6 Sätze, Sie-Form, Schweizer Rechtschreibung (immer «ss», nie «ß»), kein Markdown, keine Aufzählung.",
].join("\n");

export interface ValuationExplanationInput {
  estimate: ValuationEstimate;
  offerType: OfferType;
  propertyType: PropertyType;
  area: number;
  canton: string | null;
  positive: ValuationFactor[];
  negative: ValuationFactor[];
}

export function buildValuationExplanationData(input: ValuationExplanationInput): Record<string, unknown> {
  const e = input.estimate;
  const q = e.dataQuality;
  const rent = input.offerType === "rent";
  return {
    Objektart: PROPERTY_TYPES[input.propertyType].label,
    Angebot: rent ? "Vermietung (Nettomiete pro Monat)" : "Verkauf",
    [AREA_LABELS[q.areaBasis]]: formatArea(input.area),
    Vergleichsgebiet: q.region === "radius" ? `Umkreis von ${q.radiusKm} km` : `Kanton ${cantonName(input.canton)}`,
    "Anzahl Vergleichsangebote": q.sampleSize,
    "Angebotspreis pro m² (Median)": q.pricePerSqm ? formatChf(q.pricePerSqm.median) : null,
    "Angebotspreise pro m² (25. bis 75. Perzentil)": q.pricePerSqm ? `${formatChf(q.pricePerSqm.p25)} bis ${formatChf(q.pricePerSqm.p75)}` : null,
    Streuung: q.dispersion !== null ? formatPercent(q.dispersion) : null,
    Schätzung: formatChf(e.estimatedValue),
    Spanne: `${formatChf(e.valueLow)} bis ${formatChf(e.valueHigh)}`,
    "Möglicher Inseratepreis": formatChf(e.suggestedListPrice),
    Vertrauensgrad: CONFIDENCE_LABELS[e.confidence].label,
    Hinweise: q.notes,
    "Positive Faktoren (qualitativ)": input.positive.map((f) => `${f.label}: ${f.detail}`),
    "Negative Faktoren (qualitativ)": input.negative.map((f) => `${f.label}: ${f.detail}`),
  };
}

export function buildValuationExplanationPrompt(input: ValuationExplanationInput): string {
  return `DATEN (JSON):\n${JSON.stringify(buildValuationExplanationData(input), null, 2)}\n\nAUFTRAG: Erklären Sie diese Schätzung in 4 bis 6 Sätzen.`;
}

function numberTokens(text: string): string[] {
  return (text.match(/\d+(?:[’'.,]\d+)*/g) ?? []).map((token) => token.replace(/[^\d]/g, "")).filter(Boolean);
}

/**
 * Prüft, ob alle grösseren Zahlen der KI-Antwort in den Daten vorkommen
 * (Schutz vor erfundenen Zahlen). Zahlen bis 12 sind erlaubt (Aufzählungen, Monate).
 */
export function numbersAreGrounded(output: string, source: string): boolean {
  const allowed = new Set(numberTokens(source));
  return numberTokens(output).every((token) => Number(token) <= 12 || allowed.has(token));
}
