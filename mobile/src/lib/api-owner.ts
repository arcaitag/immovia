import * as Crypto from "expo-crypto";

import type { ImageRow, ListingRow, PropertyRow } from "@/lib/api";
import { supabase, type Database, type Enums, type Tables } from "@/lib/supabase";

/**
 * Datenzugriff für die Verwaltung eigener Immobilien (Bearbeiten, Status, Statistik, Interessenten,
 * Besichtigungen, Dokumente). Wie auf der Website läuft alles mit dem Konto des Benutzers direkt
 * gegen Supabase; Row Level Security, Spaltenrechte und Trigger prüfen die Berechtigung.
 * Die Regeln (Statusaktionen, Feldsichtbarkeit, Zeitfenster) sind aus src/lib der Website übernommen.
 */

// ---------------------------------------------------------------------------
// Bezeichnungen (wie src/lib/constants.ts der Website)
// ---------------------------------------------------------------------------

export type Tone = "neutral" | "green" | "amber" | "blue" | "dark";

export const HEATING_TYPES: Record<Enums<"heating_type">, string> = {
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

export const ENERGY_LABELS = ["A", "B", "C", "D", "E", "F", "G"] as const;

export const LOCATION_PRECISION: Record<Enums<"location_precision">, { label: string; description: string }> = {
  exact: { label: "Exakte Adresse", description: "Strasse, Hausnummer und genauer Standort auf der Karte." },
  street: { label: "Nur Strasse", description: "Strasse ohne Hausnummer, Standort auf ca. 100 m genau." },
  area: { label: "Nur Ort", description: "PLZ und Ort, Standort auf ca. 1 km genau." },
};

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
export const FEATURE_GROUPS = ["Lage", "Ausstattung", "Energie", "Aussenbereich", "Räume"] as const;

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

export type LeadStatus = Enums<"lead_status">;
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

export type AppointmentStatus = Enums<"appointment_status">;
export const APPOINTMENT_STATUS: Record<AppointmentStatus, { label: string; tone: Tone }> = {
  requested: { label: "Angefragt", tone: "amber" },
  confirmed: { label: "Bestätigt", tone: "green" },
  reschedule_requested: { label: "Änderung angefragt", tone: "amber" },
  cancelled: { label: "Abgesagt", tone: "neutral" },
  completed: { label: "Durchgeführt", tone: "blue" },
  no_show: { label: "Nicht erschienen", tone: "neutral" },
};

export type DocumentCategory = Enums<"document_category">;
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

export type DocumentVisibility = Enums<"document_visibility">;
export const DOCUMENT_VISIBILITY: Record<DocumentVisibility, { label: string; description: string }> = {
  owner: { label: "Nur ich", description: "Nur für Sie als Eigentümer sichtbar." },
  organization: { label: "Mein Team", description: "Für Sie und berechtigte Mitarbeitende Ihres Firmenkontos." },
  public: { label: "Öffentlich im Inserat", description: "Für alle Besucher des veröffentlichten Inserats." },
};

/** Meldungen der Datenbank, die nur in der Verwaltung vorkommen (sonst null → errorMessage aus labels). */
export function ownerErrorMessage(error: unknown): string | null {
  const e = error as { message?: string; code?: string } | null;
  const raw = (e?.message ?? "").trim();
  if (raw.startsWith("local:")) return raw.slice(6);
  if (raw === "slot_in_past") return "Das Zeitfenster liegt in der Vergangenheit.";
  if (raw === "slot_has_appointments") return "Für dieses Zeitfenster bestehen Termine. Sagen Sie es stattdessen ab.";
  if (raw === "invalid_message") return "Die Begründung darf höchstens 500 Zeichen lang sein.";
  if (e?.code === "23P01") return "Dieses Zeitfenster überschneidet sich mit einem bestehenden Zeitfenster. Es wurde nichts angelegt.";
  return null;
}

/** Fehler mit einer Meldung, die direkt angezeigt werden kann. */
export function localError(message: string): Error {
  return new Error(`local:${message}`);
}

// ---------------------------------------------------------------------------
// Feldsichtbarkeit je Objekttyp (wie src/lib/properties/fields.ts)
// ---------------------------------------------------------------------------

type TypeGroup = "apartment" | "house" | "multi_family" | "plot" | "commercial" | "office" | "new_build" | "other";

export function typeGroup(type: Enums<"property_type">): TypeGroup {
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

export type ConditionalField =
  | "rooms" | "bathrooms" | "living_area" | "plot_area" | "year_built" | "floor" | "floors_total" | "condition"
  | "heating_type" | "energy_label" | "is_minergie" | "has_balcony" | "has_terrace" | "has_garden" | "has_elevator"
  | "has_cellar" | "has_attic" | "is_wheelchair_accessible" | "has_garage" | "garage_spaces"
  | "underground_parking_spaces" | "outdoor_parking_spaces" | "pets_allowed" | "service_charges";

const RESIDENTIAL: readonly TypeGroup[] = ["apartment", "house", "multi_family", "new_build", "other"];
const building = (g: TypeGroup) => g !== "plot";

const VISIBILITY: Record<ConditionalField, (group: TypeGroup, offer: Enums<"offer_type">) => boolean> = {
  rooms: building,
  bathrooms: (g) => RESIDENTIAL.includes(g),
  living_area: (g) => RESIDENTIAL.includes(g),
  plot_area: (g) => g !== "apartment" && g !== "office",
  year_built: building,
  floor: (g) => g === "apartment" || g === "commercial" || g === "office" || g === "new_build" || g === "other",
  floors_total: building,
  condition: building,
  heating_type: building,
  energy_label: building,
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
};

export function isFieldVisible(field: ConditionalField, type: Enums<"property_type">, offer: Enums<"offer_type">): boolean {
  return VISIBILITY[field](typeGroup(type), offer);
}

// ---------------------------------------------------------------------------
// Statuslogik (wie src/lib/properties/listing-status.ts – die Datenbank prüft erneut)
// ---------------------------------------------------------------------------

export type ListingStatus = Enums<"listing_status">;

const ALLOWED_TRANSITIONS: Record<ListingStatus, readonly ListingStatus[]> = {
  draft: ["in_progress", "ready", "pending_review", "published", "archived"],
  in_progress: ["draft", "ready", "pending_review", "published", "archived"],
  ready: ["draft", "in_progress", "pending_review", "published", "archived"],
  pending_review: ["in_progress", "ready", "archived"],
  published: ["paused", "reserved", "sold", "rented", "archived", "in_progress"],
  paused: ["published", "pending_review", "in_progress", "archived", "sold", "rented"],
  reserved: ["published", "paused", "sold", "rented", "archived"],
  sold: ["archived"],
  rented: ["archived", "in_progress"],
  archived: [],
};

const DRAFT_STATUSES: readonly ListingStatus[] = ["draft", "in_progress", "ready"];
export const isDraftStatus = (status: ListingStatus) => DRAFT_STATUSES.includes(status);
export const isPublicStatus = (status: ListingStatus) => status === "published" || status === "reserved";

export type StatusAction =
  | "publish" | "withdraw_review" | "pause" | "resume" | "reserve" | "unreserve" | "mark_sold" | "mark_rented" | "relist" | "archive";

export interface StatusActionContext {
  status: ListingStatus;
  offerType: Enums<"offer_type">;
  /** publishing.require_review aus feature_settings */
  requireReview: boolean;
  /** Inserat wurde bereits von der Moderation freigegeben (approved_at gesetzt). */
  approved: boolean;
}

const ACTION_SOURCES: Record<StatusAction, readonly ListingStatus[]> = {
  publish: ["draft", "in_progress", "ready"],
  withdraw_review: ["pending_review"],
  pause: ["published", "reserved"],
  resume: ["paused"],
  reserve: ["published"],
  unreserve: ["reserved"],
  mark_sold: ["published", "paused", "reserved"],
  mark_rented: ["published", "paused", "reserved"],
  relist: ["rented"],
  archive: ["draft", "in_progress", "ready", "pending_review", "published", "paused", "reserved", "sold", "rented"],
};

/** Zielstatus einer Aktion (null, wenn sie für die Angebotsart nicht passt). */
export function statusActionTarget(action: StatusAction, ctx: Omit<StatusActionContext, "status">): ListingStatus | null {
  const needsReview = ctx.requireReview && !ctx.approved;
  switch (action) {
    case "publish":
    case "resume":
      return needsReview ? "pending_review" : "published";
    case "withdraw_review":
      return "in_progress";
    case "pause":
      return "paused";
    case "reserve":
      return "reserved";
    case "unreserve":
      return "published";
    case "mark_sold":
      return ctx.offerType === "sale" ? "sold" : null;
    case "mark_rented":
      return ctx.offerType === "rent" ? "rented" : null;
    case "relist":
      return "in_progress";
    case "archive":
      return "archived";
  }
}

export function isStatusActionAvailable(action: StatusAction, ctx: StatusActionContext): boolean {
  const target = statusActionTarget(action, ctx);
  return target !== null && ACTION_SOURCES[action].includes(ctx.status) && ALLOWED_TRANSITIONS[ctx.status].includes(target);
}

/** Aktionen für ein bestehendes Inserat (ohne «Veröffentlichen» und ohne Archivieren von Entwürfen – dafür wird die Immobilie gelöscht). */
export function managementActions(ctx: StatusActionContext): StatusAction[] {
  const order: StatusAction[] = ["resume", "pause", "reserve", "unreserve", "mark_sold", "mark_rented", "relist", "withdraw_review", "archive"];
  return order.filter((action) => !(action === "archive" && isDraftStatus(ctx.status)) && isStatusActionAvailable(action, ctx));
}

export interface StatusActionCopy {
  label: string;
  confirmTitle: string;
  confirmText: string;
  confirmLabel: string;
  success: string;
  destructive?: boolean;
}

export function statusActionCopy(action: StatusAction, ctx: Omit<StatusActionContext, "status">): StatusActionCopy {
  const target = statusActionTarget(action, ctx);
  switch (action) {
    case "publish":
      return target === "pending_review"
        ? {
            label: "Zur Prüfung einreichen",
            confirmTitle: "Inserat zur Prüfung einreichen?",
            confirmText: "Unser Team prüft das Inserat vor der Veröffentlichung. Sie erhalten eine Benachrichtigung, sobald es online ist.",
            confirmLabel: "Einreichen",
            success: "Das Inserat wurde zur Prüfung eingereicht.",
          }
        : {
            label: "Jetzt veröffentlichen",
            confirmTitle: "Inserat jetzt veröffentlichen?",
            confirmText: "Das Inserat ist danach öffentlich in der Suche und unter seiner eigenen Adresse sichtbar.",
            confirmLabel: "Veröffentlichen",
            success: "Ihr Inserat ist jetzt online.",
          };
    case "resume":
      return target === "pending_review"
        ? {
            label: "Fortsetzen (mit Prüfung)",
            confirmTitle: "Inserat erneut zur Prüfung einreichen?",
            confirmText: "Inserate werden derzeit vor der Veröffentlichung geprüft. Ihr Inserat wird nach der Freigabe wieder sichtbar.",
            confirmLabel: "Einreichen",
            success: "Das Inserat wurde zur Prüfung eingereicht.",
          }
        : {
            label: "Fortsetzen",
            confirmTitle: "Inserat wieder veröffentlichen?",
            confirmText: "Das Inserat ist danach wieder öffentlich sichtbar.",
            confirmLabel: "Fortsetzen",
            success: "Das Inserat ist wieder online.",
          };
    case "withdraw_review":
      return {
        label: "Prüfung zurückziehen",
        confirmTitle: "Prüfung zurückziehen?",
        confirmText: "Das Inserat wird wieder in Bearbeitung gesetzt und nicht geprüft. Sie können es später erneut einreichen.",
        confirmLabel: "Zurückziehen",
        success: "Die Prüfung wurde zurückgezogen.",
      };
    case "pause":
      return {
        label: "Pausieren",
        confirmTitle: "Inserat pausieren?",
        confirmText:
          "Das Inserat ist vorübergehend nicht mehr öffentlich sichtbar. Konversationen und Termine bleiben erhalten. Sie können es jederzeit fortsetzen.",
        confirmLabel: "Pausieren",
        success: "Das Inserat ist pausiert.",
      };
    case "reserve":
      return {
        label: "Als reserviert markieren",
        confirmTitle: "Als reserviert markieren?",
        confirmText: "Das Inserat bleibt sichtbar und wird als «reserviert» gekennzeichnet.",
        confirmLabel: "Reservieren",
        success: "Das Inserat ist als reserviert markiert.",
      };
    case "unreserve":
      return {
        label: "Reservierung aufheben",
        confirmTitle: "Reservierung aufheben?",
        confirmText: "Das Inserat wird wieder als verfügbar angezeigt.",
        confirmLabel: "Aufheben",
        success: "Die Reservierung wurde aufgehoben.",
      };
    case "mark_sold":
      return {
        label: "Als verkauft markieren",
        confirmTitle: "Als verkauft markieren?",
        confirmText: "Das Inserat wird aus der öffentlichen Suche entfernt und als verkauft abgeschlossen. Danach ist nur noch das Archivieren möglich.",
        confirmLabel: "Als verkauft markieren",
        success: "Herzlichen Glückwunsch! Das Inserat ist als verkauft markiert.",
        destructive: true,
      };
    case "mark_rented":
      return {
        label: "Als vermietet markieren",
        confirmTitle: "Als vermietet markieren?",
        confirmText: "Das Inserat wird aus der öffentlichen Suche entfernt und als vermietet abgeschlossen. Sie können die Immobilie später erneut ausschreiben.",
        confirmLabel: "Als vermietet markieren",
        success: "Das Inserat ist als vermietet markiert.",
        destructive: true,
      };
    case "relist":
      return {
        label: "Erneut vermieten",
        confirmTitle: "Erneut zur Vermietung vorbereiten?",
        confirmText: "Das Inserat wird wieder in Bearbeitung gesetzt. Prüfen Sie Preis, Verfügbarkeit und Texte und veröffentlichen Sie es danach erneut.",
        confirmLabel: "Vorbereiten",
        success: "Das Inserat ist wieder in Bearbeitung.",
      };
    case "archive":
      return {
        label: "Archivieren",
        confirmTitle: "Inserat archivieren?",
        confirmText:
          "Archivierte Inserate sind nicht mehr öffentlich und können nicht wieder aktiviert werden. Für die Immobilie können Sie später ein neues Inserat erstellen.",
        confirmLabel: "Archivieren",
        success: "Das Inserat wurde archiviert.",
        destructive: true,
      };
  }
}

// ---------------------------------------------------------------------------
// Einstellungen und Zusatzdaten des Editors
// ---------------------------------------------------------------------------

export interface PublishingSettings {
  requireReview: boolean;
  minImages: number;
  maxImages: number;
}

export async function publishingSettings(): Promise<PublishingSettings> {
  const { data } = await supabase.from("feature_settings").select("value").eq("key", "publishing").maybeSingle();
  const value = (data?.value ?? {}) as { require_review?: unknown; min_images?: unknown; max_images?: unknown };
  const int = (raw: unknown, fallback: number, min: number, max: number) =>
    typeof raw === "number" && Number.isInteger(raw) && raw >= min && raw <= max ? raw : fallback;
  return {
    requireReview: value.require_review === true,
    minImages: int(value.min_images, 1, 0, 100),
    maxImages: int(value.max_images, 40, 1, 500),
  };
}

export interface EditorExtras {
  features: FeatureKey[];
  contact: { email: string | null; phone: string | null };
  publishing: PublishingSettings;
}

/** Merkmale, private Kontaktangaben und Veröffentlichungsregeln für den Editor. */
export async function editorExtras(propertyId: string, listingId: string): Promise<EditorExtras> {
  const [featuresRes, contactRes, publishing] = await Promise.all([
    supabase.from("property_features").select("feature_key").eq("property_id", propertyId),
    supabase.from("listing_contacts").select("contact_email, contact_phone").eq("listing_id", listingId).maybeSingle(),
    publishingSettings(),
  ]);
  if (featuresRes.error) throw featuresRes.error;
  if (contactRes.error) throw contactRes.error;
  return {
    features: (featuresRes.data ?? []).map((f) => f.feature_key).filter((key): key is FeatureKey => key in FEATURE_CATALOG),
    contact: { email: contactRes.data?.contact_email ?? null, phone: contactRes.data?.contact_phone ?? null },
    publishing,
  };
}

// ---------------------------------------------------------------------------
// Immobilie speichern (wie updatePropertyFields)
// ---------------------------------------------------------------------------

export type PropertyDetailsPatch = Partial<
  Pick<
    PropertyRow,
    | "rooms" | "bathrooms" | "living_area" | "plot_area" | "year_built" | "floor" | "floors_total" | "condition"
    | "heating_type" | "energy_label" | "is_minergie" | "has_balcony" | "has_terrace" | "has_garden" | "has_garage"
    | "has_elevator" | "has_cellar" | "has_attic" | "is_wheelchair_accessible" | "pets_allowed" | "garage_spaces"
    | "underground_parking_spaces" | "outdoor_parking_spaces" | "available_from" | "available_by_arrangement"
    | "service_charges" | "special_features"
  >
>;

export async function savePropertyDetails(property: PropertyRow, patch: PropertyDetailsPatch, features: FeatureKey[]): Promise<void> {
  const merged = { ...property, ...patch };
  if (typeof merged.floor === "number" && typeof merged.floors_total === "number" && merged.floor > merged.floors_total) {
    throw localError("Die Etage liegt über der Anzahl Stockwerke des Gebäudes.");
  }
  const update: PropertyDetailsPatch = { ...patch };
  if (update.available_by_arrangement === true) update.available_from = null;
  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from("properties").update(update).eq("id", property.id);
    if (error) throw error;
  }

  const { data: existingRows, error: readError } = await supabase.from("property_features").select("feature_key").eq("property_id", property.id);
  if (readError) throw readError;
  const existing = new Set((existingRows ?? []).map((f) => f.feature_key));
  const wanted = new Set<string>(features);
  // Unbekannte Merkmale (nicht im Katalog der App) bleiben unangetastet
  const toRemove = [...existing].filter((key) => key in FEATURE_CATALOG && !wanted.has(key));
  const toAdd = [...wanted].filter((key) => !existing.has(key));
  if (toRemove.length) {
    const { error } = await supabase.from("property_features").delete().eq("property_id", property.id).in("feature_key", toRemove);
    if (error) throw error;
  }
  if (toAdd.length) {
    const { error } = await supabase.from("property_features").insert(toAdd.map((feature_key) => ({ property_id: property.id, feature_key })));
    if (error && error.code !== "23505") throw error;
  }
}

// ---------------------------------------------------------------------------
// Inserat speichern (wie saveListingContent + saveListingContact + syncDraftStatus)
// ---------------------------------------------------------------------------

export const LISTING_TEXT_LIMITS = {
  title: 140,
  short_description: 400,
  description: 12_000,
  location_description: 6000,
  equipment_description: 6000,
} as const;

export interface ListingInput {
  title: string | null;
  short_description: string | null;
  description: string | null;
  location_description: string | null;
  equipment_description: string | null;
  price: number | null;
  price_on_request: boolean;
  additional_costs: number | null;
  location_precision: Enums<"location_precision">;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  show_contact_phone: boolean;
  texts_confirmed: boolean;
}

type ListingTexts = Pick<ListingRow, "title" | "short_description" | "description" | "location_description" | "equipment_description">;

/** Vergleichbare Darstellung der in der App bearbeitbaren Texte (für «geändert seit Bestätigung»). */
export function listingTextsSignature(values: ListingTexts): string {
  const norm = (value: string | null) => (value ?? "").trim();
  return JSON.stringify([
    norm(values.title),
    norm(values.short_description),
    norm(values.description),
    norm(values.location_description),
    norm(values.equipment_description),
  ]);
}

const PHONE = /^\+?[0-9 ()/-]{6,24}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function saveListing(listing: ListingRow, data: ListingInput): Promise<void> {
  if (listing.status === "archived") throw localError("Archivierte Inserate können nicht mehr bearbeitet werden.");
  if (data.contact_phone && !PHONE.test(data.contact_phone)) throw localError("Bitte geben Sie eine gültige Telefonnummer ein, z. B. +41 79 123 45 67.");
  if (data.contact_email && (data.contact_email.length > 254 || !EMAIL.test(data.contact_email))) throw localError("Bitte geben Sie eine gültige E-Mail-Adresse ein.");
  if (data.show_contact_phone && !data.contact_phone) throw localError("Bitte geben Sie eine Telefonnummer an oder blenden Sie sie aus.");

  const textsChanged = listingTextsSignature(listing) !== listingTextsSignature(data);
  let confirmedAt = listing.texts_confirmed_at;
  if (!data.texts_confirmed) confirmedAt = null;
  else if (textsChanged || !listing.texts_confirmed_at) confirmedAt = new Date().toISOString();

  const { error } = await supabase
    .from("listings")
    .update({
      price: data.price_on_request ? null : data.price,
      price_on_request: data.price_on_request,
      additional_costs: listing.offer_type === "rent" ? data.additional_costs : null,
      title: data.title,
      short_description: data.short_description,
      description: data.description,
      location_description: data.location_description,
      equipment_description: data.equipment_description,
      location_precision: data.location_precision,
      contact_name: data.contact_name,
      show_contact_phone: data.show_contact_phone,
      texts_confirmed_at: confirmedAt,
    })
    .eq("id", listing.id);
  if (error) throw error;

  // E-Mail und Telefon sind privat und liegen getrennt vom öffentlich lesbaren Inserat
  const contact = { contact_email: data.contact_email, contact_phone: data.contact_phone };
  const { data: updated, error: contactError } = await supabase.from("listing_contacts").update(contact).eq("listing_id", listing.id).select("listing_id");
  if (contactError) throw contactError;
  if (!updated?.length) {
    const { error: insertError } = await supabase.from("listing_contacts").insert({ listing_id: listing.id, ...contact });
    if (insertError) throw insertError;
  }
}

/** Pflegt die Vorstufen Entwurf → In Bearbeitung → Bereit anhand der Pflichtangaben (wie syncDraftStatus). */
export async function syncDraftStatus(listingId: string, propertyId: string): Promise<void> {
  const { data: listing } = await supabase
    .from("listings")
    .select("id, status, title, description, short_description, price, price_on_request, texts_confirmed_at, postal_code, municipality")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing || !isDraftStatus(listing.status)) return;
  const [{ count }, settings] = await Promise.all([
    supabase.from("property_images").select("id", { count: "exact", head: true }).eq("property_id", propertyId).eq("status", "ready"),
    publishingSettings(),
  ]);
  const imageCount = count ?? 0;
  const filled = (value: string | null) => typeof value === "string" && value.trim() !== "";
  const ready =
    filled(listing.title) &&
    filled(listing.description) &&
    (listing.price !== null || listing.price_on_request) &&
    filled(listing.postal_code) &&
    filled(listing.municipality) &&
    Boolean(listing.texts_confirmed_at) &&
    imageCount >= Math.max(0, settings.minImages);
  const started = imageCount > 0 || Boolean(listing.title || listing.description || listing.short_description) || listing.price !== null || listing.price_on_request;
  const target: ListingStatus = ready ? "ready" : started ? "in_progress" : "draft";
  if (target === listing.status) return;
  // Nur Komfort: ein Fehler hier darf das Speichern nicht scheitern lassen
  await supabase.from("listings").update({ status: target }).eq("id", listing.id);
}

