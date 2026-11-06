import { Skeleton } from "@/components/ui/skeleton";

export default function LeadLoading() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <Skeleton className="h-4 w-36" />
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
      <span className="sr-only" role="status">
        Interessent wird geladen
      </span>
    </div>
  );
}
