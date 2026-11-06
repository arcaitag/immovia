"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Undo2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/sonner";
import { AiUnavailableNotice, QuotaHint, type AvailabilityView } from "@/components/ai/ai-notice";
import { ComparisonSlider } from "@/components/image-studio/comparison-slider";
import {
  acceptEnhancementAction,
  previewImageAction,
  restoreOriginalAction,
  suggestAdjustmentsAction,
} from "@/app/dashboard/bilderstudio/actions";

export interface EditorAdjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  exposure: number;
  warmth: number;
  sharpen: number;
  straighten: number;
  autoLevels: boolean;
  autoWhiteBalance: boolean;
}

const NEUTRAL: EditorAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  exposure: 0,
  warmth: 0,
  sharpen: 0,
  straighten: 0,
  autoLevels: false,
  autoWhiteBalance: false,
};

type NumericKey = "brightness" | "contrast" | "saturation" | "exposure" | "warmth" | "sharpen" | "straighten";

const percent = (value: number) => `${value > 0 ? "+" : ""}${Math.round(value * 100)} %`;

const CONTROLS: { key: NumericKey; label: string; min: number; max: number; step: number; format: (value: number) => string }[] = [
  { key: "brightness", label: "Helligkeit", min: -0.5, max: 0.5, step: 0.01, format: percent },
  { key: "exposure", label: "Belichtung", min: -0.5, max: 0.5, step: 0.01, format: percent },
  { key: "contrast", label: "Kontrast", min: -0.5, max: 0.5, step: 0.01, format: percent },
  { key: "saturation", label: "Sättigung", min: -0.5, max: 0.5, step: 0.01, format: percent },
  {
    key: "warmth",
    label: "Farbtemperatur",
    min: -1,
    max: 1,
    step: 0.02,
    format: (value) => (value === 0 ? "neutral" : `${value > 0 ? "wärmer" : "kühler"} ${Math.round(Math.abs(value) * 100)} %`),
  },
  { key: "sharpen", label: "Schärfe", min: 0, max: 1, step: 0.05, format: (value) => `${Math.round(value * 100)} %` },
  { key: "straighten", label: "Ausrichten", min: -15, max: 15, step: 0.5, format: (value) => `${value > 0 ? "+" : ""}${value.toFixed(1)}°` },
];

function isNeutral(adjustments: EditorAdjustments): boolean {
  return (Object.keys(NEUTRAL) as (keyof EditorAdjustments)[]).every((key) => adjustments[key] === NEUTRAL[key]);
}

/**
 * Bildbearbeitung mit klassischer Bildverarbeitung (keine KI): Regler, automatische Optimierung,
 * Vorschau auf dem Server, Übernehmen als neue Varianten, Original wiederherstellen.
 */
