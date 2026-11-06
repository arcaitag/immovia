"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleDashed, Gauge, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { AiUnavailableNotice, QuotaHint, type AvailabilityView } from "@/components/ai/ai-notice";
import { AiConsentDialog, useAiConsent } from "@/components/ai/consent-dialog";
import { JobProgress } from "@/components/ai/job-progress";
import { useJob } from "@/components/ai/use-job";
import { startValuationAction } from "@/app/dashboard/immobilien/[id]/bewertung/actions";
import type { PrerequisiteItem } from "@/lib/valuation/prerequisites";
import { cn } from "@/lib/utils";

/** Voraussetzungen prüfen und Bewertung starten (Hintergrundauftrag mit Statusabfrage). */
export function ValuationStarter({
  propertyId,
  items,
  ready,
  availability,
  hasValuation,
  editHref,
  explanation,
}: {
  propertyId: string;
  items: PrerequisiteItem[];
  ready: boolean;
  availability: AvailabilityView;
  hasValuation: boolean;
  editHref: string;
  /** Zusätzliche KI-Erklärung: möglich, nur mit Einwilligung oder nicht verfügbar (KI nicht konfiguriert) */
  explanation: "available" | "needs_consent" | "unavailable";
}) {
  const router = useRouter();
  const consent = useAiConsent(explanation === "needs_consent");
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const { job, running } = useJob(jobId, {
    onSuccess: (finished) => {
      const result = finished.result as { valuationId?: string; status?: string } | null;
      toast.success(result?.status === "insufficient_data" ? "Bewertung abgeschlossen – zu wenige Vergleichsdaten." : "Die Bewertung ist fertig.");
      setJobId(null);
      if (result?.valuationId) router.replace(`/dashboard/immobilien/${propertyId}/bewertung?bewertung=${result.valuationId}`, { scroll: false });
      router.refresh();
    },
    onError: (failed) => toast.error(failed.error ?? "Die Bewertung ist fehlgeschlagen."),
  });

  function start() {
    startTransition(async () => {
      const res = await startValuationAction(propertyId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setJobId(res.data.jobId);
    });
  }

  const blocked = !ready || !availability.available;
  return (
    <div className="grid gap-4 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-mint-100 text-forest">
            <Gauge className="size-5" aria-hidden />
          </span>
          <div>
            <h3 className="font-display text-lg font-bold">{hasValuation ? "Neue Bewertung durchführen" : "Bewertung starten"}</h3>
            <p className="text-sm text-muted-foreground">
              Die Schätzung vergleicht Ihr Objekt mit Angebotspreisen veröffentlichter Inserate auf Immovia. Ohne ausreichende Vergleichsdaten wird keine
              Zahl angezeigt.
            </p>
          </div>
        </div>
        <Button onClick={start} loading={pending || running} disabled={blocked} className="shrink-0">
          {hasValuation ? "Neue Bewertung" : "Bewertung starten"}
        </Button>
      </div>

      <ul className="grid gap-2 sm:grid-cols-3" aria-label="Voraussetzungen">
        {items.map((item) => {
          const Icon = item.ok ? CircleCheck : item.blocking ? CircleDashed : TriangleAlert;
          return (
            <li key={item.key} className={cn("flex gap-2.5 rounded-xl border border-border p-3 text-sm", item.ok ? "bg-mint-50" : "bg-surface")}>
              <Icon className={cn("mt-0.5 size-4 shrink-0", item.ok ? "text-brand" : item.blocking ? "text-muted-foreground" : "text-warning")} aria-hidden />
              <span>
                <span className="block font-semibold">{item.label}</span>
                <span className="text-muted-foreground">{item.hint}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {!ready ? (
        <p className="text-sm">
          <Link href={editHref} className="font-semibold text-primary hover:underline">
            Fehlende Angaben ergänzen
          </Link>
        </p>
      ) : null}
      {explanation === "needs_consent" && consent.required ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <Sparkles className="size-4 text-forest" aria-hidden />
          Die Berechnung braucht keine KI. Auf Wunsch formuliert eine KI zusätzlich eine Erklärung in Worten – nur mit Ihrer Einwilligung.
          <Button variant="link" size="sm" className="h-auto" onClick={() => consent.guard(() => router.refresh())}>
            KI-Erklärung aktivieren
          </Button>
        </p>
      ) : explanation !== "unavailable" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="size-4 text-forest" aria-hidden />
          Zusätzlich formuliert eine KI eine Erklärung in Worten – ausschliesslich aus den berechneten Daten.
        </p>
      ) : null}
      <AiUnavailableNotice availability={availability} />
      {availability.available ? <QuotaHint quota={availability.quota} /> : null}
      <JobProgress job={job} running={running} label="Bewertung wird berechnet" />
      <AiConsentDialog {...consent.dialogProps} />
    </div>
  );
}
