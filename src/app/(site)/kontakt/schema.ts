import { z } from "zod";

/** Kontaktformular – Grenzen wie in der Tabelle contact_requests. */
export const contactFormSchema = z.object({
  name: z.string().trim().min(2, "Bitte geben Sie Ihren Namen ein.").max(120, "Der Name ist zu lang."),
  email: z.email("Bitte geben Sie eine gültige E-Mail-Adresse ein.").trim().toLowerCase().max(254),
  subject: z.string().trim().min(2, "Bitte wählen Sie ein Thema.").max(160, "Das Thema ist zu lang."),
  message: z
    .string()
    .trim()
    .min(10, "Die Nachricht muss mindestens 10 Zeichen lang sein.")
    .max(4000, "Die Nachricht darf höchstens 4000 Zeichen lang sein."),
  /** Honeypot: bleibt bei echten Personen leer */
  website: z.string().max(200).optional(),
});
export type ContactFormValues = z.infer<typeof contactFormSchema>;

export const contactSubmissionSchema = contactFormSchema.extend({
  /** Dauer vom Öffnen bis zum Absenden in Millisekunden (Spam-Schutz) */
  elapsedMs: z.number().int().nonnegative().max(86_400_000),
});
export type ContactSubmission = z.infer<typeof contactSubmissionSchema>;

export const CONTACT_SUBJECTS = [
  "Frage zu einem Inserat",
  "Frage zu meinem Konto",
  "Verkaufen oder Vermieten",
  "Firmenkonto",
  "Datenschutz",
  "Technisches Problem",
  "Anderes Anliegen",
] as const;
