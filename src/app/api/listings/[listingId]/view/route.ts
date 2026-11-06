import { createHash, randomUUID } from "node:crypto";
import { NextResponse, userAgent, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured, serverEnv } from "@/lib/env";
import { TIME_ZONE } from "@/lib/format";
import { isUuid } from "@/lib/utils";

/**
 * POST /api/listings/[listingId]/view – zählt einen Inseratsaufruf (datenschutzfreundlich).
 *
 * - Bots, Vorab-Ladevorgänge und fremde Websites werden ignoriert.
 * - Besucherkennung: zufällige ID im First-Party-Cookie «iv_vid» (httpOnly, 1 Jahr).
 * - Gespeichert wird nur sha256(ID + Datum in Europe/Zurich + Salt): pro Besucher und Tag
 *   höchstens ein Aufruf, ohne IP-Adresse und ohne tagesübergreifende Verknüpfung.
 * - Aufrufe der Inserentin bzw. des Inserenten und von Teammitgliedern zählen nicht.
 * - Ohne Service Role (SUPABASE_SECRET_KEY) antwortet die Route mit 204, ohne zu zählen.
 */

const VISITOR_COOKIE = "iv_vid";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const BOT_PATTERN =
  /bot|crawl|spider|slurp|preview|headless|lighthouse|pagespeed|gtmetrix|curl|wget|python|httpclient|okhttp|java\/|go-http|axios|node-fetch|facebookexternalhit|embedly|whatsapp|telegram|discord|monitor|uptime|scanner/i;

function zurichDate(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

function noContent(): NextResponse {
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

function isIgnoredRequest(request: NextRequest): boolean {
  const ua = request.headers.get("user-agent") ?? "";
  if (!ua || BOT_PATTERN.test(ua) || userAgent(request).isBot) return true;
  const purpose = `${request.headers.get("purpose") ?? ""} ${request.headers.get("sec-purpose") ?? ""}`;
  if (/prefetch|prerender/i.test(purpose)) return true;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return true;
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return true;
  return false;
}

/** Prüft, ob die angemeldete Person das Inserat verwaltet (Inhaber oder Mitglied der Organisation). */
async function viewerContext(listingId: string): Promise<{ userId: string | null; managesListing: boolean; listingVisible: boolean }> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
    if (!userId) return { userId: null, managesListing: false, listingVisible: true };
    const { data: listing } = await supabase.from("listings").select("owner_id, organization_id").eq("id", listingId).maybeSingle();
    if (!listing) return { userId, managesListing: false, listingVisible: false };
    if (listing.owner_id === userId) return { userId, managesListing: true, listingVisible: true };
    if (listing.organization_id) {
      const { data: membership } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", listing.organization_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (membership) return { userId, managesListing: true, listingVisible: true };
    }
    return { userId, managesListing: false, listingVisible: true };
  } catch {
    // Session nicht lesbar: als anonymer Aufruf behandeln
    return { userId: null, managesListing: false, listingVisible: true };
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await context.params;
  if (!isUuid(listingId)) {
    return NextResponse.json({ error: "Ungültiges Inserat." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  if (isIgnoredRequest(request)) return noContent();
  if (!isSupabaseConfigured() || !isServiceRoleConfigured()) return noContent();

  const viewer = await viewerContext(listingId);
  if (viewer.managesListing || !viewer.listingVisible) return noContent();

  const existing = request.cookies.get(VISITOR_COOKIE)?.value;
  const visitorId = existing && isUuid(existing) ? existing : randomUUID();
  const viewerHash = createHash("sha256").update(`${visitorId}${zurichDate()}${serverEnv.analyticsSalt}`).digest("hex");

  try {
    const { error } = await createAdminClient().rpc("record_listing_view", {
      p_listing_id: listingId,
      p_viewer_hash: viewerHash,
      p_authenticated: Boolean(viewer.userId),
    });
    if (error) console.error("[statistik] Aufruf konnte nicht gespeichert werden", error.message);
  } catch (error) {
    console.error("[statistik] Aufruf konnte nicht gespeichert werden", error);
  }

  const response = noContent();
  if (visitorId !== existing) {
    response.cookies.set({
      name: VISITOR_COOKIE,
      value: visitorId,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: ONE_YEAR_SECONDS,
      path: "/",
    });
  }
  return response;
}
