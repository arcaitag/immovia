import { HEATING_TYPES, RENOVATION_CATEGORIES } from "@/lib/constants";
import { parkingSummary, type PropertyRow, type RenovationFact } from "@/lib/ai/property-facts";
import type { ValuationFactor } from "@/lib/valuation/types";

/**
 * Qualitative Wertfaktoren aus den erfassten Objektdaten (deterministische Regeln).
 * Sie fliessen NICHT rechnerisch in die Schätzung ein, sondern erklären mögliche
 * Abweichungen vom Median der Vergleichsangebote.
 */

export type FactorInput = Pick<
  PropertyRow,
  | "property_type"
  | "condition"
  | "heating_type"
  | "energy_label"
  | "is_minergie"
  | "has_balcony"
  | "has_terrace"
  | "has_garden"
  | "has_garage"
  | "has_elevator"
  | "is_wheelchair_accessible"
  | "floor"
  | "floors_total"
  | "year_built"
  | "year_renovated"
  | "garage_spaces"
  | "underground_parking_spaces"
  | "outdoor_parking_spaces"
> & { featureKeys: string[]; renovations: RenovationFact[] };

const HOUSE_TYPES = new Set(["single_family_house", "semi_detached_house", "terraced_house"]);
const RESIDENTIAL_TYPES = new Set(["apartment", "single_family_house", "semi_detached_house", "terraced_house", "multi_family_house"]);

function latestRenovationYear(input: FactorInput): number | null {
  const years = [input.year_renovated, ...input.renovations.map((r) => r.year)].filter(
    (y): y is number => typeof y === "number" && Number.isFinite(y),
  );
  return years.length ? Math.max(...years) : null;
}

export function deriveValueFactors(input: FactorInput, now: Date = new Date()): { positive: ValuationFactor[]; negative: ValuationFactor[] } {
  const year = now.getFullYear();
  const positive: ValuationFactor[] = [];
  const negative: ValuationFactor[] = [];
  const add = (direction: "positive" | "negative", key: string, label: string, detail: string) =>
    (direction === "positive" ? positive : negative).push({ key, label, detail, direction });

  const lastRenovation = latestRenovationYear(input);
  if (lastRenovation !== null && lastRenovation >= year - 10) {
    const recent = input.renovations
      .filter((r) => r.year >= year - 10)
      .map((r) => RENOVATION_CATEGORIES[r.category as keyof typeof RENOVATION_CATEGORIES] ?? "Weiteres");
    const areas = [...new Set(recent)];
    add("positive", "recent_renovation", "Kürzlich renoviert", `Letzte erfasste Renovation ${lastRenovation}${areas.length ? ` (${areas.join(", ")})` : ""}.`);
  }
  if (input.condition === "new_build" || input.condition === "as_new") {
    add("positive", "condition_good", "Sehr guter Zustand", input.condition === "new_build" ? "Neubau bzw. Erstbezug." : "Zustand als neuwertig erfasst.");
  }
  if (input.energy_label === "A" || input.energy_label === "B") {
    add("positive", "energy_label_good", "Gute Energieeffizienz", `Energieetikette ${input.energy_label}.`);
  }
  if (input.is_minergie) add("positive", "minergie", "Minergie-Standard", "Das Gebäude ist als Minergie erfasst.");
  if (input.heating_type === "heat_pump" || input.heating_type === "district_heating" || input.heating_type === "solar") {
    add("positive", "modern_heating", "Zeitgemässe Wärmeerzeugung", `${HEATING_TYPES[input.heating_type]}.`);
  }
  const outdoor = [input.has_balcony && "Balkon", input.has_terrace && "Terrasse", input.has_garden && "Garten"].filter(Boolean) as string[];
  if (outdoor.length) add("positive", "outdoor_space", "Aussenraum", `${outdoor.join(", ")}.`);
  if (input.has_elevator && (input.property_type === "apartment" || (input.floors_total ?? 0) >= 3)) {
    add("positive", "elevator", "Lift", "Ein Lift ist vorhanden.");
  }
  const parking = parkingSummary(input);
  if (parking || input.has_garage) add("positive", "parking", "Parkplatz", parking ? `${parking}.` : "Garage vorhanden.");
  if (input.featureKeys.includes("lake_view") || input.featureKeys.includes("mountain_view")) {
    const views = [input.featureKeys.includes("lake_view") && "Seesicht", input.featureKeys.includes("mountain_view") && "Bergsicht"].filter(Boolean);
    add("positive", "view", "Aussicht", `${views.join(" und ")} (Angabe Eigentümer).`);
  }
  if (input.featureKeys.includes("quiet_location")) add("positive", "quiet_location", "Ruhige Lage", "Angabe Eigentümer.");
  if (input.featureKeys.includes("near_public_transport")) add("positive", "public_transport", "Nähe öffentlicher Verkehr", "Angabe Eigentümer.");
  if (input.is_wheelchair_accessible) add("positive", "accessible", "Rollstuhlgängig", "Hindernisfreier Zugang erfasst.");

  if (input.condition === "needs_renovation") add("negative", "needs_renovation", "Renovationsbedarf", "Zustand als renovationsbedürftig erfasst.");
  if (input.condition === "needs_refresh") add("negative", "needs_refresh", "Auffrischung nötig", "Zustand: Auffrischung nötig.");
  if (input.heating_type === "oil") add("negative", "oil_heating", "Ölheizung", "Fossile Heizung: absehbarer Ersatz und Energiekosten können den Preis drücken.");
  if (input.heating_type === "electric") add("negative", "electric_heating", "Elektroheizung", "Elektro-Direktheizungen sind teuer im Betrieb und oft ersatzpflichtig.");
  if (input.energy_label === "F" || input.energy_label === "G") {
    add("negative", "energy_label_poor", "Schwache Energieeffizienz", `Energieetikette ${input.energy_label}.`);
  }
  if (input.property_type === "apartment" && !input.has_elevator && (input.floor ?? 0) >= 3) {
    add("negative", "no_elevator", "Kein Lift", `Wohnung im ${input.floor}. OG ohne Lift.`);
  }
  if (input.year_built !== null && input.year_built <= year - 40 && (lastRenovation === null || lastRenovation < year - 25)) {
    add("negative", "old_building", "Älteres Gebäude ohne erfasste Renovation", `Baujahr ${input.year_built}, keine Renovation der letzten 25 Jahre erfasst.`);
  }
  if (RESIDENTIAL_TYPES.has(input.property_type) && input.property_type !== "multi_family_house" && outdoor.length === 0) {
    add("negative", "no_outdoor_space", "Kein Aussenraum erfasst", "Weder Balkon, Terrasse noch Garten erfasst.");
  }
  if (HOUSE_TYPES.has(input.property_type) && !parking && !input.has_garage) {
    add("negative", "no_parking", "Kein Parkplatz erfasst", "Für ein Haus ist kein Parkplatz erfasst.");
  }
  return { positive, negative };
}
