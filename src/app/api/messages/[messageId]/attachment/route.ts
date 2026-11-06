import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getAttachmentUrl } from "@/services/messages";
import { isUuid } from "@/lib/utils";

/**
 * Nachrichtenanhang herunterladen: prüft die Teilnahme an der Konversation (RLS)
 * und leitet auf einen 60 Sekunden gültigen signierten Link weiter. ?inline=1 zeigt
 * Bilder/PDF im Browser an statt sie herunterzuladen.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await params;
  const notFound = () => new NextResponse("Nicht gefunden", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!isUuid(messageId)) return notFound();
  const user = await getSessionUser();
  if (!user) return new NextResponse("Bitte melden Sie sich an.", { status: 401, headers: { "Cache-Control": "no-store" } });

  const url = await getAttachmentUrl(messageId, { inline: request.nextUrl.searchParams.get("inline") === "1" });
  if (!url) return notFound();
  const response = NextResponse.redirect(url, 302);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
