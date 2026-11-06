import { z } from "zod";
import { Constants } from "@/types/database";

/** Validierung für Interessenten (Leads) und private Notizen. */

export const leadStatusSchema = z.enum(Constants.public.Enums.lead_status, { error: "Ungültiger Status." });

export const leadUpdateSchema = z
  .object({
    leadId: z.guid(),
    status: leadStatusSchema.optional(),
    rating: z.number().int().min(1, "Mindestens 1 Stern.").max(5, "Höchstens 5 Sterne.").nullable().optional(),
  })
  .refine((value) => value.status !== undefined || value.rating !== undefined, "Keine Änderung angegeben.");
export type LeadUpdateInput = z.input<typeof leadUpdateSchema>;

const noteBody = z.string().trim().min(1, "Bitte schreiben Sie eine Notiz.").max(4000, "Höchstens 4000 Zeichen.");

export const leadNoteCreateSchema = z.object({ leadId: z.guid(), body: noteBody });
export const leadNoteUpdateSchema = z.object({ noteId: z.guid(), body: noteBody });
export const leadNoteDeleteSchema = z.object({ noteId: z.guid() });

export const LEAD_SORTS = {
  aktivitaet: "Letzte Aktivität",
  neueste: "Neueste zuerst",
  bewertung: "Beste Bewertung",
} as const;
export type LeadSort = keyof typeof LEAD_SORTS;

export function parseLeadSort(value: unknown): LeadSort {
  return typeof value === "string" && value in LEAD_SORTS ? (value as LeadSort) : "aktivitaet";
}
