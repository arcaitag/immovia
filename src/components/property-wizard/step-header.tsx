import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adjacentSteps, stepHref, type StepKey } from "@/lib/properties/steps";
import { cn } from "@/lib/utils";

/**
 * Überschrift eines Schritts unterhalb des Objekt-Kopfs (h2, da der Kopf die h1 trägt).
 * Auch für die Schritte anderer Bereiche (Bewertung, Beschreibung, Dossier) gedacht.
 */
export function StepHeader({
  step,
  title,
  description,
  actions,
  className,
}: {
  step?: number;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-1.5">
        {step ? <p className="text-sm font-semibold text-primary">Schritt {step} von 8</p> : null}
        <h2 className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h2>
        {description ? <p className="max-w-2xl text-[0.9375rem] leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** «Zurück» / «Weiter» zwischen den Schritten des Assistenten. */
export function StepFooterNav({ propertyId, current }: { propertyId: string; current: StepKey }) {
  const { previous, next } = adjacentSteps(current);
  return (
    <nav aria-label="Zwischen den Schritten wechseln" className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-between">
      {previous ? (
        <Button asChild variant="outline">
          <Link href={stepHref(propertyId, previous.key)}>
            <ArrowLeft aria-hidden /> Zurück: {previous.label}
          </Link>
        </Button>
      ) : (
        <span />
      )}
      {next ? (
        <Button asChild>
          <Link href={stepHref(propertyId, next.key)}>
            Weiter: {next.label} <ArrowRight aria-hidden />
          </Link>
        </Button>
      ) : null}
    </nav>
  );
}
