import { describe, expect, it } from "vitest";
import {
  confidenceFor,
  listPriceStep,
  median,
  quantile,
  quartileDispersion,
  quartiles,
  roundEstimate,
  roundListPrice,
} from "@/lib/valuation/stats";
import { haversineKm } from "@/lib/valuation/geo";

describe("Statistik der Vergleichsbewertung", () => {
  it("berechnet Median für gerade und ungerade Anzahl", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([10])).toBe(10);
  });

  it("berechnet Quantile mit linearer Interpolation (Typ 7)", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(quantile(values, 0.25)).toBeCloseTo(3.25, 10);
    expect(quantile(values, 0.75)).toBeCloseTo(7.75, 10);
    expect(quantile(values, 0)).toBe(1);
    expect(quantile(values, 1)).toBe(10);
    expect(quartiles([8000, 9000, 10000, 11000, 12000])).toEqual({ p25: 9000, median: 10000, p75: 11000 });
  });

  it("wirft bei leerer Liste statt eine Zahl zu erfinden", () => {
    expect(() => median([])).toThrow();
  });

  it("berechnet die Quartilsdispersion", () => {
    expect(quartileDispersion(9000, 11000)).toBeCloseTo(0.1, 10);
    expect(quartileDispersion(10000, 10000)).toBe(0);
  });

  it("rundet Schätzwerte und Inseratepreise nachvollziehbar", () => {
    expect(roundEstimate(764_321, "sale")).toBe(764_000);
    expect(roundEstimate(2_345.6, "rent")).toBe(2_350);
    expect(listPriceStep(1_250_000, "sale")).toBe(10_000);
    expect(listPriceStep(764_000, "sale")).toBe(5_000);
    expect(listPriceStep(250_000, "sale")).toBe(1_000);
    expect(roundListPrice(764_000, "sale")).toBe(765_000);
    expect(roundListPrice(2_345, "rent")).toBe(2_350);
  });

  it("vergibt höchstens den Vertrauensgrad «mittel»", () => {
    expect(confidenceFor({ sampleSize: 40, dispersion: 0.05, region: "radius", minComparables: 5 })).toBe("medium");
    expect(confidenceFor({ sampleSize: 40, dispersion: 0.05, region: "canton", minComparables: 5 })).toBe("low");
    expect(confidenceFor({ sampleSize: 6, dispersion: 0.05, region: "radius", minComparables: 5 })).toBe("low");
    expect(confidenceFor({ sampleSize: 40, dispersion: 0.3, region: "radius", minComparables: 5 })).toBe("low");
  });

  it("berechnet Distanzen (Bern–Zürich ca. 95 km)", () => {
    expect(haversineKm(46.948, 7.4474, 47.3769, 8.5417)).toBeGreaterThan(90);
    expect(haversineKm(46.948, 7.4474, 47.3769, 8.5417)).toBeLessThan(100);
    expect(haversineKm(47, 8, 47, 8)).toBe(0);
  });
});
