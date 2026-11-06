import { z } from "zod";
import { PROPERTY_TYPES, cantonName, type PropertyType } from "@/lib/constants";
import { formatDate, formatNumber } from "@/lib/format";
import { AREA_LABELS } from "@/lib/valuation/config";
import { CONFIDENCE_LABELS, SOURCE_TYPE_LABELS, VALUATION_STATUS_LABELS } from "@/lib/valuation/labels";
import { formatPercent } from "@/lib/valuation/stats";
import type { ValuationReportContent } from "@/lib/pdf/valuation/document";
import type { AreaBasis, ValuationFactor } from "@/lib/valuation/types";
import type { Tables } from "@/types/database";

/**
 * Aufbereitung gespeicherter Bewertungen für Oberfläche und PDF (rein, ohne Server-Abhängigkeiten).
 */

const factorSchema = z.object({
  key: z.string(),
  label: z.string(),
  detail: z.string().catch(""),
  direction: z.enum(["positive", "negative"]),
});

const qualitySchema = z.object({
  region: z.enum(["radius", "canton", "none"]).catch("none"),
  radiusKm: z.number().nullable().catch(null),
  canton: z.string().nullable().catch(null),
  areaBasis: z.enum(["living", "usable", "plot"]).catch("living"),
  areaTolerance: z.number().catch(0.35),
  maxAgeDays: z.number().catch(365),
  minComparables: z.number().catch(5),
  candidatesConsidered: z.number().catch(0),
  sampleSize: z.number().catch(0),
  dispersion: z.number().nullable().catch(null),
  pricePerSqm: z.object({ p25: z.number(), median: z.number(), p75: z.number() }).nullable().catch(null),
  observedFrom: z.string().nullable().catch(null),
  observedTo: z.string().nullable().catch(null),
  medianAgeDays: z.number().nullable().catch(null),
  notes: z.array(z.string()).catch([]),
  summary: z.string().nullable().catch(null),
  listPriceExplanation: z.string().nullable().catch(null),
  missing: z.array(z.string()).catch([]),
  suggestions: z.array(z.string()).catch([]),
});
export type StoredDataQuality = z.infer<typeof qualitySchema>;

export function parseDataQuality(value: unknown): StoredDataQuality {
  return qualitySchema.parse(value && typeof value === "object" ? value : {});
}

export function parseFactors(value: unknown): ValuationFactor[] {
  const parsed = z.array(factorSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function areaLabelFor(basis: AreaBasis): string {
  return AREA_LABELS[basis];
}

/** Qualitätsangaben als Liste (Label/Wert) für UI und PDF. */
export function qualityRows(quality: StoredDataQuality): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (quality.region !== "none") {
    rows.push({
      label: "Vergleichsgebiet",
      value: quality.region === "radius" ? `Umkreis von ${formatNumber(quality.radiusKm ?? 0)} km` : `Kanton ${cantonName(quality.canton)}`,
    });
  }
  rows.push({ label: "Verwendete Vergleichsangebote", value: `${quality.sampleSize} (mindestens ${quality.minComparables} nötig)` });
  rows.push({ label: "Vergleichsfläche", value: `${AREA_LABELS[quality.areaBasis]} ±${Math.round(quality.areaTolerance * 100)} %` });
  rows.push({ label: "Maximales Alter der Inserate", value: `${quality.maxAgeDays} Tage` });
  if (quality.observedFrom && quality.observedTo) {
    rows.push({ label: "Inseriert zwischen", value: `${formatDate(quality.observedFrom)} und ${formatDate(quality.observedTo)}` });
  }
  if (quality.dispersion !== null) rows.push({ label: "Streuung der Preise pro m²", value: formatPercent(quality.dispersion) });
  return rows;
}

export interface ValuationDetail {
  valuation: Tables<"property_valuations">;
  sources: Tables<"valuation_sources">[];
  comparables: Tables<"valuation_comparables">[];
}

export function buildValuationReportContent(
  detail: ValuationDetail,
  property: Pick<Tables<"properties">, "property_type" | "offer_type" | "rooms" | "postal_code" | "municipality" | "internal_name">,
): ValuationReportContent {
  const v = detail.valuation;
  const quality = parseDataQuality(v.data_quality);
  const hasNumbers = (v.status === "completed" || v.status === "limited") && v.estimated_value !== null;
  const typeLabel = PROPERTY_TYPES[property.property_type].label;
  const title = [typeLabel, property.rooms !== null && property.property_type !== "plot" ? `${formatNumber(property.rooms, 1)} Zimmer` : null]
    .filter(Boolean)
    .join(" · ");
  return {
    propertyTitle: title,
    locationLabel: [property.postal_code, property.municipality].filter(Boolean).join(" ") || "Schweiz",
    rent: property.offer_type === "rent",
    createdAt: v.created_at,
    statusLabel: VALUATION_STATUS_LABELS[v.status].label,
    hasNumbers,
    estimatedValue: hasNumbers ? Number(v.estimated_value) : null,
    valueLow: hasNumbers && v.value_low !== null ? Number(v.value_low) : null,
    valueHigh: hasNumbers && v.value_high !== null ? Number(v.value_high) : null,
    suggestedListPrice: hasNumbers && v.suggested_list_price !== null ? Number(v.suggested_list_price) : null,
    listPriceExplanation: quality.listPriceExplanation,
    confidenceLabel: CONFIDENCE_LABELS[v.confidence].label,
    confidenceExplanation: v.confidence_explanation,
    summary: hasNumbers ? quality.summary : null,
    explanation: v.explanation,
    quality: qualityRows(quality),
    notes: quality.notes,
    missing: quality.missing,
    suggestions: quality.suggestions,
    sources: detail.sources.map((s) => ({
      name: s.name,
      typeLabel: SOURCE_TYPE_LABELS[s.source_type] ?? s.source_type,
      description: s.description,
      dataAsOf: s.data_as_of,
      recordCount: s.record_count,
      licenseNote: s.license_note,
    })),
    comparables: detail.comparables.map((c) => ({
      location: [c.postal_code, c.municipality].filter(Boolean).join(" ") || "–",
      typeLabel: c.property_type ? PROPERTY_TYPES[c.property_type as PropertyType].label : "–",
      rooms: c.rooms !== null ? Number(c.rooms) : null,
      area: c.living_area !== null ? Number(c.living_area) : null,
      price: Number(c.price),
      pricePerSqm: c.price_per_sqm !== null ? Number(c.price_per_sqm) : null,
      observedAt: c.observed_at,
      distanceKm: c.distance_km !== null ? Number(c.distance_km) : null,
    })),
    areaLabel: AREA_LABELS[quality.areaBasis],
    positive: parseFactors(v.positive_factors),
    negative: parseFactors(v.negative_factors),
    disclaimer: v.disclaimer,
  };
}
