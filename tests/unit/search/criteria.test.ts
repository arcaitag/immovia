import { describe, expect, it } from "vitest";
import {
  PAGE_SIZE,
  countActiveFilters,
  describeCriteria,
  parseSearchParams,
  toRpcArgs,
  toSavedCriteria,
  toSearchParams,
  type SearchCriteria,
} from "@/lib/search/criteria";

describe("parseSearchParams", () => {
  it("liest gültige Parameter aus URLSearchParams", () => {
    const state = parseSearchParams(
      new URLSearchParams(
        "angebot=sale&typ=apartment,single_family_house&kanton=BE&plz=3011&preis_bis=800000&zimmer_von=3.5&balkon=1&sortierung=price_asc&seite=3&ansicht=kombi",
      ),
    );
    expect(state.criteria).toEqual({
      offer: "sale",
      types: ["apartment", "single_family_house"],
      canton: "BE",
      postal_code: "3011",
      price_max: 800000,
      rooms_min: 3.5,
      balcony: true,
    });
    expect(state.sort).toBe("price_asc");
    expect(state.page).toBe(3);
    expect(state.view).toBe("kombi");
  });

  it("liest Next.js-searchParams (Record) inkl. wiederholter Parameter", () => {
    const state = parseSearchParams({ typ: ["apartment", "plot"], ort: "Bern (BE)", lat: "46.948", lng: "7.447", umkreis: "10" });
    expect(state.criteria.types).toEqual(["apartment", "plot"]);
    expect(state.criteria.label).toBe("Bern (BE)");
    expect(state.criteria.lat).toBeCloseTo(46.948);
    expect(state.criteria.lng).toBeCloseTo(7.447);
    expect(state.criteria.radius).toBe(10);
  });

  it("übernimmt deutsche Angebotsbezeichnungen", () => {
    expect(parseSearchParams({ angebot: "kaufen" }).criteria.offer).toBe("sale");
    expect(parseSearchParams({ angebot: "mieten" }).criteria.offer).toBe("rent");
  });

  it("akzeptiert Schweizer Tausendertrennzeichen in Zahlen", () => {
    expect(parseSearchParams({ preis_von: "500'000", preis_bis: "1’200’000" }).criteria).toMatchObject({
      price_min: 500000,
      price_max: 1200000,
    });
  });

  it("verwirft ungültige Werte, statt einen Fehler zu werfen", () => {
    const state = parseSearchParams({
      angebot: "tauschen",
      typ: "apartment,schloss",
      kanton: "XY",
      plz: "0123",
      lat: "52.5",
      lng: "abc",
      umkreis: "500",
      preis_von: "-10",
      preis_bis: "viel",
      zustand: "kaputt",
      balkon: "0",
      sortierung: "zufall",
      seite: "-2",
      ansicht: "galerie",
    });
    expect(state.criteria).toEqual({});
    expect(state.sort).toBe("newest");
    expect(state.page).toBe(1);
    expect(state.view).toBe("liste");
  });

  it("verwendet Standardwerte (z. B. Angebot der Route) und lässt die URL sie überschreiben", () => {
    expect(parseSearchParams({}, { offer: "rent" }).criteria.offer).toBe("rent");
    expect(parseSearchParams({ angebot: "sale" }, { offer: "rent" }).criteria.offer).toBe("sale");
  });

  it("begrenzt Seitenzahlen auf sinnvolle Werte", () => {
    expect(parseSearchParams({ seite: "2.5" }).page).toBe(1);
    expect(parseSearchParams({ seite: "0" }).page).toBe(1);
    expect(parseSearchParams({ seite: "1000" }).page).toBe(1);
    expect(parseSearchParams({ seite: "999" }).page).toBe(999);
  });
});

describe("toSearchParams", () => {
  const criteria: SearchCriteria = {
    offer: "rent",
    types: ["apartment"],
    label: "Zürich (ZH)",
    municipality: "Zürich",
    canton: "ZH",
    price_max: 2500,
    rooms_min: 2.5,
    pets: true,
  };

  it("erzeugt kurze deutsche Parameter", () => {
    const params = toSearchParams({ criteria, sort: "price_asc", page: 2, view: "karte" });
    expect(params.get("angebot")).toBe("rent");
    expect(params.get("typ")).toBe("apartment");
    expect(params.get("ort")).toBe("Zürich (ZH)");
    expect(params.get("gemeinde")).toBe("Zürich");
    expect(params.get("kanton")).toBe("ZH");
    expect(params.get("preis_bis")).toBe("2500");
    expect(params.get("zimmer_von")).toBe("2.5");
    expect(params.get("haustiere")).toBe("1");
    expect(params.get("sortierung")).toBe("price_asc");
    expect(params.get("seite")).toBe("2");
    expect(params.get("ansicht")).toBe("karte");
  });

  it("lässt Standardwerte und auf Wunsch die Angebotsart weg", () => {
    const params = toSearchParams({ criteria: { offer: "sale" }, sort: "newest", page: 1, view: "liste" }, { omitOffer: true });
    expect(params.toString()).toBe("");
  });

  it("ist mit parseSearchParams umkehrbar", () => {
    const params = toSearchParams({ criteria: { ...criteria, conditions: ["new_build", "as_new"] }, sort: "area_desc", page: 4 });
    const parsed = parseSearchParams(params);
    expect(parsed.criteria).toEqual({ ...criteria, conditions: ["new_build", "as_new"] });
    expect(parsed.sort).toBe("area_desc");
    expect(parsed.page).toBe(4);
  });
});

