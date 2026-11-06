import { PROPERTY_TYPES, cantonName } from "@/lib/constants";
import { formatArea, formatChf } from "@/lib/format";
import { AREA_LABELS, VALUATION_GROUPS, valuationGroupFor, type ValuationParams } from "@/lib/valuation/config";
import { areaOf, selectComparables, type SelectionResult } from "@/lib/valuation/comparables";
import {
  confidenceFor,
  formatPercent,
  listPriceStep,
  median,
  quartileDispersion,
  quartiles,
  roundEstimate,
  roundListPrice,
} from "@/lib/valuation/stats";
import type { DataQuality, OfferCandidate, ValuationEstimate, ValuationSubject } from "@/lib/valuation/types";

/**
 * Vergleichsbewertung auf Basis von Angebotspreisen (rein, deterministisch).
 * Zu wenige Vergleichsobjekte → Status insufficient_data OHNE Zahlen.
 */

/** Höchstens so viele Vergleichsobjekte werden gespeichert und angezeigt (die ähnlichsten). */
export const MAX_STORED_COMPARABLES = 25;

const DAY_MS = 86_400_000;

function baseQuality(subject: ValuationSubject, params: ValuationParams, considered: number): DataQuality {
  const group = valuationGroupFor(subject.propertyType);
  return {
    region: "none",
    radiusKm: null,
    canton: subject.canton,
    areaBasis: group ? VALUATION_GROUPS[group].area : "living",
    areaTolerance: params.area_tolerance,
    maxAgeDays: params.max_age_days,
    minComparables: params.min_comparables,
    candidatesConsidered: considered,
    sampleSize: 0,
    dispersion: null,
    pricePerSqm: null,
    observedFrom: null,
    observedTo: null,
    medianAgeDays: null,
    notes: [],
  };
}

const GENERAL_SUGGESTIONS = [
  "Sobald mehr vergleichbare Inserate auf Immovia veröffentlicht sind, kann eine Schätzung möglich werden. Starten Sie die Bewertung später erneut.",
  "Für eine belastbare Bewertung auf Basis tatsächlicher Verkaufspreise empfehlen wir eine Verkehrswertschätzung durch eine unabhängige Fachperson.",
];

function insufficient(
  subject: ValuationSubject,
  params: ValuationParams,
  considered: number,
  missing: string[],
  suggestions: string[],
  notes: string[] = [],
  sampleSize = 0,
): ValuationEstimate {
  return {
    status: "insufficient_data",
    priceBasis: "none",
    estimatedValue: null,
    valueLow: null,
    valueHigh: null,
    suggestedListPrice: null,
    listPriceExplanation: null,
    confidence: "none",
    confidenceExplanation: "Keine Schätzung: Die vorhandenen Daten reichen für eine belastbare Aussage nicht aus.",
    dataQuality: { ...baseQuality(subject, params, considered), sampleSize, notes },
    comparables: [],
    summary: "Noch keine belastbare Bewertung möglich.",
    missing,
    suggestions: [...suggestions, ...GENERAL_SUGGESTIONS],
  };
}

