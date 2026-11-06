import { z } from "zod";
import { Constants } from "@/types/database";
import { isoDateSchema } from "@/lib/validation/viewing";

/**
 * Validierung für das Dokumentencenter und gemeinsame Datei-Hilfen
 * (auch für Nachrichtenanhänge verwendet).
 */

export const FILE_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export type FileMime = (typeof FILE_MIME_TYPES)[number];

export const FILE_EXTENSION: Record<FileMime, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const FILE_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp";

/** 25 MB – entspricht dem Limit des Buckets «documents» und der Tabelle property_documents. */
export const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

export function isFileMime(value: unknown): value is FileMime {
  return typeof value === "string" && (FILE_MIME_TYPES as readonly string[]).includes(value);
}

/** Ermittelt den MIME-Typ aus Browserangabe oder Dateiendung (manche Browser liefern einen leeren Typ). */
export function detectFileMime(file: { type?: string | null; name?: string | null }): FileMime | null {
  const type = (file.type ?? "").toLowerCase().trim();
  if (isFileMime(type)) return type;
  if (type === "image/jpg" || type === "image/pjpeg") return "image/jpeg";
  const ext = (file.name ?? "").split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return null;
  }
}

/** Speicherpfad gemäss Konvention: documents/{propertyId}/{documentId}.{ext} (ohne Bucket). */
export function documentStoragePath(propertyId: string, documentId: string, mime: FileMime): string {
  return `${propertyId}/${documentId}.${FILE_EXTENSION[mime]}`;
}

/** Vorschlag für den Titel aus dem Dateinamen («grundriss_eg-2024.pdf» → «grundriss eg 2024»). */
export function titleFromFileName(name: string): string {
  const base = name.replace(/\.[a-z0-9]{2,5}$/i, "");
  const cleaned = base.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 160) || "Dokument";
}

/** Dateiname für Downloads: keine Pfadtrenner oder Steuerzeichen. */
export function sanitizeFileName(name: string): string {
  let result = "";
  for (const char of name) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 32 || code === 127 || char === "/" || char === "\\") continue;
    result += char;
  }
  return result.trim().slice(0, 200) || "Datei";
}

const documentCategorySchema = z.enum(Constants.public.Enums.document_category, { error: "Bitte wählen Sie eine Kategorie." });
const documentVisibilitySchema = z.enum(Constants.public.Enums.document_visibility, { error: "Bitte wählen Sie die Sichtbarkeit." });

const metaShape = {
  title: z.string().trim().min(1, "Bitte geben Sie einen Titel ein.").max(160, "Höchstens 160 Zeichen."),
  category: documentCategorySchema,
  visibility: documentVisibilitySchema,
  containsPersonalData: z.boolean(),
};

function refinePersonalData(value: { visibility: string; containsPersonalData: boolean }, ctx: z.RefinementCtx) {
  if (value.containsPersonalData && value.visibility === "public") {
    ctx.addIssue({
      code: "custom",
      path: ["visibility"],
      message: "Dokumente mit Personendaten dürfen nicht öffentlich sein.",
    });
  }
}

/** Formular im Browser (vor dem Upload). */
export const documentMetaSchema = z.object(metaShape).superRefine(refinePersonalData);
export type DocumentMetaInput = z.input<typeof documentMetaSchema>;

/** Server Action nach dem Upload in Storage. */
export const documentCreateSchema = z
  .object({
    id: z.guid(),
    propertyId: z.guid("Bitte wählen Sie eine Immobilie."),
    fileName: z.string().trim().min(1).max(200),
    mimeType: z.enum(FILE_MIME_TYPES, { error: "Erlaubt sind PDF, JPG, PNG und WEBP." }),
    sizeBytes: z
      .number()
      .int()
      .min(1, "Die Datei ist leer.")
      .max(DOCUMENT_MAX_BYTES, "Dokumente dürfen höchstens 25 MB gross sein."),
    ...metaShape,
  })
  .superRefine(refinePersonalData);
export type DocumentCreateInput = z.input<typeof documentCreateSchema>;

export const documentUpdateSchema = z
  .object({ documentId: z.guid(), ...metaShape })
  .superRefine(refinePersonalData);
export type DocumentUpdateInput = z.input<typeof documentUpdateSchema>;

export const documentDeleteSchema = z.object({ documentId: z.guid() });

export const documentGrantSchema = z.object({
  documentId: z.guid("Bitte wählen Sie ein Dokument."),
  granteeId: z.guid("Bitte wählen Sie eine Person."),
  /** Letzter gültiger Tag (Zürcher Datum), leer = unbefristet. */
  expiresOn: z.union([isoDateSchema, z.literal("")]).optional(),
});
export type DocumentGrantInput = z.input<typeof documentGrantSchema>;

export const revokeGrantSchema = z.object({ grantId: z.guid() });
