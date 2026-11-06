"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand, ImageOff, Images, Sparkles, WandSparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { GalleryImage } from "@/components/listing-detail/data";

const SWIPE_THRESHOLD = 50;

function ImageBadges({ image, className }: { image: GalleryImage; className?: string }) {
  if (!image.aiVisualization && !image.enhanced) return null;
  return (
    <div className={cn("pointer-events-none flex flex-wrap gap-1.5", className)}>
      {image.aiVisualization ? (
        <Badge tone="dark" className="shadow-sm">
          <Sparkles aria-hidden /> KI-Visualisierung
        </Badge>
      ) : null}
      {image.enhanced && !image.aiVisualization ? (
        <Badge tone="outline" className="border-white/0 shadow-sm">
          <WandSparkles aria-hidden /> Bild optimiert
        </Badge>
      ) : null}
    </div>
  );
}

/** Vollbildansicht mit Tastatur (← →), Wischgesten und Bildzähler. */
export function ImageLightbox({
  images,
  index,
  onIndexChange,
  open,
  onOpenChange,
  title,
}: {
  images: GalleryImage[];
  index: number;
  onIndexChange: (index: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
}) {
  const [showOriginalFor, setShowOriginalFor] = React.useState<string | null>(null);
  const touchStart = React.useRef<number | null>(null);
  const count = images.length;
  const current = images[Math.min(Math.max(index, 0), count - 1)];
  if (!current) return null;

  const showOriginal = showOriginalFor === current.id && Boolean(current.original);
  const sourceIndex = current.sourceImageId ? images.findIndex((img) => img.id === current.sourceImageId) : -1;

  const go = (delta: number) => onIndexChange((index + delta + count) % count);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 bg-foreground p-0 text-white sm:rounded-none"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            go(1);
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            go(-1);
          }
        }}
      >
        <DialogTitle className="sr-only">Bilder: {title}</DialogTitle>
        <DialogDescription className="sr-only">Mit den Pfeiltasten wechseln Sie zwischen den Bildern.</DialogDescription>

        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <p className="text-sm font-semibold tabular" aria-live="polite">
            {index + 1} / {count}
          </p>
          <ImageBadges image={current} />
          <div className="ml-auto flex items-center gap-2">
            {current.original ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
                aria-pressed={showOriginal}
                onClick={() => setShowOriginalFor(showOriginal ? null : current.id)}
              >
                {showOriginal ? "Optimierte Version" : "Original ansehen"}
              </Button>
            ) : null}
            <DialogClose className="flex size-11 items-center justify-center rounded-full text-white/85 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white">
              <X className="size-6" aria-hidden />
              <span className="sr-only">Schliessen</span>
            </DialogClose>
          </div>
        </div>

        <div
          className="relative min-h-0 flex-1 touch-pan-y select-none"
          onTouchStart={(event) => {
            touchStart.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const start = touchStart.current;
            const end = event.changedTouches[0]?.clientX;
            touchStart.current = null;
            if (start === null || end === undefined) return;
            if (end - start > SWIPE_THRESHOLD) go(-1);
            else if (start - end > SWIPE_THRESHOLD) go(1);
          }}
        >
          <Image
            key={`${current.id}-${showOriginal ? "o" : "d"}`}
            src={showOriginal && current.original ? current.original : current.src}
            alt={showOriginal ? `${current.alt} (Original)` : current.alt}
            fill
            sizes="100vw"
            className="object-contain"
            priority
          />
          {count > 1 ? (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Vorheriges Bild"
                className="absolute left-2 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white transition hover:bg-black/55 focus-visible:outline-2 focus-visible:outline-white sm:left-4"
              >
                <ChevronLeft className="size-7" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Nächstes Bild"
                className="absolute right-2 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white transition hover:bg-black/55 focus-visible:outline-2 focus-visible:outline-white sm:right-4"
              >
                <ChevronRight className="size-7" aria-hidden />
              </button>
            </>
          ) : null}
        </div>

        <div className="grid gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 text-center sm:px-6">
          {current.caption ? <p className="text-sm text-white/90">{current.caption}</p> : null}
          {current.aiVisualization ? (
            <p className="text-xs text-white/75">
              Virtuell eingerichtet bzw. mit KI verändert – zeigt nicht den tatsächlichen Zustand.
              {sourceIndex >= 0 ? (
                <>
                  {" "}
                  <button type="button" className="font-semibold text-white underline underline-offset-4" onClick={() => onIndexChange(sourceIndex)}>
                    Originalfoto ansehen
                  </button>
                </>
              ) : null}
            </p>
          ) : current.enhanced ? (
            <p className="text-xs text-white/75">
              {showOriginal
                ? "Sie sehen das unveränderte Originalbild."
                : "Helligkeit, Farben oder Schärfe wurden optimiert. Bauliche Eigenschaften sind unverändert."}
            </p>
          ) : null}
          {count > 1 ? (
            <div className="mx-auto mt-1 hidden max-w-full gap-2 overflow-x-auto pb-1 sm:flex" aria-label="Bildübersicht">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => onIndexChange(i)}
                  aria-label={`Bild ${i + 1} anzeigen`}
                  aria-current={i === index ? "true" : undefined}
                  className={cn(
                    "relative h-14 w-20 shrink-0 overflow-hidden rounded-lg opacity-60 ring-2 ring-transparent transition hover:opacity-100 focus-visible:outline-2 focus-visible:outline-white",
                    i === index && "opacity-100 ring-white",
                  )}
                >
                  <Image src={img.thumb} alt="" fill sizes="80px" className="object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Tile({
  image,
  onOpen,
  priority,
  sizes,
  className,
  overlay,
}: {
  image: GalleryImage;
  onOpen: () => void;
  priority?: boolean;
  sizes: string;
  className?: string;
  overlay?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn("group relative block overflow-hidden bg-muted focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white", className)}
      aria-label={`${image.alt} – vergrössern`}
    >
      <Image src={image.src} alt={image.alt} fill priority={priority} sizes={sizes} className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]" />
      <ImageBadges image={image} className="absolute left-3 top-3" />
      {overlay}
    </button>
  );
}

