import { z } from "zod";
import { emailSchema, passwordSchema } from "@/lib/validation/auth";

/**
 * Validierung für Benutzerkonto, Profil und Einstellungen.
 * Wird im Client (React Hook Form) und in den Server Actions verwendet.
 */

export const PHONE_ERROR = "Bitte geben Sie eine gültige Telefonnummer ein, z. B. 079 123 45 67 oder +41 79 123 45 67.";

/**
 * Normalisiert Telefonnummern.
 * - Schweizer Nummern (079 123 45 67, 0041 79 …, +41 (0)79 …) → «+41 79 123 45 67»
 * - Internationale Nummern im Format +<Ländervorwahl><Nummer> → «+<Ziffern>»
 * Liefert null, wenn die Eingabe keine gültige Nummer ist.
 */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || /[^\d\s+()./-]/.test(trimmed)) return null;
  let value = trimmed.replace(/[\s()./-]/g, "");
  if (value.lastIndexOf("+") > 0) return null;
  if (value.startsWith("00")) value = `+${value.slice(2)}`;
  if (/^0[1-9]\d{8}$/.test(value)) value = `+41${value.slice(1)}`;
  // «+41 (0)79 …» → führende 0 nach der Landesvorwahl entfernen
  if (/^\+410[1-9]\d{8}$/.test(value)) value = `+41${value.slice(4)}`;
  if (value.startsWith("+41")) {
    const m = value.match(/^\+41([1-9]\d)(\d{3})(\d{2})(\d{2})$/);
    return m ? `+41 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : null;
  }
  if (/^\+[1-9]\d{7,14}$/.test(value)) return value;
  return null;
}

/** Optionales Telefonfeld: leer → null, sonst normalisiert. */
export const optionalPhoneSchema = z
  .string()
  .trim()
  .max(30, PHONE_ERROR)
  .transform((value, ctx) => {
    if (!value) return null;
    const normalized = normalizePhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: PHONE_ERROR });
      return z.NEVER;
    }
    return normalized;
  });

/** Leerer Text → null, sonst getrimmt. */
export function optionalText(max: number, message = `Höchstens ${max} Zeichen.`) {
  return z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === "" ? null : value));
}

/** Schutz vor Verwechslung mit offiziellen Konten. */
export function containsPlatformName(value: string): boolean {
  return /immovia/i.test(value.replace(/[\s._-]/g, ""));
}

export const profileSchema = z.object({
  firstName: optionalText(80),
  lastName: optionalText(80),
  displayName: z
    .string()
    .trim()
    .min(2, "Bitte geben Sie einen Anzeigenamen mit mindestens 2 Zeichen ein.")
    .max(80, "Höchstens 80 Zeichen.")
    .refine((value) => !containsPlatformName(value), "Der Anzeigename darf «Immovia» nicht enthalten."),
  phone: optionalPhoneSchema,
});
export type ProfileInput = z.input<typeof profileSchema>;
export type ProfileValues = z.output<typeof profileSchema>;

export const emailChangeSchema = z.object({ email: emailSchema });
export type EmailChangeInput = z.input<typeof emailChangeSchema>;

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Bitte geben Sie Ihr aktuelles Passwort ein.").max(72),
    newPassword: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Die Passwörter stimmen nicht überein." })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Das neue Passwort muss sich vom bisherigen unterscheiden.",
  });
export type PasswordChangeInput = z.input<typeof passwordChangeSchema>;

// -----------------------------------------------------------------------------
// Benachrichtigungen (user_notification_settings)
// -----------------------------------------------------------------------------
export const NOTIFICATION_SETTINGS = [
  {
    key: "email_new_message",
    label: "Neue Nachrichten",
    description: "E-Mail bei neuen Nachrichten in Ihren Konversationen (gebündelt, höchstens alle 15 Minuten).",
  },
  { key: "email_new_inquiry", label: "Neue Anfragen", description: "E-Mail, wenn jemand Ihr Inserat anfragt." },
  {
    key: "email_viewings",
    label: "Besichtigungen",
    description: "Anfragen, Bestätigungen, Absagen und Erinnerungen zu Besichtigungsterminen.",
  },
  { key: "email_search_alerts", label: "Suchaufträge", description: "Neue Inserate, die zu Ihren Suchaufträgen passen." },
  {
    key: "email_listing_updates",
    label: "Meine Inserate",
    description: "Hinweise zu Ihren Inseraten, z. B. wenn ein Inserat online ist.",
  },
  { key: "email_documents", label: "Dokumente", description: "E-Mail, wenn Ihnen jemand ein Dokument freigibt." },
  {
    key: "email_product_news",
    label: "Neuigkeiten zu Immovia",
    description: "Gelegentliche Informationen zu neuen Funktionen. Jederzeit abbestellbar.",
  },
] as const;

export type NotificationSettingKey = (typeof NOTIFICATION_SETTINGS)[number]["key"];

export const notificationSettingsSchema = z.object({
  email_new_message: z.boolean(),
  email_new_inquiry: z.boolean(),
  email_viewings: z.boolean(),
  email_search_alerts: z.boolean(),
  email_listing_updates: z.boolean(),
  email_documents: z.boolean(),
  email_product_news: z.boolean(),
} satisfies Record<NotificationSettingKey, z.ZodBoolean>);
export type NotificationSettingsValues = z.output<typeof notificationSettingsSchema>;

// -----------------------------------------------------------------------------
// Präferenzen und Einwilligungen (user_preferences)
// -----------------------------------------------------------------------------
export const DEFAULT_OFFER_OPTIONS = [
  { value: "none", label: "Keine Vorgabe" },
  { value: "sale", label: "Kaufen" },
  { value: "rent", label: "Mieten" },
] as const;

export const preferencesSchema = z.object({
  ai_processing_consent: z.boolean(),
  ai_image_consent: z.boolean(),
  analytics_consent: z.boolean(),
  marketing_consent: z.boolean(),
  default_offer_type: z
    .enum(["none", "sale", "rent"])
    .transform((value) => (value === "none" ? null : value)),
});
export type PreferencesInput = z.input<typeof preferencesSchema>;
export type PreferencesValues = z.output<typeof preferencesSchema>;

// -----------------------------------------------------------------------------
// Konto löschen
// -----------------------------------------------------------------------------
export const DELETE_CONFIRMATION_WORD = "LÖSCHEN";

export const deleteAccountSchema = z.object({
  confirmation: z
    .string()
    .trim()
    .refine((value) => value.toUpperCase() === DELETE_CONFIRMATION_WORD, {
      message: `Bitte geben Sie ${DELETE_CONFIRMATION_WORD} ein, um zu bestätigen.`,
    }),
});

// -----------------------------------------------------------------------------
// Bild-Uploads (Profilbild, Firmenlogo)
// -----------------------------------------------------------------------------
/** Maximal an eine Server Action gesendete Dateigrösse (Limit der Server Actions: 2 MB). */
export const IMAGE_ACTION_MAX_BYTES = 1_800_000;
/** Maximale Grösse der ausgewählten Originaldatei (wird im Browser verkleinert). */
export const IMAGE_SOURCE_MAX_BYTES = 20 * 1024 * 1024;
export const IMAGE_SOURCE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;
export const IMAGE_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
