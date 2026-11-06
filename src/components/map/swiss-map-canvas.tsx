"use client";

import * as React from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  AttributionControl,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
  type LngLatBoundsLike,
} from "maplibre-gl";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import { MapPinOff } from "lucide-react";
import { MAP_LOCALE_DE, MAP_MAX_BOUNDS, SWISS_MAP_STYLE_URL, SWISSTOPO_ATTRIBUTION } from "@/components/map/map-config";
import { SWITZERLAND_BOUNDS, type MapBounds, type SwissMapMarker } from "@/components/map/types";
import { Skeleton } from "@/components/ui/skeleton";

export interface SwissMapCanvasProps {
  markers: SwissMapMarker[];
  /** Beschreibung der Karte für Screenreader */
  ariaLabel: string;
  /** Feste Kartenansicht [Süd, West, Nord, Ost], z. B. ein gewählter Kartenausschnitt */
  bounds?: MapBounds | null;
  /** Mittelpunkt, falls keine Marker vorhanden sind */
  center?: { lat: number; lng: number; zoom?: number } | null;
  selectedId?: string | null;
  onMarkerClick?: (id: string) => void;
  onMapClick?: () => void;
  /** Wird nach einer Verschiebung oder einem Zoom durch die Nutzerin/den Nutzer aufgerufen. */
  onUserMove?: (bounds: MapBounds) => void;
  /** Zoomen per Mausrad nur mit Ctrl/⌘ (für Karten in langen Seiten) */
  cooperativeGestures?: boolean;
  /** Ungefähre Standorte nur als Kreis darstellen (ohne Marker) */
  circleOnlyForApproximate?: boolean;
  /** Maximale Zoomstufe beim automatischen Einpassen */
  maxFitZoom?: number;
}

const APPROX_SOURCE = "immovia-approx";
const ANIMATION_MS = 450;

let workerConfigured = false;
/** MapLibre 6 benötigt bei Bundlern die URL des Web Workers (siehe MapLibre-Doku «Installation»). */
function configureWorker() {
  if (workerConfigured) return;
  setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());
  workerConfigured = true;
}

function supportsWebGl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Farbwert eines Design-Tokens (CSS-Variable) für MapLibre-Ebenen. */
function tokenColor(name: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || "currentColor";
}

function toLngLatBounds(bounds: MapBounds): LngLatBoundsLike {
  const [south, west, north, east] = bounds;
  return [
    [west, south],
    [east, north],
  ];
}

function circlePolygon(lng: number, lat: number, radiusMeters: number, steps = 72): Polygon {
  const dLat = radiusMeters / 111_320;
  const dLng = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180));
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    ring.push([lng + dLng * Math.cos(angle), lat + dLat * Math.sin(angle)]);
  }
  return { type: "Polygon", coordinates: [ring] };
}

const PILL_CLASSES =
  "relative block cursor-pointer select-none whitespace-nowrap rounded-full border bg-white px-2.5 py-1.5 font-display text-[12px] font-bold leading-none text-forest shadow-[0_2px_10px_rgb(25_40_32/0.22)] transition-[transform,background-color,color] duration-150 hover:scale-105 hover:bg-mint-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[selected=true]:scale-105 data-[selected=true]:bg-forest data-[selected=true]:text-white";
const PIN_POINTER_CLASSES =
  "border-forest/15 after:absolute after:left-1/2 after:top-full after:-translate-x-1/2 after:border-x-[6px] after:border-t-[7px] after:border-x-transparent after:border-t-white after:content-[''] hover:after:border-t-mint-100 data-[selected=true]:after:border-t-forest";
const APPROX_PILL_CLASSES = "border-dashed border-forest/45";

function createMarkerElement(marker: SwissMapMarker): HTMLElement {
  const el = document.createElement(marker.label ? "button" : "div");
  if (el instanceof HTMLButtonElement) el.type = "button";
  el.setAttribute("aria-label", marker.ariaLabel);
  el.title = marker.ariaLabel;
  if (marker.label) {
    el.className = `${PILL_CLASSES} ${marker.approximate ? APPROX_PILL_CLASSES : PIN_POINTER_CLASSES}`;
    el.textContent = marker.label;
  } else {
    el.setAttribute("role", "img");
    // Statisches SVG ohne Benutzerdaten
    el.innerHTML =
      '<svg viewBox="0 0 32 42" width="32" height="42" aria-hidden="true" class="drop-shadow-md"><path class="fill-brand" d="M16 0C7.2 0 0 7 0 15.8 0 27.6 16 42 16 42s16-14.4 16-26.2C32 7 24.8 0 16 0Z"/><circle class="fill-white" cx="16" cy="15.6" r="6.2"/></svg>';
  }
  return el;
}

