import type { Enums } from "@/types/database";

export type PropertyType = Enums<"property_type">;
export type OfferType = Enums<"offer_type">;
export type ListingStatus = Enums<"listing_status">;
export type LeadStatus = Enums<"lead_status">;
export type AppointmentStatus = Enums<"appointment_status">;
export type PropertyCondition = Enums<"property_condition">;
export type HeatingType = Enums<"heating_type">;
export type OwnershipType = Enums<"ownership_type">;
export type DocumentCategory = Enums<"document_category">;
export type DocumentVisibility = Enums<"document_visibility">;
export type DescriptionStyle = Enums<"description_style">;
export type LocationPrecision = Enums<"location_precision">;

export type Tone = "neutral" | "green" | "blue" | "amber" | "red" | "dark";

export const CANTONS = [
  { code: "AG", name: "Aargau" },
  { code: "AI", name: "Appenzell Innerrhoden" },
  { code: "AR", name: "Appenzell Ausserrhoden" },
  { code: "BE", name: "Bern" },
  { code: "BL", name: "Basel-Landschaft" },
  { code: "BS", name: "Basel-Stadt" },
  { code: "FR", name: "Freiburg" },
  { code: "GE", name: "Genf" },
  { code: "GL", name: "Glarus" },
  { code: "GR", name: "Graubünden" },
  { code: "JU", name: "Jura" },
  { code: "LU", name: "Luzern" },
  { code: "NE", name: "Neuenburg" },
  { code: "NW", name: "Nidwalden" },
  { code: "OW", name: "Obwalden" },
  { code: "SG", name: "St. Gallen" },
  { code: "SH", name: "Schaffhausen" },
  { code: "SO", name: "Solothurn" },
  { code: "SZ", name: "Schwyz" },
  { code: "TG", name: "Thurgau" },
  { code: "TI", name: "Tessin" },
  { code: "UR", name: "Uri" },
  { code: "VD", name: "Waadt" },
  { code: "VS", name: "Wallis" },
  { code: "ZG", name: "Zug" },
  { code: "ZH", name: "Zürich" },
] as const;
export type CantonCode = (typeof CANTONS)[number]["code"];
export const CANTON_CODES = CANTONS.map((c) => c.code) as unknown as readonly [CantonCode, ...CantonCode[]];
export function cantonName(code: string | null | undefined): string {
  return CANTONS.find((c) => c.code === code)?.name ?? code ?? "";
}

export const PROPERTY_TYPES: Record<PropertyType, { label: string; plural: string; group: "residential" | "land" | "commercial" }> = {
  apartment: { label: "Wohnung", plural: "Wohnungen", group: "residential" },
  single_family_house: { label: "Einfamilienhaus", plural: "Einfamilienhäuser", group: "residential" },
  semi_detached_house: { label: "Doppeleinfamilienhaus", plural: "Doppeleinfamilienhäuser", group: "residential" },
  terraced_house: { label: "Reihenhaus", plural: "Reihenhäuser", group: "residential" },
  multi_family_house: { label: "Mehrfamilienhaus", plural: "Mehrfamilienhäuser", group: "residential" },
  plot: { label: "Grundstück", plural: "Grundstücke", group: "land" },
  commercial: { label: "Gewerbeimmobilie", plural: "Gewerbeimmobilien", group: "commercial" },
  office: { label: "Büro", plural: "Büros", group: "commercial" },
  new_build_project: { label: "Neubauprojekt", plural: "Neubauprojekte", group: "residential" },
  other: { label: "Weitere Immobilie", plural: "Weitere Immobilien", group: "residential" },
};
export const PROPERTY_TYPE_OPTIONS = Object.entries(PROPERTY_TYPES).map(([value, v]) => ({
  value: value as PropertyType,
  label: v.label,
}));

export const OFFER_TYPES: Record<OfferType, { label: string; verb: string; priceLabel: string }> = {
  sale: { label: "Kaufen", verb: "Zu verkaufen", priceLabel: "Kaufpreis" },
  rent: { label: "Mieten", verb: "Zu vermieten", priceLabel: "Miete / Monat" },
};

