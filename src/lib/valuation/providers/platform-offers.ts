import "server-only";

import { isServiceRoleConfigured, type AdminSupabaseClient } from "@/lib/supabase/admin";
import { PLATFORM_OFFERS_PROVIDER, VALUATION_GROUPS, valuationGroupFor, type ValuationParams } from "@/lib/valuation/config";
import { computeOfferEstimate } from "@/lib/valuation/estimate";
import { boundingBox } from "@/lib/valuation/geo";
import type { OfferCandidate, ValuationSubject } from "@/lib/valuation/types";
import type { ValuationProvider } from "@/lib/valuation/providers/types";

/**
 * Provider «platform_offers»: Vergleich mit Angebotspreisen echter, veröffentlichter
 * Immovia-Inserate (is_demo = false). Liest mit dem Service-Role-Client nur öffentliche
 * Inseratedaten (öffentliche Koordinaten, keine exakten Adressen).
 */

const MAX_CANDIDATES = 2000;

export async function fetchOfferCandidates(
  admin: AdminSupabaseClient,
  subject: ValuationSubject,
  params: ValuationParams,
  now: Date,
): Promise<OfferCandidate[]> {
  const group = valuationGroupFor(subject.propertyType);
  if (!group) return [];
  const cutoff = new Date(now.getTime() - params.max_age_days * 86_400_000).toISOString();

  let query = admin
    .from("listings")
    .select(
      "id, property_id, property_type, offer_type, price, living_area, usable_area, plot_area, rooms, municipality, postal_code, canton, public_latitude, public_longitude, published_at, first_published_at, is_demo",
    )
    .in("status", ["published", "reserved"])
    .eq("is_demo", false)
    .is("deleted_at", null)
    .neq("moderation_status", "blocked")
    .eq("offer_type", subject.offerType)
    .in("property_type", VALUATION_GROUPS[group].types)
    .eq("price_on_request", false)
    .gt("price", 0)
    .neq("property_id", subject.propertyId)
    .gte("published_at", cutoff);

  const hasCoords = subject.latitude !== null && subject.longitude !== null;
  if (hasCoords) {
    const box = boundingBox(subject.latitude!, subject.longitude!, params.radius_km);
    const inBox = `and(public_latitude.gte.${box.minLat.toFixed(5)},public_latitude.lte.${box.maxLat.toFixed(5)},public_longitude.gte.${box.minLon.toFixed(5)},public_longitude.lte.${box.maxLon.toFixed(5)})`;
    query = subject.canton ? query.or(`${inBox},canton.eq.${subject.canton}`) : query.or(inBox);
  } else if (subject.canton) {
    query = query.eq("canton", subject.canton);
  } else {
    return [];
  }

  const { data, error } = await query.order("published_at", { ascending: false }).limit(MAX_CANDIDATES);
  if (error) throw new Error(`Vergleichsangebote konnten nicht geladen werden: ${error.message}`);

  return (data ?? [])
    .filter((row) => row.price !== null)
    .map((row) => ({
      listingId: row.id,
      propertyId: row.property_id,
      propertyType: row.property_type,
      offerType: row.offer_type,
      price: Number(row.price),
      livingArea: row.living_area !== null ? Number(row.living_area) : null,
      usableArea: row.usable_area !== null ? Number(row.usable_area) : null,
      plotArea: row.plot_area !== null ? Number(row.plot_area) : null,
      rooms: row.rooms !== null ? Number(row.rooms) : null,
      municipality: row.municipality,
      postalCode: row.postal_code,
      canton: row.canton,
      latitude: row.public_latitude,
      longitude: row.public_longitude,
      publishedAt: row.first_published_at ?? row.published_at ?? now.toISOString(),
      isDemo: row.is_demo,
    }));
}

export const platformOffersProvider: ValuationProvider = {
  id: PLATFORM_OFFERS_PROVIDER.id,
  label: PLATFORM_OFFERS_PROVIDER.label,
  isAvailable: () => isServiceRoleConfigured(),
  async estimate(subject, { admin, params, now }) {
    const candidates = await fetchOfferCandidates(admin, subject, params, now);
    const estimate = computeOfferEstimate(subject, candidates, params, now);
    return {
      provider: PLATFORM_OFFERS_PROVIDER.id,
      method: PLATFORM_OFFERS_PROVIDER.method,
      estimate,
      sources: [
        {
          sourceType: "platform_offers",
          name: PLATFORM_OFFERS_PROVIDER.sourceName,
          description: PLATFORM_OFFERS_PROVIDER.sourceDescription,
          dataAsOf: now.toISOString().slice(0, 10),
          recordCount: estimate.dataQuality.sampleSize,
          licenseNote: PLATFORM_OFFERS_PROVIDER.licenseNote,
          url: null,
        },
      ],
    };
  },
};
