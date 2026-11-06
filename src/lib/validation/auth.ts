import { z } from "zod";

export const emailSchema = z.email("Bitte geben Sie eine gültige E-Mail-Adresse ein.").trim().toLowerCase().max(254);

export const passwordSchema = z
  .string()
  .min(10, "Das Passwort muss mindestens 10 Zeichen lang sein.")
  .max(72, "Das Passwort darf höchstens 72 Zeichen lang sein.")
  .refine((v) => /[A-Za-zÄÖÜäöü]/.test(v) && /\d/.test(v), "Verwenden Sie Buchstaben und mindestens eine Zahl.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Bitte geben Sie Ihr Passwort ein."),
});

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, "Bitte geben Sie Ihren Vornamen ein.").max(80),
  lastName: z.string().trim().min(1, "Bitte geben Sie Ihren Nachnamen ein.").max(80),
  email: emailSchema,
  password: passwordSchema,
  accountType: z.enum(["private", "business"]).default("private"),
  acceptTerms: z.literal(true, { error: "Bitte bestätigen Sie die AGB und die Datenschutzerklärung." }),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Die Passwörter stimmen nicht überein.", path: ["confirm"] });

/** Nur interne, relative Weiterleitungsziele zulassen (Schutz vor Open Redirects). */
export function safeRedirectPath(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/^\/(auth|api)\//.test(value)) return fallback;
  return value.slice(0, 500);
}
