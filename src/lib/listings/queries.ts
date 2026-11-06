import "server-only";

import { createPublicClient } from "@/lib/supabase/public";
import { propertyImageUrl } from "@/lib/storage";
import { mapSearchRow, type ListingCardData } from "@/types/domain";
import { toRpcArgs, type SearchCriteria, type SortOption } from "@/lib/search/criteria";

/** Öffentliche Inseratesuche (ohne Session, RLS wie Besucher). */
export async function searchPublicListings(
  criteria: SearchCriteria,
  options: { sort?: SortOption; limit?: number; offset?: number; bbox?: [number, number, number, number] } = {},
): Promise<{ items: ListingCardData[]; total: number; error: boolean }> {
  const supabase = createPublicClient();
  if (!supabase) return { items: [], total: 0, error: true };
  const { data, error } = await supabase.rpc("search_listings", toRpcArgs(criteria, options));
  if (error || !data) {
    if (error) console.error("[search] search_listings fehlgeschlagen", error.message);
    return { items: [], total: 0, error: Boolean(error) };
  }
  const items = data.map((row) =>
    mapSearchRow(row, propertyImageUrl({ display_path: row.cover_path, external_url: row.cover_external_url }, "md")),
  );
  return { items, total: Number(data[0]?.total_count ?? 0), error: false };
}

export async function getLatestListings(limit = 6): Promise<ListingCardData[]> {
  const { items } = await searchPublicListings({}, { limit, sort: "newest" });
  return items;
}
