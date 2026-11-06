import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { propertyImageUrl } from "@/lib/storage";
import { mapSearchRow, type ListingCardData, type SearchListingRow } from "@/types/domain";
import { FavoritesGrid, UnavailableFavorites } from "./favorites-grid";

export const metadata: Metadata = { title: "Merkliste" };

const CHUNK = 100;

export default async function MerklistePage() {
  await requireUser("/dashboard/merkliste");
  const supabase = await createClient();
  const { data: favorites, error } = await supabase
    .from("favorites")
    .select("listing_id, created_at")
    .order("created_at", { ascending: false });

  const favoriteRows = favorites ?? [];
  const ids = favoriteRows.map((f) => f.listing_id);
  const rows: SearchListingRow[] = [];
  let loadFailed = Boolean(error);
  // RLS liefert nur öffentliche Inserate; nicht mehr verfügbare fehlen im Ergebnis.
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error: searchError } = await supabase.rpc("search_listings", { p_listing_ids: ids.slice(i, i + CHUNK), p_limit: CHUNK });
    if (searchError) {
      loadFailed = true;
      break;
    }
    rows.push(...(data ?? []));
  }

  const byId = new Map<string, ListingCardData>();
  for (const row of rows) {
    if (!row.id) continue;
    byId.set(row.id, mapSearchRow(row, propertyImageUrl({ display_path: row.cover_path, external_url: row.cover_external_url }, "md")));
  }
  const available = favoriteRows.map((f) => byId.get(f.listing_id)).filter((l): l is ListingCardData => Boolean(l));
  const unavailable = loadFailed
    ? []
    : favoriteRows.filter((f) => !byId.has(f.listing_id)).map((f) => ({ listingId: f.listing_id, createdAt: f.created_at }));

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Merkliste"
        description="Ihre gespeicherten Inserate. Über das Herz entfernen Sie ein Inserat wieder von der Merkliste."
        actions={
          <Button asChild variant="outline">
            <Link href="/immobilien">
              <Search aria-hidden /> Immobilien suchen
            </Link>
          </Button>
        }
      />
      {loadFailed ? <Alert tone="error">Die Merkliste konnte nicht vollständig geladen werden. Bitte laden Sie die Seite neu.</Alert> : null}
      {unavailable.length ? <UnavailableFavorites items={unavailable} /> : null}
      <FavoritesGrid listings={available} />
    </div>
  );
}
