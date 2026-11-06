import { Skeleton } from "@/components/ui/skeleton";

/** Ladezustand eines Schritts (unterhalb von Kopf und Schrittnavigation). */
export function StepSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Wird geladen">
      <div className="grid gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-7 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-card">
          <Skeleton className="h-5 w-40" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
          </div>
        </div>
      ))}
    </div>
  );
}
