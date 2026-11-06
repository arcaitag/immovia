import { z } from "zod";
import { Constants, type Database } from "@/types/database";
import { CANTONS, CONDITIONS, OFFER_TYPES, PROPERTY_TYPES, type OfferType, type PropertyType } from "@/lib/constants";
import { formatArea, formatChf, formatNumber } from "@/lib/format";

/**
 * Suchkriterien – eine Struktur für URL-Parameter, gespeicherte Suchabos
 * (saved_searches.criteria) und die Datenbankfunktion search_listings.
 * Die JSON-Schlüssel entsprechen exakt saved_search_matches_listing() in der Datenbank.
 */

const PROPERTY_TYPE_VALUES = Constants.public.Enums.property_type;
const CONDITION_VALUES = Constants.public.Enums.property_condition;

export const SORT_OPTIONS = {
  newest: "Neueste zuerst",
  price_asc: "Preis aufsteigend",
  price_desc: "Preis absteigend",
  area_desc: "Grösste Fläche",
  distance: "Nächste zuerst",
} as const;
export type SortOption = keyof typeof SORT_OPTIONS;

const optionalNumber = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(String(v).replace(/['’\s]/g, ""))),
  z.number().finite().nonnegative().optional(),
);
const optionalBool = z.preprocess((v) => (v === "1" || v === "true" || v === true ? true : undefined), z.literal(true).optional());

export const searchCriteriaSchema = z.object({
  offer: z.enum(["sale", "rent"]).optional(),
  types: z.array(z.enum(PROPERTY_TYPE_VALUES)).max(10).optional(),
  q: z.string().trim().max(80).optional(),
  label: z.string().trim().max(120).optional(),
  canton: z.enum(CANTONS.map((c) => c.code) as [string, ...string[]]).optional(),
  municipality: z.string().trim().max(80).optional(),
  postal_code: z.string().regex(/^[1-9]\d{3}$/).optional(),
  lat: z.coerce.number().min(45.7).max(47.9).optional(),
  lng: z.coerce.number().min(5.8).max(10.6).optional(),
  radius: z.coerce.number().min(1).max(100).optional(),
  price_min: optionalNumber,
  price_max: optionalNumber,
  rooms_min: optionalNumber,
  rooms_max: optionalNumber,
  area_min: optionalNumber,
  area_max: optionalNumber,
  plot_min: optionalNumber,
  year_min: optionalNumber,
  conditions: z.array(z.enum(CONDITION_VALUES)).max(5).optional(),
  balcony: optionalBool,
  terrace: optionalBool,
  garden: optionalBool,
  parking: optionalBool,
  garage: optionalBool,
  elevator: optionalBool,
  pets: optionalBool,
  new_build: optionalBool,
  wheelchair: optionalBool,
});
export type SearchCriteria = z.infer<typeof searchCriteriaSchema>;

/** URL-Parameter (deutsch, kurz) ↔ Kriterien-Schlüssel */
const PARAM_KEYS: Record<string, keyof SearchCriteria> = {
  angebot: "offer",
  typ: "types",
  q: "q",
  ort: "label",
  kanton: "canton",
  gemeinde: "municipality",
  plz: "postal_code",
  lat: "lat",
  lng: "lng",
  umkreis: "radius",
  preis_von: "price_min",
  preis_bis: "price_max",
  zimmer_von: "rooms_min",
  zimmer_bis: "rooms_max",
  flaeche_von: "area_min",
  flaeche_bis: "area_max",
  grundstueck_von: "plot_min",
  baujahr_von: "year_min",
  zustand: "conditions",
  balkon: "balcony",
  terrasse: "terrace",
  garten: "garden",
  parkplatz: "parking",
  garage: "garage",
  lift: "elevator",
  haustiere: "pets",
  neubau: "new_build",
  rollstuhl: "wheelchair",
};
const ARRAY_KEYS = new Set<keyof SearchCriteria>(["types", "conditions"]);

export interface SearchState {
  criteria: SearchCriteria;
  sort: SortOption;
  page: number;
  view: "liste" | "karte" | "kombi";
}

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function getAll(source: ParamSource, key: string): string[] {
  if (source instanceof URLSearchParams) return source.getAll(key).flatMap((v) => v.split(","));
  const value = source[key];
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).flatMap((v) => v.split(","));
}

/** Liest Suchparameter aus der URL. Ungültige Werte werden verworfen statt Fehler zu werfen. */
export function parseSearchParams(source: ParamSource, defaults: Partial<SearchCriteria> = {}): SearchState {
  const raw: Record<string, unknown> = { ...defaults };
  for (const [param, key] of Object.entries(PARAM_KEYS)) {
    const values = getAll(source, param).filter((v) => v !== "");
    if (!values.length) continue;
    raw[key] = ARRAY_KEYS.has(key) ? values : values[0];
  }
  if (raw.offer === "kaufen") raw.offer = "sale";
  if (raw.offer === "mieten") raw.offer = "rent";

  const criteria: Record<string, unknown> = {};
  const shape = searchCriteriaSchema.shape;
  for (const [key, value] of Object.entries(raw)) {
    const fieldSchema = shape[key as keyof typeof shape];
    if (!fieldSchema) continue;
    const parsed = fieldSchema.safeParse(value);
    if (parsed.success && parsed.data !== undefined) criteria[key] = parsed.data;
  }

  const sortRaw = getAll(source, "sortierung")[0];
  const sort: SortOption = sortRaw && sortRaw in SORT_OPTIONS ? (sortRaw as SortOption) : "newest";
  const pageRaw = Number(getAll(source, "seite")[0] ?? "1");
  const viewRaw = getAll(source, "ansicht")[0];
  return {
    criteria: criteria as SearchCriteria,
    sort,
    page: Number.isInteger(pageRaw) && pageRaw > 0 && pageRaw < 1000 ? pageRaw : 1,
    view: viewRaw === "karte" || viewRaw === "kombi" ? viewRaw : "liste",
  };
}

/** Erzeugt URL-Parameter aus Kriterien (für Links und Router-Navigation). */
export function toSearchParams(state: Partial<SearchState> & { criteria: SearchCriteria }, options: { omitOffer?: boolean } = {}): URLSearchParams {
  const params = new URLSearchParams();
  for (const [param, key] of Object.entries(PARAM_KEYS)) {
    if (options.omitOffer && key === "offer") continue;
    const value = state.criteria[key];
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length) params.set(param, value.join(","));
    } else if (value === true) {
      params.set(param, "1");
    } else {
      params.set(param, String(value));
    }
  }
  if (state.sort && state.sort !== "newest") params.set("sortierung", state.sort);
  if (state.page && state.page > 1) params.set("seite", String(state.page));
  if (state.view && state.view !== "liste") params.set("ansicht", state.view);
  return params;
}

