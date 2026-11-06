import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid gap-8" role="status" aria-label="Suchaufträge werden geladen">
      <div className="grid gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <div className="grid gap-4">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="grid gap-3 rounded-2xl border border-border bg-card p-6 shadow-card">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
            <div className="mt-2 flex gap-3 border-t border-border pt-4">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-10 w-36" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Suchaufträge werden geladen …</span>
    </div>
  );
}
