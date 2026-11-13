import type { ListingRow, PropertyRow } from "@/lib/api";
import {
  AMENITY_FLAGS,
  LISTING_TEXT_LIMITS,
  isFieldVisible,
  isoToSwissDate,
  localError,
  parseSwissDate,
  type AmenityKey,
  type ConditionalField,
  type FeatureKey,
  type ListingInput,
  type PropertyDetailsPatch,
} from "@/lib/api-owner";
import type { Enums } from "@/lib/supabase";

/**
 * Formularzustand des Editors und die Umwandlung in Datenbankwerte. Die Regeln (Wertebereiche,
 * Schrittweiten, Textlängen) entsprechen src/lib/validation/property.ts und listing.ts der Website.
 */

export interface PropertyForm {
  rooms: string;
  bathrooms: string;
  living_area: string;
  plot_area: string;
  year_built: string;
  floor: string;
  floors_total: string;
  condition: Enums<"property_condition"> | null;
  heating_type: Enums<"heating_type"> | null;
  energy_label: string | null;
  flags: Record<AmenityKey, boolean>;
  pets_allowed: boolean | null;
  garage_spaces: string;
  underground_parking_spaces: string;
  outdoor_parking_spaces: string;
  /** TT.MM.JJJJ */
  available_from: string;
  available_by_arrangement: boolean;
  service_charges: string;
  special_features: string;
  features: FeatureKey[];
}

export interface ListingForm {
  title: string;
  short_description: string;
  description: string;
  location_description: string;
  equipment_description: string;
  price: string;
  price_on_request: boolean;
  additional_costs: string;
  location_precision: Enums<"location_precision">;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  show_contact_phone: boolean;
  texts_confirmed: boolean;
}

const str = (value: number | null) => (value === null || value === undefined ? "" : String(Number(value)));
const count = (value: number | null) => (value ? String(value) : "");

export function initialPropertyForm(property: PropertyRow, features: FeatureKey[]): PropertyForm {
  return {
    rooms: str(property.rooms),
    bathrooms: str(property.bathrooms),
    living_area: str(property.living_area),
    plot_area: str(property.plot_area),
    year_built: str(property.year_built),
    floor: str(property.floor),
    floors_total: str(property.floors_total),
    condition: property.condition,
    heating_type: property.heating_type,
    energy_label: property.energy_label,
    flags: Object.fromEntries(AMENITY_FLAGS.map(({ key }) => [key, property[key]])) as Record<AmenityKey, boolean>,
    pets_allowed: property.pets_allowed,
    garage_spaces: count(property.garage_spaces),
    underground_parking_spaces: count(property.underground_parking_spaces),
    outdoor_parking_spaces: count(property.outdoor_parking_spaces),
    available_from: isoToSwissDate(property.available_from),
    available_by_arrangement: property.available_by_arrangement,
    service_charges: str(property.service_charges),
    special_features: property.special_features ?? "",
    features,
  };
}

export function initialListingForm(listing: ListingRow, contact: { email: string | null; phone: string | null }): ListingForm {
  return {
    title: listing.title ?? "",
    short_description: listing.short_description ?? "",
    description: listing.description ?? "",
    location_description: listing.location_description ?? "",
    equipment_description: listing.equipment_description ?? "",
    price: str(listing.price),
    price_on_request: listing.price_on_request,
    additional_costs: str(listing.additional_costs),
    location_precision: listing.location_precision,
    contact_name: listing.contact_name ?? "",
    contact_phone: contact.phone ?? "",
    contact_email: contact.email ?? "",
    show_contact_phone: listing.show_contact_phone,
    texts_confirmed: Boolean(listing.texts_confirmed_at),
  };
}

interface NumberRule {
  min: number;
  max: number;
  integer?: boolean;
  step?: number;
  decimals?: number;
  message?: string;
}

