"use client";

import { CircleAlert, Loader2 } from "lucide-react";
import type { JobStatusDto } from "@/lib/ai/job-status";
import { cn } from "@/lib/utils";

/** Fortschrittsanzeige eines laufenden Hintergrundauftrags (barrierefrei als Live-Region). */
export function JobProgress({
  job,
  running,
  label,
  className,
}: {
  job: JobStatusDto | undefined;
  running: boolean;
  label: string;
  className?: string;
}) {
  if (!running && job?.status !== "failed") return null;
  const retrying = job?.status === "queued" && job.attempts > 0;
  return (
    <div role="status" aria-live="polite" className={cn("flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm", className)}>
      {job?.status === "failed" ? (
        <>
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <span className="text-destructive">{job.error ?? "Der Auftrag ist fehlgeschlagen."}</span>
        </>
      ) : (
        <>
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-brand" aria-hidden />
          <span className="grid gap-0.5">
            <span className="font-medium text-foreground">{label}</span>
            <span className="text-muted-foreground">
              {retrying
                ? "Ein vorübergehender Fehler ist aufgetreten – der Auftrag wird automatisch erneut versucht."
                : job?.stale
                  ? "Das dauert ungewöhnlich lange. Sie können die Seite verlassen; das Ergebnis wird gespeichert."
                  : job?.status === "running"
                    ? "Wird verarbeitet …"
                    : "Auftrag ist eingereiht …"}
            </span>
          </span>
        </>
      )}
    </div>
  );
}
