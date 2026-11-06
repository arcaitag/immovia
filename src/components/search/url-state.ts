import { toSearchParams, type SearchCriteria, type SearchState, type SortOption } from "@/lib/search/criteria";
import { searchPathForOffer } from "@/lib/seo/search-metadata";

/**
 * URL-Zustand der Suche, der über criteria.ts hinausgeht (Kartenausschnitt) und
 * Hilfsfunktionen, um Suchlinks zu bauen. Rein funktional, auf Server und Client nutzbar.
 */

/** Kartenausschnitt [Süd, West, Nord, Ost] in WGS84, Reihenfolge wie p_bbox der Datenbankfunktion. */
export type Bbox = [number, number, number, number];
export const BBOX_PARAM = "ausschnitt";

export type SearchView = SearchState["view"];

export interface SearchSnapshot {
  criteria: SearchCriteria;
  sort: SortOption;
  page: number;
  view: SearchView;
  bbox: Bbox | null;
}

const LAT_RANGE = [45.5, 48.2] as const;
const LNG_RANGE = [5.5, 11] as const;

/** Liest den Kartenausschnitt aus dem URL-Parameter; ungültige Werte ergeben null. */
export function parseBbox(value: string | string[] | null | undefined): Bbox | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const parts = raw.split(",").map((p) => Number(p.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [south, west, north, east] = parts as Bbox;
  const inLat = (n: number) => n >= LAT_RANGE[0] && n <= LAT_RANGE[1];
  const inLng = (n: number) => n >= LNG_RANGE[0] && n <= LNG_RANGE[1];
  if (!inLat(south) || !inLat(north) || !inLng(west) || !inLng(east)) return null;
  if (south >= north || west >= east) return null;
  return [south, west, north, east];
}

export function formatBbox(bbox: Bbox): string {
  return bbox.map((n) => Number(n.toFixed(4))).join(",");
}

/** Begrenzt einen beliebigen Kartenausschnitt auf den gültigen Bereich (z. B. nach starkem Herauszoomen). */
export function clampBbox(bbox: Bbox): Bbox | null {
  const clamp = (n: number, [min, max]: readonly [number, number]) => Math.min(max, Math.max(min, n));
  const result: Bbox = [clamp(bbox[0], LAT_RANGE), clamp(bbox[1], LNG_RANGE), clamp(bbox[2], LAT_RANGE), clamp(bbox[3], LNG_RANGE)];
  return result[0] < result[2] && result[1] < result[3] ? result : null;
}

export const LOCATION_KEYS = ["q", "label", "canton", "municipality", "postal_code", "lat", "lng", "radius"] as const satisfies readonly (keyof SearchCriteria)[];

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

/** Entfernt leere Werte, damit Links und gespeicherte Kriterien stabil bleiben. */
export function cleanCriteria(criteria: SearchCriteria): SearchCriteria {
  return Object.fromEntries(Object.entries(criteria).filter(([, v]) => !isEmpty(v))) as SearchCriteria;
}

/** Übernimmt Änderungen; Felder mit undefined werden entfernt. */
export function patchCriteria(criteria: SearchCriteria, patch: Partial<SearchCriteria>): SearchCriteria {
  return cleanCriteria({ ...criteria, ...patch });
}

export function withoutLocation(criteria: SearchCriteria): SearchCriteria {
  const next: Record<string, unknown> = { ...criteria };
  for (const key of LOCATION_KEYS) delete next[key];
  return next as SearchCriteria;
}

/** Entfernt alle Filter ausser Angebotsart und Ort. */
export function withoutFilters(criteria: SearchCriteria): SearchCriteria {
  const keep: Record<string, unknown> = { offer: criteria.offer };
  for (const key of LOCATION_KEYS) keep[key] = criteria[key];
  return cleanCriteria(keep as SearchCriteria);
}

export function hasLocation(criteria: SearchCriteria): boolean {
  return LOCATION_KEYS.some((key) => !isEmpty(criteria[key]));
}

/** Link zu einer Suche. Die Angebotsart bestimmt den Pfad (/immobilien, /kaufen, /mieten). */
export function searchHref(input: Partial<Omit<SearchSnapshot, "criteria">> & { criteria: SearchCriteria }): string {
  const criteria = cleanCriteria(input.criteria);
  const params = toSearchParams({ criteria, sort: input.sort, page: input.page, view: input.view }, { omitOffer: true });
  if (input.bbox) params.set(BBOX_PARAM, formatBbox(input.bbox));
  const path = searchPathForOffer(criteria.offer);
  return params.size ? `${path}?${params.toString()}` : path;
}