/** «1’250.50», «4,5» → Zahl; leer → null; ungültig → Fehler mit Feldname. */
function parseField(label: string, raw: string, rule: NumberRule): number | null {
  const cleaned = raw.trim().replace(/['’`\s]/g, "").replace(",", ".");
  if (cleaned === "") return null;
  const value = /^[-+]?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : Number.NaN;
  const fail = () => localError(rule.message ?? `${label}: Bitte geben Sie einen Wert zwischen ${rule.min} und ${rule.max} ein.`);
  if (!Number.isFinite(value)) throw localError(`${label}: Bitte geben Sie eine gültige Zahl ein.`);
  if (rule.integer && !Number.isInteger(value)) throw localError(`${label}: Bitte geben Sie eine ganze Zahl ein.`);
  if (rule.step !== undefined && Math.abs(value / rule.step - Math.round(value / rule.step)) > 1e-9) throw fail();
  if (value < rule.min || value > rule.max) throw fail();
  if (rule.decimals === undefined) return value;
  const factor = 10 ** rule.decimals;
  return Math.round(value * factor) / factor;
}

function optionalText(label: string, raw: string, max: number): string | null {
  const value = raw.trim();
  if (value.length > max) throw localError(`${label}: Bitte höchstens ${max} Zeichen verwenden.`);
  return value === "" ? null : value;
}

/** Prüft die Objektdaten und liefert nur die Felder, die für diesen Objekttyp angezeigt werden. */
export function buildPropertyPatch(form: PropertyForm, property: PropertyRow, offer: Enums<"offer_type">): PropertyDetailsPatch {
  const visible = (field: ConditionalField) => isFieldVisible(field, property.property_type, offer);
  const year = new Date().getFullYear();
  const patch: PropertyDetailsPatch = {};

  if (visible("rooms")) {
    patch.rooms = parseField("Zimmer", form.rooms, { min: 0.5, max: 50, step: 0.5, message: "Zimmer bitte in halben Schritten angeben (z. B. 3.5)." });
  }
  if (visible("bathrooms")) patch.bathrooms = parseField("Badezimmer", form.bathrooms, { min: 0, max: 50, integer: true });
  if (visible("living_area")) patch.living_area = parseField("Wohnfläche", form.living_area, { min: 1, max: 19_999, decimals: 1 });
  if (visible("plot_area")) patch.plot_area = parseField("Grundstücksfläche", form.plot_area, { min: 1, max: 9_999_999, decimals: 1 });
  if (visible("year_built")) {
    patch.year_built = parseField("Baujahr", form.year_built, { min: 1000, max: year + 10, integer: true, message: "Bitte geben Sie ein gültiges Baujahr an (vierstellig)." });
  }
  if (visible("floor")) patch.floor = parseField("Etage", form.floor, { min: -5, max: 100, integer: true });
  if (visible("floors_total")) patch.floors_total = parseField("Anzahl Stockwerke", form.floors_total, { min: 1, max: 120, integer: true });
  if (visible("condition")) patch.condition = form.condition;
  if (visible("heating_type")) patch.heating_type = form.heating_type;
  if (visible("energy_label")) patch.energy_label = form.energy_label;
  for (const { key } of AMENITY_FLAGS) if (visible(key)) patch[key] = form.flags[key];
  if (visible("pets_allowed")) patch.pets_allowed = form.pets_allowed;
  if (visible("garage_spaces")) {
    patch.garage_spaces = parseField("Garagenplätze", form.garage_spaces, { min: 0, max: 500, integer: true }) ?? 0;
    patch.underground_parking_spaces = parseField("Tiefgaragenplätze", form.underground_parking_spaces, { min: 0, max: 500, integer: true }) ?? 0;
    patch.outdoor_parking_spaces = parseField("Aussenparkplätze", form.outdoor_parking_spaces, { min: 0, max: 500, integer: true }) ?? 0;
  }
  if (visible("service_charges")) patch.service_charges = parseField("Nebenkosten", form.service_charges, { min: 0, max: 100_000, decimals: 2 });

  patch.available_by_arrangement = form.available_by_arrangement;
  if (form.available_by_arrangement || form.available_from.trim() === "") {
    patch.available_from = null;
  } else {
    const iso = parseSwissDate(form.available_from);
    if (!iso) throw localError("Verfügbar ab: Bitte geben Sie das Datum im Format TT.MM.JJJJ ein.");
    const y = Number(iso.slice(0, 4));
    if (y < 2000 || y > year + 10) throw localError("Verfügbar ab: Bitte prüfen Sie das Datum.");
    patch.available_from = iso;
  }
  patch.special_features = optionalText("Besonderheiten", form.special_features, 4000);
  return patch;
}

export function buildListingInput(form: ListingForm, listing: ListingRow): ListingInput {
  const price = parseField(listing.offer_type === "rent" ? "Miete" : "Kaufpreis", form.price, { min: 0, max: 9_999_999_999, decimals: 2 });
  if (price !== null && price <= 0 && !form.price_on_request) throw localError("Der Preis muss grösser als 0 sein.");
  return {
    title: optionalText("Titel", form.title, LISTING_TEXT_LIMITS.title),
    short_description: optionalText("Kurzbeschreibung", form.short_description, LISTING_TEXT_LIMITS.short_description),
    description: optionalText("Beschreibung", form.description, LISTING_TEXT_LIMITS.description),
    location_description: optionalText("Lagebeschreibung", form.location_description, LISTING_TEXT_LIMITS.location_description),
    equipment_description: optionalText("Ausstattungsbeschreibung", form.equipment_description, LISTING_TEXT_LIMITS.equipment_description),
    price,
    price_on_request: form.price_on_request,
    additional_costs: parseField("Nebenkosten", form.additional_costs, { min: 0, max: 99_999_999, decimals: 2 }),
    location_precision: form.location_precision,
    contact_name: optionalText("Kontaktname", form.contact_name, 120),
    contact_phone: form.contact_phone.trim() || null,
    contact_email: form.contact_email.trim().toLowerCase() || null,
    show_contact_phone: form.show_contact_phone,
    texts_confirmed: form.texts_confirmed,
  };
}

/** Adresse, wie sie mit der gewählten Standortanzeige im Inserat erscheint. */
export function publicAddressPreview(property: PropertyRow, precision: Enums<"location_precision">): string {
  const place = [property.postal_code, property.municipality].filter(Boolean).join(" ");
  const street = precision === "exact" ? [property.street, property.house_number].filter(Boolean).join(" ") : precision === "street" ? (property.street ?? "") : "";
  return [street, place].filter(Boolean).join(", ");
}
