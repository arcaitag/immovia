import { Alert } from "react-native";

import { activeFilterCount, type SearchFilters, type SearchRow } from "@/lib/api";

/**
 * Platzhalter-Inserate, damit man in der App sieht, wie die Startseite mit mehreren Inseraten wirkt.
 * Sie liegen nur im App-Code, nicht in der Datenbank, und erscheinen deshalb weder auf der Website
 * noch in Suchaufträgen. In der App sind sie als «Beispiel» gekennzeichnet und lassen sich weder
 * öffnen noch merken.
 *
 * Vor dem öffentlichen Start auf false setzen (oder Datei und Bilder entfernen).
 */
export const DEMO_LISTINGS_ENABLED = true;

export type DemoRow = SearchRow & { demoPhotos: number[] };

export function isDemo(row: SearchRow): row is DemoRow {
  return "demoPhotos" in row;
}

const photo = {
  a: require("../../assets/images/beispiele/a.jpg"),
  b: require("../../assets/images/beispiele/b.jpg"),
  c: require("../../assets/images/beispiele/c.jpg"),
  d: require("../../assets/images/beispiele/d.jpg"),
  e: require("../../assets/images/beispiele/e.jpg"),
  f: require("../../assets/images/beispiele/f.jpg"),
  g: require("../../assets/images/beispiele/g.jpg"),
  h: require("../../assets/images/beispiele/h.jpg"),
};

type DemoInput = Pick<SearchRow, "title" | "offer_type" | "property_type" | "price" | "rooms" | "living_area" | "municipality" | "postal_code"> &
  Partial<Pick<SearchRow, "plot_area" | "status">> & { photos: number[] };

const INPUT: DemoInput[] = [
  { title: "Modernes Einfamilienhaus mit Garten", offer_type: "sale", property_type: "single_family_house", price: 1590000, rooms: 5.5, living_area: 185, municipality: "Muri bei Bern", postal_code: "3074", photos: [photo.a, photo.f, photo.b] },
  { title: "Helle Wohnung nahe am See", offer_type: "rent", property_type: "apartment", price: 2450, rooms: 3.5, living_area: 82, municipality: "Thun", postal_code: "3600", photos: [photo.d, photo.g] },
  { title: "Doppeleinfamilienhaus an ruhiger Lage", offer_type: "sale", property_type: "semi_detached_house", price: 1120000, rooms: 5.5, living_area: 152, municipality: "Burgdorf", postal_code: "3400", photos: [photo.c, photo.a] },
  { title: "Gemütliche Stadtwohnung", offer_type: "rent", property_type: "apartment", price: 1690, rooms: 2.5, living_area: 61, municipality: "Biel/Bienne", postal_code: "2502", status: "reserved", photos: [photo.e, photo.b] },
  { title: "Bauland für ein Einfamilienhaus", offer_type: "sale", property_type: "plot", price: 420000, rooms: null, living_area: null, plot_area: 780, municipality: "Herzogenbuchsee", postal_code: "3360", photos: [photo.h] },
  { title: "Reihenhaus mit Sitzplatz", offer_type: "sale", property_type: "terraced_house", price: 945000, rooms: 4.5, living_area: 128, municipality: "Worb", postal_code: "3076", photos: [photo.f, photo.c] },
  { title: "Grosszügige Attikawohnung", offer_type: "sale", property_type: "apartment", price: 1350000, rooms: 5.5, living_area: 146, municipality: "Bern", postal_code: "3006", photos: [photo.g, photo.d, photo.e] },
  { title: "Familienwohnung mit Balkon", offer_type: "rent", property_type: "apartment", price: 2890, rooms: 4.5, living_area: 104, municipality: "Köniz", postal_code: "3098", photos: [photo.b, photo.e] },
];

const DEMO_ROWS: DemoRow[] = INPUT.map(({ photos, ...input }, i) => ({
  status: "published",
  price_on_request: false,
  additional_costs: null,
  plot_area: null,
  canton: "BE",
  cover_path: null,
  cover_external_url: null,
  total_count: 0,
  ...input,
  id: `beispiel-${i + 1}`,
  slug: null,
  image_count: photos.length,
  demoPhotos: photos,
}));

/**
 * Beispiele zur aktuellen Suche: nur ohne Ort, Suchtext, Filter und eigene Sortierung (dann zählen allein
 * die echten Treffer); die Wahl Kaufen/Mieten wird berücksichtigt.
 */
export function demoRowsFor(filters: SearchFilters): DemoRow[] {
  if (!DEMO_LISTINGS_ENABLED) return [];
  if (filters.query || filters.place || activeFilterCount(filters) > 0 || filters.sort !== "newest") return [];
  return DEMO_ROWS.filter((row) => !filters.offer || row.offer_type === filters.offer);
}

export function showDemoNotice() {
  Alert.alert("Beispielinserat", "Dieses Inserat ist ein Platzhalter für die Vorschau. Es lässt sich nicht öffnen oder merken.");
}
