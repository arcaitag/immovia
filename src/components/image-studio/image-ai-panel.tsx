"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Armchair, BrushCleaning, Ruler, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { AiUnavailableNotice, QuotaHint, type AvailabilityView } from "@/components/ai/ai-notice";
import { AiConsentDialog, useAiConsent } from "@/components/ai/consent-dialog";
import { JobProgress } from "@/components/ai/job-progress";
import { useJob } from "@/components/ai/use-job";
import { requestImageAiAction } from "@/app/dashboard/bilderstudio/actions";
import { DESIGN_CAPABILITIES, IMAGE_AI_CAPABILITIES, type ImageAiCapability, type ImageConsentInfo } from "@/lib/images/ai-providers/types";

/**
 * Designvorschläge über einen externen Bild-KI-Anbieter («Aufräumen», «Neu einrichten»).
 * Ohne eingerichteten Anbieter sind sie deaktiviert und erklärt. Ergebnisse werden immer als
 * NEUES Bild gespeichert, als «KI-Visualisierung» gekennzeichnet und erst nach der Prüfung durch
 * den Inserenten veröffentlicht.
 */
export function ImageAiPanel({
  imageId,
  status,
  capabilities,
  availability,
  roomTypes,
  styles,
  editable,
  consentInfo,
}: {
  imageId: string;
  status: { configured: boolean; message: string };
  capabilities: ImageAiCapability[];
  availability: AvailabilityView;
  roomTypes: Record<string, string>;
  styles: Record<string, string>;
  editable: boolean;
  consentInfo: ImageConsentInfo;
}) {
  const router = useRouter();
  const consent = useAiConsent(Boolean(availability.consentRequired));
  const [roomType, setRoomType] = React.useState(Object.keys(roomTypes)[0] ?? "");
  const [style, setStyle] = React.useState(Object.keys(styles)[0] ?? "");
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [starting, startTransition] = React.useTransition();
  const lastStart = React.useRef<(() => void) | null>(null);

  const job = useJob(jobId, {
    onSuccess: (finished) => {
      const result = finished.result as { imageId?: string } | null;
      setJobId(null);
      toast.success("Der Vorschlag ist fertig. Prüfen Sie ihn, bevor er im Inserat erscheint.");
      if (result?.imageId) router.push(`/dashboard/bilderstudio/${result.imageId}`);
      else router.refresh();
    },
    onError: (failed) => {
      setJobId(null);
      if (failed.consentRequired && lastStart.current) consent.requestConsent(lastStart.current);
      else toast.error(failed.error ?? "Die Bild-KI konnte das Bild nicht bearbeiten.");
    },
  });

  function start(capability: ImageAiCapability) {
    const run = () => start(capability);
    lastStart.current = run;
    consent.guard(() => {
      startTransition(async () => {
        const res = await requestImageAiAction({
          imageId,
          capability,
          ...(capability === "virtual_staging" ? { roomType, style } : {}),
        });
        if (!res.ok) {
          if (res.consentRequired) consent.requestConsent(run);
          else toast.error(res.error);
          return;
        }
        setJobId(res.data.jobId);
      });
    });
  }

  const usable = status.configured && editable && availability.available;
  const can = (capability: ImageAiCapability) => usable && capabilities.includes(capability);
  const busy = starting || job.running;
  // Ohne Anbieter die Designvorschläge deaktiviert zeigen (erklärt), sonst was der Anbieter kann
  const shown: ImageAiCapability[] = status.configured ? capabilities : [...DESIGN_CAPABILITIES];

  return (
    <section aria-labelledby="image-ai-title" className="grid content-start gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="grid gap-1">
        <h2 id="image-ai-title" className="flex items-center gap-2 font-display text-base font-bold">
          <Sparkles className="size-4 text-forest" aria-hidden /> Designvorschlag mit KI
        </h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Die Bild-KI erstellt aus diesem Foto einen Vorschlag desselben Raums. Wände, Fenster, Böden, Aussicht und allfällige Mängel bleiben
          unverändert. Der Vorschlag wird als neues Bild gespeichert und erst veröffentlicht, wenn Sie ihn geprüft haben – gekennzeichnet als
          «KI-Visualisierung».
        </p>
      </div>
      {!status.configured ? (
        <p className="rounded-xl bg-muted px-3 py-2.5 text-sm text-foreground">{status.message}</p>
      ) : !editable ? null : (
        <>
          <AiUnavailableNotice availability={availability} />
          {availability.available ? <QuotaHint quota={availability.quota} /> : null}
        </>
      )}

      {shown.includes("declutter") ? (
        <div className="grid gap-3 rounded-xl border border-border p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <BrushCleaning className="size-4 text-muted-foreground" aria-hidden /> {IMAGE_AI_CAPABILITIES.declutter.label}
          </p>
          <p className="text-xs text-muted-foreground">{IMAGE_AI_CAPABILITIES.declutter.description}</p>
          <Button variant="outline" size="sm" onClick={() => start("declutter")} disabled={!can("declutter") || busy}>
            Aufräumen
          </Button>
        </div>
      ) : null}

      {shown.includes("virtual_staging") ? (
        <div className="grid gap-3 rounded-xl border border-border p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Armchair className="size-4 text-muted-foreground" aria-hidden /> {IMAGE_AI_CAPABILITIES.virtual_staging.label}
          </p>
          <p className="text-xs text-muted-foreground">{IMAGE_AI_CAPABILITIES.virtual_staging.description}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
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
          <Button variant="outline" size="sm" onClick={() => start("virtual_staging")} disabled={!can("virtual_staging") || busy}>
            Neu einrichten
          </Button>
        </div>
      ) : null}

      {shown.includes("perspective") ? (
        <div className="grid gap-3 rounded-xl border border-border p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Ruler className="size-4 text-muted-foreground" aria-hidden /> {IMAGE_AI_CAPABILITIES.perspective.label}
          </p>
          <p className="text-xs text-muted-foreground">{IMAGE_AI_CAPABILITIES.perspective.description}</p>
          <Button variant="outline" size="sm" onClick={() => start("perspective")} disabled={!can("perspective") || busy}>
            Perspektive korrigieren
          </Button>
        </div>
      ) : null}

      <JobProgress job={job.job} running={job.running} label="Die Bild-KI erstellt den Vorschlag. Das dauert in der Regel unter einer Minute." />
      <AiConsentDialog {...consent.dialogProps} kind="image" imageInfo={consentInfo} />
    </section>
  );
}
