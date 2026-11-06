import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container-page pt-4 sm:pt-6" role="status" aria-label="Inserat wird geladen">
      <Skeleton className="mb-4 h-4 w-48" />
      <div className="hidden h-[30rem] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-3xl md:grid lg:h-[34rem]">
        <Skeleton className="col-span-2 row-span-2 rounded-none" />
        <Skeleton className="rounded-none" />
        <Skeleton className="rounded-none" />
        <Skeleton className="rounded-none" />
        <Skeleton className="rounded-none" />
      </div>
      <Skeleton className="-mx-4 aspect-[4/3] rounded-none sm:mx-0 sm:rounded-3xl md:hidden" />
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid content-start gap-4">
          <div className="flex gap-2">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-10 w-4/5" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="mt-8 h-7 w-40" />
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl sm:grid-cols-3">
            {Array.from({ length: 9 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-none" />
            ))}
          </div>
          <Skeleton className="mt-8 h-7 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <Skeleton className="hidden h-80 lg:block" />
      </div>
      <span className="sr-only">Inserat wird geladen …</span>
    </div>
  );
}
