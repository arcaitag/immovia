"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Armchair, Ruler, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { AiUnavailableNotice, QuotaHint, type AvailabilityView } from "@/components/ai/ai-notice";
import { AiConsentDialog, useAiConsent } from "@/components/ai/consent-dialog";
import { JobProgress } from "@/components/ai/job-progress";
import { useJob } from "@/components/ai/use-job";
import { requestImageAiAction } from "@/app/dashboard/bilderstudio/actions";

type Capability = "perspective" | "virtual_staging";

/**
 * KI-Funktionen über einen externen Bild-KI-Anbieter. Ohne eingerichteten Anbieter sind sie
 * deaktiviert und erklärt. Ergebnisse werden immer als NEUES Bild gespeichert; virtuelle
 * Möblierung ist als «KI-Visualisierung» gekennzeichnet.
 */
export function ImageAiPanel({
  imageId,
  status,
  capabilities,
  availability,
  roomTypes,
  styles,
  editable,
}: {
  imageId: string;
  status: { configured: boolean; message: string };
  capabilities: Capability[];
  availability: AvailabilityView;
  roomTypes: Record<string, string>;
  styles: Record<string, string>;
  editable: boolean;
}) {
  const router = useRouter();
  const consent = useAiConsent(Boolean(availability.consentRequired));
  const [roomType, setRoomType] = React.useState(Object.keys(roomTypes)[0] ?? "");
  const [style, setStyle] = React.useState(Object.keys(styles)[0] ?? "");
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [starting, startTransition] = React.useTransition();

  const job = useJob(jobId, {
    onSuccess: (finished) => {
      const result = finished.result as { imageId?: string } | null;
      setJobId(null);
      toast.success("Das neue Bild wurde erstellt und separat gespeichert.");
      if (result?.imageId) router.push(`/dashboard/bilderstudio/${result.imageId}`);
      else router.refresh();
    },
    onError: (failed) => {
      setJobId(null);
      if (failed.consentRequired) toast.error("Bitte erteilen Sie die Einwilligung zur KI-Verarbeitung und starten Sie erneut.");
      else toast.error(failed.error ?? "Die Bild-KI konnte das Bild nicht bearbeiten.");
    },
  });

  function start(capability: Capability) {
    consent.guard(() => {
      startTransition(async () => {
        const res = await requestImageAiAction({
          imageId,
          capability,
          ...(capability === "virtual_staging" ? { roomType, style } : {}),
        });
        if (!res.ok) {
          if (res.consentRequired) consent.requestConsent(() => start(capability));
          else toast.error(res.error);
          return;
        }
        setJobId(res.data.jobId);
      });
    });
  }

  const usable = status.configured && editable && availability.available;
  const can = (capability: Capability) => usable && capabilities.includes(capability);

  return (
    <section aria-labelledby="image-ai-title" className="grid gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="grid gap-1">
        <h2 id="image-ai-title" className="flex items-center gap-2 font-display text-base font-bold">
          <Sparkles className="size-4 text-forest" aria-hidden /> KI-Funktionen
        </h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Ergebnisse werden als neues Bild gespeichert; das Original bleibt unverändert. Virtuell möblierte Bilder sind überall als
          «KI-Visualisierung» gekennzeichnet.
        </p>
      </div>
      {!status.configured ? (
        <p className="rounded-xl bg-muted px-3 py-2.5 text-sm text-foreground">{status.message}</p>
      ) : (
        <>
          <AiUnavailableNotice availability={availability} />
          {availability.available ? <QuotaHint quota={availability.quota} /> : null}
        </>
      )}

      <div className="grid gap-3 rounded-xl border border-border p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Ruler className="size-4 text-muted-foreground" aria-hidden /> Perspektive korrigieren
        </p>
        <p className="text-xs text-muted-foreground">Stürzende Linien begradigen, z. B. bei Fassaden- oder Raumaufnahmen.</p>
        <Button variant="outline" size="sm" onClick={() => start("perspective")} disabled={!can("perspective") || starting || job.running}>
          Perspektive korrigieren
        </Button>
      </div>

      <div className="grid gap-3 rounded-xl border border-border p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Armchair className="size-4 text-muted-foreground" aria-hidden /> Virtuelle Möblierung
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="grid gap-1.5">
            <Label htmlFor="staging-room">Raum</Label>
            <NativeSelect id="staging-room" value={roomType} onChange={(event) => setRoomType(event.target.value)} disabled={!can("virtual_staging")}>
              {Object.entries(roomTypes).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="staging-style">Stil</Label>
            <NativeSelect id="staging-style" value={style} onChange={(event) => setStyle(event.target.value)} disabled={!can("virtual_staging")}>
              {Object.entries(styles).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => start("virtual_staging")} disabled={!can("virtual_staging") || starting || job.running}>
          Virtuell möblieren
        </Button>
      </div>

      <JobProgress job={job.job} running={job.running} label="Die Bild-KI arbeitet …" />
      <AiConsentDialog {...consent.dialogProps} />
    </section>
  );
}