export const LISTING_STATUS: Record<ListingStatus, { label: string; tone: Tone; description: string }> = {
  draft: { label: "Entwurf", tone: "neutral", description: "Noch nicht vollständig erfasst." },
  in_progress: { label: "In Bearbeitung", tone: "neutral", description: "Wird gerade bearbeitet." },
  ready: { label: "Bereit zur Veröffentlichung", tone: "blue", description: "Alle Pflichtangaben sind vorhanden." },
  pending_review: { label: "Zur Prüfung eingereicht", tone: "amber", description: "Wird vor der Veröffentlichung geprüft." },
  published: { label: "Veröffentlicht", tone: "green", description: "Öffentlich sichtbar." },
  paused: { label: "Pausiert", tone: "amber", description: "Vorübergehend nicht sichtbar." },
  reserved: { label: "Reserviert", tone: "blue", description: "Sichtbar mit Hinweis «reserviert»." },
  sold: { label: "Verkauft", tone: "dark", description: "Abgeschlossen und nicht mehr öffentlich." },
  rented: { label: "Vermietet", tone: "dark", description: "Abgeschlossen und nicht mehr öffentlich." },
  archived: { label: "Archiviert", tone: "neutral", description: "Archiviert." },
};

export const LEAD_STATUS: Record<LeadStatus, { label: string; tone: Tone }> = {
  new: { label: "Neue Anfrage", tone: "green" },
  in_contact: { label: "In Kontakt", tone: "blue" },
  dossier_sent: { label: "Dossier gesendet", tone: "blue" },
  viewing_requested: { label: "Besichtigung angefragt", tone: "amber" },
  viewing_confirmed: { label: "Besichtigung bestätigt", tone: "green" },
  viewing_done: { label: "Besichtigung durchgeführt", tone: "blue" },
  highly_interested: { label: "Stark interessiert", tone: "green" },
  financing_check: { label: "Finanzierung in Abklärung", tone: "amber" },
  offer_received: { label: "Angebot erhalten", tone: "green" },
  declined: { label: "Abgesagt", tone: "neutral" },
  closed: { label: "Abgeschlossen", tone: "dark" },
};
export const LEAD_STATUS_ORDER = Object.keys(LEAD_STATUS) as LeadStatus[];

export const APPOINTMENT_STATUS: Record<AppointmentStatus, { label: string; tone: Tone }> = {
  requested: { label: "Angefragt", tone: "amber" },
  confirmed: { label: "Bestätigt", tone: "green" },
  reschedule_requested: { label: "Änderung angefragt", tone: "amber" },
  cancelled: { label: "Abgesagt", tone: "neutral" },
  completed: { label: "Durchgeführt", tone: "blue" },
  no_show: { label: "Nicht erschienen", tone: "red" },
};

export const CONDITIONS: Record<PropertyCondition, string> = {
  new_build: "Neubau / Erstbezug",
  as_new: "Neuwertig",
  good: "Gepflegt",
  needs_refresh: "Auffrischung nötig",
  needs_renovation: "Renovationsbedürftig",
};

export const HEATING_TYPES: Record<HeatingType, string> = {
  heat_pump: "Wärmepumpe",
  district_heating: "Fernwärme",
  gas: "Gas",
  oil: "Öl",
  wood: "Holz",
  pellets: "Pellets",
  electric: "Elektro",
  solar: "Solar",
  other: "Andere",
};

export const OWNERSHIP_TYPES: Record<OwnershipType, string> = {
  condominium: "Stockwerkeigentum",
  sole: "Alleineigentum",
  co_ownership: "Miteigentum",
  building_right: "Baurecht",
  other: "Andere",
};

export const LOCATION_PRECISION: Record<LocationPrecision, { label: string; description: string }> = {
  exact: { label: "Exakte Adresse", description: "Strasse, Hausnummer und genauer Standort auf der Karte." },
  street: { label: "Nur Strasse", description: "Strasse ohne Hausnummer, Standort auf ca. 100 m genau." },
  area: { label: "Nur Ort", description: "PLZ und Ort, Standort auf ca. 1 km genau." },
};

export const DOCUMENT_CATEGORIES: Record<DocumentCategory, string> = {
  floor_plan: "Grundriss",
  land_register: "Grundbuchauszug",
  renovation_receipt: "Renovationsbeleg",
  service_charges: "Nebenkostenabrechnung",
  regulations: "Reglement",
  minutes: "Protokoll",
  building_insurance: "Gebäudeversicherung",
  energy_certificate: "Energieausweis (GEAK)",
  sales_dossier: "Verkaufsdossier",
  other: "Weiteres Dokument",
};

export const DOCUMENT_VISIBILITY: Record<DocumentVisibility, { label: string; description: string }> = {
  owner: { label: "Nur ich", description: "Nur für Sie als Eigentümer sichtbar." },
  organization: { label: "Mein Team", description: "Für Sie und berechtigte Mitarbeitende Ihres Firmenkontos." },
  public: { label: "Öffentlich im Inserat", description: "Für alle Besucher des veröffentlichten Inserats." },
};

