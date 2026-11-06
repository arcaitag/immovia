import { describe, expect, it } from "vitest";
import { parseSearchParams } from "@/lib/search/criteria";

describe("parseSearchParams – Kommas", () => {
  it("behält Freitext mit Komma vollständig", () => {
    const state = parseSearchParams(new URLSearchParams({ ort: "Bern, Länggasse", q: "Attika, Seesicht" }));
    expect(state.criteria.label).toBe("Bern, Länggasse");
    expect(state.criteria.q).toBe("Attika, Seesicht");
  });

  it("trennt Listenparameter weiterhin an Kommas", () => {
    const state = parseSearchParams(new URLSearchParams({ typ: "apartment,single_family_house" }));
    expect(state.criteria.types).toEqual(["apartment", "single_family_house"]);
  });

  it("verarbeitet Objekt-Parameter wie von Next.js geliefert", () => {
    const state = parseSearchParams({ ort: "Zürich, Kreis 4", typ: ["apartment", "office"] });
    expect(state.criteria.label).toBe("Zürich, Kreis 4");
    expect(state.criteria.types).toEqual(["apartment", "office"]);
  });
});