export function ImageEditor({
  imageId,
  alt,
  beforeUrl,
  currentUrl,
  isEnhanced,
  availability,
}: {
  imageId: string;
  alt: string;
  beforeUrl: string;
  currentUrl: string;
  isEnhanced: boolean;
  availability: AvailabilityView;
}) {
  const router = useRouter();
  const [adjustments, setAdjustments] = React.useState<EditorAdjustments>(NEUTRAL);
  const [preview, setPreview] = React.useState<{ key: string; dataUrl: string } | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<"suggest" | "accept" | "restore" | null>(null);
  const requestRef = React.useRef(0);

  const neutral = isNeutral(adjustments);
  const adjustmentsKey = JSON.stringify(adjustments);

  // Vorschau verzögert neu berechnen, sobald sich die Einstellungen ändern (ältere Antworten verwerfen)
  React.useEffect(() => {
    if (neutral) return;
    const requestId = ++requestRef.current;
    const timer = window.setTimeout(async () => {
      setPendingKey(adjustmentsKey);
      const res = await previewImageAction(imageId, JSON.parse(adjustmentsKey));
      if (requestId !== requestRef.current) return;
      setPendingKey(null);
      if (!res.ok) {
        setPreviewError(res.error);
        return;
      }
      setPreviewError(null);
      setPreview({ key: adjustmentsKey, dataUrl: res.data.dataUrl });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [adjustmentsKey, imageId, neutral]);

  const shownPreview = neutral ? null : preview;
  const afterUrl = shownPreview?.dataUrl ?? currentUrl;
  const previewOutdated = !neutral && preview?.key !== adjustmentsKey;

  function set<K extends keyof EditorAdjustments>(key: K, value: EditorAdjustments[K]) {
    setAdjustments((current) => ({ ...current, [key]: value }));
  }

  async function suggest() {
    setBusy("suggest");
    try {
      const res = await suggestAdjustmentsAction(imageId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setAdjustments({ ...NEUTRAL, ...res.data });
      toast.success("Vorschlag berechnet. Prüfen Sie das Ergebnis im Vergleich.");
    } finally {
      setBusy(null);
    }
  }

  async function accept() {
    setBusy("accept");
    try {
      const res = await acceptEnhancementAction(imageId, adjustments);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "Die Optimierung wurde übernommen.");
      setAdjustments(NEUTRAL);
      setPreview(null);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setBusy("restore");
    try {
      const res = await restoreOriginalAction(imageId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "Das Original wird wieder angezeigt.");
      setAdjustments(NEUTRAL);
      setPreview(null);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="grid content-start gap-3">
        <ComparisonSlider before={beforeUrl} after={afterUrl} alt={alt} />
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {pendingKey || previewOutdated
            ? "Vorschau wird berechnet …"
            : shownPreview
              ? "Links das Original, rechts die Vorschau mit Ihren Einstellungen (noch nicht gespeichert)."
              : isEnhanced
                ? "Links das Original, rechts die aktuell verwendete optimierte Version."
                : "Verschieben Sie die Regler oder nutzen Sie «Automatisch optimieren»."}
        </p>
        {previewError ? <Alert tone="error">{previewError}</Alert> : null}
      </div>

      <div className="grid content-start gap-5 rounded-2xl border border-border bg-card p-5">
        <div className="grid gap-1">
          <h2 className="font-display text-base font-bold">Automatische Optimierung (Bildverarbeitung)</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Klassische Bildkorrekturen auf unseren Servern – keine KI. Das Original bleibt immer erhalten.
          </p>
        </div>
        <Button variant="secondary" onClick={suggest} loading={busy === "suggest"} disabled={busy !== null || !availability.available}>
          <Wand2 aria-hidden /> Automatisch optimieren
        </Button>

        <div className="grid gap-4">
          {CONTROLS.map((control) => {
            const id = `adjust-${control.key}`;
            const value = adjustments[control.key];
            return (
              <div key={control.key} className="grid gap-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <Label htmlFor={id}>{control.label}</Label>
                  <span className="tabular text-xs text-muted-foreground">{control.format(value)}</span>
                </div>
                <input
                  id={id}
                  type="range"
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={value}
                  aria-valuetext={control.format(value)}
                  onChange={(event) => set(control.key, Number(event.target.value))}
                  onDoubleClick={() => set(control.key, 0)}
                  className="h-6 w-full cursor-pointer accent-brand"
                />
              </div>
            );
          })}
        </div>

        <div className="grid gap-3 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="adjust-auto-levels" className="text-sm">
              Automatische Tonwertkorrektur
            </Label>
            <Switch id="adjust-auto-levels" checked={adjustments.autoLevels} onCheckedChange={(checked) => set("autoLevels", checked)} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="adjust-auto-wb" className="text-sm">
              Automatischer Weissabgleich
            </Label>
            <Switch id="adjust-auto-wb" checked={adjustments.autoWhiteBalance} onCheckedChange={(checked) => set("autoWhiteBalance", checked)} />
          </div>
        </div>

        <div className="grid gap-2 border-t border-border pt-4">
          <Button onClick={accept} loading={busy === "accept"} disabled={neutral || busy !== null || !availability.available}>
            Übernehmen
          </Button>
          <Button variant="outline" onClick={() => setAdjustments(NEUTRAL)} disabled={neutral || busy !== null}>
            <Undo2 aria-hidden /> Verwerfen
          </Button>
          {isEnhanced ? (
            <Button variant="ghost" onClick={restore} loading={busy === "restore"} disabled={busy !== null}>
              <RotateCcw aria-hidden /> Original wiederherstellen
            </Button>
          ) : null}
          <AiUnavailableNotice availability={availability} />
          {availability.available ? <QuotaHint quota={availability.quota} /> : null}
        </div>
      </div>
    </div>
  );
}
