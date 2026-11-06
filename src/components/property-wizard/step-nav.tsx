"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check } from "lucide-react";
import { usePropertyProgress } from "@/components/property-wizard/progress-context";
import { PROPERTY_STEPS, STEP_STATE_LABELS, type StepKey, type StepState, type StepStates } from "@/lib/properties/steps";
import { cn } from "@/lib/utils";

const NAV_LABELS: Partial<Record<StepKey, string>> = {
  veroeffentlichung: "Veröffentlichen",
  verwaltung: "Verwaltung",
};

function StepIndicator({ number, state, current }: { number: number; state: StepState; current: boolean }) {
  if (state === "done") {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-white" aria-hidden>
        <Check className="size-4" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold tabular",
        current ? "border-brand bg-white text-forest" : "border-border bg-white text-muted-foreground",
        state === "in_progress" && "border-brand/60 text-forest",
      )}
      aria-hidden
    >
      {number}
      {state === "in_progress" ? <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-white bg-warning" /> : null}
    </span>
  );
}

/**
 * Navigation durch die 8 Schritte. Frei springbar; auf Mobilgeräten horizontal
 * scrollbar. Der Status stammt aus echten Daten (Schritt 1 live aus dem Formular).
 */
export function PropertyStepNav({ propertyId, states }: { propertyId: string; states: StepStates }) {
  const pathname = usePathname();
  const progress = usePropertyProgress();
  const activeRef = React.useRef<HTMLAnchorElement | null>(null);

  const liveStates: StepStates = progress
    ? {
        ...states,
        erfassen: progress.completeness.isComplete ? "done" : progress.completeness.percent > 0 ? "in_progress" : "open",
      }
    : states;

  const base = `/dashboard/immobilien/${propertyId}`;
  const currentKey = PROPERTY_STEPS.find((step) => pathname === `${base}/${step.segment}` || pathname.startsWith(`${base}/${step.segment}/`))?.key;

  React.useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [currentKey]);

  return (
    <nav aria-label="Schritte des Verkaufsassistenten" className="-mx-4 sm:mx-0">
      <ol className="flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0">
        {PROPERTY_STEPS.map((step) => {
          const state = liveStates[step.key];
          const current = step.key === currentKey;
          return (
            <li key={step.key} className="shrink-0 snap-start lg:min-w-0">
              <Link
                ref={current ? activeRef : undefined}
                href={`${base}/${step.segment}`}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex min-h-14 w-[10.5rem] items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors lg:w-full lg:flex-col lg:items-start lg:gap-2 lg:py-3",
                  current
                    ? "border-brand bg-mint-100 shadow-sm"
                    : "border-border bg-card hover:border-mint-300 hover:bg-mint-50",
                )}
              >
                <StepIndicator number={step.number} state={state} current={current} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold leading-tight text-foreground">
                    {NAV_LABELS[step.key] ?? step.label}
                  </span>
                  <span className={cn("block text-xs", state === "done" ? "text-primary" : "text-muted-foreground")}>
                    {STEP_STATE_LABELS[state]}
                    {!step.required && state !== "done" ? " · optional" : ""}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
