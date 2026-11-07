import { createElement } from "react";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ValuationReportDocument } from "@/lib/pdf/valuation/document";
import { pdfFileName, renderPdf } from "@/lib/pdf/render";
import { buildValuationReportContent } from "@/lib/valuation/view";
import { formatDate } from "@/lib/format";
import { isUuid } from "@/lib/utils";
import { enforceRateLimit } from "@/services/ai/access";

export const runtime = "nodejs";
export const maxDuration = 300;

/** PDF-Export eines Bewertungsberichts (auf Abruf, Zugriff über RLS des Benutzers). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ valuationId: string }> }) {
  const { valuationId } = await params;
  if (!isUuid(valuationId)) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Bitte melden Sie sich an." }, { status: 401 });
  if (user.profile.status !== "active") return NextResponse.json({ error: "Ihr Konto ist derzeit gesperrt." }, { status: 403 });
  try {
    // PDF-Erzeugung ist rechenintensiv: pro Konto begrenzen
    await enforceRateLimit(`valuation-pdf:${user.id}`, 10, 60);
  } catch {
    return NextResponse.json({ error: "Zu viele Anfragen. Bitte versuchen Sie es in einer Minute erneut." }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: valuation } = await supabase.from("property_valuations").select("*").eq("id", valuationId).maybeSingle();
  if (!valuation) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  const [propertyRes, sourcesRes, comparablesRes] = await Promise.all([
    supabase
      .from("properties")
      .select("property_type, offer_type, rooms, postal_code, municipality, internal_name")
      .eq("id", valuation.property_id)
      .maybeSingle(),
    supabase.from("valuation_sources").select("*").eq("valuation_id", valuation.id).order("created_at"),
    supabase.from("valuation_comparables").select("*").eq("valuation_id", valuation.id).order("similarity", { ascending: false }),
  ]);
  if (!propertyRes.data) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  try {
    const content = buildValuationReportContent(
      { valuation, sources: sourcesRes.data ?? [], comparables: comparablesRes.data ?? [] },
      propertyRes.data,
    );
    const { buffer } = await renderPdf(createElement(ValuationReportDocument, { content }));
    const fileName = pdfFileName(`bewertung-${content.locationLabel}`, formatDate(valuation.created_at).replace(/\./g, "-"));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[valuation] PDF-Export fehlgeschlagen", error);
    return NextResponse.json({ error: "Der Bericht konnte nicht erstellt werden." }, { status: 500 });
  }
}