export function computeOfferEstimate(
  subject: ValuationSubject,
  candidates: OfferCandidate[],
  params: ValuationParams,
  now: Date = new Date(),
): ValuationEstimate {
  const group = valuationGroupFor(subject.propertyType);
  if (!group) {
    return insufficient(
      subject,
      params,
      candidates.length,
      [`Für die Objektart «${PROPERTY_TYPES[subject.propertyType].label}» ist ein Vergleich über Preise pro m² nicht aussagekräftig.`],
      ["Lassen Sie den Wert durch eine Fachperson schätzen."],
    );
  }
  const basis = VALUATION_GROUPS[group].area;
  const area = areaOf(subject, basis);
  if (!area) {
    return insufficient(subject, params, candidates.length, [`Die ${AREA_LABELS[basis]} ist nicht erfasst.`], [
      `Ergänzen Sie die ${AREA_LABELS[basis]} in den Objektdaten.`,
    ]);
  }
  const hasCoords = subject.latitude !== null && subject.longitude !== null;
  if (!hasCoords && !subject.canton) {
    return insufficient(subject, params, candidates.length, ["Der Standort (Koordinaten oder Kanton) ist nicht erfasst."], [
      "Ergänzen Sie die Adresse Ihrer Immobilie, damit vergleichbare Angebote in der Umgebung gefunden werden.",
    ]);
  }

  const notes: string[] = [];
  let region: "radius" | "canton" | null = null;
  let selection: SelectionResult | null = null;
  let bestCount = 0;

  if (hasCoords) {
    const radiusSelection = selectComparables(subject, candidates, { group, params, region: "radius", now });
    bestCount = radiusSelection.comparables.length;
    selection = radiusSelection;
    if (radiusSelection.comparables.length >= params.min_comparables) region = "radius";
  }
  if (!region && subject.canton) {
    const cantonSelection = selectComparables(subject, candidates, { group, params, region: "canton", now });
    bestCount = Math.max(bestCount, cantonSelection.comparables.length);
    if (cantonSelection.comparables.length >= params.min_comparables) {
      region = "canton";
      selection = cantonSelection;
      notes.push(
        hasCoords
          ? `Im Umkreis von ${params.radius_km} km gab es zu wenige Vergleichsangebote. Verglichen wurde deshalb mit dem ganzen Kanton ${cantonName(subject.canton)} – die Aussagekraft ist eingeschränkt.`
          : `Ohne Koordinaten wurde mit dem ganzen Kanton ${cantonName(subject.canton)} verglichen – die Aussagekraft ist eingeschränkt.`,
      );
    }
  }

  if (!region || !selection) {
    const missing = [
      `Es wurden ${bestCount === 1 ? "nur 1 vergleichbares Angebot" : `nur ${bestCount} vergleichbare Angebote`} gefunden, für eine Schätzung sind mindestens ${params.min_comparables} nötig.`,
    ];
    const suggestions = [
      hasCoords ? null : "Ergänzen Sie die genaue Adresse (Koordinaten), damit im Umkreis gesucht werden kann.",
      `Prüfen Sie Objektart und ${AREA_LABELS[basis]} – verglichen werden nur Angebote mit ähnlicher Fläche (±${Math.round(params.area_tolerance * 100)} %).`,
    ].filter((s): s is string => Boolean(s));
    return insufficient(subject, params, candidates.length, missing, suggestions, notes, bestCount);
  }

  const comparables = selection.comparables;
  const prices = comparables.map((c) => c.pricePerSqm);
  const q = quartiles(prices);
  const dispersion = quartileDispersion(q.p25, q.p75);
  const step = subject.offerType === "rent" ? 10 : 1000;
  const estimatedValue = Math.max(step, roundEstimate(q.median * area, subject.offerType));
  const valueLow = Math.max(step, Math.min(estimatedValue, roundEstimate(q.p25 * area, subject.offerType)));
  const valueHigh = Math.max(estimatedValue, roundEstimate(q.p75 * area, subject.offerType));
  const suggestedListPrice = roundListPrice(estimatedValue, subject.offerType);
  const confidence = confidenceFor({ sampleSize: comparables.length, dispersion, region, minComparables: params.min_comparables });

  if (selection.excludedImplausible > 0) {
    notes.push(
      `${selection.excludedImplausible} ${selection.excludedImplausible === 1 ? "Inserat wurde" : "Inserate wurden"} wegen unplausibler Preise pro m² nicht berücksichtigt.`,
    );
  }
  if (comparables.length > MAX_STORED_COMPARABLES) {
    notes.push(`Ausgewertet wurden ${comparables.length} Angebote; aufgeführt sind die ${MAX_STORED_COMPARABLES} ähnlichsten.`);
  }

  const dates = comparables.map((c) => c.observedAt).sort();
  const ages = comparables.map((c) => Math.max(0, Math.round((now.getTime() - new Date(c.observedAt).getTime()) / DAY_MS)));
  const rent = subject.offerType === "rent";
  const unit = rent ? "pro m² und Monat" : "pro m²";
  const regionText =
    region === "radius" ? `im Umkreis von ${params.radius_km} km` : `im Kanton ${cantonName(subject.canton)}`;

  const confidenceExplanation = [
    `Grundlage sind ${comparables.length} Angebotspreise ${regionText}; die Preise ${unit} streuen um ${formatPercent(dispersion)} (Quartilsdispersion).`,
    confidence === "medium"
      ? "Die Stichprobe ist gross und die Streuung gering."
      : "Wegen der kleinen Stichprobe, einer grösseren Streuung oder des erweiterten Vergleichsgebiets ist die Schätzung nur als grobe Orientierung zu verstehen.",
    "Weil Angebotspreise keine tatsächlich bezahlten Preise sind, ist der Vertrauensgrad höchstens «mittel».",
  ].join(" ");

  return {
    status: region === "radius" ? "completed" : "limited",
    priceBasis: "offer_prices",
    estimatedValue,
    valueLow,
    valueHigh,
    suggestedListPrice,
    listPriceExplanation: `Der mögliche Inseratepreis entspricht der Schätzung, gerundet auf ${formatChf(listPriceStep(estimatedValue, subject.offerType))}. Ein Aufschlag für Verhandlungsspielraum ist bewusst nicht eingerechnet, weil die Vergleichsbasis bereits aus Angebotspreisen besteht.`,
    confidence,
    confidenceExplanation,
    dataQuality: {
      ...baseQuality(subject, params, selection.considered),
      region,
      radiusKm: region === "radius" ? params.radius_km : null,
      sampleSize: comparables.length,
      dispersion: Math.round(dispersion * 1000) / 1000,
      pricePerSqm: {
        p25: Math.round(q.p25 * 100) / 100,
        median: Math.round(q.median * 100) / 100,
        p75: Math.round(q.p75 * 100) / 100,
      },
      observedFrom: dates[0] ?? null,
      observedTo: dates[dates.length - 1] ?? null,
      medianAgeDays: ages.length ? Math.round(median(ages)) : null,
      notes,
    },
    comparables: comparables.slice(0, MAX_STORED_COMPARABLES),
    summary: `Median der Angebotspreise ${regionText}: ${formatChf(Math.round(q.median * (rent ? 10 : 1)) / (rent ? 10 : 1))} ${unit}, multipliziert mit ${formatArea(area)} ${AREA_LABELS[basis]}. Die Spanne entspricht dem mittleren Bereich (25. bis 75. Perzentil) der Vergleichsangebote.`,
    missing: [],
    suggestions: [],
  };
}
