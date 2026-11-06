import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="grid gap-8" aria-busy="true" aria-label="Profil wird geladen">
      <div className="grid gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-6">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
        <div className="grid content-start gap-6">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
