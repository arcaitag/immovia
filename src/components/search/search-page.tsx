import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ListingCard } from "@/components/property/listing-card";
import { searchPublicListings } from "@/lib/listings/queries";
import { PAGE_SIZE, parseSearchParams, type SearchState } from "@/lib/search/criteria";
import type { OfferType } from "@/lib/constants";
import { pluralize } from "@/lib/format";
import { buildSearchMetadata, searchHeading } from "@/lib/seo/search-metadata";
import { cn } from "@/lib/utils";
import { SearchPendingArea, SearchProvider } from "@/components/search/search-context";
import { SearchLocationBar } from "@/components/search/search-location-bar";
import { SearchToolbar } from "@/components/search/search-toolbar";
import { ActiveFilters } from "@/components/search/active-filters";
import { FilterPanel } from "@/components/search/filter-panel";
import { SearchPagination } from "@/components/search/search-pagination";
import { SearchResultsMap } from "@/components/search/search-results-map";
import { SearchEmptyState } from "@/components/search/search-empty-state";
import { searchMapListings } from "@/components/search/search-data";
import { BBOX_PARAM, parseBbox, searchHref, type SearchSnapshot } from "@/components/search/url-state";
import type { ListingCardData } from "@/types/domain";

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Liest den Suchzustand aus der URL. Bei /kaufen und /mieten ist die Angebotsart fest. */
export function readSearchState(params: RawSearchParams, routeOffer?: OfferType): SearchSnapshot {
  const state: SearchState = parseSearchParams(params, routeOffer ? { offer: routeOffer } : {});
  if (routeOffer) state.criteria.offer = routeOffer;
  return { ...state, bbox: parseBbox(params[BBOX_PARAM]) };
}

export function searchPageMetadata(params: RawSearchParams, routeOffer?: OfferType): Metadata {
  const snapshot = readSearchState(params, routeOffer);
  return buildSearchMetadata(snapshot, Boolean(snapshot.bbox));
}

function ResultsGrid({ items, compact = false }: { items: ListingCardData[]; compact?: boolean }) {
  return (
    <ul role="list" className={cn("grid gap-6 sm:grid-cols-2", compact ? "2xl:grid-cols-2" : "xl:grid-cols-3")}>
      {items.map((listing, index) => (
        <li key={listing.id}>
          <ListingCard
            listing={listing}
            priority={index < 2}
            sizes={compact ? "(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw" : "(min-width: 1280px) 360px, (min-width: 640px) 50vw, 100vw"}
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * Gemeinsame Suchseite für /immobilien, /kaufen und /mieten.
 * Daten kommen serverseitig über die Datenbankfunktion search_listings (öffentlicher Client).
 */
export async function SearchPage({ params, routeOffer }: { params: RawSearchParams; routeOffer?: OfferType }) {
  const snapshot = readSearchState(params, routeOffer);
  const { criteria, sort, page, view, bbox } = snapshot;
  const showList = view !== "karte";
  const showMap = view !== "liste";

  const [list, map] = await Promise.all([
    showList
      ? searchPublicListings(criteria, { sort, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, bbox: bbox ?? undefined })
      : Promise.resolve(null),
    showMap ? searchMapListings(criteria, { sort, bbox, limit: 100 }) : Promise.resolve(null),
  ]);

  // Seite ausserhalb des Bereichs: Gesamtzahl separat ermitteln
  let total = list ? list.total : (map?.total ?? 0);
  const pageOutOfRange = Boolean(list && list.items.length === 0 && page > 1 && !list.error);
  if (pageOutOfRange) {
    const probe = await searchPublicListings(criteria, { sort, limit: 1, offset: 0, bbox: bbox ?? undefined });
    total = probe.total;
  }
  const failed = Boolean(list?.error || map?.error);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const heading = searchHeading(criteria);
  const returnTo = searchHref(snapshot);

  const listContent = (compact: boolean) => {
    if (failed) return null;
    if (pageOutOfRange) {
      return (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
          <p className="font-display text-lg font-bold">Diese Seite enthält keine Treffer mehr.</p>
          <p className="mt-2 text-sm text-muted-foreground">Die Trefferliste hat sich inzwischen verändert.</p>
          <Button asChild className="mt-5">
            <Link href={searchHref({ ...snapshot, page: total ? totalPages : 1 })}>{total ? "Zur letzten Seite" : "Zur ersten Seite"}</Link>
          </Button>
        </div>
      );
    }
    if (!list?.items.length) return <SearchEmptyState snapshot={snapshot} returnTo={returnTo} />;
    return (
      <>
        <ResultsGrid items={list.items} compact={compact} />
        <SearchPagination totalPages={totalPages} />
      </>
    );
  };

  return (
    <SearchProvider initial={snapshot} total={total} routeOffer={routeOffer}>
      <div className="border-b border-border bg-surface">
        <div className={cn("container-page py-6 sm:py-8", view !== "liste" && "max-w-[96rem]")}>
          <h1 className="font-display text-[1.75rem] font-extrabold leading-tight tracking-tight sm:text-[2.1rem]">{heading.title}</h1>
          <p role="status" className="mt-1.5 text-[0.9375rem] text-muted-foreground">
            {failed ? "Die Suche ist momentan nicht verfügbar." : `${pluralize(total, "Immobilie", "Immobilien")} gefunden`}
          </p>
          <SearchLocationBar className="mt-5" />
        </div>
      </div>

      <div className={cn("container-page py-6", view !== "liste" && "max-w-[96rem]")}>
        <SearchToolbar />
        <div className="mt-4 empty:hidden">
          <ActiveFilters />
        </div>

        {failed ? (
          <Alert tone="error" title="Die Suche ist momentan nicht verfügbar" className="mt-6">
            Die Datenbank ist nicht erreichbar. Bitte versuchen Sie es in einigen Minuten erneut.
          </Alert>
        ) : null}

        {view === "liste" ? (
          <div className="mt-6 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10">
            <aside aria-label="Filter" className="hidden lg:block">
              <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-5 shadow-card">
                <FilterPanel idPrefix="filter-seitenleiste" />
              </div>
            </aside>
            <SearchPendingArea>{listContent(false)}</SearchPendingArea>
          </div>
        ) : null}

        {view === "karte" && map ? (
          <SearchPendingArea className="mt-6">
            <SearchResultsMap listings={map.items} total={map.total} className="h-[calc(100dvh-13rem)] min-h-[26rem]" />
          </SearchPendingArea>
        ) : null}

        {view === "kombi" && map ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <SearchPendingArea className="order-2 lg:order-1">{listContent(true)}</SearchPendingArea>
            <div className="order-1 lg:order-2">
              <div className="lg:sticky lg:top-24">
                <SearchResultsMap listings={map.items} total={map.total} className="h-[50vh] lg:h-[calc(100dvh-7.5rem)]" />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </SearchProvider>
  );
}
