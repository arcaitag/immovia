"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ScanEye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/sonner";
import { ComparisonSlider } from "@/components/image-studio/comparison-slider";
import { confirmAiVisualizationAction, discardAiVisualizationAction } from "@/app/dashboard/bilderstudio/actions";

const CHECKS = [
  "Wände, Decke und Böden wie im Original",
  "Fenster, Türen und Aussicht unverändert",
  "Küche, Bad und Einbauten unverändert",
  "Keine Mängel verdeckt, z. B. Risse oder Flecken",
] as const;

/**
 * Prüfung eines Designvorschlags der Bild-KI. Erst mit «Freigeben» wird das Bild öffentlich
 * (gekennzeichnet als KI-Visualisierung); «Verwerfen» löscht es, das Original bleibt unverändert.
 */
export function AiReviewPanel({
  imageId,
  beforeUrl,
  afterUrl,
  alt,
}: {
  imageId: string;
  beforeUrl: string | null;
  afterUrl: string;
  alt: string;
}) {
  const router = useRouter();
  const [checked, setChecked] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function confirm() {
    startTransition(async () => {
      const res = await confirmAiVisualizationAction(imageId, checked);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "Der Vorschlag ist freigegeben.");
      router.refresh();
    });
  }

  function discard() {
    startTransition(async () => {
      const res = await discardAiVisualizationAction(imageId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "Der Vorschlag wurde verworfen.");
      router.replace(res.data.sourceImageId ? `/dashboard/bilderstudio/${res.data.sourceImageId}` : "/dashboard/bilderstudio");
    });
  }

  return (
    <section aria-labelledby="ai-review-title" className="grid gap-5 rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="grid gap-1.5">
        <h2 id="ai-review-title" className="flex items-center gap-2 font-display text-lg font-bold">
          <ScanEye className="size-5 text-forest" aria-hidden /> Vorschlag prüfen
        </h2>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          Der Vorschlag ist noch nicht öffentlich. Vergleichen Sie ihn mit dem Original: Die KI kann Details verändern, etwa ein Fenster hinzufügen
          oder den Raum grösser wirken lassen. Verschieben Sie dazu den Regler.
        </p>
      </div>

      {/* Ab xl Bild links, Prüfpunkte und Entscheidung rechts – so bleiben beide gleichzeitig sichtbar */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem] xl:items-start">
        {beforeUrl ? (
          <ComparisonSlider before={beforeUrl} after={afterUrl} alt={alt} className="overflow-hidden rounded-xl" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={afterUrl} alt={alt} className="block h-auto w-full rounded-xl" />
        )}

        <div className="grid gap-4">
          <ul className="grid gap-1.5 text-sm sm:grid-cols-2 xl:grid-cols-1" aria-label="Darauf achten">
            {CHECKS.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden /> {item}
              </li>
            ))}
          </ul>
          <label htmlFor="ai-review-confirm" className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface p-3 text-sm">
            <Checkbox id="ai-review-confirm" checked={checked} onCheckedChange={(value) => setChecked(value === true)} className="mt-0.5" />
            <span>Ich habe den Vorschlag geprüft: Raum und feste Ausstattung entsprechen dem Originalfoto.</span>
          </label>
          <div className="flex flex-wrap gap-2 xl:grid xl:grid-cols-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={pending}>
                  Verwerfen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Vorschlag verwerfen?</AlertDialogTitle>
                  <AlertDialogDescription>Das erzeugte Bild wird gelöscht. Ihr Originalfoto bleibt unverändert.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction destructive onClick={discard}>
                    Verwerfen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button onClick={confirm} disabled={!checked || pending} loading={pending}>
              Freigeben
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Freigegeben erscheint der Vorschlag im Inserat und im Verkaufsdossier mit dem Hinweis «KI-Visualisierung». Ihr Originalfoto bleibt
            unverändert.
          </p>
        </div>
      </div>
    </section>
  );
}
