import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/validation/auth";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * Bestätigung per token_hash (geräteübergreifend). Wird von den E-Mail-Vorlagen
 * in supabase/templates verwendet: /auth/confirm?token_hash=…&type=…&next=…
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const fallbackNext = type === "recovery" ? "/passwort-zuruecksetzen" : "/dashboard";
  const next = safeRedirectPath(url.searchParams.get("next"), fallbackNext);
  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/login?fehler=link", url.origin));
}
