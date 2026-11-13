import { AppError } from "@/lib/errors";
import { dossierStoragePath } from "@/lib/storage";
import { isUuid } from "@/lib/utils";
import { canManageProperty } from "@/services/ai/access";
import { withSession } from "../../../valuation/_lib";

export const runtime = "nodejs";

const EXPIRES_IN_SECONDS = 120;

/**
 * Mobile App: kurzlebige signierte URL für das PDF einer Dossier-Version. Gleiche Prüfungen wie
 * /api/dossiers/[dossierId]/download (fertige Version, Speicherpfad passt zur Immobilie,
 * Benutzer-Client mit Storage-Policy) – zusätzlich nur für Personen, die die Immobilie verwalten.
 * Ohne Download-Dateiname, damit das PDF im In-App-Browser direkt angezeigt wird.
 */
export async function GET(request: Request, { params }: { params: Promise<{ dossierId: string }> }) {
  const { dossierId } = await params;
  return withSession(request, async ({ supabase, user }) => {
    const notFound = () => new AppError("not_found", "Die Dossier-Version wurde nicht gefunden.");
    if (!isUuid(dossierId)) throw notFound();
    const { data: dossier } = await supabase
      .from("generated_dossiers")
      .select("id, property_id, version, status, storage_path")
      .eq("id", dossierId)
      .maybeSingle();
    if (!dossier || dossier.status !== "ready" || dossier.storage_path !== dossierStoragePath(dossier.property_id, dossier.id)) throw notFound();
    const { data: property } = await supabase
      .from("properties")
      .select("owner_id, organization_id")
      .eq("id", dossier.property_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!property || !canManageProperty(user, property)) throw notFound();
    const { data: signed, error } = await supabase.storage.from("dossiers").createSignedUrl(dossier.storage_path, EXPIRES_IN_SECONDS);
    if (error || !signed) throw new AppError("not_found", "Das PDF kann nicht geöffnet werden.");
    return { url: signed.signedUrl, expiresIn: EXPIRES_IN_SECONDS, version: dossier.version };
  });
}
