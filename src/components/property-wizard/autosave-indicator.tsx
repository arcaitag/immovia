"use client";

import { CircleAlert, CircleCheck, CloudUpload, Loader2, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AutosaveState } from "@/components/property-wizard/use-property-autosave";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Zustand des automatischen Zwischenspeicherns («Speichert … / Gespeichert / Fehler»). */
export function AutosaveIndicator({
  state,
  onRetry,
  className,
}: {
  state: AutosaveState;
  onRetry: () => void;
  className?: string;
}) {
  const base = "inline-flex min-h-8 items-center gap-1.5 text-sm";
  return (
    <div role="status" aria-live="polite" className={cn("flex flex-wrap items-center gap-2", className)}>
      {state.status === "saving" ? (
        <span className={cn(base, "text-muted-foreground")}>
          <Loader2 className="size-4 animate-spin" aria-hidden /> Speichert …
        </span>
      ) : state.status === "pending" ? (
        <span className={cn(base, "text-muted-foreground")}>
          <PencilLine className="size-4" aria-hidden /> Änderungen werden gleich gespeichert
        </span>
      ) : state.status === "saved" ? (
        <span className={cn(base, "text-primary")}>
          <CircleCheck className="size-4" aria-hidden /> Gespeichert{state.savedAt ? ` um ${formatTime(state.savedAt)}` : ""}
        </span>
      ) : state.status === "invalid" ? (
        <span className={cn(base, "text-warning")}>
          <CircleAlert className="size-4" aria-hidden /> {state.message ?? "Bitte prüfen Sie die markierten Felder."}
        </span>
      ) : state.status === "error" ? (
        <>
          <span className={cn(base, "text-destructive")}>
            <CircleAlert className="size-4" aria-hidden /> {state.message ?? "Speichern fehlgeschlagen."}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Erneut versuchen
          </Button>
        </>
      ) : (
        <span className={cn(base, "text-muted-foreground")}>
          <CloudUpload className="size-4" aria-hidden /> Änderungen werden automatisch gespeichert
        </span>
      )}
    </div>
  );
}
