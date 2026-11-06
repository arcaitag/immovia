"use client";

import { Progress } from "@/components/ui/progress";
import { usePropertyProgress } from "@/components/property-wizard/progress-context";
import type { Completeness } from "@/lib/properties/completeness";
import { cn } from "@/lib/utils";

/** Vollständigkeit der Objektdaten (live, sobald das Formular Werte ändert). */
export function CompletenessMeter({ fallback, className }: { fallback: Completeness; className?: string }) {
  const progress = usePropertyProgress();
  const completeness = progress?.completeness ?? fallback;
  const missing = completeness.missingRequired.length;
  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold">Vollständigkeit</span>
        <span className="font-display text-lg font-extrabold tabular text-forest">{completeness.percent} %</span>
      </div>
      <Progress value={completeness.percent} aria-label={`Vollständigkeit ${completeness.percent} Prozent`} />
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {missing === 0
          ? "Alle Pflichtangaben sind erfasst."
          : missing === 1
            ? "Noch 1 Pflichtangabe offen."
            : `Noch ${missing} Pflichtangaben offen.`}
      </p>
    </div>
  );
}
