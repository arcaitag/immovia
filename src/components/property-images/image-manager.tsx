"use client";

import * as React from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Camera, CircleAlert, CircleCheck, ImagePlus, Images, Loader2, RotateCcw, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CaptionDialog } from "@/components/property-images/caption-dialog";
import { CropDialog } from "@/components/property-images/crop-dialog";
import { SortableImageCard, type ImageCardActions } from "@/components/property-images/image-card";
import { detectImageType, isSupportedImage, prepareUpload } from "@/components/property-images/prepare-upload";
import { runWithConcurrency, uploadWithProgress } from "@/components/property-images/upload-with-progress";
import type { ManagedImage } from "@/components/property-images/types";
import {
  createImageUploadTargetsAction,
  deleteImageAction,
  processUploadedImageAction,
  reorderImagesAction,
  resetImageCropAction,
  setCoverImageAction,
  updateImageDetailsAction,
} from "@/lib/properties/image-actions";
import { formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";

type QueueStatus = "preparing" | "waiting" | "uploading" | "processing" | "done" | "error";

interface QueueItem {
  key: string;
  file: File;
  name: string;
  previewUrl: string | null;
  status: QueueStatus;
  progress: number;
  error?: string;
  imageId?: string;
}

type OptimisticAction =
  | { type: "reorder"; ids: string[] }
  | { type: "patch"; id: string; patch: Partial<ManagedImage> }
  | { type: "cover"; id: string }
  | { type: "remove"; id: string };

function reducer(state: ManagedImage[], action: OptimisticAction): ManagedImage[] {
  switch (action.type) {
    case "reorder": {
      const byId = new Map(state.map((image) => [image.id, image]));
      return action.ids
        .map((id) => byId.get(id))
        .filter((image): image is ManagedImage => Boolean(image))
        .map((image, index) => ({ ...image, sort_order: index }));
    }
    case "patch":
      return state.map((image) => (image.id === action.id ? { ...image, ...action.patch } : image));
    case "cover":
      return state.map((image) => ({ ...image, is_cover: image.id === action.id }));
    case "remove":
      return state.filter((image) => image.id !== action.id);
  }
}

const STATUS_TEXT: Record<QueueStatus, string> = {
  preparing: "Wird vorbereitet …",
  waiting: "Wartet …",
  uploading: "Wird hochgeladen",
  processing: "Wird verarbeitet …",
  done: "Fertig",
  error: "Fehler",
};

const announcements: Announcements = {
  onDragStart: () => "Bild aufgenommen. Mit den Pfeiltasten verschieben, mit Leertaste ablegen.",
  onDragOver: ({ over }) => (over ? "Bild wird über eine neue Position bewegt." : undefined),
  onDragEnd: ({ over }) => (over ? "Bild abgelegt. Die Reihenfolge wird gespeichert." : "Bild abgelegt."),
  onDragCancel: () => "Verschieben abgebrochen.",
};

/**
 * Schritt 3: Bilder hochladen (Mehrfachauswahl, Drag-and-drop, Kamera), sortieren,
 * Titelbild, Bildunterschrift, Grundriss, Zuschneiden und Löschen.
 */
export function ImageManager({
  propertyId,
  images,
  maxImages,
  minImages,
  maxBytes,
}: {
  propertyId: string;
  images: ManagedImage[];
  maxImages: number;
  minImages: number;
  maxBytes: number;
}) {
  const [optimisticImages, applyOptimistic] = React.useOptimistic(images, reducer);
  const [queue, setQueue] = React.useState<QueueItem[]>([]);
  const [dragOver, setDragOver] = React.useState(false);
  const [captionFor, setCaptionFor] = React.useState<ManagedImage | null>(null);
  const [cropFor, setCropFor] = React.useState<ManagedImage | null>(null);
  const [deleteFor, setDeleteFor] = React.useState<ManagedImage | null>(null);
  const [captionPending, startCaption] = React.useTransition();
  const [, startTransition] = React.useTransition();
  const fileInput = React.useRef<HTMLInputElement | null>(null);
  const cameraInput = React.useRef<HTMLInputElement | null>(null);
  const previewUrls = React.useRef(new Set<string>());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  React.useEffect(() => {
    const urls = previewUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  const knownIds = new Set(images.map((image) => image.id));
  // Fertige Uploads verschwinden aus der Liste, sobald das Bild im Raster erscheint
  const visibleQueue = queue.filter((item) => !(item.status === "done" && item.imageId && knownIds.has(item.imageId)));
  const activeUploads = queue.filter((item) => item.status !== "done" && item.status !== "error").length;
  const remaining = Math.max(0, maxImages - images.length - activeUploads);
  const busy = activeUploads > 0;

  function updateItem(key: string, patch: Partial<QueueItem>) {
    setQueue((items) => items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function releasePreview(item: QueueItem) {
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
      previewUrls.current.delete(item.previewUrl);
    }
  }

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    const unsupported = files.filter((file) => !isSupportedImage(file));
    if (unsupported.length) {
      toast.error(`${unsupported.length === 1 ? "Eine Datei wird" : `${unsupported.length} Dateien werden`} nicht unterstützt (nur JPG, PNG, WebP, HEIC).`);
    }
    const supported = files.filter(isSupportedImage);
    if (supported.length === 0) return;
    if (remaining === 0) {
      toast.error(`Sie haben die maximale Anzahl von ${maxImages} Bildern erreicht.`);
      return;
    }
    const accepted = supported.slice(0, remaining);
    if (supported.length > remaining) {
      toast.warning(`Es werden nur ${remaining} weitere Bilder hochgeladen (maximal ${maxImages}).`);
    }

    const items: QueueItem[] = accepted.map((file) => {
      const type = detectImageType(file);
      const previewUrl = type === "image/heic" || type === "image/heif" ? null : URL.createObjectURL(file);
      if (previewUrl) previewUrls.current.add(previewUrl);
      return { key: crypto.randomUUID(), file, name: file.name, previewUrl, status: "preparing", progress: 0 };
    });
    // Abgeschlossene Einträge früherer Uploads entfernen
    setQueue((current) => [...current.filter((item) => item.status !== "done"), ...items]);

    const prepared: { item: QueueItem; blob: Blob; contentType: "image/jpeg" | "image/png" | "image/webp" }[] = [];
    for (const item of items) {
      try {
        const upload = await prepareUpload(item.file, { maxBytes });
        prepared.push({ item, blob: upload.blob, contentType: upload.contentType });
        updateItem(item.key, { status: "waiting" });
      } catch (error) {
        updateItem(item.key, { status: "error", error: error instanceof Error ? error.message : "Die Datei konnte nicht gelesen werden." });
      }
    }
    if (prepared.length === 0) return;

    const targets = await createImageUploadTargetsAction({
      propertyId,
      files: prepared.map((p) => ({ contentType: p.contentType, size: p.blob.size })),
    });
    if (!targets.ok) {
      for (const p of prepared) updateItem(p.item.key, { status: "error", error: targets.error });
      toast.error(targets.error);
      return;
    }

    let failed = 0;
    await runWithConcurrency(
      prepared.map((p, index) => async () => {
        const target = targets.data[index];
        if (!target) return;
        updateItem(p.item.key, { status: "uploading", progress: 0, imageId: target.imageId });
        try {
          await uploadWithProgress(target.signedUrl, p.blob, target.contentType, (fraction) =>
            updateItem(p.item.key, { progress: fraction }),
          );
          updateItem(p.item.key, { status: "processing", progress: 1 });
          const result = await processUploadedImageAction({ propertyId, imageId: target.imageId, ext: target.ext });
          if (!result.ok) throw new Error(result.error);
          releasePreview(p.item);
          updateItem(p.item.key, { status: "done", previewUrl: null });
        } catch (error) {
          failed += 1;
          updateItem(p.item.key, { status: "error", error: error instanceof Error ? error.message : "Upload fehlgeschlagen." });
        }
      }),
      3,
    );
    const succeeded = prepared.length - failed;
    if (succeeded > 0) toast.success(succeeded === 1 ? "Bild hochgeladen." : `${succeeded} Bilder hochgeladen.`);
  }

  function retry(item: QueueItem) {
    releasePreview(item);
    setQueue((items) => items.filter((entry) => entry.key !== item.key));
    void handleFiles([item.file]);
  }

  function dismiss(item: QueueItem) {
    releasePreview(item);
    setQueue((items) => items.filter((entry) => entry.key !== item.key));
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = optimisticImages.map((image) => image.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = arrayMove(ids, from, to);
    startTransition(async () => {
      applyOptimistic({ type: "reorder", ids: next });
      const result = await reorderImagesAction({ propertyId, orderedIds: next });
      if (!result.ok) toast.error(result.error);
    });
  }

  const actions: ImageCardActions = {
    onCover: (image) =>
      startTransition(async () => {
        applyOptimistic({ type: "cover", id: image.id });
        const result = await setCoverImageAction(image.id);
        if (result.ok) toast.success(result.message ?? "Titelbild festgelegt.");
        else toast.error(result.error);
      }),
    onCaption: (image) => setCaptionFor(image),
    onCrop: (image) => setCropFor(image),
    onResetCrop: (image) =>
      startTransition(async () => {
        const result = await resetImageCropAction(image.id);
        if (result.ok) toast.success(result.message ?? "Zuschnitt zurückgesetzt.");
        else toast.error(result.error);
      }),
    onToggleFloorPlan: (image) =>
      startTransition(async () => {
        applyOptimistic({ type: "patch", id: image.id, patch: { is_floor_plan: !image.is_floor_plan } });
        const result = await updateImageDetailsAction(image.id, { is_floor_plan: !image.is_floor_plan });
        if (!result.ok) toast.error(result.error);
      }),
    onDelete: (image) => setDeleteFor(image),
  };

  function saveCaption(caption: string) {
    const image = captionFor;
    if (!image) return;
    startCaption(async () => {
      applyOptimistic({ type: "patch", id: image.id, patch: { caption: caption.trim() || null } });
      const result = await updateImageDetailsAction(image.id, { caption });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCaptionFor(null);
    });
  }

  function confirmDelete() {
    const image = deleteFor;
    setDeleteFor(null);
    if (!image) return;
    startTransition(async () => {
      applyOptimistic({ type: "remove", id: image.id });
      const result = await deleteImageAction(image.id);
      if (result.ok) toast.success(result.message ?? "Bild gelöscht.");
      else toast.error(result.error);
    });
  }

  const readyCount = images.filter((image) => image.status === "ready").length;

  return (
    <div className="grid gap-6">
      <section
        aria-label="Bilder hochladen"
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          void handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-5 py-8 text-center transition-colors sm:py-10",
          dragOver ? "border-brand bg-mint-100" : "border-mint-300 bg-mint-50/60",
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-forest shadow-sm">
          <ImagePlus className="size-6" aria-hidden />
        </span>
        <div className="grid gap-1">
          <p className="font-display text-lg font-bold">Fotos hierher ziehen</p>
          <p className="text-sm text-muted-foreground">
            oder auswählen – mehrere gleichzeitig. JPG, PNG, WebP oder HEIC bis {formatFileSize(maxBytes)}. Grosse Fotos werden
            automatisch verkleinert.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button type="button" onClick={() => fileInput.current?.click()} disabled={remaining === 0}>
            <Upload aria-hidden /> Bilder auswählen
          </Button>
          <Button type="button" variant="outline" onClick={() => cameraInput.current?.click()} disabled={remaining === 0}>
            <Camera aria-hidden /> Foto aufnehmen
          </Button>
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {images.length} von maximal {maxImages} Bildern
          {remaining === 0 ? " – Maximum erreicht" : ""}
        </p>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            const files = event.target.files;
            if (files) void handleFiles(files);
            event.target.value = "";
          }}
        />
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            const files = event.target.files;
            if (files) void handleFiles(files);
            event.target.value = "";
          }}
        />
      </section>

      {visibleQueue.length > 0 ? (
        <section aria-label="Uploads" className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-display font-bold">Uploads</h3>
            {busy ? (
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Läuft …
              </span>
            ) : null}
          </div>
          <ul className="grid gap-2">
            {visibleQueue.map((item) => (
              <li key={item.key} className="flex items-center gap-3 rounded-xl border border-border p-2.5">
                <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {item.previewUrl ? (
                    // Lokale Vorschau (Object-URL) – next/image ist dafür nicht geeignet
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.previewUrl} alt="" className="size-full object-cover" />
                  ) : item.status === "done" ? (
                    <CircleCheck className="m-3 size-6 text-primary" aria-hidden />
                  ) : (
                    <Images className="m-3 size-6 text-muted-foreground" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  {item.status === "error" ? (
                    <p className="flex items-start gap-1 text-xs text-destructive" role="alert">
                      <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden /> {item.error}
                    </p>
                  ) : (
                    <div className="mt-1 grid gap-1">
                      <p className="text-xs text-muted-foreground">
                        {STATUS_TEXT[item.status]}
                        {item.status === "uploading" ? ` · ${Math.round(item.progress * 100)} %` : ""}
                      </p>
                      {item.status === "uploading" || item.status === "processing" ? (
                        <Progress value={item.progress * 100} className="h-1.5" aria-label={`Upload ${item.name}`} />
                      ) : null}
                    </div>
                  )}
                </div>
                {item.status === "error" ? (
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`${item.name} erneut hochladen`} onClick={() => retry(item)}>
                      <RotateCcw className="size-4" aria-hidden />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`${item.name} entfernen`} onClick={() => dismiss(item)}>
                      <X className="size-4" aria-hidden />
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {optimisticImages.length === 0 && visibleQueue.length === 0 ? (
        <EmptyState
          icon={Images}
          title="Noch keine Bilder"
          description={`Für die Veröffentlichung ${minImages === 1 ? "braucht es mindestens ein Bild" : `braucht es mindestens ${minImages} Bilder`}. Ideal sind 8 bis 20 helle Fotos: Aussenansicht, Wohnräume, Küche, Bad, Aussicht und Grundriss.`}
        />
      ) : null}

      {optimisticImages.length > 0 ? (
        <section aria-label="Ihre Bilder" className="grid gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-lg font-bold">Ihre Bilder</h3>
            <p className="text-sm text-muted-foreground">
              Ziehen Sie am Griff, um die Reihenfolge zu ändern. Das Titelbild erscheint in der Suche.
            </p>
          </div>
          <DndContext
            id="bilder-reihenfolge"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
            accessibility={{
              announcements,
              screenReaderInstructions: {
                draggable:
                  "Drücken Sie die Leertaste, um das Bild aufzunehmen. Verschieben Sie es mit den Pfeiltasten und legen Sie es mit der Leertaste ab. Escape bricht ab.",
              },
            }}
          >
            <SortableContext items={optimisticImages.map((image) => image.id)} strategy={rectSortingStrategy}>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {optimisticImages.map((image, index) => (
                  <SortableImageCard
                    key={image.id}
                    image={image}
                    position={index + 1}
                    total={optimisticImages.length}
                    actions={actions}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          {readyCount < minImages ? (
            <p className="text-sm text-warning">
              Für die Veröffentlichung fehlen noch {minImages - readyCount} {minImages - readyCount === 1 ? "Bild" : "Bilder"}.
            </p>
          ) : null}
        </section>
      ) : null}

      {captionFor ? (
        <CaptionDialog
          key={captionFor.id}
          initial={captionFor.caption ?? ""}
          open
          pending={captionPending}
          onOpenChange={(open) => (open ? null : setCaptionFor(null))}
          onSave={saveCaption}
        />
      ) : null}
      {cropFor ? <CropDialog key={cropFor.id} image={cropFor} open onOpenChange={(open) => (open ? null : setCropFor(null))} /> : null}

      <AlertDialog open={deleteFor !== null} onOpenChange={(open) => (open ? null : setDeleteFor(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bild löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Das Bild wird mit allen Versionen (Original, Zuschnitte, Optimierungen) endgültig gelöscht.
              {deleteFor?.is_cover ? " Das nächste Bild wird automatisch zum Titelbild." : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction destructive onClick={confirmDelete}>
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
