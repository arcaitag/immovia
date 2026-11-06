import type { Metadata } from "next";
import { PROPERTY_TYPES, cantonName, type OfferType } from "@/lib/constants";
import type { SearchCriteria, SearchState } from "@/lib/search/criteria";
import { pageMetadata } from "@/lib/seo/metadata";

export type SearchPath = "/immobilien" | "/kaufen" | "/mieten";

/** Basis-URL der Suche je Angebotsart. */
export function searchPathForOffer(offer: OfferType | undefined): SearchPath {
  if (offer === "sale") return "/kaufen";
  if (offer === "rent") return "/mieten";
  return "/immobilien";
}

/** Lesbare Ortsangabe der Suchkriterien («Bern (BE)», «Kanton Bern», «3011»). */
export function searchPlaceLabel(criteria: SearchCriteria): string | undefined {
  if (criteria.label) return criteria.label;
  if (criteria.municipality) return criteria.municipality;
  if (criteria.postal_code) return criteria.postal_code;
  if (criteria.canton) return `Kanton ${cantonName(criteria.canton)}`;
  return criteria.q || undefined;
}

function withPreposition(place: string): string {
  return /^Kanton\s/.test(place) ? `im ${place}` : `in ${place}`;
}

/** Überschrift und Beschreibung einer Suchseite, z. B. «Wohnungen kaufen in Bern (BE)». */
export function searchHeading(criteria: SearchCriteria): { title: string; description: string } {
  const singleType = criteria.types?.length === 1 ? criteria.types[0] : undefined;
  const subject = singleType ? PROPERTY_TYPES[singleType].plural : "Immobilien";
  const verb = criteria.offer === "sale" ? "kaufen" : criteria.offer === "rent" ? "mieten" : undefined;
  const place = searchPlaceLabel(criteria);

  let title: string;
  if (verb && place) title = `${subject} ${verb} ${withPreposition(place)}`;
  else if (verb) title = `${subject} ${verb}`;
  else if (place) title = `${subject} ${withPreposition(place)}`;
  else title = `${subject} suchen`;

  const purpose = criteria.offer === "sale" ? " zum Kaufen" : criteria.offer === "rent" ? " zum Mieten" : "";
  const where = place ? ` ${withPreposition(place)}` : " in der Schweiz";
  const description = `Aktuelle ${subject}${purpose}${where} auf Immovia: Fotos, Preise und Eckdaten. Kostenlos suchen, merken und Suchaufträge einrichten.`;
  return { title, description };
}

const CANONICAL_KEYS = new Set<keyof SearchCriteria>(["offer", "canton", "municipality", "postal_code", "types", "label", "lat", "lng"]);

/**
 * Kanonische URL einer Suchseite. Indexiert werden nur Standort- und Typseiten (erste Seite),
 * Kombinationen weiterer Filter erhalten «noindex, follow».
 */
export function searchCanonical(
  state: Pick<SearchState, "criteria" | "page">,
  hasBbox = false,
): { path: string; indexable: boolean } {
  const c = state.criteria;
  const params = new URLSearchParams();
  if (c.types?.length === 1 && c.types[0]) params.set("typ", c.types[0]);
  if (c.canton) params.set("kanton", c.canton);
  if (c.municipality) params.set("gemeinde", c.municipality);
  if (c.postal_code) params.set("plz", c.postal_code);
  const base = searchPathForOffer(c.offer);
  const extraFilters = (Object.entries(c) as [keyof SearchCriteria, unknown][]).some(
    ([key, value]) => value !== undefined && !(Array.isArray(value) && value.length === 0) && !CANONICAL_KEYS.has(key),
  );
  const indexable = !extraFilters && !hasBbox && state.page === 1 && (c.types?.length ?? 0) <= 1;
  return { path: params.size ? `${base}?${params.toString()}` : base, indexable };
}

export function buildSearchMetadata(state: Pick<SearchState, "criteria" | "page">, hasBbox = false): Metadata {
  const { title, description } = searchHeading(state.criteria);
  const { path, indexable } = searchCanonical(state, hasBbox);
  return pageMetadata({ title: state.page > 1 ? `${title} – Seite ${state.page}` : title, description, path, noindex: !indexable });
}
