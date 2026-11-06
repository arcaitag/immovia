import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Alles ausser statischen Dateien, Bildern und Metadaten-Routen
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|robots.txt|sitemap.xml|sw.js|offline|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
