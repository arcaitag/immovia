"use client";

import * as React from "react";
import { ChevronsLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Vorher/Nachher-Vergleich mit verschiebbarer Trennlinie.
 * Bedienbar mit Maus, Touch (Pointer Events) und Tastatur (Pfeiltasten, Pos1, Ende).
 */
export function ComparisonSlider({
  before,
  after,
  alt,
  className,
}: {
  before: string;
  after: string;
  alt: string;
  className?: string;
}) {
  const [position, setPosition] = React.useState(50);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const draggingRef = React.useRef(false);

  function updateFromPointer(clientX: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    setPosition(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 10 : 2;
    const next =
      event.key === "ArrowLeft" || event.key === "ArrowDown"
        ? position - step
        : event.key === "ArrowRight" || event.key === "ArrowUp"
          ? position + step
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? 100
              : null;
    if (next === null) return;
    event.preventDefault();
    setPosition(Math.min(100, Math.max(0, next)));
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative touch-none select-none overflow-hidden rounded-2xl bg-muted", className)}
      onPointerDown={(event) => {
        draggingRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        updateFromPointer(event.clientX);
      }}
      onPointerMove={(event) => {
        if (draggingRef.current) updateFromPointer(event.clientX);
      }}
      onPointerUp={() => {
        draggingRef.current = false;
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
      }}
    >
      {/* Vorschau als Data-URL und Original im exakt gleichen Rahmen: bewusst ohne next/image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after} alt={`${alt} – nachher`} className="block h-auto w-full" draggable={false} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={before} alt="" className="size-full object-cover" draggable={false} />
      </div>
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-forest/80 px-2.5 py-1 text-xs font-semibold text-white">Vorher</span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-forest/80 px-2.5 py-1 text-xs font-semibold text-white">Nachher</span>
      <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow" style={{ left: `${position}%` }} aria-hidden />
      <div
        role="slider"
        tabIndex={0}
        aria-label="Vergleich vorher und nachher"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        aria-valuetext={`${Math.round(position)} % Original sichtbar`}
        onKeyDown={onKeyDown}
        className="absolute top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border-2 border-white bg-forest text-white shadow-float focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        style={{ left: `${position}%` }}
      >
        <ChevronsLeftRight className="size-5" aria-hidden />
      </div>
    </div>
  );
}
