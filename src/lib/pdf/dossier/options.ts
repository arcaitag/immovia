import { z } from "zod";

/**
 * Optionen des Verkaufsdossiers (Client und Server).
 */

export const DOSSIER_TEMPLATE_IDS = ["modern", "premium", "classic"] as const;
export type DossierTemplateId = (typeof DOSSIER_TEMPLATE_IDS)[number];

export const DOSSIER_SECTION_KEYS = [
  "highlights",
  "keyFacts",
  "description",
  "location",
  "equipment",
  "renovations",
  "gallery",
  "floorPlans",
  "documents",
  "contact",
  "qrCode",
] as const;
export type DossierSectionKey = (typeof DOSSIER_SECTION_KEYS)[number];

export const DOSSIER_SECTIONS: Record<DossierSectionKey, { label: string; description: string }> = {
  highlights: { label: "Highlights", description: "Die wichtigsten Merkmale aus dem Inserat." },
  keyFacts: { label: "Eckdaten", description: "Zimmer, Flächen, Baujahr, Energie, Parkplätze." },
  description: { label: "Objektbeschreibung", description: "Ausführliche Beschreibung aus dem Inserat." },
  location: { label: "Lage", description: "Nur erfasste Lagetexte und -merkmale." },
  equipment: { label: "Ausstattung", description: "Ausstattungstext und Merkmale." },
  renovations: { label: "Renovationen", description: "Erfasste Renovationen mit Jahr." },
  gallery: { label: "Bildgalerie", description: "Ausgewählte Fotos in Ihrer Reihenfolge." },
  floorPlans: { label: "Grundrisse", description: "Als Grundriss markierte Bilder." },
  documents: { label: "Freigegebene Unterlagen", description: "Titel öffentlich freigegebener Dokumente." },
  contact: { label: "Ansprechpartner", description: "Name und Kontaktmöglichkeiten." },
  qrCode: { label: "QR-Code zum Inserat", description: "Nur wenn das Inserat veröffentlicht ist." },
};

export const DOSSIER_TEMPLATE_INFO: Record<DossierTemplateId, { label: string; description: string }> = {
  modern: { label: "Modern", description: "Weiss und Hellgrün, viel Freiraum, klare Kacheln." },
  premium: { label: "Premium", description: "Grossflächige Fotografie, reduzierte Typografie." },
  classic: { label: "Klassisch", description: "Sachlich und übersichtlich mit Tabellen." },
};

const idSchema = z.guid();

export const dossierContactSchema = z.object({
  name: z.string().trim().max(120).optional(),
  company: z.string().trim().max(120).optional(),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^$|^\+?[0-9 ()/-]{6,24}$/, "Bitte geben Sie eine gültige Telefonnummer ein.")
    .optional(),
  email: z
    .string()
    .trim()
    .max(200)
    .regex(/^$|^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Bitte geben Sie eine gültige E-Mail-Adresse ein.")
    .optional(),
});

export const dossierOptionsSchema = z.object({
  templateId: z.enum(DOSSIER_TEMPLATE_IDS).default("modern"),
  sections: z.partialRecord(z.enum(DOSSIER_SECTION_KEYS), z.boolean()).default({}),
  excludedImageIds: z.array(idSchema).max(200).default([]),
  imageOrder: z.array(idSchema).max(200).default([]),
  title: z.string().trim().max(140).optional(),
  intro: z.string().trim().max(1200).optional(),
  contact: dossierContactSchema.optional(),
});
export type DossierOptions = z.infer<typeof dossierOptionsSchema>;
export type DossierOptionsInput = z.input<typeof dossierOptionsSchema>;

export function isSectionEnabled(options: Pick<DossierOptions, "sections">, key: DossierSectionKey): boolean {
  return options.sections[key] !== false;
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Kodiert die Optionen für den Vorschau-Link (?options=…). */
export function encodeDossierOptions(options: DossierOptionsInput): string {
  return toBase64Url(JSON.stringify(options));
}

export function decodeDossierOptions(value: string | null | undefined): DossierOptions | null {
  if (!value || value.length > 12_000) return null;
  try {
    const parsed = dossierOptionsSchema.safeParse(JSON.parse(fromBase64Url(value)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
