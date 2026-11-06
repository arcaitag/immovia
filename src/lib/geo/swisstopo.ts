import { CANTONS } from "@/lib/constants";

/**
 * Orts- und Adresssuche über den offiziellen SearchServer von geo.admin.ch (swisstopo).
 * Nutzung gemäss den Nutzungsbedingungen von geo.admin.ch (kostenlos, Quellenangabe «© swisstopo»).
 */

export const SWISSTOPO_SEARCH_URL = "https://api3.geo.admin.ch/rest/services/api/SearchServer";

export type LocationKind = "municipality" | "postal_code" | "canton" | "district" | "address";

export interface LocationResult {
  id: string;
  kind: LocationKind;
  label: string;
  municipality?: string;
  postalCode?: string;
  canton?: string;
  street?: string;
  houseNumber?: string;
  egid?: number;
  lat: number;
  lng: number;
}

interface RawAttrs {
  origin?: string;
  label?: string;
  detail?: string;
  lat?: number;
  lon?: number;
  featureId?: string | number;
  num?: number;
}

const CANTON_CODES = new Set<string>(CANTONS.map((c) => c.code));

export function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function cantonFromText(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const paren = text.match(/\(([A-Z]{2})\)/);
  if (paren?.[1] && CANTON_CODES.has(paren[1])) return paren[1];
  const tokens = text.toUpperCase().split(/[\s,]+/).reverse();
  return tokens.find((t) => t.length === 2 && CANTON_CODES.has(t));
}

function cantonFromName(name: string): string | undefined {
  const normalized = name.toLowerCase().replace(/^kanton\s+/, "").trim();
  return CANTONS.find((c) => c.name.toLowerCase() === normalized || c.code.toLowerCase() === normalized)?.code;
}

/** Wandelt einen Treffer des SearchServers in ein einheitliches Objekt um. */
export function parseSearchResult(attrs: RawAttrs, id: string | number): LocationResult | null {
  if (typeof attrs.lat !== "number" || typeof attrs.lon !== "number" || !attrs.label) return null;
  const label = stripTags(attrs.label);
  const base = { id: String(id), lat: attrs.lat, lng: attrs.lon };
  switch (attrs.origin) {
    case "gg25": {
      const m = label.match(/^(.+?)\s*\(([A-Z]{2})\)$/);
      const municipality = (m?.[1] ?? label).trim();
      const canton = m?.[2] && CANTON_CODES.has(m[2]) ? m[2] : cantonFromText(attrs.detail);
      return { ...base, kind: "municipality", label: canton ? `${municipality} (${canton})` : municipality, municipality, canton };
    }
    case "zipcode": {
      const m = label.match(/^(\d{4})\s*-?\s*(.+)$/);
      if (!m?.[1]) return null;
      const name = (m[2] ?? "").replace(/\s*\([A-Z]{2}\)$/, "").trim();
      return {
        ...base,
        kind: "postal_code",
        label: `${m[1]} ${name}`.trim(),
        postalCode: m[1],
        municipality: name || undefined,
        canton: cantonFromText(label) ?? cantonFromText(attrs.detail),
      };
    }
    case "kantone": {
      const canton = cantonFromName(label) ?? cantonFromText(label) ?? cantonFromText(attrs.detail);
      if (!canton) return null;
      const name = CANTONS.find((c) => c.code === canton)?.name ?? label;
      return { ...base, kind: "canton", label: `Kanton ${name}`, canton };
    }
    case "district": {
      return { ...base, kind: "district", label, canton: cantonFromText(attrs.detail) };
    }
    case "address": {
      const m = label.match(/^(.*?)\s+(\d+[a-zA-Z]?(?:\.\d+)?)?\s*(\d{4})\s+(.+)$/);
      const featureId = attrs.featureId !== undefined ? String(attrs.featureId) : "";
      const egid = Number(featureId.split("_")[0]);
      return {
        ...base,
        kind: "address",
        label,
        street: m?.[1]?.trim() || undefined,
        houseNumber: m?.[2]?.trim() || undefined,
        postalCode: m?.[3],
        municipality: m?.[4]?.trim(),
        canton: cantonFromText(attrs.detail),
        egid: Number.isFinite(egid) && egid > 0 ? egid : undefined,
      };
    }
    default:
      return null;
  }
}

export async function searchSwissLocations(
  query: string,
  mode: "place" | "address",
  init?: RequestInit & { next?: { revalidate?: number } },
): Promise<LocationResult[]> {
  const text = query.trim();
  if (text.length < 2) return [];
  const params = new URLSearchParams({
    searchText: text.slice(0, 80),
    type: "locations",
    origins: mode === "address" ? "address" : "zipcode,gg25,kantone",
    limit: mode === "address" ? "8" : "10",
    sr: "4326",
    lang: "de",
  });
  const response = await fetch(`${SWISSTOPO_SEARCH_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    ...init,
  });
  if (!response.ok) throw new Error(`geo.admin.ch antwortet mit ${response.status}`);
  const json = (await response.json()) as {
    results?: { id: string | number; attrs: RawAttrs }[];
    features?: { id?: string | number; properties: RawAttrs }[];
  };
  const raw = json.results
    ? json.results.map((r) => ({ id: r.id, attrs: r.attrs }))
    : (json.features ?? []).map((f, i) => ({ id: f.id ?? i, attrs: f.properties }));
  const seen = new Set<string>();
  const results: LocationResult[] = [];
  for (const item of raw) {
    const parsed = parseSearchResult(item.attrs, item.id);
    if (!parsed) continue;
    const key = `${parsed.kind}:${parsed.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(parsed);
  }
  return results;
}
