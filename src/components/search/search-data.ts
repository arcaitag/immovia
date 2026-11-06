import "server-only";

import { createPublicClient } from "@/lib/supabase/public";
import { propertyImageUrl } from "@/lib/storage";
import { priceDisplay } from "@/lib/listings/price";
import { formatArea, formatRooms } from "@/lib/format";
import { PROPERTY_TYPES, type OfferType, type PropertyType } from "@/lib/constants";
import { toRpcArgs, type SearchCriteria, type SortOption } from "@/lib/search/criteria";
import { approximateRadiusMeters } from "@/components/map/types";
import type { Bbox } from "@/components/search/url-state";

/** Inserat für die Kartenansicht (Marker und Vorschaukarte). */
export interface MapListing {
  id: string;
  slug: string;
  title: string;
  locationLabel: string;
  priceValue: string;
  priceLabel: string;
  facts: string;
  imageUrl: string | null;
  offerType: OfferType;
  isDemo: boolean;
  lat: number;
  lng: number;
  approximate: boolean;
  radiusMeters: number | null;
  /** Kurzer Preis im Marker */
  markerLabel: string;
}

/** Kurzer Preis für Kartenmarker, z. B. «765’000» bzw. «2’150 / Mt.». */
function shortPrice(value: number | null, offer: OfferType, onRequest: boolean): string {
  if (onRequest || value === null) return "Auf Anfrage";
  const rounded = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 }).format(value);
  return offer === "rent" ? `${rounded} / Mt.` : value >= 1_000_000
    ? `${new Intl.NumberFormat("de-CH", { maximumFractionDigits: 2 }).format(value / 1_000_000)} Mio.`
    : rounded;
}

/**
 * Treffer mit Koordinaten für die Karte. Ruft dieselbe Datenbankfunktion wie die Liste auf
 * (öffentlicher Client, RLS wie für Besucher), liefert aber zusätzlich die Standortgenauigkeit.
 */
export async function searchMapListings(
  criteria: SearchCriteria,
  options: { sort?: SortOption; bbox?: Bbox | null; limit?: number } = {},
): Promise<{ items: MapListing[]; total: number; error: boolean }> {
  const supabase = createPublicClient();
  if (!supabase) return { items: [], total: 0, error: true };
  const { data, error } = await supabase.rpc(
    "search_listings",
    toRpcArgs(criteria, { sort: options.sort, limit: options.limit ?? 100, offset: 0, bbox: options.bbox ?? undefined }),
  );
  if (error || !data) {
    if (error) console.error("[suche] Kartenabfrage fehlgeschlagen", error.message);
    return { items: [], total: 0, error: Boolean(error) };
  }
  const items: MapListing[] = [];
  for (const row of data) {
    if (!row.id || !row.slug || row.public_latitude === null || row.public_longitude === null) continue;
    const offerType = (row.offer_type ?? "sale") as OfferType;
    const propertyType = (row.property_type ?? "apartment") as PropertyType;
    const price = row.price !== null ? Number(row.price) : null;
    const additional = row.additional_costs !== null ? Number(row.additional_costs) : null;
    const display = priceDisplay({ offerType, price, priceOnRequest: Boolean(row.price_on_request), additionalCosts: additional });
    const radius = approximateRadiusMeters(row.location_precision);
    const facts = [
      row.rooms !== null && propertyType !== "plot" ? formatRooms(Number(row.rooms)) : null,
      row.living_area !== null && propertyType !== "plot" ? formatArea(Number(row.living_area)) : null,
      propertyType === "plot" && row.plot_area !== null ? `${formatArea(Number(row.plot_area))} Grundstück` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    items.push({
      id: row.id,
      slug: row.slug,
      title: row.title ?? PROPERTY_TYPES[propertyType].label,
      locationLabel: row.public_address ?? [row.postal_code, row.municipality].filter(Boolean).join(" "),
      priceValue: display.value,
      priceLabel: display.label,
      facts,
      imageUrl: propertyImageUrl({ display_path: row.cover_path, external_url: row.cover_external_url }, "sm"),
      offerType,
      isDemo: Boolean(row.is_demo),
      lat: Number(row.public_latitude),
      lng: Number(row.public_longitude),
      approximate: radius !== null,
      radiusMeters: radius,
      markerLabel: shortPrice(
        offerType === "rent" && price !== null ? price + (additional ?? 0) : price,
        offerType,
        Boolean(row.price_on_request),
      ),
    });
  }
  return { items, total: Number(data[0]?.total_count ?? 0), error: false };
}
