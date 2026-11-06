import { describe, expect, it } from "vitest";
import {
  clampBbox,
  formatBbox,
  hasLocation,
  pageItems,
  parseBbox,
  patchCriteria,
  searchHref,
  withoutFilters,
  withoutLocation,
} from "@/components/search/url-state";
import { criteriaFromJson, criteriaForStorage, isAlertFrequency } from "@/components/saved-searches/criteria-json";
import { searchCanonical, searchHeading, searchPathForOffer } from "@/lib/seo/search-metadata";

describe("Kartenausschnitt", () => {
  it("liest gültige Ausschnitte [Süd, West, Nord, Ost]", () => {
    expect(parseBbox("46.9,7.3,47.0,7.5")).toEqual([46.9, 7.3, 47.0, 7.5]);
    expect(parseBbox(["46.9, 7.3, 47.0, 7.5"])).toEqual([46.9, 7.3, 47.0, 7.5]);
  });

  it("verwirft ungültige oder vertauschte Werte", () => {
    expect(parseBbox(undefined)).toBeNull();
    expect(parseBbox("46.9,7.3,47.0")).toBeNull();
    expect(parseBbox("47.0,7.3,46.9,7.5")).toBeNull();
    expect(parseBbox("40,7,41,8")).toBeNull();
    expect(parseBbox("46.9,abc,47,7.5")).toBeNull();
  });

  it("formatiert mit vier Nachkommastellen und begrenzt auf die Schweiz", () => {
    expect(formatBbox([46.912345, 7.31, 47, 7.555555])).toBe("46.9123,7.31,47,7.5556");
    expect(clampBbox([44, 4, 49, 12])).toEqual([45.5, 5.5, 48.2, 11]);
  });
});

describe("Suchlinks", () => {
  it("wählt den Pfad nach Angebotsart und lässt den Parameter weg", () => {
    expect(searchPathForOffer("sale")).toBe("/kaufen");
    expect(searchPathForOffer("rent")).toBe("/mieten");
    expect(searchPathForOffer(undefined)).toBe("/immobilien");
    expect(searchHref({ criteria: { offer: "rent", rooms_min: 3 } })).toBe("/mieten?zimmer_von=3");
    expect(searchHref({ criteria: {} })).toBe("/immobilien");
  });

  it("hängt Sortierung, Seite, Ansicht und Ausschnitt an", () => {
    const href = searchHref({ criteria: { offer: "sale" }, sort: "price_asc", page: 2, view: "karte", bbox: [46.9, 7.3, 47, 7.5] });
    const url = new URL(href, "https://immovia.test");
    expect(url.pathname).toBe("/kaufen");
    expect(url.searchParams.get("sortierung")).toBe("price_asc");
    expect(url.searchParams.get("seite")).toBe("2");
    expect(url.searchParams.get("ansicht")).toBe("karte");
    expect(url.searchParams.get("ausschnitt")).toBe("46.9,7.3,47,7.5");
  });

  it("entfernt Ort bzw. Filter gezielt", () => {
    const criteria = { offer: "sale" as const, label: "Bern (BE)", municipality: "Bern", canton: "BE", lat: 46.9, lng: 7.4, radius: 10, rooms_min: 4, garden: true as const };
    expect(withoutLocation(criteria)).toEqual({ offer: "sale", rooms_min: 4, garden: true });
    expect(withoutFilters(criteria)).toEqual({ offer: "sale", label: "Bern (BE)", municipality: "Bern", canton: "BE", lat: 46.9, lng: 7.4, radius: 10 });
    expect(hasLocation(criteria)).toBe(true);
    expect(hasLocation({ offer: "sale" })).toBe(false);
  });

  it("entfernt beim Ändern leere Werte", () => {
    expect(patchCriteria({ types: ["apartment"], price_max: 5 }, { types: [], price_max: undefined, balcony: true })).toEqual({ balcony: true });
  });
});

describe("Seitennavigation", () => {
  it("zeigt bei wenigen Seiten alle Zahlen", () => {
    expect(pageItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });
  it("kürzt lange Listen mit Auslassungen", () => {
    expect(pageItems(1, 20)).toEqual([1, 2, 3, 4, "…", 20]);
    expect(pageItems(10, 20)).toEqual([1, "…", 9, 10, 11, "…", 20]);
    expect(pageItems(20, 20)).toEqual([1, "…", 17, 18, 19, 20]);
  });
});

describe("Gespeicherte Suchkriterien", () => {
  it("liest gültige Felder und verwirft ungültige einzeln", () => {
    expect(criteriaFromJson({ offer: "rent", canton: "XX", price_max: 2000, types: ["apartment"], unbekannt: 1 })).toEqual({
      offer: "rent",
      price_max: 2000,
      types: ["apartment"],
    });
    expect(criteriaFromJson(null)).toEqual({});
    expect(criteriaFromJson(["apartment"])).toEqual({});
  });

  it("speichert nur bereinigte Werte", () => {
    expect(criteriaForStorage({ offer: "sale", q: "", types: [], balcony: true, radius: 999 })).toEqual({ offer: "sale", balcony: true });
  });

  it("erkennt Benachrichtigungs-Häufigkeiten", () => {
    expect(isAlertFrequency("daily")).toBe(true);
    expect(isAlertFrequency("monthly")).toBe(false);
  });
});

describe("Metadaten der Suche", () => {
  it("bildet sprechende Überschriften", () => {
    expect(searchHeading({ offer: "sale", types: ["apartment"], label: "Bern (BE)" }).title).toBe("Wohnungen kaufen in Bern (BE)");
    expect(searchHeading({ offer: "rent", canton: "ZH" }).title).toBe("Immobilien mieten im Kanton Zürich");
    expect(searchHeading({}).title).toBe("Immobilien suchen");
  });

  it("indexiert nur Standort- und Typseiten", () => {
    expect(searchCanonical({ criteria: { offer: "sale", canton: "BE" }, page: 1 })).toEqual({ path: "/kaufen?kanton=BE", indexable: true });
    expect(searchCanonical({ criteria: { offer: "sale", canton: "BE", balcony: true }, page: 1 }).indexable).toBe(false);
    expect(searchCanonical({ criteria: { offer: "rent" }, page: 2 }).indexable).toBe(false);
    expect(searchCanonical({ criteria: {}, page: 1 }, true).indexable).toBe(false);
  });
});
