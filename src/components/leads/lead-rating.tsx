"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { updateLeadAction } from "@/app/dashboard/interessenten/actions";

/** Bewertung 1–5 Sterne. Ein Klick auf die aktuelle Bewertung entfernt sie. */
export function LeadRating({ leadId, value }: { leadId: string; value: number | null }) {
  const [rating, setRating] = React.useState<number | null>(value);
  const [hover, setHover] = React.useState<number | null>(null);
  const [pending, startTransition] = React.useTransition();

  function choose(next: number) {
    const target = rating === next ? null : next;
    const previous = rating;
    setRating(target);
    startTransition(async () => {
      const res = await updateLeadAction({ leadId, rating: target });
      if (res.ok) toast.success(target ? `Bewertung: ${target} von 5 Sternen.` : "Bewertung entfernt.");
      else {
        setRating(previous);
        toast.error(res.error);
      }
    });
  }

  const shown = hover ?? rating ?? 0;
  return (
    <div role="radiogroup" aria-label="Bewertung" className="flex items-center" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={rating === n}
          aria-label={`${n} von 5 Sternen`}
          disabled={pending}
          onMouseEnter={() => setHover(n)}
          onClick={() => choose(n)}
          className="flex size-11 items-center justify-center rounded-lg transition-colors hover:bg-mint-50 disabled:opacity-60"
        >
          <Star className={cn("size-6", n <= shown ? "fill-current text-brand" : "text-border")} aria-hidden />
        </button>
      ))}
    </div>
  );
}

export function RatingStars({ value, className }: { value: number | null; className?: string }) {
  if (!value) return <span className={cn("text-xs text-muted-foreground", className)}>Keine Bewertung</span>;
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value} von 5 Sternen`} role="img">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("size-3.5", n <= value ? "fill-current text-brand" : "text-border")} aria-hidden />
      ))}
    </span>
  );
}
