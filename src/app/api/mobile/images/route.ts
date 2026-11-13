import { NextResponse } from "next/server";
import { z } from "zod";
import { getBearerSession } from "@/lib/auth/bearer";
import { AppError, fail } from "@/lib/errors";
import { processUploadedImage } from "@/services/property-images";
import { revalidateProperty } from "@/services/ai/revalidate";

// Bildverarbeitung mit sharp (Varianten erzeugen, Metadaten entfernen)
export const maxDuration = 60;

const bodySchema = z.object({
  propertyId: z.guid(),
  imageId: z.guid(),
  ext: z.enum(["jpg", "png", "webp"]),
});

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Mobile App: verarbeitet ein Foto, das die App zuvor als Original nach
 * property-originals/{propertyId}/{imageId}.{ext} hochgeladen hat – gleiche Logik wie der Upload
 * auf der Website (Berechtigung, Höchstzahl, Varianten ohne EXIF/GPS).
 */
export async function POST(request: Request) {
  const session = await getBearerSession(request);
  if (!session) return NextResponse.json({ error: "Bitte melden Sie sich an." }, { status: 401, headers: NO_STORE });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400, headers: NO_STORE });

  try {
    const image = await processUploadedImage(session.supabase, session.user, parsed.data);
    await revalidateProperty(session.supabase, parsed.data.propertyId, [`/dashboard/immobilien/${parsed.data.propertyId}/bilder`]);
    return NextResponse.json({ image }, { headers: NO_STORE });
  } catch (error) {
    const result = fail(error);
    const status = error instanceof AppError ? ({ not_found: 404, forbidden: 403, validation: 422, conflict: 409 } as Record<string, number>)[error.code] ?? 400 : 500;
    if (status === 500) console.error("[mobile] Bildverarbeitung fehlgeschlagen", error);
    return NextResponse.json({ error: result.error }, { status, headers: NO_STORE });
  }
}
