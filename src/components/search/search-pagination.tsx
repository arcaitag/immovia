"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearch } from "@/components/search/search-context";
import { pageItems } from "@/components/search/url-state";

/**
 * Seitennavigation. Echte Links (auch ohne JavaScript und für Suchmaschinen),
 * im Browser als Transition mit abgeblendeten Treffern.
 */
export function SearchPagination({ totalPages }: { totalPages: number }) {
  const { snapshot, navigate, hrefFor } = useSearch();
  const current = Math.min(snapshot.page, Math.max(totalPages, 1));
  if (totalPages <= 1) return null;

  function onClick(event: React.MouseEvent<HTMLAnchorElement>, page: number) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    navigate({ page }, { history: "push", scrollToResults: true });
  }

  const base =
    "inline-flex h-11 min-w-11 items-center justify-center rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring";

  return (
    <nav aria-label="Seitennavigation" className="mt-10 flex flex-wrap items-center justify-center gap-1.5">
      {current > 1 ? (
        <Link href={hrefFor({ page: current - 1 })} onClick={(e) => onClick(e, current - 1)} rel="prev" className={cn(base, "gap-1 border border-border bg-card hover:bg-mint-50")}>
          <ChevronLeft className="size-4" aria-hidden />
          <span className="hidden sm:inline">Zurück</span>
          <span className="sr-only sm:hidden">Vorherige Seite</span>
        </Link>
      ) : null}
      {pageItems(current, totalPages).map((item, index) =>
        item === "…" ? (
          <span key={`luecke-${index}`} className="px-1 text-muted-foreground" aria-hidden>
            …
          </span>
        ) : (
          <Link
            key={item}
            href={hrefFor({ page: item })}
            onClick={(e) => onClick(e, item)}
            aria-current={item === current ? "page" : undefined}
            aria-label={`Seite ${item}`}
            className={cn(
              base,
              item === current ? "bg-forest text-white" : "border border-border bg-card hover:bg-mint-50",
              Math.abs(item - current) > 1 && item !== 1 && item !== totalPages && "hidden sm:inline-flex",
            )}
          >
            {item}
          </Link>
        ),
      )}
      {current < totalPages ? (
        <Link href={hrefFor({ page: current + 1 })} onClick={(e) => onClick(e, current + 1)} rel="next" className={cn(base, "gap-1 border border-border bg-card hover:bg-mint-50")}>
          <span className="hidden sm:inline">Weiter</span>
          <span className="sr-only sm:hidden">Nächste Seite</span>
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </nav>
  );
}
