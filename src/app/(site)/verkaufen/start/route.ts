import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

/** «Kostenlos starten»: direkt in den Verkaufsassistenten oder zuerst registrieren. */
export async function GET(request: NextRequest) {
  const target = "/dashboard/immobilien/neu";
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims?.sub) {
      return NextResponse.redirect(new URL(target, request.url));
    }
  }
  return NextResponse.redirect(new URL(`/registrieren?weiter=${encodeURIComponent(target)}`, request.url));
}
