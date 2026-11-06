import { Skeleton } from "@/components/ui/skeleton";
import { ListingCardSkeleton } from "@/components/search/search-skeleton";

export default function Loading() {
  return (
    <div className="grid gap-8" role="status" aria-label="Merkliste wird geladen">
      <div className="grid gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <ListingCardSkeleton key={i} />
        ))}
      </div>
      <span className="sr-only">Merkliste wird geladen …</span>
    </div>
  );
}
