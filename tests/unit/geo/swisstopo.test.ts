import { describe, expect, it } from "vitest";
import { parseSearchResult, stripTags } from "@/lib/geo/swisstopo";

const BERN = { lat: 46.9481, lon: 7.4474 };

describe("stripTags", () => {
  it("entfernt HTML und überzählige Leerzeichen", () => {
    expect(stripTags("<b>Bern</b>   (BE)")).toBe("Bern (BE)");
    expect(stripTags("Bundesplatz 3 <b>3005 Bern</b>")).toBe("Bundesplatz 3 3005 Bern");
  });
});

describe("parseSearchResult", () => {
  it("liest Gemeinden (gg25) mit Kanton im Label", () => {
    const result = parseSearchResult({ origin: "gg25", label: "<b>Bern</b> (BE)", ...BERN }, 351);
    expect(result).toEqual({
      id: "351",
      kind: "municipality",
      label: "Bern (BE)",
      municipality: "Bern",
      canton: "BE",
      lat: BERN.lat,
      lng: BERN.lon,
    });
  });

  it("ermittelt den Kanton einer Gemeinde aus dem Detailtext", () => {
    const result = parseSearchResult({ origin: "gg25", label: "<b>Muri bei Bern</b>", detail: "muri bei bern be", lat: 46.93, lon: 7.49 }, "356");
    expect(result?.kind).toBe("municipality");
    expect(result?.municipality).toBe("Muri bei Bern");
    expect(result?.canton).toBe("BE");
    expect(result?.label).toBe("Muri bei Bern (BE)");
  });

  it("liest Postleitzahlen (zipcode)", () => {
    const result = parseSearchResult({ origin: "zipcode", label: "<b>3011 - Bern</b>", detail: "3011 bern 351 bern ch be", ...BERN }, "z1");
    expect(result).toMatchObject({ kind: "postal_code", label: "3011 Bern", postalCode: "3011", municipality: "Bern", canton: "BE" });
  });

  it("entfernt den Kanton aus dem Ortsnamen einer PLZ", () => {
    const result = parseSearchResult({ origin: "zipcode", label: "<b>8004 Zürich (ZH)</b>", lat: 47.37, lon: 8.52 }, "z2");
    expect(result).toMatchObject({ postalCode: "8004", municipality: "Zürich", canton: "ZH", label: "8004 Zürich" });
  });

  it("verwirft PLZ-Treffer ohne gültige Postleitzahl", () => {
    expect(parseSearchResult({ origin: "zipcode", label: "<b>Bern</b>", ...BERN }, "z3")).toBeNull();
  });

  it("liest Kantone (kantone) über Namen und Kürzel", () => {
    expect(parseSearchResult({ origin: "kantone", label: "<b>Bern</b>", ...BERN }, "k1")).toMatchObject({
      kind: "canton",
      label: "Kanton Bern",
      canton: "BE",
    });
    expect(parseSearchResult({ origin: "kantone", label: "Kanton Zürich", lat: 47.4, lon: 8.6 }, "k2")).toMatchObject({
      label: "Kanton Zürich",
      canton: "ZH",
    });
    expect(parseSearchResult({ origin: "kantone", label: "<b>GR</b>", lat: 46.7, lon: 9.6 }, "k3")?.canton).toBe("GR");
  });

  it("verwirft unbekannte Kantone", () => {
    expect(parseSearchResult({ origin: "kantone", label: "Atlantis", ...BERN }, "k4")).toBeNull();
  });

  it("zerlegt Adressen (address) in Strasse, Hausnummer, PLZ und Ort", () => {
    const result = parseSearchResult(
      {
        origin: "address",
        label: "Bundesplatz 3 <b>3005 Bern</b>",
        detail: "bundesplatz 3 3005 bern 351 bern ch be",
        featureId: "1013542_0",
        lat: 46.9466,
        lon: 7.4442,
      },
      "a1",
    );
    expect(result).toEqual({
      id: "a1",
      kind: "address",
      label: "Bundesplatz 3 3005 Bern",
      street: "Bundesplatz",
      houseNumber: "3",
      postalCode: "3005",
      municipality: "Bern",
      canton: "BE",
      egid: 1013542,
      lat: 46.9466,
      lng: 7.4442,
    });
  });

  it("liest Adressen mit Zusatz zur Hausnummer und ohne Hausnummer", () => {
    expect(parseSearchResult({ origin: "address", label: "Seestrasse 12a <b>6006 Luzern</b>", lat: 47.05, lon: 8.32 }, "a2")).toMatchObject({
      street: "Seestrasse",
      houseNumber: "12a",
      postalCode: "6006",
      municipality: "Luzern",
    });
    const withoutNumber = parseSearchResult({ origin: "address", label: "Dorfstrasse <b>3000 Bern</b>", ...BERN }, "a3");
    expect(withoutNumber?.street).toBe("Dorfstrasse");
    expect(withoutNumber?.houseNumber).toBeUndefined();
    expect(withoutNumber?.postalCode).toBe("3000");
  });

  it("verwirft Treffer ohne Koordinaten, ohne Label oder mit unbekannter Herkunft", () => {
    expect(parseSearchResult({ origin: "gg25", label: "Bern (BE)" }, 1)).toBeNull();
    expect(parseSearchResult({ origin: "gg25", lat: 46.9, lon: 7.4 }, 2)).toBeNull();
    expect(parseSearchResult({ origin: "parcel", label: "Parzelle 1", ...BERN }, 3)).toBeNull();
  });

  it("liest Bezirke (district) mit Kanton aus dem Detailtext", () => {
    expect(parseSearchResult({ origin: "district", label: "<b>Bern-Mittelland</b>", detail: "bern-mittelland be", ...BERN }, "d1")).toMatchObject({
      kind: "district",
      label: "Bern-Mittelland",
      canton: "BE",
    });
  });
});
