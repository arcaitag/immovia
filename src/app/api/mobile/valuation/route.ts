import { z } from "zod";
import { AppError } from "@/lib/errors";
import { isAiConfigured } from "@/lib/ai/provider";
import { PROPERTY_TYPES, type PropertyType } from "@/lib/constants";
import { createPublicClient } from "@/lib/supabase/public";
import { CONFIDENCE_LABELS, VALUATION_STATUS_LABELS } from "@/lib/valuation/labels";
import { checkValuationPrerequisites } from "@/lib/valuation/prerequisites";
import { externalAvmStatus } from "@/lib/valuation/providers/external-avm";
import { buildValuationReportContent, parseDataQuality } from "@/lib/valuation/view";
import { getFeatureAvailability, hasAiConsent, requireManagedProperty } from "@/services/ai/access";
import { toValuationSubject } from "@/services/ai/property-data";
import { loadAiSettings } from "@/services/ai/settings";
import { requestValuationJob } from "@/services/ai/valuations";
import { readJson, withSession } from "./_lib";

export const runtime = "nodejs";
// Wie die Bewertungsseite der Website: der Auftrag läuft nach der Antwort weiter (after)
export const maxDuration = 300;

const querySchema = z.object({ propertyId: z.guid(), valuationId: z.guid().optional() });
const bodySchema = z.object({ propertyId: z.guid() });

/**
 * Mobile App: Stand der Bewertung einer Immobilie – dieselben Daten wie die Seite
 * /dashboard/immobilien/[id]/bewertung (Voraussetzungen, Verfügbarkeit/Kontingent, gespeicherte
 * Bewertungen, gewählte Bewertung aufbereitet wie für Oberfläche und PDF-Bericht).
 */
export async function GET(request: Request) {
  return withSession(request, async ({ supabase, user }) => {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      propertyId: url.searchParams.get("propertyId") ?? "",
      valuationId: url.searchParams.get("valuationId") ?? undefined,
    });
    if (!parsed.success) throw new AppError("validation", "Ungültige Anfrage.");
    const property = await requireManagedProperty(supabase, user, parsed.data.propertyId);
    const settings = await loadAiSettings();

    const { data: valuations } = await supabase
      .from("property_valuations")
      .select("id, status, estimated_value, created_at")
      .eq("property_id", property.id)
      .order("created_at", { ascending: false })
      .limit(20);
    const list = valuations ?? [];
    const selectedId = list.find((v) => v.id === parsed.data.valuationId)?.id ?? list[0]?.id ?? null;

    let detail = null;
    if (selectedId) {
      const [valuationRes, sourcesRes, comparablesRes] = await Promise.all([
        supabase.from("property_valuations").select("*").eq("id", selectedId).maybeSingle(),
        supabase.from("valuation_sources").select("*").eq("valuation_id", selectedId).order("created_at"),
        supabase.from("valuation_comparables").select("*").eq("valuation_id", selectedId).order("similarity", { ascending: false }),
      ]);
      if (valuationRes.data) {
        const v = valuationRes.data;
        const comparables = comparablesRes.data ?? [];
        const content = buildValuationReportContent({ valuation: v, sources: sourcesRes.data ?? [], comparables }, property);
        // Verlinkt wird nur, was noch öffentlich ist (anonymer Client wie auf der Website)
        let publicSlugs: Record<string, string> = {};
        const listingIds = comparables.map((c) => c.listing_id).filter((id): id is string => Boolean(id));
        const publicClient = createPublicClient();
        if (listingIds.length && publicClient) {
          const { data: open } = await publicClient.from("listings").select("id, slug").in("id", listingIds);
          publicSlugs = Object.fromEntries((open ?? []).filter((l) => l.slug).map((l) => [l.id, l.slug as string]));
        }
        detail = {
          id: v.id,
          status: v.status,
          statusLabel: content.statusLabel,
          statusTone: VALUATION_STATUS_LABELS[v.status].tone,
          createdAt: v.created_at,
          // Zahlen nur bei «completed»/«limited» mit vorhandenem Wert – sonst bewusst null
          hasNumbers: content.hasNumbers,
          estimatedValue: content.estimatedValue,
          valueLow: content.valueLow,
          valueHigh: content.valueHigh,
          suggestedListPrice: content.suggestedListPrice,
          listPriceExplanation: content.hasNumbers ? content.listPriceExplanation : null,
          confidence: v.confidence,
          confidenceLabel: content.confidenceLabel,
          confidenceTone: CONFIDENCE_LABELS[v.confidence].tone,
          confidenceExplanation: v.confidence_explanation,
          summary: content.summary,
          explanation: v.explanation,
          notes: content.notes,
          missing: content.missing,
          suggestions: content.suggestions,
          sources: content.sources,
          quality: content.quality,
          sampleSize: parseDataQuality(v.data_quality).sampleSize,
          areaLabel: content.areaLabel,
          comparables: comparables.map((c) => ({
            id: c.id,
            location: [c.postal_code, c.municipality].filter(Boolean).join(" ") || "–",
            typeLabel: c.property_type ? (PROPERTY_TYPES[c.property_type as PropertyType]?.label ?? "–") : "–",
            rooms: c.rooms !== null ? Number(c.rooms) : null,
            area: c.living_area !== null ? Number(c.living_area) : null,
            price: Number(c.price),
            pricePerSqm: c.price_per_sqm !== null ? Number(c.price_per_sqm) : null,
            observedAt: c.observed_at,
            distanceKm: c.distance_km !== null ? Number(c.distance_km) : null,
            slug: c.listing_id ? (publicSlugs[c.listing_id] ?? null) : null,
          })),
          positive: content.positive,
          negative: content.negative,
          disclaimer: v.disclaimer,
        };
      }
    }

    const prerequisites = checkValuationPrerequisites(toValuationSubject(property));
    const availability = await getFeatureAvailability({
      supabase,
      userId: user.id,
      flag: "valuation",
      quotaFeature: "valuation",
      requiresAi: false,
      requiresConsent: false,
      settings,
    });
    // Die Bewertung selbst ist rein rechnerisch; nur die zusätzliche KI-Erklärung braucht die Einwilligung
    const explanation = !isAiConfigured() ? "unavailable" : (await hasAiConsent(supabase, user.id)) ? "available" : "needs_consent";

    return {
      rent: property.offer_type === "rent",
      availability,
      prerequisites,
      explanation,
      method: {
        minComparables: settings.valuation.min_comparables,
        radiusKm: settings.valuation.radius_km,
        areaTolerance: settings.valuation.area_tolerance,
        maxAgeDays: settings.valuation.max_age_days,
        avmConfigured: externalAvmStatus().configured,
      },
      history: list.map((item) => ({
        id: item.id,
        status: item.status,
        statusLabel: VALUATION_STATUS_LABELS[item.status].label,
        statusTone: VALUATION_STATUS_LABELS[item.status].tone,
        estimatedValue: item.estimated_value !== null ? Number(item.estimated_value) : null,
        createdAt: item.created_at,
      })),
      selectedId,
      detail,
    };
  });
}

/** Startet eine Bewertung (Hintergrundauftrag, Status über /api/jobs/[jobId]). */
export async function POST(request: Request) {
  return withSession(request, async ({ supabase, user }) => {
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError("validation", "Ungültige Anfrage.");
    return requestValuationJob(supabase, user, parsed.data.propertyId);
  });
}
