"use client";

import * as React from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/components/ui/sonner";
import { cropImageAction } from "@/lib/properties/image-actions";
import { imageVariantUrl, propertyImageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import type { ManagedImage } from "@/components/property-images/types";

const ASPECTS: { key: string; label: string; value: number | "original" }[] = [
  { key: "original", label: "Original", value: "original" },
  { key: "16-10", label: "16:10", value: 16 / 10 },
  { key: "4-3", label: "4:3", value: 4 / 3 },
  { key: "3-2", label: "3:2", value: 3 / 2 },
  { key: "1-1", label: "1:1", value: 1 },
];

/**
 * Zuschneiden mit react-easy-crop. Gesendet werden Prozentwerte; der Server schneidet
 * das Originalbild zu und erzeugt neue Varianten (die Basisversion bleibt erhalten).
 */
export function CropDialog({
  image,
  open,
  onOpenChange,
}: {
  image: ManagedImage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [crop, setCrop] = React.useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [aspectKey, setAspectKey] = React.useState("original");
  const [naturalAspect, setNaturalAspect] = React.useState<number | null>(null);
  const [area, setArea] = React.useState<Area | null>(null);
  const [pending, startTransition] = React.useTransition();

  const src = imageVariantUrl(image.base_path, "lg") ?? propertyImageUrl(image, "lg");
  const selected = ASPECTS.find((a) => a.key === aspectKey) ?? ASPECTS[0];
  const aspect = selected?.value === "original" || !selected ? (naturalAspect ?? 4 / 3) : selected.value;

  function save() {
    if (!area) return;
    startTransition(async () => {
      const result = await cropImageAction({
        imageId: image.id,
        area: { x: area.x, y: area.y, width: area.width, height: area.height },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Zuschnitt gespeichert.");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? null : onOpenChange(next))}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bild zuschneiden</DialogTitle>
          <DialogDescription>
            Der Zuschnitt geht immer vom Originalbild aus und kann jederzeit zurückgesetzt werden. Eine frühere Optimierung muss
            danach erneut angewendet werden.
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-[50dvh] min-h-64 overflow-hidden rounded-xl bg-forest">
          {src ? (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              minZoom={1}
              maxZoom={4}
              objectFit="contain"
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(croppedArea) => setArea(croppedArea)}
              onMediaLoaded={(media) => setNaturalAspect(media.naturalWidth / media.naturalHeight)}
            />
          ) : (
            <p className="p-6 text-sm text-white">Für dieses Bild ist keine Vorlage vorhanden.</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-center">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Seitenverhältnis">
            {ASPECTS.map((option) => (
              <button
                key={option.key}
                type="button"
                role="radio"
                aria-checked={aspectKey === option.key}
                onClick={() => setAspectKey(option.key)}
                className={cn(
                  "min-h-11 rounded-xl border px-3.5 text-sm font-semibold transition-colors",
                  aspectKey === option.key ? "border-brand bg-mint-100 text-forest" : "border-border bg-card hover:bg-mint-50",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-3 text-sm font-medium">
            <ZoomIn className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="sr-only">Zoom</span>
            <Slider value={[zoom]} min={1} max={4} step={0.01} onValueChange={(value) => setZoom(value[0] ?? 1)} aria-label="Zoom" />
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Abbrechen
          </Button>
          <Button type="button" onClick={save} loading={pending} disabled={!area || !src}>
            Zuschnitt speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
