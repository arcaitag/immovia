import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getDocumentDownloadUrl } from "@/services/documents";
import { isUuid } from "@/lib/utils";

/**
 * Dokument herunterladen. Angemeldet mit Benutzer-Client, sonst anonym (nur öffentliche
 * Dokumente veröffentlichter Inserate). RLS can_read_document entscheidet; bei Erfolg
 * 302 auf einen 60 Sekunden gültigen signierten Link, sonst 404 (auch bei fehlender
 * Berechtigung, damit keine Rückschlüsse auf fremde Dokumente möglich sind).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const notFound = () => new NextResponse("Nicht gefunden", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!isUuid(documentId)) return notFound();

  const user = await getSessionUser();
  const url = await getDocumentDownloadUrl(documentId, {
    inline: request.nextUrl.searchParams.get("inline") === "1",
    authenticated: Boolean(user),
  });
  if (!url) return notFound();
  const response = NextResponse.redirect(url, 302);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