export const DESCRIPTION_STYLES: Record<DescriptionStyle, { label: string; description: string }> = {
  factual: { label: "Sachlich", description: "Nüchtern und präzise, Fakten im Vordergrund." },
  modern: { label: "Modern", description: "Frisch und direkt, kurze Sätze." },
  elegant: { label: "Elegant", description: "Gehoben und ruhig, mit Sinn für Details." },
  emotional: { label: "Emotional", description: "Lebensgefühl und Wohnqualität im Vordergrund." },
  premium: { label: "Premium", description: "Exklusiv, für hochwertige Objekte." },
};

/** Zusätzliche Ausstattungsmerkmale (property_features.feature_key). */
export const FEATURE_CATALOG = {
  lake_view: { label: "Seesicht", group: "Lage" },
  mountain_view: { label: "Bergsicht", group: "Lage" },
  quiet_location: { label: "Ruhige Lage", group: "Lage" },
  near_public_transport: { label: "Nähe ÖV", group: "Lage" },
  fireplace: { label: "Cheminée", group: "Ausstattung" },
  floor_heating: { label: "Bodenheizung", group: "Ausstattung" },
  own_washing_machine: { label: "Eigene Waschmaschine", group: "Ausstattung" },
  dishwasher: { label: "Geschirrspüler", group: "Ausstattung" },
  steamer: { label: "Steamer", group: "Ausstattung" },
  walk_in_closet: { label: "Ankleide", group: "Ausstattung" },
  parquet: { label: "Parkett", group: "Ausstattung" },
  fiber_optic: { label: "Glasfaser", group: "Ausstattung" },
  smart_home: { label: "Smart Home", group: "Ausstattung" },
  solar_panels: { label: "Photovoltaik", group: "Energie" },
  ev_charging: { label: "E-Ladestation", group: "Energie" },
  conservatory: { label: "Wintergarten", group: "Aussenbereich" },
  pool: { label: "Pool", group: "Aussenbereich" },
  playground: { label: "Spielplatz", group: "Aussenbereich" },
  storage_room: { label: "Bastelraum", group: "Räume" },
  bike_room: { label: "Veloraum", group: "Räume" },
  hobby_room: { label: "Hobbyraum", group: "Räume" },
  guest_toilet: { label: "Gäste-WC", group: "Räume" },
  sauna: { label: "Sauna", group: "Räume" },
} as const;
export type FeatureKey = keyof typeof FEATURE_CATALOG;
export const FEATURE_KEYS = Object.keys(FEATURE_CATALOG) as FeatureKey[];

export const RENOVATION_CATEGORIES = {
  kitchen: "Küche",
  bathroom: "Bad",
  roof: "Dach",
  facade: "Fassade",
  windows: "Fenster",
  heating: "Heizung",
  electrical: "Elektrisches",
  flooring: "Böden",
  interior: "Innenausbau",
  other: "Weiteres",
} as const;
export type RenovationCategory = keyof typeof RENOVATION_CATEGORIES;

export const REPORT_REASONS = {
  spam: "Spam oder Werbung",
  fraud: "Betrugsverdacht",
  inappropriate: "Unangemessener Inhalt",
  wrong_information: "Falsche Angaben",
  discrimination: "Diskriminierung",
  duplicate: "Doppeltes Inserat",
  other: "Anderer Grund",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

/** Bewegliche Boolean-Merkmale mit Spalten in properties/listings. */
export const AMENITY_FLAGS = [
  { key: "has_balcony", label: "Balkon" },
  { key: "has_terrace", label: "Terrasse" },
  { key: "has_garden", label: "Garten" },
  { key: "has_garage", label: "Garage" },
  { key: "has_elevator", label: "Lift" },
  { key: "has_cellar", label: "Keller" },
  { key: "has_attic", label: "Estrich" },
  { key: "is_wheelchair_accessible", label: "Rollstuhlgängig" },
  { key: "is_minergie", label: "Minergie" },
] as const;
export type AmenityKey = (typeof AMENITY_FLAGS)[number]["key"];

export const SITE = {
  name: "Immovia",
  claim: "Immobilie bewerten, professionell verkaufen. Einfach und kostenlos.",
  description:
    "Immovia ist die Schweizer Immobilienplattform für Privatpersonen: kostenlos inserieren, KI-gestützt bewerten, professionelle Verkaufsdossiers erstellen und Interessenten an einem Ort verwalten.",
  supportEmail: "support@immovia.ch",
};
