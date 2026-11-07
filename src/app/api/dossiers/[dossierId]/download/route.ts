import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { pdfFileName } from "@/lib/pdf/render";
import { isUuid } from "@/lib/utils";
import { dossierStoragePath } from "@/lib/storage";

export const runtime = "nodejs";

/** Download einer Dossier-Version: kurzlebige signierte URL (Benutzer-Client, Storage-Policy). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ dossierId: string }> }) {
  const { dossierId } = await params;
  if (!isUuid(dossierId)) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Bitte melden Sie sich an." }, { status: 401 });

  const supabase = await createClient();
  const { data: dossier } = await supabase
    .from("generated_dossiers")
    .select("id, property_id, version, status, storage_path")
    .eq("id", dossierId)
    .maybeSingle();
  if (!dossier || dossier.status !== "ready" || dossier.storage_path !== dossierStoragePath(dossier.property_id, dossier.id)) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  const { data: property } = await supabase.from("properties").select("municipality").eq("id", dossier.property_id).maybeSingle();
  const { data: signed, error } = await supabase.storage
    .from("dossiers")
    .createSignedUrl(dossier.storage_path, 60, { download: pdfFileName(`verkaufsdossier-${property?.municipality ?? "immobilie"}`, `v${dossier.version}`) });
  if (error || !signed) return NextResponse.json({ error: "Download nicht möglich" }, { status: 404 });
  return NextResponse.redirect(signed.signedUrl, { status: 302, headers: { "Cache-Control": "no-store" } });
}
