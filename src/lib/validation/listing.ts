import { z } from "zod";
import { optionalNumber, optionalText } from "@/lib/validation/property";
import { Constants } from "@/types/database";
import type { StatusAction } from "@/lib/properties/listing-status";

/**
 * Validierung des Inserats (Schritt 6): Preis, Texte, Standortgenauigkeit, Kontakt.
 * Pflichtangaben für die Veröffentlichung (Titel, Beschreibung, Preis …) prüft die
 * Checkliste bzw. der Datenbank-Trigger – gespeichert werden darf auch ein Entwurf.
 */

export const LISTING_TEXT_LIMITS = {
  title: 140,
  short_description: 400,
  description: 12_000,
  location_description: 6000,
  equipment_description: 6000,
  search_summary: 300,
} as const;

export type ListingTextField = keyof typeof LISTING_TEXT_LIMITS;
export const LISTING_TEXT_FIELDS = Object.keys(LISTING_TEXT_LIMITS) as ListingTextField[];

export const MAX_HIGHLIGHTS = 12;
export const HIGHLIGHT_MAX_LENGTH = 80;

const PHONE = /^\+?[0-9 ()/-]{6,24}$/;

export const phoneField = z.string().transform((raw, ctx): string | null => {
  const value = raw.trim();
  if (value === "") return null;
  if (!PHONE.test(value)) {
    ctx.addIssue({ code: "custom", message: "Bitte geben Sie eine gültige Telefonnummer ein, z. B. +41 79 123 45 67." });
    return z.NEVER;
  }
  return value;
});

const emailCheck = z.email();

export const emailField = z.string().transform((raw, ctx): string | null => {
  const value = raw.trim().toLowerCase();
  if (value === "") return null;
  if (value.length > 254 || !emailCheck.safeParse(value).success) {
    ctx.addIssue({ code: "custom", message: "Bitte geben Sie eine gültige E-Mail-Adresse ein." });
    return z.NEVER;
  }
  return value;
});

const money = (max: number) => optionalNumber({ min: 0, max, decimals: 2 });

export const highlightsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(2, "Ein Highlight braucht mindestens 2 Zeichen.")
      .max(HIGHLIGHT_MAX_LENGTH, `Ein Highlight darf höchstens ${HIGHLIGHT_MAX_LENGTH} Zeichen lang sein.`),
  )
  .max(MAX_HIGHLIGHTS, `Bitte höchstens ${MAX_HIGHLIGHTS} Highlights angeben.`)
  .transform((items) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

export const listingFormSchema = z
  .object({
    price: money(9_999_999_999),
    price_on_request: z.boolean(),
    additional_costs: money(99_999_999),
    parking_price: money(99_999_999),

    title: optionalText(LISTING_TEXT_LIMITS.title),
    short_description: optionalText(LISTING_TEXT_LIMITS.short_description),
    description: optionalText(LISTING_TEXT_LIMITS.description),
    location_description: optionalText(LISTING_TEXT_LIMITS.location_description),
    equipment_description: optionalText(LISTING_TEXT_LIMITS.equipment_description),
    highlights: highlightsSchema,
    search_summary: optionalText(LISTING_TEXT_LIMITS.search_summary),

    location_precision: z.enum(Constants.public.Enums.location_precision, {
      error: "Bitte wählen Sie, wie genau der Standort angezeigt wird.",
    }),

    contact_name: optionalText(120),
    contact_phone: phoneField,
    contact_email: emailField,
    show_contact_phone: z.boolean(),

    dossier_public: z.boolean(),
    texts_confirmed: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.show_contact_phone && !values.contact_phone) {
      ctx.addIssue({
        code: "custom",
        path: ["contact_phone"],
        message: "Bitte geben Sie eine Telefonnummer an oder blenden Sie sie aus.",
      });
    }
  });

export type ListingFormValues = z.input<typeof listingFormSchema>;
export type ListingFormData = z.output<typeof listingFormSchema>;

/** Vergleichbare Darstellung der Texte (für «geändert seit Bestätigung»). */
export function listingTextsSignature(values: {
  title: string | null;
  short_description: string | null;
  description: string | null;
  location_description: string | null;
  equipment_description: string | null;
  search_summary: string | null;
  highlights: readonly string[];
}): string {
  const norm = (value: string | null) => (value ?? "").trim();
  return JSON.stringify([
    norm(values.title),
    norm(values.short_description),
    norm(values.description),
    norm(values.location_description),
    norm(values.equipment_description),
    norm(values.search_summary),
    values.highlights.map((h) => h.trim()),
  ]);
}

export const statusActionSchema = z.enum([
  "publish",
  "withdraw_review",
  "pause",
  "resume",
  "reserve",
  "unreserve",
  "mark_sold",
  "mark_rented",
  "relist",
  "archive",
] as const satisfies readonly StatusAction[]);

export const statisticsRangeSchema = z.union([z.literal(30), z.literal(90)]);