type SearchArgs = Database["public"]["Functions"]["search_listings"]["Args"];

/** Abbildung auf die Argumente der Datenbankfunktion search_listings. */
export function toRpcArgs(
  criteria: SearchCriteria,
  options: { sort?: SortOption; limit?: number; offset?: number; bbox?: [number, number, number, number] } = {},
): SearchArgs {
  const hasRadius = criteria.lat !== undefined && criteria.lng !== undefined && criteria.radius !== undefined;
  const args: SearchArgs = {
    p_offer_type: criteria.offer,
    p_property_types: criteria.types?.length ? criteria.types : undefined,
    p_canton: criteria.canton,
    p_municipality: hasRadius ? undefined : criteria.municipality,
    p_postal_code: hasRadius ? undefined : criteria.postal_code,
    p_query: criteria.canton || criteria.municipality || criteria.postal_code || hasRadius ? undefined : criteria.q,
    p_lat: criteria.lat,
    p_lng: criteria.lng,
    p_radius_km: hasRadius ? criteria.radius : undefined,
    p_bbox: options.bbox,
    p_price_min: criteria.price_min,
    p_price_max: criteria.price_max,
    p_rooms_min: criteria.rooms_min,
    p_rooms_max: criteria.rooms_max,
    p_area_min: criteria.area_min,
    p_area_max: criteria.area_max,
    p_plot_min: criteria.plot_min,
    p_year_min: criteria.year_min,
    p_conditions: criteria.conditions?.length ? criteria.conditions : undefined,
    p_balcony: criteria.balcony,
    p_terrace: criteria.terrace,
    p_garden: criteria.garden,
    p_parking: criteria.parking,
    p_garage: criteria.garage,
    p_elevator: criteria.elevator,
    p_pets: criteria.pets,
    p_new_build: criteria.new_build,
    p_wheelchair: criteria.wheelchair,
    p_sort: options.sort === "distance" && !hasRadius ? "newest" : options.sort,
    p_limit: options.limit,
    p_offset: options.offset,
  };
  return Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined)) as SearchArgs;
}

/** Kriterien für die Speicherung als Suchabo (nur gesetzte Werte). */
export function toSavedCriteria(criteria: SearchCriteria): Record<string, unknown> {
  return Object.fromEntries(Object.entries(criteria).filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && !v.length)));
}

/** Kurze, lesbare Zusammenfassung (z. B. für Suchabos und E-Mails). */
export function describeCriteria(criteria: SearchCriteria): string {
  const parts: string[] = [];
  const typeLabel = criteria.types?.length
    ? criteria.types.map((t) => PROPERTY_TYPES[t as PropertyType]?.plural ?? t).join(", ")
    : "Immobilien";
  parts.push(`${typeLabel}${criteria.offer ? ` ${criteria.offer === "sale" ? "zum Kaufen" : "zum Mieten"}` : ""}`);
  const place = criteria.label || criteria.municipality || criteria.postal_code || (criteria.canton && `Kanton ${criteria.canton}`) || criteria.q;
  if (place) parts.push(`in ${place}${criteria.radius ? ` (+${criteria.radius} km)` : ""}`);
  if (criteria.rooms_min) parts.push(`ab ${formatNumber(criteria.rooms_min, 1)} Zimmer`);
  if (criteria.price_max) parts.push(`bis ${formatChf(criteria.price_max)}`);
  if (criteria.area_min) parts.push(`ab ${formatArea(criteria.area_min)}`);
  if (criteria.conditions?.length) parts.push(criteria.conditions.map((c) => CONDITIONS[c]).join(", "));
  return parts.join(" · ");
}

export function countActiveFilters(criteria: SearchCriteria): number {
  const ignored = new Set(["offer", "label", "lat", "lng", "q", "municipality", "postal_code", "canton"]);
  return Object.entries(criteria).filter(([k, v]) => !ignored.has(k) && v !== undefined && !(Array.isArray(v) && !v.length)).length;
}

export function offerLabel(offer: OfferType | undefined): string {
  return offer ? OFFER_TYPES[offer].label : "Kaufen & Mieten";
}

export const PAGE_SIZE = 24;
