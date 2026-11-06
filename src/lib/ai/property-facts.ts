import {
  AMENITY_FLAGS,
  CONDITIONS,
  FEATURE_CATALOG,
  HEATING_TYPES,
  OWNERSHIP_TYPES,
  PROPERTY_TYPES,
  RENOVATION_CATEGORIES,
  cantonName,
  type FeatureKey,
} from "@/lib/constants";
import { formatArea, formatChf, formatDate, formatFloor, formatRooms } from "@/lib/format";
import type { Tables } from "@/types/database";

/**
 * Aufbereitung der erfassten Objektdaten für KI-Prompts.
 * Grundsatz: Es werden NUR vorhandene, vom Eigentümer erfasste Angaben übergeben.
 * Nie übergeben werden: exakte Adresse (Strasse, Hausnummer, Koordinaten, EGID),
 * interne Bezeichnung, Eigentümer- und Kontaktdaten.
 */

export type PropertyRow = Pick<
  Tables<"properties">,
  | "property_type"
  | "offer_type"
  | "postal_code"
  | "municipality"
  | "canton"
  | "rooms"
  | "living_area"
  | "gross_living_area"
  | "usable_area"
  | "plot_area"
  | "year_built"
  | "year_renovated"
  | "floor"
  | "floors_total"
  | "bathrooms"
  | "condition"
  | "heating_type"
  | "energy_label"
  | "energy_demand_kwh"
  | "has_balcony"
  | "has_terrace"
  | "has_garden"
  | "has_garage"
  | "has_elevator"
  | "has_cellar"
  | "has_attic"
  | "is_wheelchair_accessible"
  | "is_minergie"
  | "pets_allowed"
  | "garage_spaces"
  | "underground_parking_spaces"
  | "outdoor_parking_spaces"
  | "available_from"
  | "available_by_arrangement"
  | "service_charges"
  | "ownership_type"
  | "special_features"
  | "view_description"
>;

/** Spaltenliste für Abfragen (passend zu PropertyRow). */
export const PROPERTY_FACT_COLUMNS =
  "property_type, offer_type, postal_code, municipality, canton, rooms, living_area, gross_living_area, usable_area, plot_area, year_built, year_renovated, floor, floors_total, bathrooms, condition, heating_type, energy_label, energy_demand_kwh, has_balcony, has_terrace, has_garden, has_garage, has_elevator, has_cellar, has_attic, is_wheelchair_accessible, is_minergie, pets_allowed, garage_spaces, underground_parking_spaces, outdoor_parking_spaces, available_from, available_by_arrangement, service_charges, ownership_type, special_features, view_description";

export interface RenovationFact {
  year: number;
  category: string;
  description: string;
}

export interface PropertyFactsInput {
  property: PropertyRow;
  featureKeys: string[];
  renovations: RenovationFact[];
}

const LOCATION_GROUP = "Lage";

