import { Skeleton } from "@/components/ui/skeleton";

export function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card" aria-hidden>
      <Skeleton className="aspect-[16/10] rounded-none" />
      <div className="grid gap-3 p-5">
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-6 w-2/5" />
        <div className="flex gap-4 border-t border-border pt-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-14" />
        </div>
      </div>
    </div>
  );
}

/** Ladezustand der Suchseiten (loading.tsx). */
export function SearchPageSkeleton() {
  return (
    <div role="status" aria-label="Suchergebnisse werden geladen">
      <div className="border-b border-border bg-surface">
        <div className="container-page grid gap-3 py-6 sm:py-8">
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-2 h-12 w-full" />
        </div>
      </div>
      <div className="container-page py-6">
        <div className="flex flex-wrap justify-between gap-3">
          <div className="flex gap-2">
            <Skeleton className="h-11 w-28 lg:hidden" />
            <Skeleton className="h-11 w-44" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-11 w-40" />
            <Skeleton className="h-11 w-48" />
          </div>
        </div>
        <div className="mt-6 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10">
          <div className="hidden gap-4 lg:grid lg:content-start" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="grid gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-11 w-full" />
              </div>
            ))}
          </div>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">Suchergebnisse werden geladen …</span>
    </div>
  );
}
