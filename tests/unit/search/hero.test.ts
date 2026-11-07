import { describe, expect, it } from "vitest";
import { HERO_PRICE_OPTIONS, HERO_TYPE_GROUPS, heroSearchCriteria, heroSearchHref, type HeroSearchInput } from "@/lib/search/hero";
import { parseSearchParams } from "@/lib/search/criteria";

const empty: HeroSearchInput = { offer: "sale", place: "", location: {}, typeGroup: "", priceMax: "", roomsMin: "" };

describe("Schnellsuche der Startseite", () => {
  it("ohne Angaben führt zur passenden Angebotsseite", () => {
    expect(heroSearchHref(empty)).toBe("/kaufen");
    expect(heroSearchHref({ ...empty, offer: "rent" })).toBe("/mieten");
  });

  it("überträgt Objektart, Preis und Zimmer in dieselben Parameter wie die Suchseite", () => {
    const href = heroSearchHref({ ...empty, offer: "rent", typeGroup: "wohnung", priceMax: "2500", roomsMin: "3.5" });
    const url = new URL(href, "https://immovia.ch");
    expect(url.pathname).toBe("/mieten");
    const parsed = parseSearchParams(url.searchParams, { offer: "rent" });
    expect(parsed.criteria).toMatchObject({ offer: "rent", types: ["apartment"], price_max: 2500, rooms_min: 3.5 });
  });

  it("Gruppe «Haus» sucht nach allen Hausarten", () => {
    const criteria = heroSearchCriteria({ ...empty, typeGroup: "haus" });
    expect(criteria.types).toEqual(["single_family_house", "semi_detached_house", "terraced_house", "multi_family_house"]);
    expect(HERO_TYPE_GROUPS.map((g) => g.label)).toEqual(["Wohnung", "Haus", "Grundstück", "Gewerbe und Büro", "Neubauprojekt"]);
  });

  it("Ortstreffer mit Koordinaten erhält 10 km Umkreis, Freitext wird zur Volltextsuche", () => {
    const selected = heroSearchCriteria({
      ...empty,
      place: "Bern (BE)",
      location: { label: "Bern (BE)", municipality: "Bern", canton: undefined, lat: 46.95, lng: 7.44 },
    });
    expect(selected).toMatchObject({ municipality: "Bern", lat: 46.95, lng: 7.44, radius: 10 });

    // Text nach der Auswahl geändert: kein veralteter Treffer, sondern Freitext
    const edited = heroSearchCriteria({ ...empty, place: "Bern West", location: { label: "Bern (BE)", lat: 46.95, lng: 7.44 } });
    expect(edited).toMatchObject({ q: "Bern West", label: "Bern West" });
    expect(edited.lat).toBeUndefined();
  });

  it("öffnet auf Wunsch das Filter-Panel der Suchseite", () => {
    expect(heroSearchHref({ ...empty, roomsMin: "4" }, { openFilters: true })).toBe("/kaufen?zimmer_von=4#filter");
  });

  it("Preisoptionen unterscheiden Kaufpreis und Monatsmiete", () => {
    expect(Math.max(...HERO_PRICE_OPTIONS.rent)).toBeLessThan(Math.min(...HERO_PRICE_OPTIONS.sale));
  });
});
