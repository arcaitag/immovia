import type { OfferType, PropertyType } from "@/lib/constants";

/**
 * Typabhängige Feldkonfiguration des Verkaufsassistenten (Schritt 1).
 * Reine Logik ohne Abhängigkeiten zu Server oder Browser – wird im Formular,
 * in der Vollständigkeitsberechnung und in den Tests verwendet.
 */

export type TypeGroup = "apartment" | "house" | "multi_family" | "plot" | "commercial" | "office" | "new_build" | "other";

export function typeGroup(type: PropertyType): TypeGroup {
  switch (type) {
    case "apartment":
      return "apartment";
    case "single_family_house":
    case "semi_detached_house":
    case "terraced_house":
      return "house";
    case "multi_family_house":
      return "multi_family";
    case "plot":
      return "plot";
    case "commercial":
      return "commercial";
    case "office":
      return "office";
    case "new_build_project":
      return "new_build";
    default:
      return "other";
  }
}

export function isBuilding(type: PropertyType): boolean {
  return typeGroup(type) !== "plot";
}

/** Felder, deren Anzeige vom Objekttyp oder der Angebotsart abhängt. */
export type ConditionalField =
  | "rooms"
  | "bathrooms"
  | "living_area"
  | "gross_living_area"
  | "usable_area"
  | "plot_area"
  | "year_built"
  | "year_renovated"
  | "floor"
  | "floors_total"
  | "condition"
  | "heating_type"
  | "energy_label"
  | "energy_demand_kwh"
  | "is_minergie"
  | "has_balcony"
  | "has_terrace"
  | "has_garden"
  | "has_elevator"
  | "has_cellar"
  | "has_attic"
  | "is_wheelchair_accessible"
  | "has_garage"
  | "garage_spaces"
  | "underground_parking_spaces"
  | "outdoor_parking_spaces"
  | "pets_allowed"
  | "service_charges"
  | "ownership_type";

const RESIDENTIAL: readonly TypeGroup[] = ["apartment", "house", "multi_family", "new_build", "other"];
const building = (g: TypeGroup) => g !== "plot";

const VISIBILITY: Record<ConditionalField, (group: TypeGroup, offer: OfferType) => boolean> = {
  rooms: building,
  bathrooms: (g) => RESIDENTIAL.includes(g),
  living_area: (g) => RESIDENTIAL.includes(g),
  gross_living_area: (g) => RESIDENTIAL.includes(g),
  usable_area: (g) => g === "commercial" || g === "office" || g === "multi_family" || g === "other",
  plot_area: (g) => g !== "apartment" && g !== "office",
  year_built: building,
  year_renovated: building,
  floor: (g) => g === "apartment" || g === "commercial" || g === "office" || g === "new_build" || g === "other",
  floors_total: building,
  condition: building,
  heating_type: building,
  energy_label: building,
  energy_demand_kwh: building,
  is_minergie: building,
  has_balcony: building,
  has_terrace: building,
  has_garden: (g) => g !== "plot" && g !== "office",
  has_elevator: (g) => g !== "plot" && g !== "house",
  has_cellar: building,
  has_attic: building,
  is_wheelchair_accessible: building,
  has_garage: building,
  garage_spaces: building,
  underground_parking_spaces: building,
  outdoor_parking_spaces: building,
  pets_allowed: (g, offer) => offer === "rent" && RESIDENTIAL.includes(g),
  service_charges: building,
  ownership_type: (_g, offer) => offer === "sale",
};

export function isFieldVisible(field: ConditionalField, type: PropertyType, offer: OfferType): boolean {
  return VISIBILITY[field](typeGroup(type), offer);
}

/** Felder, die bei einem Wechsel des Objekttyps nicht mehr passen (werden geleert). */
export function fieldsHiddenAfterChange(
  from: { type: PropertyType; offer: OfferType },
  to: { type: PropertyType; offer: OfferType },
): ConditionalField[] {
  return (Object.keys(VISIBILITY) as ConditionalField[]).filter(
    (field) => isFieldVisible(field, from.type, from.offer) && !isFieldVisible(field, to.type, to.offer),
  );
}

/** Beschriftungen der Formularfelder (typabhängige Varianten über fieldLabel). */
export const FIELD_LABELS = {
  property_type: "Immobilientyp",
  offer_type: "Angebotsart",
  internal_name: "Interne Bezeichnung",
  street: "Strasse",
  house_number: "Hausnummer",
  postal_code: "PLZ",
  municipality: "Gemeinde / Ort",
  canton: "Kanton",
  rooms: "Zimmer",
  bathrooms: "Badezimmer",
  living_area: "Nettowohnfläche",
  gross_living_area: "Bruttowohnfläche",
  usable_area: "Nutzfläche",
  plot_area: "Grundstücksfläche",
  year_built: "Baujahr",
  year_renovated: "Letzte Gesamtrenovation",
  floor: "Etage",
  floors_total: "Anzahl Stockwerke",
  condition: "Zustand",
  heating_type: "Heizung",
  energy_label: "GEAK-Klasse",
  energy_demand_kwh: "Energiekennzahl",
  is_minergie: "Minergie-zertifiziert",
  ownership_type: "Eigentumsform",
  available_from: "Verfügbar ab",
  available_by_arrangement: "Nach Vereinbarung",
  service_charges: "Nebenkosten",
  special_features: "Besonderheiten",
  view_description: "Aussicht",
  garage_spaces: "Garagenplätze",
  underground_parking_spaces: "Tiefgaragenplätze",
  outdoor_parking_spaces: "Aussenparkplätze",
  has_garage: "Garage",
  pets_allowed: "Haustiere",
  features: "Weitere Merkmale",
} as const;

