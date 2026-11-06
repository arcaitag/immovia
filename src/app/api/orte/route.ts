import { NextResponse, type NextRequest } from "next/server";
import { searchSwissLocations } from "@/lib/geo/swisstopo";

/**
 * Ortssuche (Gemeinden, PLZ, Kantone) bzw. Adresssuche über geo.admin.ch.
 * GET /api/orte?q=Bern&art=ort|adresse
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const mode = request.nextUrl.searchParams.get("art") === "adresse" ? "address" : "place";
  if (q.trim().length < 2) return NextResponse.json({ results: [] });
  try {
    const results = await searchSwissLocations(q, mode, { next: { revalidate: 86_400 } });
    return NextResponse.json(
      { results, source: "© swisstopo / geo.admin.ch" },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (error) {
    console.error("[orte] Suche fehlgeschlagen", error);
    return NextResponse.json({ results: [], error: "Die Ortssuche ist momentan nicht erreichbar." }, { status: 502 });
  }
}
