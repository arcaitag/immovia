import { createElement } from "react";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { DossierDocument } from "@/lib/pdf/dossier/document";
import { DOSSIER_TEMPLATE_IDS, decodeDossierOptions, dossierOptionsSchema, type DossierTemplateId } from "@/lib/pdf/dossier/options";
import { renderPdf } from "@/lib/pdf/render";
import { buildDossierContent } from "@/services/ai/dossier-data";
import { enforceRateLimit, requireManagedProperty } from "@/services/ai/access";
import { loadAiSettings } from "@/services/ai/settings";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Sofort-Vorschau eines Dossiers als PDF (inline, nicht gespeichert).
 * Query: propertyId, template, optional options (Base64url-JSON der Dossier-Optionen).
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Bitte melden Sie sich an." }, { status: 401 });
  if (user.profile.status !== "active") return NextResponse.json({ error: "Ihr Konto ist derzeit gesperrt." }, { status: 403 });
  const url = new URL(request.url);
  const propertyId = url.searchParams.get("propertyId") ?? "";
  const template = url.searchParams.get("template") as DossierTemplateId | null;
  try {
    const supabase = await createClient();
    await requireManagedProperty(supabase, user, propertyId);
    const settings = await loadAiSettings();
    if (!settings.features.dossiers) throw new AppError("service_unavailable", "Die Dossier-Funktion ist derzeit deaktiviert.");
    await enforceRateLimit(`dossier-preview:${user.id}`, 30, 60);

    const decoded = decodeDossierOptions(url.searchParams.get("options"));
    const options = decoded ?? dossierOptionsSchema.parse({});
    if (template && (DOSSIER_TEMPLATE_IDS as readonly string[]).includes(template)) options.templateId = template;

    const built = await buildDossierContent({ client: supabase, propertyId, options, isPreview: true });
    const { buffer } = await renderPdf(createElement(DossierDocument, { content: built.content }));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="dossier-vorschau.pdf"',
        "Cache-Control": "private, no-store",
        "X-Skipped-Images": String(built.skippedImages),
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      const status = error.code === "not_found" ? 404 : error.code === "rate_limited" ? 429 : error.code === "forbidden" ? 403 : 503;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("[dossier] Vorschau fehlgeschlagen", error);
    return NextResponse.json({ error: "Die Vorschau konnte nicht erstellt werden." }, { status: 500 });
  }
}
