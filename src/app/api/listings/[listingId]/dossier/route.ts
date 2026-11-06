import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { pdfFileName } from "@/lib/pdf/render";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";

/**
 * Öffentlicher Dossier-Download eines Inserats.
 * Nur wenn das Inserat veröffentlicht ist, das Dossier freigegeben (listings.dossier_public)
 * und genau eine Version als öffentlich markiert ist. Sonst 404.
 * Läuft mit dem öffentlichen Client: RLS und Storage-Policy (is_public_dossier_object) prüfen.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  const notFound = () => NextResponse.json({ error: "Kein öffentliches Dossier vorhanden." }, { status: 404 });
  if (!isUuid(listingId)) return notFound();
  const supabase = createPublicClient();
  if (!supabase) return notFound();

  const { data: listing } = await supabase
    .from("listings")
    .select("id, property_id, slug, dossier_public")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing || !listing.dossier_public) return notFound();

  const { data: dossier } = await supabase
    .from("generated_dossiers")
    .select("id, storage_path, version")
    .eq("property_id", listing.property_id)
    .eq("is_public", true)
    .eq("status", "ready")
    .maybeSingle();
  if (!dossier?.storage_path) return notFound();

  const { data: signed, error } = await supabase.storage
    .from("dossiers")
    .createSignedUrl(dossier.storage_path, 120, { download: pdfFileName(`verkaufsdossier-${listing.slug ?? "immovia"}`) });
  if (error || !signed) return notFound();
  return NextResponse.redirect(signed.signedUrl, { status: 302, headers: { "Cache-Control": "no-store" } });
}
