import { Skeleton } from "@/components/ui/skeleton";

export default function ConversationLoading() {
  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] top-16 z-10 flex flex-col bg-card lg:static lg:inset-auto lg:z-auto lg:min-h-0 lg:flex-1">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      <div className="flex-1 space-y-4 bg-surface p-5" aria-hidden>
        <Skeleton className="h-14 w-2/3" />
        <Skeleton className="ml-auto h-10 w-1/2" />
        <Skeleton className="h-20 w-3/5" />
        <Skeleton className="ml-auto h-12 w-2/5" />
      </div>
      <div className="border-t border-border p-3">
        <Skeleton className="h-11 w-full" />
      </div>
      <span className="sr-only" role="status">
        Unterhaltung wird geladen
      </span>
    </div>
  );
}
