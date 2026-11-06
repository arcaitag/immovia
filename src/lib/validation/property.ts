import { z } from "zod";
import { CANTON_CODES, FEATURE_CATALOG, RENOVATION_CATEGORIES, type FeatureKey, type RenovationCategory } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import { ENERGY_LABELS } from "@/lib/properties/fields";
import { Constants } from "@/types/database";

/**
 * Validierung der Immobiliendaten (Schritt 1 des Verkaufsassistenten).
 * Formularwerte sind Strings (wie sie aus den Eingabefeldern kommen); die Schemas
 * wandeln sie in Datenbanktypen um. Dieselben Schemas laufen im Browser (React Hook
 * Form) und in den Server Actions.
 */

const NUMBER_NOISE = /['’`\s]/g;

/** «1'250.50», «4,5», « 112 » → Zahl. Leer → null, ungültig → NaN. */
export function parseSwissNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(NUMBER_NOISE, "").replace(",", ".");
  if (cleaned === "") return null;
  if (!/^[-+]?\d+(\.\d+)?$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

export interface NumberRule {
  min: number;
  max: number | (() => number);
  integer?: boolean;
  /** Erlaubte Schrittweite, z. B. 0.5 für Zimmer */
  step?: number;
  /** Rundung auf Nachkommastellen (Spaltenpräzision) */
  decimals?: number;
  messages?: { range?: string; step?: string; integer?: string; required?: string };
}

function resolveMax(rule: NumberRule): number {
  return typeof rule.max === "function" ? rule.max() : rule.max;
}

/** Prüft eine Zahl gegen eine Regel und liefert die Fehlermeldung oder null. */
export function validateNumber(value: number, rule: NumberRule): string | null {
  if (!Number.isFinite(value)) return "Bitte geben Sie eine gültige Zahl ein.";
  if (rule.integer && !Number.isInteger(value)) return rule.messages?.integer ?? "Bitte geben Sie eine ganze Zahl ein.";
  if (rule.step !== undefined) {
    const ratio = value / rule.step;
    if (Math.abs(ratio - Math.round(ratio)) > 1e-9) {
      return rule.messages?.step ?? `Bitte in Schritten von ${String(rule.step)} angeben.`;
    }
  }
  const max = resolveMax(rule);
  if (value < rule.min || value > max) {
    return rule.messages?.range ?? `Bitte geben Sie einen Wert zwischen ${formatNumber(rule.min, 2)} und ${formatNumber(max, 2)} ein.`;
  }
  return null;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Optionale Zahl: leer → null. */
export function optionalNumber(rule: NumberRule) {
  return z.string().transform((raw, ctx): number | null => {
    const parsed = parseSwissNumber(raw);
    if (parsed === null) return null;
    const message = validateNumber(parsed, rule);
    if (message) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return rule.decimals !== undefined ? roundTo(parsed, rule.decimals) : parsed;
  });
}

/** Pflichtzahl: leer → Fehler. */
export function requiredNumber(rule: NumberRule) {
  return z.string().transform((raw, ctx): number => {
    const parsed = parseSwissNumber(raw);
    if (parsed === null) {
      ctx.addIssue({ code: "custom", message: rule.messages?.required ?? "Bitte geben Sie einen Wert ein." });
      return z.NEVER;
    }
    const message = validateNumber(parsed, rule);
    if (message) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return rule.decimals !== undefined ? roundTo(parsed, rule.decimals) : parsed;
  });
}

/** Anzahl (z. B. Parkplätze): leer → 0. */
export function countNumber(rule: NumberRule) {
  return z.string().transform((raw, ctx): number => {
    const parsed = parseSwissNumber(raw);
    if (parsed === null) return 0;
    const message = validateNumber(parsed, rule);
    if (message) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return parsed;
  });
}

/** Optionaler Text: getrimmt, leer → null. */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Bitte höchstens ${formatNumber(max)} Zeichen verwenden.`)
    .transform((value) => (value === "" ? null : value));
}

export function requiredText(max: number, requiredMessage: string) {
  return z.string().trim().min(1, requiredMessage).max(max, `Bitte höchstens ${formatNumber(max)} Zeichen verwenden.`);
}

/** Auswahlfeld mit leerer Option: "" → null, sonst einer der erlaubten Werte. */
export function optionalEnum<const T extends readonly string[]>(values: T, message = "Bitte wählen Sie einen gültigen Wert.") {
  return z.string().transform((raw, ctx): T[number] | null => {
    const value = raw.trim();
    if (value === "") return null;
    if (!(values as readonly string[]).includes(value)) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return value as T[number];
  });
}

/** Pflicht-Auswahlfeld (Eingabe als String, z. B. aus einem nativen Select). */
export function requiredEnum<const T extends readonly string[]>(values: T, message: string) {
  return z.string().transform((raw, ctx): T[number] => {
    const value = raw.trim();
    if (!(values as readonly string[]).includes(value)) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return value as T[number];
  });
}

const POSTAL_CODE = /^[1-9]\d{3}$/;
const POSTAL_CODE_MESSAGE = "Bitte geben Sie eine gültige Schweizer PLZ mit 4 Ziffern ein.";

export const postalCodeField = z.string().transform((raw, ctx): string | null => {
  const value = raw.trim();
  if (value === "") return null;
  if (!POSTAL_CODE.test(value)) {
    ctx.addIssue({ code: "custom", message: POSTAL_CODE_MESSAGE });
    return z.NEVER;
  }
  return value;
});

export const requiredPostalCodeField = z
  .string()
  .trim()
  .min(1, "Bitte geben Sie die PLZ ein.")
  .regex(POSTAL_CODE, POSTAL_CODE_MESSAGE);

export const cantonField = optionalEnum(CANTON_CODES, "Bitte wählen Sie einen Kanton.");

function currentYear(): number {
  return new Date().getFullYear();
}

/** Datum im Format JJJJ-MM-TT, leer → null. */
export const optionalDateField = z.string().transform((raw, ctx): string | null => {
  const value = raw.trim();
  if (value === "") return null;
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    ctx.addIssue({ code: "custom", message: "Bitte geben Sie ein gültiges Datum ein." });
    return z.NEVER;
  }
  const year = parsed.getUTCFullYear();
  if (year < 2000 || year > currentYear() + 10) {
    ctx.addIssue({ code: "custom", message: "Bitte prüfen Sie das Datum." });
    return z.NEVER;
  }
  return value;
});

export const ROOM_RULE: NumberRule = {
  min: 0.5,
  max: 50,
  step: 0.5,
  messages: {
    step: "Zimmer bitte in halben Schritten angeben (z. B. 3.5).",
    range: "Bitte geben Sie zwischen 0.5 und 50 Zimmer an.",
  },
};

export const YEAR_BUILT_RULE: NumberRule = {
  min: 1000,
  max: () => currentYear() + 10,
  integer: true,
  messages: { range: "Bitte geben Sie ein gültiges Baujahr an (vierstellig)." },
};

export const YEAR_RENOVATED_RULE: NumberRule = {
  min: 1000,
  max: () => currentYear() + 5,
  integer: true,
  messages: { range: "Bitte geben Sie ein gültiges Renovationsjahr an (vierstellig)." },
};

const PROPERTY_TYPE_VALUES = Constants.public.Enums.property_type;
const OFFER_TYPE_VALUES = Constants.public.Enums.offer_type;
const FEATURE_KEY_VALUES = Object.keys(FEATURE_CATALOG) as [FeatureKey, ...FeatureKey[]];
const RENOVATION_CATEGORY_VALUES = Object.keys(RENOVATION_CATEGORIES) as [RenovationCategory, ...RenovationCategory[]];

export const featureKeysSchema = z
  .array(z.enum(FEATURE_KEY_VALUES, { error: "Unbekanntes Merkmal." }))
  .max(FEATURE_KEY_VALUES.length)
  .transform((keys) => Array.from(new Set(keys)));

/**
 * Alle Felder des Erfassungsformulars (ohne Kreuzprüfungen, damit .partial() für
 * das automatische Zwischenspeichern einzelner Felder funktioniert).
 */
export const propertyFieldsSchema = z.object({
  property_type: z.enum(PROPERTY_TYPE_VALUES, { error: "Bitte wählen Sie einen Immobilientyp." }),
  offer_type: z.enum(OFFER_TYPE_VALUES, { error: "Bitte wählen Sie Verkauf oder Vermietung." }),
  internal_name: optionalText(120),

  street: optionalText(120),
  house_number: optionalText(12),
  postal_code: postalCodeField,
  municipality: optionalText(80),
  canton: cantonField,
  latitude: z.number().min(45.7).max(47.9).nullable(),
  longitude: z.number().min(5.8).max(10.6).nullable(),
  egid: z.number().int().positive().nullable(),

  rooms: optionalNumber(ROOM_RULE),
  bathrooms: optionalNumber({ min: 0, max: 50, integer: true }),
  living_area: optionalNumber({ min: 1, max: 19_999, decimals: 1 }),
  gross_living_area: optionalNumber({ min: 1, max: 29_999, decimals: 1 }),
  usable_area: optionalNumber({ min: 1, max: 199_999, decimals: 1 }),
  plot_area: optionalNumber({ min: 1, max: 9_999_999, decimals: 1 }),

  year_built: optionalNumber(YEAR_BUILT_RULE),
  year_renovated: optionalNumber(YEAR_RENOVATED_RULE),
  floor: optionalNumber({ min: -5, max: 100, integer: true }),
  floors_total: optionalNumber({ min: 1, max: 120, integer: true }),

  condition: optionalEnum(Constants.public.Enums.property_condition),
  heating_type: optionalEnum(Constants.public.Enums.heating_type),
  energy_label: optionalEnum(ENERGY_LABELS, "Bitte wählen Sie eine GEAK-Klasse von A bis G."),
  energy_demand_kwh: optionalNumber({ min: 0, max: 2000, decimals: 1 }),
  is_minergie: z.boolean(),

  has_balcony: z.boolean(),
  has_terrace: z.boolean(),
  has_garden: z.boolean(),
  has_garage: z.boolean(),
  has_elevator: z.boolean(),
  has_cellar: z.boolean(),
  has_attic: z.boolean(),
  is_wheelchair_accessible: z.boolean(),
  pets_allowed: z.enum(["", "yes", "no"]).transform((value) => (value === "" ? null : value === "yes")),

  garage_spaces: countNumber({ min: 0, max: 500, integer: true }),
  underground_parking_spaces: countNumber({ min: 0, max: 500, integer: true }),
  outdoor_parking_spaces: countNumber({ min: 0, max: 500, integer: true }),

  available_from: optionalDateField,
  available_by_arrangement: z.boolean(),
  service_charges: optionalNumber({ min: 0, max: 100_000, decimals: 2 }),
  ownership_type: optionalEnum(Constants.public.Enums.ownership_type),
  special_features: optionalText(4000),
  view_description: optionalText(300),

  features: featureKeysSchema,
});

export type PropertyFormValues = z.input<typeof propertyFieldsSchema>;
export type PropertyFieldsData = z.output<typeof propertyFieldsSchema>;
export type PropertyFormField = keyof PropertyFormValues;
export const PROPERTY_FORM_FIELDS = Object.keys(propertyFieldsSchema.shape) as PropertyFormField[];

export interface ConsistencyIssue {
  field: "year_renovated" | "floor";
  message: string;
}

/** Kreuzprüfungen zwischen Feldern (laufen im Formular und nach dem Zusammenführen auf dem Server). */
export function propertyConsistencyIssues(values: {
  year_built?: number | null;
  year_renovated?: number | null;
  floor?: number | null;
  floors_total?: number | null;
}): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  if (
    typeof values.year_built === "number" &&
    typeof values.year_renovated === "number" &&
    values.year_renovated < values.year_built
  ) {
    issues.push({ field: "year_renovated", message: "Die Renovation kann nicht vor dem Baujahr liegen." });
  }
  if (typeof values.floor === "number" && typeof values.floors_total === "number" && values.floor > values.floors_total) {
    issues.push({ field: "floor", message: "Die Etage liegt über der Anzahl Stockwerke des Gebäudes." });
  }
  return issues;
}

/** Vollständiges Formular inkl. Kreuzprüfungen (React Hook Form). */
export const propertyFormSchema = propertyFieldsSchema.superRefine((values, ctx) => {
  for (const issue of propertyConsistencyIssues(values)) {
    ctx.addIssue({ code: "custom", path: [issue.field], message: issue.message });
  }
});

/** Teilaktualisierung beim Zwischenspeichern: nur bekannte Felder, jedes einzeln geprüft. */
export const propertyPatchSchema = propertyFieldsSchema.partial().strict();
export type PropertyPatch = z.output<typeof propertyPatchSchema>;

/** Neue Immobilie (Start des Assistenten). */
export const createPropertySchema = z.object({
  property_type: z.enum(PROPERTY_TYPE_VALUES, { error: "Bitte wählen Sie einen Immobilientyp." }),
  offer_type: z.enum(OFFER_TYPE_VALUES, { error: "Bitte wählen Sie Verkauf oder Vermietung." }),
  street: optionalText(120),
  house_number: optionalText(12),
  postal_code: requiredPostalCodeField,
  municipality: requiredText(80, "Bitte geben Sie die Gemeinde ein."),
  canton: requiredEnum(CANTON_CODES, "Bitte wählen Sie den Kanton."),
  latitude: z.number().min(45.7).max(47.9).nullable(),
  longitude: z.number().min(5.8).max(10.6).nullable(),
  egid: z.number().int().positive().nullable(),
  organization_id: z
    .union([z.literal(""), z.uuid("Ungültiges Firmenkonto.")])
    .transform((value) => (value === "" ? null : value)),
  goal: z.enum(["", "bewertung"]).default(""),
});

export type CreatePropertyInput = z.input<typeof createPropertySchema>;
export type CreatePropertyData = z.output<typeof createPropertySchema>;

export const renovationSchema = z.object({
  year: requiredNumber({
    min: 1900,
    max: () => currentYear() + 2,
    integer: true,
    messages: { required: "Bitte geben Sie das Jahr an.", range: "Bitte ein Jahr ab 1900 angeben." },
  }),
  category: z.enum(RENOVATION_CATEGORY_VALUES, { error: "Bitte wählen Sie eine Kategorie." }),
  description: z
    .string()
    .trim()
    .min(2, "Bitte beschreiben Sie die Renovation kurz.")
    .max(500, "Bitte höchstens 500 Zeichen verwenden."),
});

export type RenovationInput = z.input<typeof renovationSchema>;
export type RenovationData = z.output<typeof renovationSchema>;

export const wizardStepSchema = z.number().int().min(1).max(8);

/** Wandelt eine Zeile aus properties in Formularwerte um. */
export function propertyToFormValues(
  row: {
    property_type: PropertyFormValues["property_type"];
    offer_type: PropertyFormValues["offer_type"];
    internal_name: string | null;
    street: string | null;
    house_number: string | null;
    postal_code: string | null;
    municipality: string | null;
    canton: string | null;
    latitude: number | null;
    longitude: number | null;
    egid: number | null;
    rooms: number | null;
    bathrooms: number | null;
    living_area: number | null;
    gross_living_area: number | null;
    usable_area: number | null;
    plot_area: number | null;
    year_built: number | null;
    year_renovated: number | null;
    floor: number | null;
    floors_total: number | null;
    condition: string | null;
    heating_type: string | null;
    energy_label: string | null;
    energy_demand_kwh: number | null;
    is_minergie: boolean;
    has_balcony: boolean;
    has_terrace: boolean;
    has_garden: boolean;
    has_garage: boolean;
    has_elevator: boolean;
    has_cellar: boolean;
    has_attic: boolean;
    is_wheelchair_accessible: boolean;
    pets_allowed: boolean | null;
    garage_spaces: number;
    underground_parking_spaces: number;
    outdoor_parking_spaces: number;
    available_from: string | null;
    available_by_arrangement: boolean;
    service_charges: number | null;
    ownership_type: string | null;
    special_features: string | null;
    view_description: string | null;
  },
  features: readonly string[],
): PropertyFormValues {
  const num = (value: number | null) => (value === null || value === undefined ? "" : String(Number(value)));
  const count = (value: number) => (value ? String(value) : "");
  const featureKeys = features.filter((key): key is FeatureKey => key in FEATURE_CATALOG);
  return {
    property_type: row.property_type,
    offer_type: row.offer_type,
    internal_name: row.internal_name ?? "",
    street: row.street ?? "",
    house_number: row.house_number ?? "",
    postal_code: row.postal_code ?? "",
    municipality: row.municipality ?? "",
    canton: row.canton ?? "",
    latitude: row.latitude,
    longitude: row.longitude,
    egid: row.egid,
    rooms: num(row.rooms),
    bathrooms: num(row.bathrooms),
    living_area: num(row.living_area),
    gross_living_area: num(row.gross_living_area),
    usable_area: num(row.usable_area),
    plot_area: num(row.plot_area),
    year_built: num(row.year_built),
    year_renovated: num(row.year_renovated),
    floor: num(row.floor),
    floors_total: num(row.floors_total),
    condition: row.condition ?? "",
    heating_type: row.heating_type ?? "",
    energy_label: row.energy_label ?? "",
    energy_demand_kwh: num(row.energy_demand_kwh),
    is_minergie: row.is_minergie,
    has_balcony: row.has_balcony,
    has_terrace: row.has_terrace,
    has_garden: row.has_garden,
    has_garage: row.has_garage,
    has_elevator: row.has_elevator,
    has_cellar: row.has_cellar,
    has_attic: row.has_attic,
    is_wheelchair_accessible: row.is_wheelchair_accessible,
    pets_allowed: row.pets_allowed === null ? "" : row.pets_allowed ? "yes" : "no",
    garage_spaces: count(row.garage_spaces),
    underground_parking_spaces: count(row.underground_parking_spaces),
    outdoor_parking_spaces: count(row.outdoor_parking_spaces),
    available_from: row.available_from ?? "",
    available_by_arrangement: row.available_by_arrangement,
    service_charges: num(row.service_charges),
    ownership_type: row.ownership_type ?? "",
    special_features: row.special_features ?? "",
    view_description: row.view_description ?? "",
    features: featureKeys,
  };
}
