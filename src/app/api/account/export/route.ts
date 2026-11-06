import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { buildAccountExport } from "@/services/account";

export const dynamic = "force-dynamic";

/**
 * Datenexport (DSG/DSGVO): alle persönlichen Daten des angemeldeten Benutzers
 * als JSON-Download. Nur für die eigene Session, nie zwischengespeichert.
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Der Dienst ist nicht konfiguriert." }, { status: 503 });
  }
  try {
    const result = await buildAccountExport();
    if (!result) {
      return NextResponse.json({ error: "Bitte melden Sie sich an." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(result.data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="immovia-datenexport-${date}.json"`,
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[account/export] Export fehlgeschlagen", error);
    return NextResponse.json(
      { error: "Der Export konnte nicht erstellt werden. Bitte versuchen Sie es erneut." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
