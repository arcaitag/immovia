"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { AppError, fail, ok, validationError, type ActionResult } from "@/lib/errors";
import { isFeatureEnabled } from "@/lib/settings";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  safeRedirectPath,
} from "@/lib/validation/auth";

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (process.env.NEXT_PUBLIC_SITE_URL) return publicEnv.siteUrl;
  return host ? `${proto}://${host}` : publicEnv.siteUrl;
}

function translateAuthError(message: string | undefined): AppError {
  const m = (message ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) return new AppError("validation", "E-Mail-Adresse oder Passwort ist falsch.");
  if (m.includes("email not confirmed"))
    return new AppError("invalid_state", "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse. Wir können Ihnen den Link erneut senden.", {
      unconfirmed: true,
    });
  if (m.includes("already registered") || m.includes("already been registered"))
    return new AppError("conflict", "Für diese E-Mail-Adresse besteht bereits ein Konto. Bitte melden Sie sich an.");
  if (m.includes("rate limit") || m.includes("too many")) return new AppError("rate_limited");
  if (m.includes("weak") || m.includes("pwned")) return new AppError("validation", "Dieses Passwort ist zu unsicher. Bitte wählen Sie ein anderes.");
  if (m.includes("same password")) return new AppError("validation", "Das neue Passwort muss sich vom bisherigen unterscheiden.");
  if (m.includes("signups not allowed")) return new AppError("service_unavailable", "Registrierungen sind derzeit deaktiviert.");
  return new AppError("unknown", "Die Anmeldung ist fehlgeschlagen. Bitte versuchen Sie es erneut.");
}

export async function loginAction(_prev: unknown, formData: FormData): Promise<ActionResult<null>> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return fail(validationError(parsed.error.flatten().fieldErrors));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const appError = translateAuthError(error.message);
    return { ...fail(appError), ...(appError.details?.unconfirmed ? { code: "invalid_state" as const } : {}) };
  }
  redirect(safeRedirectPath(formData.get("weiter")));
}

export async function registerAction(_prev: unknown, formData: FormData): Promise<ActionResult<{ email: string }>> {
  const parsed = registerSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
    accountType: formData.get("accountType") ?? "private",
    acceptTerms: formData.get("acceptTerms") === "on",
  });
  if (!parsed.success) return fail(validationError(parsed.error.flatten().fieldErrors));
  if (!(await isFeatureEnabled("registration"))) {
    return fail(new AppError("service_unavailable", "Neue Registrierungen sind derzeit nicht möglich. Bitte versuchen Sie es später erneut."));
  }
  if (parsed.data.accountType === "business" && !(await isFeatureEnabled("business_accounts"))) {
    return fail(new AppError("service_unavailable", "Firmenkonten können derzeit nicht eröffnet werden. Bitte registrieren Sie sich als Privatperson."));
  }
  const next = safeRedirectPath(formData.get("weiter"));
  const supabase = await createClient();
  const origin = await siteOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      data: {
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        account_type: parsed.data.accountType,
      },
    },
  });
  if (error) return fail(translateAuthError(error.message));
  // Supabase meldet bei bestehender, bestätigter Adresse keinen Fehler (Schutz vor Enumeration)
  if (data.session) redirect(next);
  return ok({ email: parsed.data.email });
}

export async function resendConfirmationAction(email: string): Promise<ActionResult<null>> {
  const parsed = forgotPasswordSchema.safeParse({ email });
  if (!parsed.success) return fail(validationError(parsed.error.flatten().fieldErrors));
  const supabase = await createClient();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/dashboard` },
  });
  if (error) return fail(translateAuthError(error.message));
  return ok(null, "Falls ein unbestätigtes Konto existiert, haben wir den Bestätigungslink erneut gesendet.");
}

export async function forgotPasswordAction(_prev: unknown, formData: FormData): Promise<ActionResult<null>> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return fail(validationError(parsed.error.flatten().fieldErrors));
  const supabase = await createClient();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/passwort-zuruecksetzen`,
  });
  if (error && error.message.toLowerCase().includes("rate")) return fail(new AppError("rate_limited"));
  // Immer dieselbe Antwort, um nicht preiszugeben, ob ein Konto existiert
  return ok(null, "Falls ein Konto mit dieser Adresse besteht, erhalten Sie in Kürze eine E-Mail mit einem Link.");
}

export async function resetPasswordAction(_prev: unknown, formData: FormData): Promise<ActionResult<null>> {
  const parsed = resetPasswordSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return fail(validationError(parsed.error.flatten().fieldErrors));
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return fail(new AppError("not_authenticated", "Der Link ist abgelaufen. Bitte fordern Sie einen neuen an."));
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(translateAuthError(error.message));
  redirect("/dashboard?passwort=geaendert");
}
