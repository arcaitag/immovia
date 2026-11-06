import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="grid gap-8" aria-busy="true" aria-label="Einstellungen werden geladen">
      <div className="grid gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>
      <Skeleton className="h-[30rem] rounded-2xl" />
      <Skeleton className="h-96 rounded-2xl" />
      <Skeleton className="h-36 rounded-2xl" />
    </div>
  );
}