/** Statuswechsel über eine Benutzeraktion (wie changeListingStatus); die Datenbank prüft Übergang und Pflichtangaben erneut. */
export async function changeListingStatus(listingId: string, action: StatusAction): Promise<{ after: ListingStatus; copy: StatusActionCopy }> {
  const [{ data: listing, error }, settings] = await Promise.all([
    supabase.from("listings").select("id, status, offer_type, approved_at").eq("id", listingId).is("deleted_at", null).maybeSingle(),
    publishingSettings(),
  ]);
  if (error) throw error;
  if (!listing) throw new Error("not_found");
  const ctx: StatusActionContext = {
    status: listing.status,
    offerType: listing.offer_type,
    requireReview: settings.requireReview,
    approved: Boolean(listing.approved_at),
  };
  const target = statusActionTarget(action, ctx);
  if (!target || !isStatusActionAvailable(action, ctx)) throw new Error("invalid_status_transition");
  const { data, error: updateError } = await supabase.from("listings").update({ status: target }).eq("id", listingId).select("status").single();
  if (updateError) throw updateError;
  return { after: data.status, copy: statusActionCopy(action, ctx) };
}

/** Legt nach dem Archivieren ein neues, leeres Inserat an (wie createDraftListing). */
export async function createDraftListing(propertyId: string, email: string | null): Promise<void> {
  const { data: profile } = await supabase.from("profiles").select("first_name, last_name, display_name, phone").maybeSingle();
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() || profile?.display_name || null;
  const phone = profile?.phone && PHONE.test(profile.phone) ? profile.phone : null;
  const listingId = Crypto.randomUUID();
  const { error } = await supabase.from("listings").insert({
    id: listingId,
    property_id: propertyId,
    contact_name: name ? name.slice(0, 120) : null,
    location_precision: "area",
  } as Database["public"]["Tables"]["listings"]["Insert"]);
  if (error) throw error;
  const { error: contactError } = await supabase.from("listing_contacts").insert({ listing_id: listingId, contact_email: email, contact_phone: phone });
  if (contactError) throw contactError;
}

