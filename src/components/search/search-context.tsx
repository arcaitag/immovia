"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { OfferType } from "@/lib/constants";
import { searchHref, type SearchSnapshot } from "@/components/search/url-state";

interface NavigateOptions {
  /** push für Seitenwechsel (Zurück-Taste), replace für Filteränderungen */
  history?: "push" | "replace";
  /** Nach dem Wechsel an den Anfang der Trefferliste scrollen */
  scrollToResults?: boolean;
  /** Anker für die Zieladresse (ohne «#»), z. B. um das Filter-Sheet nach einem Routenwechsel wieder zu öffnen */
  hash?: string;
}

interface SearchContextValue {
  /** Aktueller (optimistischer) Zustand: Änderungen sind sofort sichtbar, bevor der Server antwortet. */
  snapshot: SearchSnapshot;
  total: number;
  isPending: boolean;
  /** Angebotsart ist durch die Route festgelegt (/kaufen, /mieten). */
  routeOffer?: OfferType;
  navigate: (next: Partial<SearchSnapshot>, options?: NavigateOptions) => void;
  hrefFor: (next: Partial<SearchSnapshot>) => string;
  resultsRef: React.RefObject<HTMLDivElement | null>;
}

const SearchContext = React.createContext<SearchContextValue | null>(null);

export function useSearch(): SearchContextValue {
  const context = React.useContext(SearchContext);
  if (!context) throw new Error("useSearch muss innerhalb von <SearchProvider> verwendet werden.");
  return context;
}

function resolve(current: SearchSnapshot, next: Partial<SearchSnapshot>): SearchSnapshot {
  const resetsPage = next.criteria !== undefined || next.bbox !== undefined || next.sort !== undefined;
  return {
    criteria: next.criteria ?? current.criteria,
    sort: next.sort ?? current.sort,
    view: next.view ?? current.view,
    bbox: next.bbox !== undefined ? next.bbox : current.bbox,
    page: next.page ?? (resetsPage ? 1 : current.page),
  };
}

/**
 * Hält den Suchzustand (aus der URL) für alle Bedienelemente der Suche.
 * Navigationen laufen als Transition: die bisherigen Treffer bleiben sichtbar und werden abgeblendet.
 */
export function SearchProvider({
  initial,
  total,
  routeOffer,
  children,
}: {
  initial: SearchSnapshot;
  total: number;
  routeOffer?: OfferType;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [snapshot, setOptimisticSnapshot] = React.useOptimistic(initial);
  const resultsRef = React.useRef<HTMLDivElement>(null);

  const navigate = React.useCallback(
    (next: Partial<SearchSnapshot>, options: NavigateOptions = {}) => {
      const target = resolve(snapshot, next);
      const href = options.hash ? `${searchHref(target)}#${options.hash}` : searchHref(target);
      startTransition(() => {
        setOptimisticSnapshot(target);
        if (options.history === "push") router.push(href, { scroll: false });
        else router.replace(href, { scroll: false });
      });
      if (options.scrollToResults && resultsRef.current) {
        const top = resultsRef.current.getBoundingClientRect().top + window.scrollY - 96;
        if (window.scrollY > top) {
          const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
        }
      }
    },
    [router, setOptimisticSnapshot, snapshot],
  );

  const hrefFor = React.useCallback((next: Partial<SearchSnapshot>) => searchHref(resolve(snapshot, next)), [snapshot]);

  const value = React.useMemo<SearchContextValue>(
    () => ({ snapshot, total, isPending, routeOffer, navigate, hrefFor, resultsRef }),
    [snapshot, total, isPending, routeOffer, navigate, hrefFor],
  );

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

/** Blendet die Treffer während einer laufenden Suche ab und kündigt das Laden an. */
export function SearchPendingArea({ children, className }: { children: React.ReactNode; className?: string }) {
  const { isPending, resultsRef } = useSearch();
  return (
    <div
      ref={resultsRef}
      aria-busy={isPending || undefined}
      data-pending={isPending ? "" : undefined}
      className={className}
    >
      <div
        className={
          isPending
            ? "pointer-events-none opacity-55 transition-opacity duration-200"
            : "opacity-100 transition-opacity duration-200"
        }
      >
        {children}
      </div>
    </div>
  );
}
