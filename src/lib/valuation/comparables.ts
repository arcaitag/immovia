import type { OfferType } from "@/lib/constants";
import { VALUATION_GROUPS, type ValuationGroup, type ValuationParams } from "@/lib/valuation/config";
import { haversineKm } from "@/lib/valuation/geo";
import type { AreaBasis, Comparable, OfferCandidate, ValuationSubject } from "@/lib/valuation/types";

/**
 * Auswahl vergleichbarer Angebote (rein, deterministisch).
 * Kriterien: echte Inserate (keine Demo), nicht das eigene Objekt, gleicher Angebotstyp,
 * gleiche Vergleichsgruppe, Fläche ± Toleranz, nicht älter als max_age_days,
 * Region (Umkreis bzw. Kanton), plausibler Preis pro m².
 */

export function areaOf(
  item: Pick<ValuationSubject, "livingArea" | "usableArea" | "plotArea">,
  basis: AreaBasis,
): number | null {
  const value = basis === "living" ? item.livingArea : basis === "usable" ? (item.usableArea ?? item.livingArea) : item.plotArea;
  return value !== null && Number.isFinite(value) && value > 0 ? value : null;
}

/** Plausible Preise pro m² (Schutz vor Tippfehlern wie fehlenden Nullen). */
export function plausiblePricePerSqm(offerType: OfferType, basis: AreaBasis): { min: number; max: number } {
  if (offerType === "rent") return basis === "plot" ? { min: 0.1, max: 100 } : { min: 3, max: 150 };
  if (basis === "plot") return { min: 20, max: 20_000 };
  if (basis === "usable") return { min: 300, max: 30_000 };
  return { min: 1_000, max: 40_000 };
}

export interface SelectionResult {
  comparables: Comparable[];
  /** Anzahl Kandidaten vor den Filtern */
  considered: number;
  excludedImplausible: number;
}

const DAY_MS = 86_400_000;

export function selectComparables(
  subject: ValuationSubject,
  candidates: OfferCandidate[],
  options: { group: ValuationGroup; params: ValuationParams; region: "radius" | "canton"; now: Date },
): SelectionResult {
  const { group, params, region, now } = options;
  const basis = VALUATION_GROUPS[group].area;
  const types = VALUATION_GROUPS[group].types;
  const subjectArea = areaOf(subject, basis);
  const bounds = plausiblePricePerSqm(subject.offerType, basis);
  const cutoff = now.getTime() - params.max_age_days * DAY_MS;
  let excludedImplausible = 0;

  if (!subjectArea) return { comparables: [], considered: candidates.length, excludedImplausible: 0 };

  const comparables: Comparable[] = [];
  for (const c of candidates) {
    if (c.isDemo) continue;
    if (c.propertyId === subject.propertyId) continue;
    if (c.offerType !== subject.offerType) continue;
    if (!types.includes(c.propertyType)) continue;
    if (!(c.price > 0)) continue;
    const published = new Date(c.publishedAt).getTime();
    if (!Number.isFinite(published) || published < cutoff || published > now.getTime() + DAY_MS) continue;
    const area = areaOf(c, basis);
    if (!area) continue;
    if (Math.abs(area - subjectArea) / subjectArea > params.area_tolerance) continue;

    let distanceKm: number | null = null;
    if (subject.latitude !== null && subject.longitude !== null && c.latitude !== null && c.longitude !== null) {
      distanceKm = haversineKm(subject.latitude, subject.longitude, c.latitude, c.longitude);
    }
    if (region === "radius") {
      if (distanceKm === null || distanceKm > params.radius_km) continue;
    } else {
      if (!subject.canton || c.canton !== subject.canton) continue;
    }

    const pricePerSqm = c.price / area;
    if (pricePerSqm < bounds.min || pricePerSqm > bounds.max) {
      excludedImplausible++;
      continue;
    }

    const areaDiff = Math.abs(area - subjectArea) / subjectArea / params.area_tolerance;
    const distanceScore = distanceKm === null ? 0.5 : Math.min(1, distanceKm / params.radius_km);
    const roomsDiff = subject.rooms !== null && c.rooms !== null ? Math.min(1, Math.abs(subject.rooms - c.rooms) / 3) : 0.5;
    const similarity = Math.max(0, Math.min(1, 1 - (0.5 * areaDiff + 0.3 * distanceScore + 0.2 * roomsDiff)));

    comparables.push({
      listingId: c.listingId,
      propertyType: c.propertyType,
      municipality: c.municipality,
      postalCode: c.postalCode,
      rooms: c.rooms,
      area,
      price: c.price,
      pricePerSqm,
      observedAt: new Date(published).toISOString().slice(0, 10),
      distanceKm: distanceKm === null ? null : Math.round(distanceKm * 100) / 100,
      similarity: Math.round(similarity * 1000) / 1000,
    });
  }
  comparables.sort((a, b) => b.similarity - a.similarity || a.pricePerSqm - b.pricePerSqm);
  return { comparables, considered: candidates.length, excludedImplausible };
}