/**
 * Archiviert die Inserate und markiert die Immobilie als gelöscht – über dieselbe
 * Datenbankfunktion wie die Website (ein direktes Update lehnt die Zeilensicherheit ab).
 */
export async function softDeleteProperty(propertyId: string): Promise<void> {
  const { error } = await supabase.rpc("soft_delete_property", { p_property: propertyId });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Fotos: Bildunterschrift, Grundriss, Reihenfolge
// ---------------------------------------------------------------------------

export const CAPTION_MAX = 300;

export async function updatePhotoDetails(imageId: string, patch: { caption?: string | null; is_floor_plan?: boolean }): Promise<void> {
  const { error } = await supabase.from("property_images").update(patch).eq("id", imageId);
  if (error) throw error;
}

/** Speichert die neue Reihenfolge (nur geänderte Positionen, wie reorderImages). */
export async function reorderPhotos(images: Pick<ImageRow, "id" | "sort_order">[], orderedIds: string[]): Promise<void> {
  const current = new Map(images.map((image) => [image.id, image.sort_order]));
  const changes = orderedIds.map((id, index) => ({ id, sort_order: index })).filter((change) => current.get(change.id) !== change.sort_order);
  const results = await Promise.all(changes.map((change) => supabase.from("property_images").update({ sort_order: change.sort_order }).eq("id", change.id)));
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

// ---------------------------------------------------------------------------
// Aktuelles Inserat einer Immobilie (für die Verwaltungsseiten)
// ---------------------------------------------------------------------------

export interface ManagedListing {
  propertyId: string;
  organizationId: string | null;
  listingIds: string[];
  listing: Pick<ListingRow, "id" | "title" | "status" | "slug" | "offer_type" | "first_published_at" | "created_at"> | null;
}

export async function managedListing(propertyId: string): Promise<ManagedListing | null> {
  const [propertyRes, listingsRes] = await Promise.all([
    supabase.from("properties").select("id, organization_id").eq("id", propertyId).is("deleted_at", null).maybeSingle(),
    supabase
      .from("listings")
      .select("id, title, status, slug, offer_type, first_published_at, created_at")
      .eq("property_id", propertyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);
  if (propertyRes.error) throw propertyRes.error;
  if (listingsRes.error) throw listingsRes.error;
  if (!propertyRes.data) return null;
  const rows = listingsRes.data ?? [];
  return {
    propertyId,
    organizationId: propertyRes.data.organization_id,
    listingIds: rows.map((l) => l.id),
    listing: rows.find((l) => l.status !== "archived") ?? rows[0] ?? null,
  };
}

// ---------------------------------------------------------------------------
// Statistik
// ---------------------------------------------------------------------------

export interface ListingStatistics {
  published_at: string | null;
  views_total: number;
  favorites: number;
  inquiries: number;
  leads: number;
  viewings: number;
  series: { date: string; views: number; inquiries: number }[];
}

const toCount = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
};

export async function listingStatistics(listingId: string, days: 30 | 90): Promise<ListingStatistics> {
  const { data, error } = await supabase.rpc("get_listing_statistics", { p_listing_id: listingId, p_days: days });
  if (error) throw error;
  const raw = (data ?? {}) as Record<string, unknown>;
  const series = Array.isArray(raw.series) ? (raw.series as Record<string, unknown>[]) : [];
  return {
    published_at: typeof raw.published_at === "string" ? raw.published_at : null,
    views_total: toCount(raw.views_total),
    favorites: toCount(raw.favorites),
    inquiries: toCount(raw.inquiries),
    leads: toCount(raw.leads),
    viewings: toCount(raw.viewings),
    series: series.map((point) => ({ date: String(point.date ?? ""), views: toCount(point.views), inquiries: toCount(point.inquiries) })),
  };
}

/** Neue Anfragen und offene Besichtigungsanfragen je Inserat (für die Liste «Meine Immobilien»). */
export async function ownerBadges(listingIds: string[]): Promise<Record<string, { newLeads: number; openRequests: number }>> {
  const result: Record<string, { newLeads: number; openRequests: number }> = {};
  if (listingIds.length === 0) return result;
  const [leadsRes, viewingsRes] = await Promise.all([
    supabase.from("leads").select("listing_id").in("listing_id", listingIds).eq("status", "new").limit(1000),
    supabase
      .from("viewing_appointments")
      .select("listing_id")
      .in("listing_id", listingIds)
      .in("status", ["requested", "reschedule_requested"])
      .gt("ends_at", new Date().toISOString())
      .limit(1000),
  ]);
  if (leadsRes.error) throw leadsRes.error;
  if (viewingsRes.error) throw viewingsRes.error;
  const entry = (id: string) => (result[id] ??= { newLeads: 0, openRequests: 0 });
  for (const row of leadsRes.data ?? []) entry(row.listing_id).newLeads += 1;
  for (const row of viewingsRes.data ?? []) entry(row.listing_id).openRequests += 1;
  return result;
}

// ---------------------------------------------------------------------------
// Interessenten
// ---------------------------------------------------------------------------

export interface LeadItem {
  id: string;
  status: LeadStatus;
  rating: number | null;
  source: string;
  lastActivityAt: string;
  createdAt: string;
  conversationId: string | null;
  name: string;
}

async function profileNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return new Map();
  const { data } = await supabase.from("public_profiles").select("id, display_name").in("id", unique);
  const names = new Map<string, string>();
  for (const profile of data ?? []) if (profile.id && profile.display_name) names.set(profile.id, profile.display_name);
  return names;
}

export async function propertyLeads(listingIds: string[]): Promise<LeadItem[]> {
  if (listingIds.length === 0) return [];
  const { data, error } = await supabase
    .from("leads")
    .select("id, status, rating, source, last_activity_at, created_at, conversation_id, interested_id")
    .in("listing_id", listingIds)
    .order("last_activity_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const names = await profileNames((data ?? []).map((l) => l.interested_id));
  return (data ?? []).map((l) => ({
    id: l.id,
    status: l.status,
    rating: l.rating,
    source: l.source,
    lastActivityAt: l.last_activity_at,
    createdAt: l.created_at,
    conversationId: l.conversation_id,
    name: (l.interested_id ? names.get(l.interested_id) : null) ?? "Immovia-Mitglied",
  }));
}

export async function updateLead(leadId: string, changes: { status?: LeadStatus; rating?: number | null }): Promise<void> {
  const { data, error } = await supabase.from("leads").update(changes).eq("id", leadId).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("not_found");
}

// ---------------------------------------------------------------------------
// Zeit in Europe/Zurich (wie zurichLocalToUtc / utcToZurichParts der Website)
// ---------------------------------------------------------------------------

/** Offset von Europe/Zurich gegenüber UTC in Minuten. Ohne Zeitzonendaten: Offset des Geräts. */
function zurichOffsetMinutes(at: Date): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Zurich",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(at);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
    const offset = Math.round((asUtc - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000);
    if (Number.isFinite(offset) && Math.abs(offset) <= 180) return offset;
  } catch {
    // Zeitzonendaten fehlen: weiter unten Geräte-Offset
  }
  return -at.getTimezoneOffset();
}

/** Zürcher Ortszeit (JJJJ-MM-TT, HH:MM) → UTC-Zeitpunkt. */
export function zurichLocalToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  let utc = Date.UTC(y!, m! - 1, d!, hh!, mm!);
  for (let i = 0; i < 2; i++) utc = Date.UTC(y!, m! - 1, d!, hh!, mm!) - zurichOffsetMinutes(new Date(utc)) * 60_000;
  return new Date(utc);
}

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;
const pad = (n: number) => String(n).padStart(2, "0");

function zurichShifted(iso: string): Date {
  const at = new Date(iso);
  return new Date(at.getTime() + zurichOffsetMinutes(at) * 60_000);
}

/** «Sa, 14.11.2026» in Zürcher Ortszeit. */
export function formatDay(iso: string): string {
  const d = zurichShifted(iso);
  return `${WEEKDAYS[d.getUTCDay()]}, ${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

/** «10:00» in Zürcher Ortszeit. */
export function formatTime(iso: string): string {
  const d = zurichShifted(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** «Sa, 14.11.2026, 10:00–10:30 Uhr» */
export function formatSlotRange(startsAt: string, endsAt: string): string {
  return `${formatDay(startsAt)}, ${formatTime(startsAt)}–${formatTime(endsAt)} Uhr`;
}

/** «14.11.2026» (ohne Wochentag), z. B. für Aktivitätsdaten. */
export function formatDate(iso: string): string {
  const d = zurichShifted(iso);
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

/** «TT.MM.JJJJ» → «JJJJ-MM-TT» oder null, wenn es kein gültiger Kalendertag ist. */
export function parseSwissDate(input: string): string | null {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(input.trim());
  if (!match) return null;
  const d = Number(match[1]);
  const m = Number(match[2]);
  const y = Number(match[3]);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** «JJJJ-MM-TT» → «TT.MM.JJJJ» */
export function isoToSwissDate(iso: string | null): string {
  const match = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return match ? `${match[3]}.${match[2]}.${match[1]}` : "";
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// ---------------------------------------------------------------------------
// Besichtigungen (wie src/services/viewings.ts)
// ---------------------------------------------------------------------------

const ACTIVE_APPOINTMENTS: AppointmentStatus[] = ["requested", "confirmed", "reschedule_requested"];

export interface AppointmentItem {
  id: string;
  slotId: string | null;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  guestName: string | null;
  guestMessage: string | null;
  cancelReason: string | null;
  conversationId: string | null;
  /** Der Termin hat (zum Zeitpunkt des Ladens) bereits begonnen – erst dann sind «Durchgeführt» / «Nicht erschienen» möglich. */
  started: boolean;
}

export interface SlotItem {
  id: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  note: string | null;
  booked: number;
  appointments: AppointmentItem[];
}

export interface SellerSchedule {
  slots: SlotItem[];
  requests: AppointmentItem[];
  past: AppointmentItem[];
}

/** Zeitfenster ab jetzt und Termine (inkl. der letzten 30 Tage) eines Inserats. */
export async function sellerSchedule(listingId: string): Promise<SellerSchedule> {
  const now = new Date();
  const pastFrom = new Date(now.getTime() - 30 * 86_400_000);
  const [slotsRes, appointmentsRes] = await Promise.all([
    supabase
      .from("viewing_slots")
      .select("id, starts_at, ends_at, capacity, note")
      .eq("listing_id", listingId)
      .eq("is_cancelled", false)
      .gte("ends_at", now.toISOString())
      .order("starts_at", { ascending: true })
      .limit(400),
    supabase
      .from("viewing_appointments")
      .select("id, slot_id, starts_at, ends_at, status, guest_id, guest_message, cancel_reason, conversation_id")
      .eq("listing_id", listingId)
      .gte("ends_at", pastFrom.toISOString())
      .order("starts_at", { ascending: true })
      .limit(1000),
  ]);
  if (slotsRes.error) throw slotsRes.error;
  if (appointmentsRes.error) throw appointmentsRes.error;

  const rows = appointmentsRes.data ?? [];
  const nowMs = now.getTime();
  const names = await profileNames(rows.map((a) => a.guest_id));
  const items: AppointmentItem[] = rows.map((a) => ({
    id: a.id,
    slotId: a.slot_id,
    startsAt: a.starts_at,
    endsAt: a.ends_at,
    status: a.status,
    guestName: a.guest_id ? (names.get(a.guest_id) ?? "Immovia-Mitglied") : null,
    guestMessage: a.guest_message,
    cancelReason: a.cancel_reason,
    conversationId: a.conversation_id,
    started: new Date(a.starts_at).getTime() <= nowMs,
  }));

  return {
    slots: (slotsRes.data ?? []).map((s) => ({
      id: s.id,
      startsAt: s.starts_at,
      endsAt: s.ends_at,
      capacity: s.capacity,
      note: s.note,
      booked: items.filter((a) => a.slotId === s.id && ACTIVE_APPOINTMENTS.includes(a.status)).length,
      appointments: items.filter((a) => a.slotId === s.id && a.status !== "cancelled"),
    })),
    requests: items.filter((a) => (a.status === "requested" || a.status === "reschedule_requested") && new Date(a.endsAt).getTime() > nowMs),
    past: items
      .filter((a) => new Date(a.startsAt).getTime() <= nowMs && ["confirmed", "completed", "no_show"].includes(a.status))
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
  };
}

export const SLOT_DURATION_OPTIONS = [
  { value: 0, label: "Ganzer Zeitraum" },
  { value: 15, label: "15 Min." },
  { value: 30, label: "30 Min." },
  { value: 45, label: "45 Min." },
  { value: 60, label: "1 Std." },
] as const;

const MAX_SLOT_MINUTES = 8 * 60;
const MAX_SLOTS_PER_REQUEST = 100;

export interface SlotFormInput {
  /** TT.MM.JJJJ (Zürich) */
  date: string;
  /** HH:MM (Zürich) */
  startTime: string;
  endTime: string;
  /** Dauer pro Termin in Minuten; 0 = ganzer Zeitraum als ein Termin */
  durationMinutes: number;
  capacity: number;
  note: string;
}

/** Legt ein Zeitfenster an oder teilt den Zeitraum in Einzeltermine (wie createSlots, ohne Wiederholung). */
export async function createSlots(listingId: string, input: SlotFormInput): Promise<number> {
  const date = parseSwissDate(input.date);
  if (!date) throw localError("Bitte geben Sie ein gültiges Datum im Format TT.MM.JJJJ ein.");
  if (!TIME_PATTERN.test(input.startTime) || !TIME_PATTERN.test(input.endTime)) throw localError("Bitte geben Sie die Uhrzeit im Format HH:MM ein.");
  const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const toTime = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  const start = toMinutes(input.startTime);
  const end = toMinutes(input.endTime);
  if (end <= start) throw localError("Die Endzeit muss nach der Startzeit liegen.");
  const span = end - start;
  const duration = Math.trunc(input.durationMinutes);
  if (duration === 0 && span > MAX_SLOT_MINUTES) throw localError("Ein Zeitfenster darf höchstens 8 Stunden dauern. Teilen Sie den Zeitraum in Termine auf.");
  if (duration > span) throw localError("Die Dauer pro Termin ist länger als der gewählte Zeitraum.");
  if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 50) throw localError("Bitte 1 bis 50 Personen pro Zeitfenster angeben.");
  const note = input.note.trim();
  if (note.length > 300) throw localError("Der Hinweis darf höchstens 300 Zeichen lang sein.");

  const chunk = duration === 0 ? span : duration;
  if (Math.floor(span / chunk) > MAX_SLOTS_PER_REQUEST) throw localError(`Pro Vorgang sind höchstens ${MAX_SLOTS_PER_REQUEST} Zeitfenster möglich.`);
  const slots: { startsAt: Date; endsAt: Date }[] = [];
  let previousEnd = Number.NEGATIVE_INFINITY;
  for (let from = start; from + chunk <= end; from += chunk) {
    const startsAt = zurichLocalToUtc(date, toTime(from));
    const endsAt = zurichLocalToUtc(date, toTime(from + chunk));
    // Nacht der Zeitumstellung: leere oder sich überschneidende Zeitfenster auslassen
    if (endsAt.getTime() <= startsAt.getTime() || startsAt.getTime() < previousEnd) continue;
    previousEnd = endsAt.getTime();
    slots.push({ startsAt, endsAt });
  }
  if (!slots.length) throw localError("Mit diesen Angaben entsteht kein Zeitfenster.");
  const past = slots.find((slot) => slot.startsAt.getTime() <= Date.now());
  if (past) throw localError(`Das Zeitfenster am ${formatDay(past.startsAt.toISOString())} um ${formatTime(past.startsAt.toISOString())} Uhr liegt in der Vergangenheit.`);

  const { error } = await supabase.from("viewing_slots").insert(
    slots.map((slot) => ({
      id: Crypto.randomUUID(),
      listing_id: listingId,
      starts_at: slot.startsAt.toISOString(),
      ends_at: slot.endsAt.toISOString(),
      capacity: input.capacity,
      note: note || null,
    })),
  );
  if (error) throw error;
  return slots.length;
}

/** Löscht ein Zeitfenster ohne aktive Termine. */
export async function deleteSlot(slotId: string): Promise<void> {
  const { data, error } = await supabase.from("viewing_slots").delete().eq("id", slotId).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("not_found");
}

/** Sagt ein Zeitfenster mit allen Terminen ab; die Betroffenen werden benachrichtigt. Liefert die Anzahl abgesagter Termine. */
export async function cancelSlot(slotId: string, reason?: string): Promise<number> {
  const trimmed = reason?.trim();
  const { data, error } = await supabase.rpc("cancel_viewing_slot", { p_slot_id: slotId, ...(trimmed ? { p_reason: trimmed } : {}) });
  if (error) throw error;
  return Number(data ?? 0);
}

export type SellerAppointmentAction = "confirm" | "cancel" | "complete" | "no_show";

export async function updateAppointment(appointmentId: string, action: SellerAppointmentAction, reason?: string): Promise<void> {
  const trimmed = reason?.trim();
  const { error } = await supabase.rpc("update_viewing_status", {
    p_appointment_id: appointmentId,
    p_action: action,
    ...(trimmed ? { p_reason: trimmed } : {}),
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Dokumente (wie src/services/documents.ts)
// ---------------------------------------------------------------------------

export type DocumentItem = Pick<
  Tables<"property_documents">,
  "id" | "title" | "category" | "file_name" | "mime_type" | "size_bytes" | "visibility" | "contains_personal_data" | "created_at"
>;

export async function propertyDocuments(propertyId: string): Promise<DocumentItem[]> {
  const { data, error } = await supabase
    .from("property_documents")
    .select("id, title, category, file_name, mime_type, size_bytes, visibility, contains_personal_data, created_at")
    .eq("property_id", propertyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function setDocumentVisibility(documentId: string, visibility: DocumentVisibility): Promise<void> {
  const { data: canManage } = await supabase.rpc("can_manage_document", { p_document: documentId });
  if (!canManage) throw new Error("forbidden");
  const { data, error } = await supabase.from("property_documents").update({ visibility }).eq("id", documentId).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("not_found");
}

/** Entfernt die Datei aus dem Speicher und markiert den Datensatz als gelöscht. */
export async function deleteDocument(documentId: string): Promise<void> {
  const { data: doc } = await supabase.from("property_documents").select("id, storage_path").eq("id", documentId).is("deleted_at", null).maybeSingle();
  if (!doc) throw new Error("not_found");
  const { data: canManage } = await supabase.rpc("can_manage_document", { p_document: doc.id });
  if (!canManage) throw new Error("forbidden");
  // Zuerst die Datei entfernen: danach ist sie (wegen deleted_at) nicht mehr lesbar
  const { error: storageError } = await supabase.storage.from("documents").remove([doc.storage_path]);
  if (storageError) throw localError("Die Datei konnte nicht gelöscht werden. Bitte versuchen Sie es erneut.");
  const { error } = await supabase.from("property_documents").update({ deleted_at: new Date().toISOString() }).eq("id", doc.id);
  if (error) throw error;
}

/** Kurzlebiger Link (60 s) zum Ansehen eines Dokuments. */
export async function documentUrl(documentId: string): Promise<string> {
  const { data: doc } = await supabase.from("property_documents").select("storage_path").eq("id", documentId).is("deleted_at", null).maybeSingle();
  if (!doc) throw new Error("not_found");
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.storage_path, 60);
  if (error || !data) throw localError("Das Dokument konnte nicht geöffnet werden. Bitte versuchen Sie es erneut.");
  return data.signedUrl;
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null) return "–";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
