import { NextResponse } from "next/server";
import { getBearerSession } from "@/lib/auth/bearer";
import { isAiConsentRequiredError } from "@/lib/ai/consent";
import { AppError, fail } from "@/lib/errors";
import { getImageAiStatus, getImageConsentInfo } from "@/lib/images/ai-providers";
import { STAGING_ROOM_TYPES, STAGING_STYLES } from "@/lib/images/ai-providers/types";
import { getFeatureAvailability } from "@/services/ai/access";
import {
  acceptImageEnhancement,
  confirmAiVisualization,
  discardAiVisualization,
  renderImagePreview,
  requestImageAi,
  restoreOriginalImage,
  suggestImageAdjustments,
} from "@/services/ai/images";
import { loadAiSettings } from "@/services/ai/settings";

/**
 * Mobile App: Bilderstudio. Gleiche Dienste wie die Server Actions der Website
 * (src/app/dashboard/bilderstudio/actions.ts), angemeldet per «Authorization: Bearer».
 *
 *   GET  /api/mobile/studio/status   → Bild-KI eingerichtet?, Fähigkeiten, Kontingente, Einwilligungsangaben
 *   POST /api/mobile/studio/suggest  { imageId }                              → { adjustments }
 *   POST /api/mobile/studio/preview  { imageId, adjustments }                 → { dataUrl, width, height }
 *   POST /api/mobile/studio/accept   { imageId, adjustments }                 → { displayPath }
 *   POST /api/mobile/studio/restore  { imageId }                              → { ok: true }
 *   POST /api/mobile/studio/ai       { imageId, capability, roomType?, style? } → { jobId }
 *   POST /api/mobile/studio/confirm  { imageId, confirmed: true }             → { ok: true }
 *   POST /api/mobile/studio/discard  { imageId }                              → { sourceImageId }
 *
 * Fehler: { error, consentRequired? } mit passendem Status.
 */

// Bildverarbeitung mit sharp; Aufträge an die Bild-KI laufen nach der Antwort weiter (after)
export const runtime = "nodejs";
export const maxDuration = 300;

const NO_STORE = { "Cache-Control": "no-store" };

const STATUS: Partial<Record<AppError["code"], number>> = {
  not_authenticated: 401,
  forbidden: 403,
  account_inactive: 403,
  not_found: 404,
  validation: 422,
  conflict: 409,
  invalid_state: 409,
  rate_limited: 429,
  quota_exceeded: 429,
  service_unavailable: 503,
  unknown: 500,
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function errorResponse(error: unknown, action: string) {
  const result = fail(error);
  if (isAiConsentRequiredError(error)) return json({ error: result.error, consentRequired: true }, 403);
  const status = error instanceof AppError ? (STATUS[error.code] ?? 400) : 500;
  if (status === 500) console.error(`[mobile] Bilderstudio «${action}» fehlgeschlagen`, error);
  return json({ error: result.error }, status);
}

type Context = { params: Promise<{ action: string }> };

export async function GET(request: Request, context: Context) {
  const { action } = await context.params;
  if (action !== "status") return json({ error: "Nicht gefunden." }, 404);
  const session = await getBearerSession(request);
  if (!session) return json({ error: "Bitte melden Sie sich an." }, 401);
  const { supabase, user } = session;

  try {
    // Gleiche Berechnung wie src/app/dashboard/bilderstudio/[imageId]/page.tsx
    const settings = await loadAiSettings();
    const aiStatus = getImageAiStatus();
    const [enhance, design] = await Promise.all([
      // Grundkorrekturen sind keine KI: Schalter image_ai gilt nicht, das Kontingent schon
      getFeatureAvailability({
        supabase,
        userId: user.id,
        flag: "image_ai",
        quotaFeature: "image_enhance",
        requiresAi: false,
        requiresConsent: false,
        settings: { ...settings, features: { ...settings.features, image_ai: true } },
      }),
      getFeatureAvailability({
        supabase,
        userId: user.id,
        flag: "image_ai",
        quotaFeature: "virtual_staging",
        requiresAi: false,
        requiresConsent: true,
        consentKind: "image",
        settings,
      }),
    ]);
    return json({
      configured: aiStatus.configured,
      message: aiStatus.message,
      capabilities: aiStatus.provider?.capabilities ?? [],
      enhance,
      design,
      consent: getImageConsentInfo(),
      roomTypes: STAGING_ROOM_TYPES,
      styles: STAGING_STYLES,
    });
  } catch (error) {
    return errorResponse(error, action);
  }
}

export async function POST(request: Request, context: Context) {
  const { action } = await context.params;
  const session = await getBearerSession(request);
  if (!session) return json({ error: "Bitte melden Sie sich an." }, 401);
  const { supabase, user } = session;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || typeof body.imageId !== "string") return json({ error: "Ungültige Anfrage." }, 400);
  const imageId = body.imageId;

  try {
    switch (action) {
      case "suggest":
        return json({ adjustments: await suggestImageAdjustments(supabase, user, imageId) });
      case "preview":
        return json(await renderImagePreview(supabase, user, imageId, body.adjustments));
      case "accept":
        return json(await acceptImageEnhancement(supabase, user, imageId, body.adjustments));
      case "restore":
        await restoreOriginalImage(supabase, user, imageId);
        return json({ ok: true });
      case "ai":
        return json(await requestImageAi(supabase, user, { imageId, capability: body.capability, roomType: body.roomType ?? undefined, style: body.style ?? undefined }));
      case "confirm":
        await confirmAiVisualization(supabase, user, imageId, body.confirmed);
        return json({ ok: true });
      case "discard":
        return json(await discardAiVisualization(supabase, user, imageId));
      default:
        return json({ error: "Nicht gefunden." }, 404);
    }
  } catch (error) {
    return errorResponse(error, action);
  }
}
