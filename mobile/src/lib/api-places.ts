import type { PlaceFilter } from "@/lib/api";
import { CONFIG } from "@/lib/config";

/**
 * Ortsvorschläge für die Suche: Gemeinden, PLZ, Kantone und Adressen über die Ortssuche der
 * Website (/api/orte, Daten von swisstopo). Gleiche Quelle wie das Suchfeld der Website.
 */

export type PlaceKind = "municipality" | "postal_code" | "canton" | "district" | "address";

/** Treffer von /api/orte (LocationResult in src/lib/geo/swisstopo.ts). */
export interface PlaceSuggestion {
  id: string;
  kind: PlaceKind;
  label: string;
  municipality?: string;
  postalCode?: string;
  canton?: string;
  street?: string;
  lat: number;
  lng: number;
}

export const PLACE_KIND_LABEL: Record<PlaceKind, string> = {
  municipality: "Gemeinde",
  postal_code: "PLZ",
  canton: "Kanton",
  district: "Bezirk",
  address: "Adresse",
};

/** Umkreis um eine Adresse oder einen Bezirk, wie die Suche der Website (10 km). */
const ADDRESS_RADIUS_KM = 10;

async function fetchPlaces(query: string, mode: "ort" | "adresse", signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  const response = await fetch(`${CONFIG.siteUrl}/api/orte?art=${mode}&q=${encodeURIComponent(query)}`, { signal });
  const json = (await response.json().catch(() => null)) as { results?: PlaceSuggestion[]; error?: string } | null;
  if (!response.ok) throw new Error(json?.error ?? "Die Ortssuche ist momentan nicht erreichbar.");
  return json?.results ?? [];
}

/** swisstopo setzt «#» als Platzhalter für die Hausnummer – für die Anzeige entfernen. */
function addressLabel(result: PlaceSuggestion): string {
  const street = (result.street ?? "").replace(/\s*#\s*/g, " ").trim();
  const place = [result.postalCode, result.municipality].filter(Boolean).join(" ");
  if (street && place) return `${street}, ${place}`;
  return result.label.replace(/\s*#\s*/g, " ").trim();
}

/** Orte zuerst, danach Adressen. Fällt die Adresssuche aus, bleiben die Orte. */
export async function suggestPlaces(query: string, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  const text = query.trim().slice(0, 80);
  if (text.length < 2) return [];
  const [places, addresses] = await Promise.allSettled([fetchPlaces(text, "ort", signal), fetchPlaces(text, "adresse", signal)]);
  if (places.status === "rejected" && addresses.status === "rejected") throw places.reason;
  const seen = new Set<string>();
  const merged: PlaceSuggestion[] = [];
  const add = (items: PlaceSuggestion[], limit: number) => {
    let added = 0;
    for (const item of items) {
      if (added >= limit) break;
      const label = item.kind === "address" ? addressLabel(item) : item.label;
      const key = `${item.kind}:${label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push({ ...item, label });
      added++;
    }
  };
  if (places.status === "fulfilled") add(places.value, 5);
  if (addresses.status === "fulfilled") add(addresses.value, 5);
  return merged;
}

/** Übernimmt einen Vorschlag als Ortsfilter (wie locationToCriteria der Website). */
export function placeFromSuggestion(result: PlaceSuggestion): PlaceFilter {
  switch (result.kind) {
    case "canton":
      return { label: result.label, canton: result.canton };
    case "postal_code":
      return { label: result.label, postalCode: result.postalCode };
    case "municipality":
      return { label: result.label, municipality: result.municipality, canton: result.canton };
    default:
      // Adresse oder Bezirk: Inserate im Umkreis – die genaue Adresse eines Inserats ist oft nicht öffentlich
      return { label: result.label, lat: result.lat, lng: result.lng, radiusKm: ADDRESS_RADIUS_KM };
  }
}
