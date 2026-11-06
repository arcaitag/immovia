"use client";

import * as React from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, HeartOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/sonner";
import { ListingCard } from "@/components/property/listing-card";
import { FAVORITE_IDS_KEY, useFavoriteIds } from "@/hooks/use-favorites";
import { formatDate, pluralize } from "@/lib/format";
import type { ListingCardData } from "@/types/domain";
import { removeFavoritesAction } from "./actions";

/** Gemerkte Inserate. Über das Herz entfernte Inserate verschwinden sofort aus der Liste. */
export function FavoritesGrid({ listings }: { listings: ListingCardData[] }) {
  const { data: ids } = useFavoriteIds();
  const visible = ids ? listings.filter((listing) => ids.has(listing.id)) : listings;

  if (!visible.length) {
    return (
      <EmptyState
        icon={Heart}
        title="Ihre Merkliste ist leer"
        description="Tippen Sie bei einem Inserat auf das Herz, um es hier zu speichern und später zu vergleichen."
        action={
          <Button asChild>
            <Link href="/immobilien">Immobilien entdecken</Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul role="list" className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {visible.map((listing) => (
        <li key={listing.id}>
          <ListingCard listing={listing} sizes="(min-width: 1280px) 340px, (min-width: 640px) 50vw, 100vw" />
        </li>
      ))}
    </ul>
  );
}

/** Hinweis auf gemerkte Inserate, die nicht mehr öffentlich sind (verkauft, vermietet, entfernt). */
export function UnavailableFavorites({ items }: { items: { listingId: string; createdAt: string }[] }) {
  const queryClient = useQueryClient();
  const [pending, startTransition] = React.useTransition();

  function remove(listingIds: string[]) {
    startTransition(async () => {
      const result = await removeFavoritesAction({ listingIds });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Entfernt.");
      void queryClient.invalidateQueries({ queryKey: FAVORITE_IDS_KEY });
    });
  }

  return (
    <section aria-labelledby="nicht-verfuegbar" className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-muted-foreground">
            <HeartOff className="size-5" aria-hidden />
          </span>
          <div>
            <h2 id="nicht-verfuegbar" className="font-display font-bold">
              {pluralize(items.length, "gemerktes Inserat ist", "gemerkte Inserate sind")} nicht mehr verfügbar
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Die Immobilie wurde verkauft oder vermietet, oder das Inserat wurde pausiert bzw. entfernt.
            </p>
          </div>
        </div>
        {items.length > 1 ? (
          <Button variant="outline" size="sm" loading={pending} onClick={() => remove(items.map((i) => i.listingId))}>
            Alle entfernen
          </Button>
        ) : null}
      </div>
      <ul role="list" className="mt-4 grid gap-2">
        {items.map((item) => (
          <li key={item.listingId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 text-sm">
            <span>
              Gemerkt am {formatDate(item.createdAt)} · <span className="text-muted-foreground">nicht mehr verfügbar</span>
            </span>
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => remove([item.listingId])}>
              Entfernen
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
