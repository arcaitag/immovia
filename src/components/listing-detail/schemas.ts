import { z } from "zod";
import { REPORT_REASONS, type ReportReason } from "@/lib/constants";

/** Telefonnummer wie in der Datenbank geprüft (listing_inquiries.phone). */
const phoneSchema = z
  .string()
  .trim()
  .max(24, "Bitte geben Sie eine gültige Telefonnummer ein.")
  .refine((value) => value === "" || /^\+?[0-9 ()/-]{6,24}$/.test(value), "Bitte geben Sie eine gültige Telefonnummer ein.");

export const inquiryFormSchema = z.object({
  message: z
    .string()
    .trim()
    .min(10, "Die Nachricht muss mindestens 10 Zeichen lang sein.")
    .max(3000, "Die Nachricht darf höchstens 3000 Zeichen lang sein."),
  phone: phoneSchema,
  wantsViewing: z.boolean(),
  wantsDossier: z.boolean(),
});
export type InquiryFormValues = z.infer<typeof inquiryFormSchema>;

export const inquirySchema = inquiryFormSchema.extend({ listingId: z.uuid("Ungültiges Inserat.") });
export type InquiryInput = z.infer<typeof inquirySchema>;

const reasonKeys = Object.keys(REPORT_REASONS) as [ReportReason, ...ReportReason[]];

export const reportFormSchema = z.object({
  reason: z.enum(reasonKeys, { error: "Bitte wählen Sie einen Grund." }),
  details: z.string().trim().max(2000, "Die Beschreibung darf höchstens 2000 Zeichen lang sein."),
});
export type ReportFormValues = z.infer<typeof reportFormSchema>;

export const reportSchema = reportFormSchema.extend({ listingId: z.uuid("Ungültiges Inserat.") });
export type ReportInput = z.infer<typeof reportSchema>;
