import { Skeleton } from "@/components/ui/skeleton";

/** Allgemeiner Ladezustand des Dashboards (gilt auch für Unterseiten ohne eigenen Ladezustand). */
export default function DashboardLoading() {
  return (
    <div className="grid gap-8" aria-busy="true" aria-label="Wird geladen">
      <div className="grid gap-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}
