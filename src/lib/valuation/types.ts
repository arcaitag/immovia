import type { OfferType, PropertyType } from "@/lib/constants";
import type { Enums } from "@/types/database";

export type ValuationStatus = Enums<"valuation_status">;
export type ConfidenceLevel = Enums<"confidence_level">;
export type AreaBasis = "living" | "usable" | "plot";

/** Das zu bewertende Objekt (nur die für den Vergleich nötigen Angaben). */
export interface ValuationSubject {
  propertyId: string;
  propertyType: PropertyType;
  offerType: OfferType;
  livingArea: number | null;
  usableArea: number | null;
  plotArea: number | null;
  rooms: number | null;
  latitude: number | null;
  longitude: number | null;
  canton: string | null;
  municipality: string | null;
  postalCode: string | null;
}

/** Ein veröffentlichtes Inserat als möglicher Vergleich (Angebotspreis). */
export interface OfferCandidate {
  listingId: string;
  propertyId: string;
  propertyType: PropertyType;
  offerType: OfferType;
  price: number;
  livingArea: number | null;
  usableArea: number | null;
  plotArea: number | null;
  rooms: number | null;
  municipality: string | null;
  postalCode: string | null;
  canton: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Erstveröffentlichung (ISO) */
  publishedAt: string;
  isDemo: boolean;
}

export interface Comparable {
  listingId: string;
  propertyType: PropertyType;
  municipality: string | null;
  postalCode: string | null;
  rooms: number | null;
  area: number;
  price: number;
  pricePerSqm: number;
  /** YYYY-MM-DD */
  observedAt: string;
  distanceKm: number | null;
  similarity: number;
}

export interface ValuationFactor {
  key: string;
  label: string;
  detail: string;
  direction: "positive" | "negative";
}

export interface DataQuality {
  region: "radius" | "canton" | "none";
  radiusKm: number | null;
  canton: string | null;
  areaBasis: AreaBasis;
  areaTolerance: number;
  maxAgeDays: number;
  minComparables: number;
  candidatesConsidered: number;
  sampleSize: number;
  /** Quartilsdispersion (P75−P25)/(P75+P25) der Preise pro m² */
  dispersion: number | null;
  pricePerSqm: { p25: number; median: number; p75: number } | null;
  observedFrom: string | null;
  observedTo: string | null;
  medianAgeDays: number | null;
  notes: string[];
}

export interface ValuationEstimate {
  status: ValuationStatus;
  priceBasis: "offer_prices" | "none";
  estimatedValue: number | null;
  valueLow: number | null;
  valueHigh: number | null;
  suggestedListPrice: number | null;
  listPriceExplanation: string | null;
  confidence: ConfidenceLevel;
  confidenceExplanation: string;
  dataQuality: DataQuality;
  comparables: Comparable[];
  /** Deterministische Zusammenfassung (ohne KI) */
  summary: string;
  /** Bei fehlenden Daten: was fehlt bzw. was helfen würde */
  missing: string[];
  suggestions: string[];
}
