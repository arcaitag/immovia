import type { OfferType } from "@/lib/constants";
import type { ConfidenceLevel } from "@/lib/valuation/types";

/**
 * Statistische Hilfsfunktionen der Vergleichsbewertung (rein, deterministisch).
 */

function sortedCopy(values: number[]): number[] {
  return values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
}

/** Quantil mit linearer Interpolation (Typ 7, wie Excel QUANTIL.INKL / R-Standard). */
export function quantile(values: number[], q: number): number {
  const sorted = sortedCopy(values);
  if (sorted.length === 0) throw new Error("quantile: keine Werte");
  if (q <= 0) return sorted[0]!;
  if (q >= 1) return sorted[sorted.length - 1]!;
  const pos = (sorted.length - 1) * q;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  const lowerValue = sorted[lower]!;
  const upperValue = sorted[upper]!;
  return lowerValue + (upperValue - lowerValue) * (pos - lower);
}

export function median(values: number[]): number {
  return quantile(values, 0.5);
}

export function quartiles(values: number[]): { p25: number; median: number; p75: number } {
  return { p25: quantile(values, 0.25), median: quantile(values, 0.5), p75: quantile(values, 0.75) };
}

/** Quartilsdispersionskoeffizient: robustes Streuungsmass, 0 = keine Streuung. */
export function quartileDispersion(p25: number, p75: number): number {
  if (p25 + p75 <= 0) return 0;
  return (p75 - p25) / (p75 + p25);
}

export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Rundung der Schätzwerte: Kauf auf CHF 1’000, Miete auf CHF 10. */
export function roundEstimate(value: number, offerType: OfferType): number {
  return offerType === "rent" ? roundTo(value, 10) : roundTo(value, 1000);
}

/** Schrittweite für den möglichen Inseratepreis («leicht gerundet»). */
export function listPriceStep(value: number, offerType: OfferType): number {
  if (offerType === "rent") return 10;
  if (value >= 1_000_000) return 10_000;
  if (value >= 300_000) return 5_000;
  return 1_000;
}

export function roundListPrice(value: number, offerType: OfferType): number {
  return roundTo(value, listPriceStep(value, offerType));
}

/**
 * Vertrauensgrad. Weil Angebots- keine Transaktionspreise sind, höchstens «mittel».
 * mittel: grosse Stichprobe (≥ 2× Minimum und ≥ 10), geringe Streuung (≤ 15 %) und Umkreisvergleich.
 * sonst: tief.
 */
export function confidenceFor(input: {
  sampleSize: number;
  dispersion: number;
  region: "radius" | "canton";
  minComparables: number;
}): Exclude<ConfidenceLevel, "high" | "none"> {
  const largeSample = input.sampleSize >= Math.max(10, input.minComparables * 2);
  if (largeSample && input.dispersion <= 0.15 && input.region === "radius") return "medium";
  return "low";
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)} %`;
}