/** Bildergalerie der Inseratseite: grosses Hauptbild mit Raster (Desktop), Wischgalerie (Mobile). */
export function ListingGallery({ images, title, badges }: { images: GalleryImage[]; title: string; badges?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  const [mobileIndex, setMobileIndex] = React.useState(0);
  const scroller = React.useRef<HTMLDivElement>(null);

  if (!images.length) {
    return (
      <div className="relative flex aspect-[16/9] max-h-[28rem] w-full flex-col items-center justify-center gap-2 rounded-3xl bg-muted text-muted-foreground">
        <ImageOff className="size-8" aria-hidden />
        <p className="text-sm">Für dieses Inserat sind noch keine Bilder vorhanden.</p>
        {badges ? <div className="absolute left-4 top-4">{badges}</div> : null}
      </div>
    );
  }

  const openAt = (i: number) => {
    setIndex(i);
    setOpen(true);
  };
  const desktop = images.slice(0, 5);
  const more = images.length - desktop.length;

  return (
    <div className="relative">
      {/* Mobile: Wischgalerie */}
      <div className="relative -mx-4 sm:mx-0 md:hidden">
        <div
          ref={scroller}
          className="flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] sm:rounded-3xl [&::-webkit-scrollbar]:hidden"
          onScroll={(event) => {
            const el = event.currentTarget;
            const next = Math.round(el.scrollLeft / Math.max(el.clientWidth, 1));
            if (next !== mobileIndex) setMobileIndex(next);
          }}
          aria-label="Bilder, zum Wechseln wischen"
          role="region"
        >
          {images.map((image, i) => (
            <Tile
              key={image.id}
              image={image}
              onOpen={() => openAt(i)}
              priority={i === 0}
              sizes="100vw"
              className="h-full w-full shrink-0 snap-center"
            />
          ))}
        </div>
        <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white tabular" aria-hidden>
          {mobileIndex + 1} / {images.length}
        </span>
        {badges ? <div className="pointer-events-none absolute bottom-3 left-3">{badges}</div> : null}
      </div>

      {/* Desktop: Hauptbild mit Raster */}
      <div
        className={cn(
          "hidden h-[30rem] gap-2 overflow-hidden rounded-3xl md:grid lg:h-[34rem]",
          desktop.length === 1 && "grid-cols-1",
          desktop.length === 2 && "grid-cols-2",
          desktop.length === 3 && "grid-cols-3 grid-rows-2",
          desktop.length >= 4 && "grid-cols-4 grid-rows-2",
        )}
      >
        {desktop.map((image, i) => (
          <Tile
            key={image.id}
            image={image}
            onOpen={() => openAt(i)}
            priority={i === 0}
            sizes={i === 0 ? "(min-width: 1280px) 640px, 50vw" : "(min-width: 1280px) 320px, 25vw"}
            className={cn(
              "h-full w-full",
              i === 0 && desktop.length >= 3 && "col-span-2 row-span-2",
              desktop.length === 4 && i === 3 && "col-span-2",
            )}
            overlay={
              i === desktop.length - 1 && more > 0 ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 font-display text-xl font-bold text-white">
                  +{more}
                </span>
              ) : undefined
            }
          />
        ))}
        {badges ? <div className="pointer-events-none absolute bottom-4 left-4 hidden md:block">{badges}</div> : null}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="absolute bottom-4 right-4 hidden bg-white/95 shadow-card md:inline-flex"
        onClick={() => openAt(0)}
      >
        {images.length > 1 ? <Images aria-hidden /> : <Expand aria-hidden />}
        {images.length > 1 ? `Alle ${images.length} Bilder` : "Vergrössern"}
      </Button>

      <ImageLightbox images={images} index={index} onIndexChange={setIndex} open={open} onOpenChange={setOpen} title={title} />
    </div>
  );
}

/** Grundrisse als Raster, Vergrösserung im selben Bildbetrachter. */
export function FloorPlanGallery({ plans, title }: { plans: GalleryImage[]; title: string }) {
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  return (
    <>
      <ul role="list" className="grid gap-4 sm:grid-cols-2">
        {plans.map((plan, i) => (
          <li key={plan.id}>
            <button
              type="button"
              onClick={() => {
                setIndex(i);
                setOpen(true);
              }}
              className="group block w-full overflow-hidden rounded-2xl border border-border bg-white text-left focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className="relative block aspect-[4/3]">
                <Image src={plan.src} alt={plan.alt} fill sizes="(min-width: 640px) 50vw, 100vw" className="object-contain p-3" />
              </span>
              <span className="flex items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm font-semibold">
                {plan.caption ?? `Grundriss ${i + 1}`}
                <Expand className="size-4 text-muted-foreground transition group-hover:text-forest" aria-hidden />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <ImageLightbox images={plans} index={index} onIndexChange={setIndex} open={open} onOpenChange={setOpen} title={`Grundrisse: ${title}`} />
    </>
  );
}
