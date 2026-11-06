"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Crop,
  Ellipsis,
  GripVertical,
  LayoutGrid,
  Loader2,
  Pencil,
  RotateCcw,
  Sparkles,
  Star,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { propertyImageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { isCropped, type ManagedImage } from "@/components/property-images/types";

export interface ImageCardActions {
  onCover: (image: ManagedImage) => void;
  onCaption: (image: ManagedImage) => void;
  onCrop: (image: ManagedImage) => void;
  onResetCrop: (image: ManagedImage) => void;
  onToggleFloorPlan: (image: ManagedImage) => void;
  onDelete: (image: ManagedImage) => void;
}

function IconAction({
  label,
  onClick,
  children,
  pressed,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  pressed?: boolean;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-11", pressed && "text-brand")}
          aria-label={label}
          aria-pressed={pressed}
          onClick={onClick}
          disabled={disabled}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Ein sortierbares Bild im Raster (Ziehen am Griff oder per Tastatur). */
export function SortableImageCard({
  image,
  position,
  total,
  actions,
}: {
  image: ManagedImage;
  position: number;
  total: number;
  actions: ImageCardActions;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
  });
  const src = propertyImageUrl(image, "sm");
  const ready = image.status === "ready";
  const label = image.caption?.trim() || `Bild ${position}`;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card",
        isDragging && "z-20 opacity-90 shadow-float ring-2 ring-brand",
      )}
    >
      <div className="relative aspect-[4/3] bg-muted">
        {src ? (
          <Image
            src={src}
            alt={label}
            fill
            sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 46vw"
            className="object-cover"
            draggable={false}
          />
        ) : null}
        {!ready ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-medium text-forest">
            {image.status === "failed" ? (
              "Verarbeitung fehlgeschlagen"
            ) : (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Wird verarbeitet
              </span>
            )}
          </div>
        ) : null}
        <div className="absolute left-2 top-2 flex max-w-[calc(100%-4rem)] flex-wrap gap-1">
          <Badge tone="dark" className="tabular shadow-sm">
            {position}
          </Badge>
          {image.is_cover ? (
            <Badge tone="solid" className="shadow-sm">
              <Star aria-hidden /> Titelbild
            </Badge>
          ) : null}
          {image.is_floor_plan ? (
            <Badge tone="outline" className="shadow-sm">
              <LayoutGrid aria-hidden /> Grundriss
            </Badge>
          ) : null}
          {image.is_enhanced ? (
            <Badge tone="green" className="shadow-sm">
              <Sparkles aria-hidden /> Optimiert
            </Badge>
          ) : null}
          {image.is_ai_visualization ? (
            <Badge tone="amber" className="shadow-sm">
              <WandSparkles aria-hidden /> KI-Visualisierung
            </Badge>
          ) : null}
        </div>
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Bild ${position} von ${total} verschieben`}
          className="absolute right-2 top-2 flex size-11 cursor-grab touch-none items-center justify-center rounded-xl bg-white/90 text-forest shadow-sm hover:bg-white active:cursor-grabbing"
        >
          <GripVertical className="size-5" aria-hidden />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-2">
        <button
          type="button"
          onClick={() => actions.onCaption(image)}
          className={cn(
            "line-clamp-2 min-h-11 rounded-lg px-1.5 py-1 text-left text-sm hover:bg-mint-50",
            !image.caption && "text-muted-foreground",
          )}
          aria-label={image.caption ? `Bildunterschrift bearbeiten: ${image.caption}` : `Bildunterschrift für Bild ${position} hinzufügen`}
        >
          {image.caption || "Bildunterschrift hinzufügen"}
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <IconAction
              label={image.is_cover ? "Titelbild" : "Als Titelbild festlegen"}
              pressed={image.is_cover}
              disabled={image.is_cover || !ready}
              onClick={() => actions.onCover(image)}
            >
              <Star className={cn("size-[18px]", image.is_cover && "fill-current")} aria-hidden />
            </IconAction>
            <IconAction
              label="Zuschneiden"
              disabled={!ready || image.is_ai_visualization || !image.base_path}
              onClick={() => actions.onCrop(image)}
            >
              <Crop className="size-[18px]" aria-hidden />
            </IconAction>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Weitere Aktionen für Bild ${position}`}>
                <Ellipsis className="size-[18px]" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => actions.onCaption(image)}>
                <Pencil /> Bildunterschrift bearbeiten
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => actions.onToggleFloorPlan(image)}>
                <LayoutGrid /> {image.is_floor_plan ? "Nicht mehr als Grundriss" : "Als Grundriss markieren"}
              </DropdownMenuItem>
              {ready && !image.is_ai_visualization ? (
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/bilderstudio/${image.id}`}>
                    <WandSparkles /> Optimieren im Bilderstudio
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {isCropped(image) ? (
                <DropdownMenuItem onSelect={() => actions.onResetCrop(image)}>
                  <RotateCcw /> Zuschnitt zurücksetzen
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => actions.onDelete(image)}>
                <Trash2 /> Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>
  );
}