function markSelected(el: HTMLElement, selected: boolean) {
  el.dataset.selected = String(selected);
  el.style.zIndex = selected ? "5" : "";
  if (el instanceof HTMLButtonElement) el.setAttribute("aria-pressed", String(selected));
}

export function SwissMapCanvas({
  markers,
  ariaLabel,
  bounds,
  center,
  selectedId,
  onMarkerClick,
  onMapClick,
  onUserMove,
  cooperativeGestures = false,
  circleOnlyForApproximate = false,
  maxFitZoom = 14,
}: SwissMapCanvasProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<MapLibreMap | null>(null);
  const markerEntries = React.useRef(new Map<string, { marker: Marker; el: HTMLElement }>());
  const firstCamera = React.useRef(true);
  const [status, setStatus] = React.useState<"loading" | "ready" | "failed">(() => (supportsWebGl() ? "loading" : "failed"));

  const handleMarkerClick = React.useEffectEvent((id: string) => onMarkerClick?.(id));
  const handleMapClick = React.useEffectEvent(() => onMapClick?.());
  const handleUserMove = React.useEffectEvent((next: MapBounds) => onUserMove?.(next));

  /** Zielansicht aus Kartenausschnitt, Markern oder Mittelpunkt. */
  const cameraTarget = React.useEffectEvent((): { bounds: LngLatBoundsLike } | { center: [number, number]; zoom: number } => {
    if (bounds) return { bounds: toLngLatBounds(bounds) };
    if (markers.length === 1 && markers[0]) {
      const only = markers[0];
      const zoom = only.approximate && (only.radiusMeters ?? 0) >= 500 ? Math.min(13, maxFitZoom) : maxFitZoom;
      return { center: [only.lng, only.lat], zoom };
    }
    if (markers.length > 1) {
      const lats = markers.map((m) => m.lat);
      const lngs = markers.map((m) => m.lng);
      return { bounds: toLngLatBounds([Math.min(...lats), Math.min(...lngs), Math.max(...lats), Math.max(...lngs)]) };
    }
    if (center) return { center: [center.lng, center.lat], zoom: center.zoom ?? 11 };
    return { bounds: toLngLatBounds(SWITZERLAND_BOUNDS) };
  });

  const initialOptions = React.useEffectEvent(() => ({
    canRender: status !== "failed",
    cooperative: cooperativeGestures,
    fitZoom: maxFitZoom,
    target: cameraTarget(),
  }));

  // Karte einmalig erzeugen; Änderungen laufen über die folgenden Effekte.
  React.useEffect(() => {
    const container = containerRef.current;
    const { canRender, cooperative, fitZoom, target } = initialOptions();
    if (!container || !canRender) return;
    let map: MapLibreMap;
    try {
      configureWorker();
      map = new MapLibreMap({
        container,
        style: SWISS_MAP_STYLE_URL,
        ...("bounds" in target
          ? { bounds: target.bounds, fitBoundsOptions: { padding: 48, maxZoom: fitZoom } }
          : { center: target.center, zoom: target.zoom }),
        attributionControl: false,
        locale: MAP_LOCALE_DE,
        cooperativeGestures: cooperative,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        minZoom: 6,
        maxZoom: 18,
        maxBounds: MAP_MAX_BOUNDS,
      });
    } catch (error) {
      console.warn("[karte] Karte konnte nicht erzeugt werden", error);
      void Promise.resolve().then(() => setStatus("failed"));
      return;
    }
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new AttributionControl({ compact: true, customAttribution: SWISSTOPO_ATTRIBUTION }), "bottom-right");

    let styleLoaded = false;
    map.once("style.load", () => {
      styleLoaded = true;
    });
    map.once("load", () => setStatus("ready"));
    map.on("error", (event) => {
      // Fehler einzelner Kacheln sind unkritisch; ohne Stil gibt es aber keine Karte.
      if (!styleLoaded) {
        console.warn("[karte] Kartenstil nicht erreichbar", event.error?.message);
        setStatus("failed");
      }
    });
    map.on("click", () => handleMapClick());
    map.on("moveend", (event) => {
      if (!event.originalEvent) return;
      const b = map.getBounds();
      handleUserMove([b.getSouth(), b.getWest(), b.getNorth(), b.getEast()]);
    });
    mapRef.current = map;

    const entries = markerEntries.current;
    return () => {
      for (const entry of entries.values()) entry.marker.remove();
      entries.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Marker abgleichen
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const entries = markerEntries.current;
    const visible = markers.filter((m) => !(m.approximate && circleOnlyForApproximate));
    const nextIds = new Set(visible.map((m) => m.id));
    for (const [id, entry] of entries) {
      if (!nextIds.has(id)) {
        entry.marker.remove();
        entries.delete(id);
      }
    }
    for (const m of visible) {
      const existing = entries.get(m.id);
      if (existing) {
        existing.marker.setLngLat([m.lng, m.lat]);
        if (m.label && existing.el.textContent !== m.label) existing.el.textContent = m.label;
        continue;
      }
      const el = createMarkerElement(m);
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        handleMarkerClick(m.id);
      });
      // Preis-Pin und Symbol-Pin zeigen mit der Spitze auf den Standort, ungefähre Standorte sind zentriert.
      const marker = new Marker({
        element: el,
        anchor: m.approximate ? "center" : "bottom",
        // Die Spitze des Preis-Pins (CSS-Dreieck, 7 px) liegt unterhalb des Elements.
        offset: m.label && !m.approximate ? [0, -7] : [0, 0],
      })
        .setLngLat([m.lng, m.lat])
        .addTo(map);
      entries.set(m.id, { marker, el });
    }
  }, [markers, circleOnlyForApproximate]);

  // Auswahl hervorheben
  React.useEffect(() => {
    for (const [id, { el }] of markerEntries.current) markSelected(el, id === selectedId);
  }, [selectedId, markers]);

  // Kreise für ungefähre Standorte (benötigt den geladenen Kartenstil)
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    const features: Feature<Polygon, { id: string }>[] = markers
      .filter((m) => m.approximate && m.radiusMeters)
      .map((m) => ({ type: "Feature", properties: { id: m.id }, geometry: circlePolygon(m.lng, m.lat, m.radiusMeters ?? 0) }));
    const data: FeatureCollection<Polygon, { id: string }> = { type: "FeatureCollection", features };
    const source = map.getSource<GeoJSONSource>(APPROX_SOURCE);
    if (source) {
      void source.setData(data);
      return;
    }
    const brand = tokenColor("--brand");
    map.addSource(APPROX_SOURCE, { type: "geojson", data });
    map.addLayer({ id: `${APPROX_SOURCE}-fill`, type: "fill", source: APPROX_SOURCE, paint: { "fill-color": brand, "fill-opacity": 0.14 } });
    map.addLayer({
      id: `${APPROX_SOURCE}-line`,
      type: "line",
      source: APPROX_SOURCE,
      paint: { "line-color": brand, "line-width": 2, "line-opacity": 0.65, "line-dasharray": [2, 1.5] },
    });
  }, [markers, status]);

  // Ansicht anpassen, wenn sich Ausschnitt oder Treffer ändern
  const cameraKey = JSON.stringify([bounds ?? null, center ?? null, markers.map((m) => [m.id, m.lat, m.lng])]);
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (firstCamera.current) {
      firstCamera.current = false;
      return;
    }
    const target = cameraTarget();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduceMotion ? 0 : ANIMATION_MS;
    if ("bounds" in target) map.fitBounds(target.bounds, { padding: 48, maxZoom: maxFitZoom, duration });
    else map.easeTo({ center: target.center, zoom: target.zoom, duration });
  }, [cameraKey, maxFitZoom]);

  return (
    <div className="absolute inset-0" role="region" aria-label={ariaLabel}>
      <div ref={containerRef} className="absolute inset-0" />
      {status === "loading" ? <Skeleton className="pointer-events-none absolute inset-0 rounded-none" aria-hidden /> : null}
      {status === "failed" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted p-6 text-center">
          <MapPinOff className="size-7 text-muted-foreground" aria-hidden />
          <p className="text-sm font-semibold">Die Karte konnte nicht geladen werden.</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Bitte prüfen Sie Ihre Internetverbindung. Ihr Browser muss WebGL unterstützen.
          </p>
        </div>
      ) : null}
    </div>
  );
}