describe("toRpcArgs", () => {
  it("bildet Kriterien auf die Argumente von search_listings ab und lässt leere Werte weg", () => {
    const args = toRpcArgs(
      { offer: "sale", types: ["apartment"], canton: "BE", price_max: 900000, garden: true },
      { sort: "price_desc", limit: PAGE_SIZE, offset: 24 },
    );
    expect(args).toEqual({
      p_offer_type: "sale",
      p_property_types: ["apartment"],
      p_canton: "BE",
      p_price_max: 900000,
      p_garden: true,
      p_sort: "price_desc",
      p_limit: PAGE_SIZE,
      p_offset: 24,
    });
  });

  it("verwendet bei Umkreissuche Koordinaten statt Gemeinde und PLZ", () => {
    const args = toRpcArgs({ municipality: "Bern", postal_code: "3011", lat: 46.95, lng: 7.44, radius: 10, q: "Bern" }, { sort: "distance" });
    expect(args.p_municipality).toBeUndefined();
    expect(args.p_postal_code).toBeUndefined();
    expect(args.p_query).toBeUndefined();
    expect(args.p_lat).toBe(46.95);
    expect(args.p_lng).toBe(7.44);
    expect(args.p_radius_km).toBe(10);
    expect(args.p_sort).toBe("distance");
  });

  it("sucht ohne Umkreis nach Gemeinde und fällt bei Sortierung nach Distanz auf «neueste» zurück", () => {
    const args = toRpcArgs({ municipality: "Thun", lat: 46.75, lng: 7.62 }, { sort: "distance" });
    expect(args.p_municipality).toBe("Thun");
    expect(args.p_radius_km).toBeUndefined();
    expect(args.p_sort).toBe("newest");
  });

  it("nutzt Freitext nur ohne strukturierte Ortsangabe", () => {
    expect(toRpcArgs({ q: "Seesicht" }).p_query).toBe("Seesicht");
    expect(toRpcArgs({ q: "Seesicht", canton: "LU" }).p_query).toBeUndefined();
  });

  it("übergibt einen Kartenausschnitt", () => {
    expect(toRpcArgs({}, { bbox: [46.9, 7.3, 47.0, 7.5] }).p_bbox).toEqual([46.9, 7.3, 47.0, 7.5]);
  });

  it("lässt leere Listen weg", () => {
    const args = toRpcArgs({ types: [], conditions: [] });
    expect(args).not.toHaveProperty("p_property_types");
    expect(args).not.toHaveProperty("p_conditions");
  });
});

describe("toSavedCriteria, describeCriteria und countActiveFilters", () => {
  it("speichert nur gesetzte Werte", () => {
    expect(toSavedCriteria({ offer: "sale", types: [], q: "", price_max: 500000, balcony: undefined })).toEqual({
      offer: "sale",
      price_max: 500000,
    });
  });

  it("beschreibt Kriterien lesbar", () => {
    const text = describeCriteria({ offer: "sale", types: ["apartment"], label: "Bern (BE)", radius: 10, rooms_min: 3.5, price_max: 800000 });
    expect(text).toMatch(/^Wohnungen zum Kaufen · in Bern \(BE\) \(\+10 km\) · ab 3\.5 Zimmer · bis CHF 800.000$/);
    expect(describeCriteria({})).toBe("Immobilien");
    expect(describeCriteria({ canton: "GR", offer: "rent" })).toBe("Immobilien zum Mieten · in Kanton GR");
  });

  it("zählt Filter ohne Ort und Angebotsart", () => {
    expect(countActiveFilters({ offer: "sale", municipality: "Bern", label: "Bern (BE)" })).toBe(0);
    expect(countActiveFilters({ types: ["apartment"], price_max: 1, balcony: true })).toBe(3);
  });
});
