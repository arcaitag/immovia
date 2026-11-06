"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type { SwissMapCanvasProps } from "@/components/map/swiss-map-canvas";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * MapLibre (inkl. CSS und Web Worker) wird erst im Browser und erst bei Bedarf geladen.
 * Ohne JavaScript bzw. ohne WebGL bleibt ein neutraler Platzhalter sichtbar.
 */
const SwissMapCanvas = dynamic(() => import("@/components/map/swiss-map-canvas").then((m) => m.SwissMapCanvas), {
  ssr: false,
  loading: () => <Skeleton className="absolute inset-0 rounded-none" aria-hidden />,
});

export type SwissMapProps = SwissMapCanvasProps & {
  className?: string;
  /** Erst laden, wenn die Karte in die Nähe des sichtbaren Bereichs kommt (Standard). */
  lazy?: boolean;
  children?: React.ReactNode;
};

/**
 * Wiederverwendbare Schweizer Karte (swisstopo-Vektorkarte, MapLibre GL).
 * Exakte Standorte als Pin, ungefähre Standorte als Kreis.
 */
export function SwissMap({ className, lazy = true, children, ...props }: SwissMapProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(!lazy);

  React.useEffect(() => {
    if (visible) return;
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(() => setVisible(true), 0);
      return () => window.clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={ref} className={cn("relative isolate overflow-hidden rounded-2xl border border-border bg-muted", className)}>
      {visible ? <SwissMapCanvas {...props} /> : <Skeleton className="absolute inset-0 rounded-none" aria-hidden />}
      {children}
    </div>
  );
}
