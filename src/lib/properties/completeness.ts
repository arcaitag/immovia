import type { OfferType, PropertyType } from "@/lib/constants";
import { typeGroup, type TypeGroup } from "@/lib/properties/fields";

/**
 * Vollständigkeit einer Immobilie: pro Objekttyp Pflicht- und empfohlene Felder.
 * Pflichtfelder zählen doppelt. Funktioniert mit Formularwerten (Strings) und
 * Datenbankwerten (Zahlen/null) gleichermassen.
 */

export type CompletenessField =
  | "street"
  | "house_number"
  | "postal_code"
  | "municipality"
  | "canton"
  | "rooms"
  | "bathrooms"
  | "living_area"
  | "usable_area"
  | "plot_area"
  | "year_built"
  | "floor"
  | "floors_total"
  | "condition"
  | "heating_type"
  | "energy_label"
  | "ownership_type"
  | "service_charges"
  | "available";

export const COMPLETENESS_LABELS: Record<CompletenessField, string> = {
  street: "Strasse",
  house_number: "Hausnummer",
  postal_code: "PLZ",
  municipality: "Gemeinde / Ort",
  canton: "Kanton",
  rooms: "Zimmerzahl",
  bathrooms: "Anzahl Badezimmer",
  living_area: "Nettowohnfläche",
  usable_area: "Nutzfläche",
  plot_area: "Grundstücksfläche",
  year_built: "Baujahr",
  floor: "Etage",
  floors_total: "Anzahl Stockwerke",
  condition: "Zustand",
  heating_type: "Heizungsart",
  energy_label: "GEAK-Klasse",
  ownership_type: "Eigentumsform",
  service_charges: "Nebenkosten",
  available: "Verfügbarkeit",
};

interface TypeRule {
  required: CompletenessField[];
  recommended: CompletenessField[];
}

const BUILDING_BASICS: CompletenessField[] = ["year_built", "condition", "heating_type"];

const TYPE_RULES: Record<TypeGroup, TypeRule> = {
  apartment: {
    required: ["rooms", "living_area", "floor"],
    recommended: ["bathrooms", "floors_total", ...BUILDING_BASICS, "energy_label"],
  },
  house: {
    required: ["rooms", "living_area", "plot_area"],
    recommended: ["bathrooms", "floors_total", ...BUILDING_BASICS, "energy_label"],
  },
  multi_family: {
    required: ["living_area", "plot_area"],
    recommended: ["rooms", "floors_total", ...BUILDING_BASICS, "energy_label"],
  },
  plot: {
    required: ["plot_area"],
    recommended: [],
  },
  commercial: {
    required: ["usable_area"],
    recommended: ["floor", "floors_total", ...BUILDING_BASICS],
  },
  office: {
    required: ["usable_area"],
    recommended: ["rooms", "floor", "floors_total", ...BUILDING_BASICS],
  },
  new_build: {
    required: ["rooms", "living_area"],
    recommended: ["bathrooms", "floors_total", "heating_type", "energy_label"],
  },
  other: {
    required: [],
    recommended: ["living_area", "rooms", "year_built", "condition"],
  },
};

const ADDRESS_REQUIRED: CompletenessField[] = ["postal_code", "municipality", "canton"];

export function completenessRules(type: PropertyType, offer: OfferType): TypeRule {
  const group = typeGroup(type);
  const rule = TYPE_RULES[group];
  const required: CompletenessField[] = [...ADDRESS_REQUIRED, ...rule.required];
  const recommended: CompletenessField[] = ["street"];
  if (group !== "plot") recommended.push("house_number");
  recommended.push(...rule.recommended, "available");
  if (offer === "sale") recommended.push("ownership_type");
  if (group !== "plot" && (offer === "rent" || group === "apartment")) recommended.push("service_charges");
  return { required, recommended };
}

export type CompletenessSource = {
  property_type: PropertyType;
  offer_type: OfferType;
  available_from?: unknown;
  available_by_arrangement?: unknown;
} & { [K in Exclude<CompletenessField, "available">]?: unknown };

export interface Completeness {
  percent: number;
  requiredTotal: number;
  requiredFilled: number;
  recommendedTotal: number;
  recommendedFilled: number;
  missingRequired: CompletenessField[];
  missingRecommended: CompletenessField[];
  /** Alle Pflichtangaben sind vorhanden. */
  isComplete: boolean;
}

export function isFilledValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return Number.isFinite(value);
  return true;
}

export function isCompletenessFieldFilled(source: CompletenessSource, field: CompletenessField): boolean {
  if (field === "available") {
    return source.available_by_arrangement === true || isFilledValue(source.available_from);
  }
  return isFilledValue(source[field]);
}

export function computeCompleteness(source: CompletenessSource): Completeness {
  const { required, recommended } = completenessRules(source.property_type, source.offer_type);
  const missingRequired = required.filter((field) => !isCompletenessFieldFilled(source, field));
  const missingRecommended = recommended.filter((field) => !isCompletenessFieldFilled(source, field));
  const requiredFilled = required.length - missingRequired.length;
  const recommendedFilled = recommended.length - missingRecommended.length;
  const total = required.length * 2 + recommended.length;
  const filled = requiredFilled * 2 + recommendedFilled;
  return {
    percent: total === 0 ? 100 : Math.round((filled / total) * 100),
    requiredTotal: required.length,
    requiredFilled,
    recommendedTotal: recommended.length,
    recommendedFilled,
    missingRequired,
    missingRecommended,
    isComplete: missingRequired.length === 0,
  };
}
