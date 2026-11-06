"use client";

import * as React from "react";
import { Columns2, List, Map as MapIcon, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SORT_OPTIONS, countActiveFilters, type SortOption } from "@/lib/search/criteria";
import { pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSearch } from "@/components/search/search-context";
import { FilterPanel } from "@/components/search/filter-panel";
import { useMediaQuery } from "@/components/search/use-media-query";
import { SaveSearchButton } from "@/components/saved-searches/save-search-dialog";
import type { SearchView } from "@/components/search/url-state";

const VIEWS: { value: SearchView; label: string; icon: typeof List; desktopOnly?: boolean }[] = [
  { value: "liste", label: "Liste", icon: List },
  { value: "karte", label: "Karte", icon: MapIcon },
  { value: "kombi", label: "Liste und Karte", icon: Columns2, desktopOnly: true },
];

function ViewToggle() {
  const { snapshot, navigate } = useSearch();
  return (
    <div role="radiogroup" aria-label="Ansicht" className="inline-flex h-11 items-center gap-1 rounded-xl bg-muted p-1">
      {VIEWS.map((view) => {
        const active = snapshot.view === view.value;
        return (
          <button
            key={view.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={view.label}
            title={view.label}
            onClick={() => navigate({ view: view.value })}
            className={cn(
              "h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              view.desktopOnly ? "hidden lg:inline-flex" : "inline-flex",
              active ? "bg-card text-forest shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <view.icon className="size-4" aria-hidden />
            <span className={view.desktopOnly ? "sr-only xl:not-sr-only" : "hidden sm:inline"}>
              {view.value === "kombi" ? "Kombi" : view.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Werkzeugleiste der Suche: Filter (Sheet), Sortierung, Ansicht und Suchauftrag. */
export function SearchToolbar() {
  const { snapshot, navigate, total, isPending, hrefFor } = useSearch();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const criteria = snapshot.criteria;
  const activeCount = countActiveFilters(criteria) + (snapshot.bbox ? 1 : 0);
  const hasRadius = criteria.lat !== undefined && criteria.lng !== undefined && criteria.radius !== undefined;
  const sortOptions = (Object.entries(SORT_OPTIONS) as [SortOption, string][]).filter(([key]) => key !== "distance" || hasRadius);
  const sortValue = snapshot.sort === "distance" && !hasRadius ? "newest" : snapshot.sort;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-1 items-center gap-2 sm:flex-none">
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className={cn("relative", snapshot.view === "liste" && "lg:hidden")}>
              <SlidersHorizontal aria-hidden />
              Filter
              {activeCount ? (
                <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold leading-5 text-white">
                  {activeCount}
                  <span className="sr-only"> aktiv</span>
                </span>
              ) : null}
            </Button>
          </SheetTrigger>
          <SheetContent side={isDesktop ? "right" : "bottom"} className={cn("gap-0 p-0", isDesktop ? "sm:max-w-md" : "h-[90dvh]")}>
            <SheetHeader className="border-b border-border">
              <SheetTitle>Filter</SheetTitle>
              <SheetDescription>Die Treffer werden direkt aktualisiert.</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">
              <FilterPanel
                idPrefix="filter-sheet"
                footer={
                  <SheetClose asChild>
                    <Button size="lg" className="w-full" aria-live="polite">
                      {isPending ? "Treffer werden aktualisiert …" : `${pluralize(total, "Immobilie", "Immobilien")} anzeigen`}
                    </Button>
                  </SheetClose>
                }
              />
            </div>
          </SheetContent>
        </Sheet>

        <NativeSelect
          aria-label="Sortierung"
          value={sortValue}
          onChange={(event) => navigate({ sort: event.target.value as SortOption })}
          className="min-w-44"
        >
          {sortOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="flex items-center gap-2">
        <ViewToggle />
        <SaveSearchButton
          criteria={criteria}
          hasBbox={Boolean(snapshot.bbox)}
          returnTo={hrefFor({})}
          label={
            <>
              <span className="hidden sm:inline">Suchauftrag speichern</span>
              <span className="sm:hidden">Speichern</span>
            </>
          }
        />
      </div>
    </div>
  );
}