function isFeatureKey(key: string): key is FeatureKey {
  return Object.prototype.hasOwnProperty.call(FEATURE_CATALOG, key);
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Ausstattungsmerkmale (Spalten-Flags und Katalog), ohne Lagemerkmale. */
export function equipmentLabels(input: PropertyFactsInput): string[] {
  const flags = AMENITY_FLAGS.filter((flag) => input.property[flag.key]).map((flag) => flag.label);
  const catalog = input.featureKeys
    .filter(isFeatureKey)
    .filter((key) => FEATURE_CATALOG[key].group !== LOCATION_GROUP)
    .map((key) => FEATURE_CATALOG[key].label);
  return [...new Set([...flags, ...catalog])];
}

/** Lagemerkmale aus dem Katalog (z. B. Seesicht, Nähe ÖV) – nur wenn erfasst. */
export function locationLabels(featureKeys: string[]): string[] {
  return featureKeys
    .filter(isFeatureKey)
    .filter((key) => FEATURE_CATALOG[key].group === LOCATION_GROUP)
    .map((key) => FEATURE_CATALOG[key].label);
}

export function parkingSummary(property: Pick<PropertyRow, "garage_spaces" | "underground_parking_spaces" | "outdoor_parking_spaces">): string | null {
  const parts: string[] = [];
  if (property.garage_spaces > 0) parts.push(`${property.garage_spaces} ${property.garage_spaces === 1 ? "Garagenplatz" : "Garagenplätze"}`);
  if (property.underground_parking_spaces > 0)
    parts.push(`${property.underground_parking_spaces} ${property.underground_parking_spaces === 1 ? "Tiefgaragenplatz" : "Tiefgaragenplätze"}`);
  if (property.outdoor_parking_spaces > 0)
    parts.push(`${property.outdoor_parking_spaces} ${property.outdoor_parking_spaces === 1 ? "Aussenparkplatz" : "Aussenparkplätze"}`);
  return parts.length ? parts.join(", ") : null;
}

export function locationLabel(property: Pick<PropertyRow, "postal_code" | "municipality">): string | null {
  const label = [property.postal_code, property.municipality].filter(Boolean).join(" ").trim();
  return label || null;
}

/**
 * Objektfakten als Objekt mit deutschen Schlüsseln. Fehlende Angaben werden weggelassen
 * (nie als «unbekannt» oder Annahme übergeben).
 */
export function buildPropertyFacts(input: PropertyFactsInput): Record<string, unknown> {
  const p = input.property;
  const facts: Record<string, unknown> = {
    Angebot: p.offer_type === "rent" ? "Vermietung" : "Verkauf",
    Objektart: PROPERTY_TYPES[p.property_type]?.label ?? "Immobilie",
  };
  const add = (key: string, value: unknown) => {
    if (hasValue(value)) facts[key] = value;
  };

  add("Ort", locationLabel(p));
  add("Kanton", p.canton ? cantonName(p.canton) : null);
  add("Zimmer", p.rooms !== null ? formatRooms(p.rooms, false) : null);
  add("Wohnfläche", p.living_area !== null ? formatArea(p.living_area) : null);
  add("Bruttowohnfläche", p.gross_living_area !== null ? formatArea(p.gross_living_area) : null);
  add("Nutzfläche", p.usable_area !== null ? formatArea(p.usable_area) : null);
  add("Grundstücksfläche", p.plot_area !== null ? formatArea(p.plot_area) : null);
  add("Baujahr", p.year_built);
  add("Letzte Renovation (Jahr)", p.year_renovated);
  add("Stockwerk", p.floor !== null ? formatFloor(p.floor) : null);
  add("Anzahl Stockwerke", p.floors_total);
  add("Badezimmer", p.bathrooms);
  add("Zustand", p.condition ? CONDITIONS[p.condition] : null);
  add("Heizung", p.heating_type ? HEATING_TYPES[p.heating_type] : null);
  add("Energieetikette", p.energy_label);
  add("Energiebedarf", p.energy_demand_kwh !== null ? `${p.energy_demand_kwh} kWh/m² pro Jahr` : null);
  add("Eigentumsform", p.ownership_type ? OWNERSHIP_TYPES[p.ownership_type] : null);
  add("Ausstattung", equipmentLabels(input));
  add("Parkplätze", parkingSummary(p));
  add("Haustiere", p.pets_allowed === null ? null : p.pets_allowed ? "erlaubt" : "nicht erlaubt");
  add("Lagemerkmale", locationLabels(input.featureKeys));
  add("Aussicht (Angabe Eigentümer)", p.view_description?.trim());
  add(
    "Verfügbarkeit",
    p.available_by_arrangement ? "nach Vereinbarung" : p.available_from ? `ab ${formatDate(p.available_from)}` : null,
  );
  add("Nebenkosten pro Monat", p.service_charges !== null ? formatChf(p.service_charges) : null);
  add(
    "Renovationen",
    input.renovations
      .filter((r) => r.description?.trim())
      .sort((a, b) => b.year - a.year)
      .map((r) => ({
        Jahr: r.year,
        Bereich: RENOVATION_CATEGORIES[r.category as keyof typeof RENOVATION_CATEGORIES] ?? "Weiteres",
        Beschreibung: r.description.trim(),
      })),
  );
  add("Besonderheiten (Angabe Eigentümer)", p.special_features?.trim());
  return facts;
}

/** Hat das Objekt Lageangaben über den Ort hinaus? (sonst kein Lagetext mit Inhalt) */
export function hasLocationDetails(input: PropertyFactsInput): boolean {
  return locationLabels(input.featureKeys).length > 0 || Boolean(input.property.view_description?.trim());
}
