"use client";

import { usePathname, useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useFavoriteIds, useToggleFavorite } from "@/hooks/use-favorites";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  listingId,
  className,
  variant = "overlay",
}: {
  listingId: string;
  className?: string;
  variant?: "overlay" | "inline";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: user } = useAuthUser();
  const { data: ids } = useFavoriteIds();
  const toggle = useToggleFavorite();
  const active = ids?.has(listingId) ?? false;

  function onClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!user) {
      router.push(`/login?weiter=${encodeURIComponent(pathname)}`);
      return;
    }
    toggle.mutate(
      { listingId, favorite: !active },
      {
        onSuccess: () => toast.success(active ? "Von der Merkliste entfernt" : "Auf der Merkliste gespeichert"),
        onError: () => toast.error("Die Merkliste konnte nicht aktualisiert werden."),
      },
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? "Von der Merkliste entfernen" : "Auf die Merkliste setzen"}
      className={cn(
        "flex items-center justify-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        variant === "overlay"
          ? "size-10 bg-white/95 text-forest shadow-sm hover:scale-105 hover:bg-white"
          : "h-11 gap-2 border border-border bg-card px-4 text-sm font-semibold hover:bg-mint-50",
        className,
      )}
    >
      <Heart className={cn("size-5 transition-colors", active && "fill-brand text-brand")} aria-hidden />
      {variant === "inline" ? <span>{active ? "Gemerkt" : "Merken"}</span> : null}
    </button>
  );
}