export type LabeledField = keyof typeof FIELD_LABELS;

export function fieldLabel(field: LabeledField, type: PropertyType): string {
  const group = typeGroup(type);
  if (field === "rooms" && (group === "office" || group === "commercial")) return "Räume";
  if (field === "rooms" && group === "multi_family") return "Zimmer total";
  if (field === "living_area" && group === "multi_family") return "Wohnfläche total";
  if (field === "floors_total" && group === "apartment") return "Stockwerke im Gebäude";
  if (field === "floors_total" && group === "house") return "Anzahl Etagen";
  return FIELD_LABELS[field];
}

/** Abschnitte des Erfassungsformulars. */
export const FORM_SECTIONS = [
  {
    key: "adresse",
    label: "Adresse & Lage",
    description: "Wo befindet sich die Immobilie? Die exakte Adresse bleibt privat, bis Sie es anders wählen.",
    buildingOnly: false,
  },
  {
    key: "objekt",
    label: "Objektart & Eigentum",
    description: "Art der Immobilie, Verkauf oder Vermietung und die Eigentumsform.",
    buildingOnly: false,
  },
  {
    key: "flaechen",
    label: "Flächen & Zimmer",
    description: "Die wichtigsten Kennzahlen für Suche und Bewertung.",
    buildingOnly: false,
  },
  {
    key: "gebaeude",
    label: "Gebäude",
    description: "Baujahr, Renovation und Lage im Gebäude.",
    buildingOnly: true,
  },
  {
    key: "zustand",
    label: "Zustand & Energie",
    description: "Zustand, Heizung und Energieeffizienz.",
    buildingOnly: true,
  },
  {
    key: "ausstattung",
    label: "Ausstattung",
    description: "Wählen Sie alles aus, was tatsächlich vorhanden ist.",
    buildingOnly: false,
  },
  {
    key: "parkplaetze",
    label: "Parkplätze",
    description: "Garagen-, Tiefgaragen- und Aussenparkplätze.",
    buildingOnly: true,
  },
  {
    key: "verfuegbarkeit",
    label: "Verfügbarkeit & Kosten",
    description: "Ab wann ist die Immobilie verfügbar und welche Nebenkosten fallen an?",
    buildingOnly: false,
  },
  {
    key: "besonderheiten",
    label: "Besonderheiten & Aussicht",
    description: "Was macht die Immobilie besonders? Nur Tatsachen, keine Werbesprache nötig.",
    buildingOnly: false,
  },
  {
    key: "renovationen",
    label: "Renovationen",
    description: "Erneuerungen der letzten Jahre mit Jahr und kurzer Beschreibung.",
    buildingOnly: true,
  },
] as const;

export type SectionKey = (typeof FORM_SECTIONS)[number]["key"];
export type FormSection = (typeof FORM_SECTIONS)[number];

export const SECTION_KEYS = FORM_SECTIONS.map((s) => s.key) as SectionKey[];

export function isSectionKey(value: unknown): value is SectionKey {
  return typeof value === "string" && (SECTION_KEYS as string[]).includes(value);
}

export function visibleSections(type: PropertyType): FormSection[] {
  const building = isBuilding(type);
  return FORM_SECTIONS.filter((section) => building || !section.buildingOnly);
}

/** Abschnitt, in dem ein Feld der Vollständigkeitsprüfung bearbeitet wird. */
export const FIELD_SECTION: Record<string, SectionKey> = {
  street: "adresse",
  house_number: "adresse",
  postal_code: "adresse",
  municipality: "adresse",
  canton: "adresse",
  property_type: "objekt",
  offer_type: "objekt",
  ownership_type: "objekt",
  internal_name: "objekt",
  rooms: "flaechen",
  bathrooms: "flaechen",
  living_area: "flaechen",
  gross_living_area: "flaechen",
  usable_area: "flaechen",
  plot_area: "flaechen",
  year_built: "gebaeude",
  year_renovated: "gebaeude",
  floor: "gebaeude",
  floors_total: "gebaeude",
  condition: "zustand",
  heating_type: "zustand",
  energy_label: "zustand",
  energy_demand_kwh: "zustand",
  is_minergie: "zustand",
  garage_spaces: "parkplaetze",
  underground_parking_spaces: "parkplaetze",
  outdoor_parking_spaces: "parkplaetze",
  has_garage: "parkplaetze",
  available: "verfuegbarkeit",
  available_from: "verfuegbarkeit",
  available_by_arrangement: "verfuegbarkeit",
  service_charges: "verfuegbarkeit",
  special_features: "besonderheiten",
  view_description: "besonderheiten",
};

export function sectionOf(field: string): SectionKey {
  return FIELD_SECTION[field] ?? "ausstattung";
}

/** Etagen-Auswahl: 2. Untergeschoss bis 40. Obergeschoss. */
export const FLOOR_OPTIONS: { value: string; label: string }[] = Array.from({ length: 43 }, (_, i) => {
  const floor = i - 2;
  const label = floor === 0 ? "Erdgeschoss" : floor < 0 ? `${Math.abs(floor)}. Untergeschoss` : `${floor}. Obergeschoss`;
  return { value: String(floor), label };
});

export const ENERGY_LABELS = ["A", "B", "C", "D", "E", "F", "G"] as const;
