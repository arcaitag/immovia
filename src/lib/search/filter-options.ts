/**
 * Auswahlwerte der Suchfilter, gemeinsam für Website und App.
 * Die App erhält eine Kopie über mobile/scripts/sync-content.mjs – deshalb ohne Importe.
 */

type Offer = "sale" | "rent";

/** Kaufpreise in CHF */
export const PRICE_STEPS_SALE = [
  100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000, 1250000, 1500000, 1750000, 2000000,
  2500000, 3000000, 4000000, 5000000,
];
/** Monatsmieten in CHF (brutto) */
export const PRICE_STEPS_RENT = [500, 750, 1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000, 3500, 4000, 4500, 5000, 6000, 7000, 8000];

/** Ohne Angebotsart gelten Mieten und Kaufpreise gemeinsam. */
export function priceSteps(offer: Offer | null | undefined): number[] {
  if (offer === "rent") return PRICE_STEPS_RENT;
  if (offer === "sale") return PRICE_STEPS_SALE;
  return [...PRICE_STEPS_RENT, ...PRICE_STEPS_SALE];
}

export const ROOM_STEPS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 7, 8];
/** Wohnfläche in m² */
export const AREA_STEPS = [30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 175, 200, 250, 300, 400];
/** Grundstücksfläche in m² */
export const PLOT_STEPS = [200, 300, 400, 500, 600, 700, 800, 1000, 1200, 1500, 2000, 3000, 5000, 10000];
/** Baujahr ab */
export const YEAR_STEPS = [1900, 1950, 1960, 1970, 1980, 1990, 2000, 2005, 2010, 2015, 2020, 2024];
/** Umkreis in km */
export const RADIUS_STEPS = [2, 5, 10, 15, 20, 30, 50];

export type FeatureKey = "balcony" | "terrace" | "garden" | "parking" | "garage" | "elevator" | "wheelchair" | "new_build" | "minergie" | "pets";

/** Merkmale und Ausstattung (Schlüssel wie in den gespeicherten Suchkriterien) */
export const FEATURE_FILTERS: { key: FeatureKey; label: string; rentOnly?: boolean }[] = [
  { key: "balcony", label: "Balkon" },
  { key: "terrace", label: "Terrasse" },
  { key: "garden", label: "Garten" },
  { key: "parking", label: "Parkplatz" },
  { key: "garage", label: "Garage" },
  { key: "elevator", label: "Lift" },
  { key: "wheelchair", label: "Rollstuhlgängig" },
  { key: "new_build", label: "Neubau" },
  { key: "minergie", label: "Minergie" },
  { key: "pets", label: "Haustiere erlaubt", rentOnly: true },
];

function withCurrent(steps: number[], current: number | null | undefined): number[] {
  return current === null || current === undefined || steps.includes(current) ? steps : [...steps, current].sort((a, b) => a - b);
}

/** Werte für «von»: höchstens bis zum gewählten Maximum. Ein Wert ausserhalb der Liste (z. B. aus einem Link) bleibt wählbar. */
export function minOptions(steps: number[], current: number | null | undefined, max: number | null | undefined): number[] {
  return withCurrent(steps, current).filter((v) => max === null || max === undefined || v <= max);
}

/** Werte für «bis»: mindestens ab dem gewählten Minimum. */
export function maxOptions(steps: number[], current: number | null | undefined, min: number | null | undefined): number[] {
  return withCurrent(steps, current).filter((v) => min === null || min === undefined || v >= min);
}
