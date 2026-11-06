import { describe, expect, it } from "vitest";
import { deriveValueFactors, type FactorInput } from "@/lib/valuation/factors";
import { buildValuationReportContent, parseDataQuality, qualityRows } from "@/lib/valuation/view";
import type { Tables } from "@/types/database";

const NOW = new Date("2026-11-06T12:00:00Z");

const base: FactorInput = {
  property_type: "apartment",
  condition: "good",
  heating_type: "gas",
  energy_label: null,
  is_minergie: false,
  has_balcony: true,
  has_terrace: false,
  has_garden: false,
  has_garage: false,
  has_elevator: true,
  is_wheelchair_accessible: false,
  floor: 2,
  floors_total: 4,
  year_built: 2005,
  year_renovated: null,
  garage_spaces: 0,
  underground_parking_spaces: 1,
  outdoor_parking_spaces: 0,
  featureKeys: [],
  renovations: [],
};

describe("Qualitative Wertfaktoren", () => {
  it("erkennt positive Faktoren aus den Objektdaten", () => {
    const { positive, negative } = deriveValueFactors(
      { ...base, energy_label: "A", heating_type: "heat_pump", renovations: [{ year: 2022, category: "kitchen", description: "Neue Küche" }], featureKeys: ["lake_view"] },
      NOW,
    );
    const keys = positive.map((f) => f.key);
    expect(keys).toEqual(expect.arrayContaining(["recent_renovation", "energy_label_good", "modern_heating", "outdoor_space", "elevator", "parking", "view"]));
    expect(positive.find((f) => f.key === "recent_renovation")?.detail).toContain("Küche");
    expect(negative).toHaveLength(0);
  });

  it("erkennt negative Faktoren", () => {
    const { negative } = deriveValueFactors(
      { ...base, condition: "needs_renovation", heating_type: "oil", has_elevator: false, floor: 4, year_built: 1965, energy_label: "G", has_balcony: false },
      NOW,
    );
    expect(negative.map((f) => f.key)).toEqual(
      expect.arrayContaining(["needs_renovation", "oil_heating", "no_elevator", "old_building", "energy_label_poor", "no_outdoor_space"]),
    );
  });

  it("erfindet keine Faktoren ohne Daten", () => {
    const { positive, negative } = deriveValueFactors(
      { ...base, has_balcony: false, has_elevator: false, underground_parking_spaces: 0, heating_type: null, condition: null, year_built: null, floor: null },
      NOW,
    );
    expect(positive).toHaveLength(0);
    expect(negative.map((f) => f.key)).toEqual(["no_outdoor_space"]);
  });
});

describe("Aufbereitung gespeicherter Bewertungen", () => {
  it("liest data_quality tolerant und zeigt bei insufficient_data keine Zahlen", () => {
    const quality = parseDataQuality({ sampleSize: 2, minComparables: 5, missing: ["Zu wenig"], region: "unbekannt" });
    expect(quality.region).toBe("none");
    expect(qualityRows(quality).some((r) => r.value.includes("2 (mindestens 5"))).toBe(true);

    const valuation = {
      id: "v1",
      property_id: "p1",
      requested_by: null,
      status: "insufficient_data",
      method: "m",
      provider: "platform_offers",
      price_basis: "none",
      estimated_value: null,
      value_low: null,
      value_high: null,
      suggested_list_price: null,
      currency: "CHF",
      confidence: "none",
      confidence_explanation: "Keine Schätzung",
      data_quality: { sampleSize: 2, missing: ["Zu wenig"], suggestions: ["Später"] },
      positive_factors: [],
      negative_factors: [],
      explanation: null,
      ai_model: null,
      input_snapshot: {},
      disclaimer: "Ohne Gewähr",
      created_at: "2026-11-06T10:00:00Z",
    } satisfies Tables<"property_valuations">;
    const content = buildValuationReportContent(
      { valuation, sources: [], comparables: [] },
      { property_type: "apartment", offer_type: "sale", rooms: 4.5, postal_code: "3011", municipality: "Bern", internal_name: null },
    );
    expect(content.hasNumbers).toBe(false);
    expect(content.estimatedValue).toBeNull();
    expect(content.missing).toEqual(["Zu wenig"]);
  });
});
