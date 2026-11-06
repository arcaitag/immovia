import { describe, expect, it } from "vitest";
import { computeOfferEstimate, MAX_STORED_COMPARABLES } from "@/lib/valuation/estimate";
import { selectComparables } from "@/lib/valuation/comparables";
import { DEFAULT_VALUATION_PARAMS, parseValuationParams } from "@/lib/valuation/config";
import { checkValuationPrerequisites } from "@/lib/valuation/prerequisites";
import type { OfferCandidate, ValuationSubject } from "@/lib/valuation/types";

const NOW = new Date("2026-11-06T12:00:00Z");

const subject: ValuationSubject = {
  propertyId: "00000000-0000-4000-8000-000000000001",
  propertyType: "apartment",
  offerType: "sale",
  livingArea: 100,
  usableArea: null,
  plotArea: null,
  rooms: 4.5,
  latitude: 46.948,
  longitude: 7.4474,
  canton: "BE",
  municipality: "Bern",
  postalCode: "3011",
};

let counter = 0;
function candidate(overrides: Partial<OfferCandidate> = {}): OfferCandidate {
  counter++;
  return {
    listingId: `00000000-0000-4000-8000-${String(1000 + counter).padStart(12, "0")}`,
    propertyId: `10000000-0000-4000-8000-${String(1000 + counter).padStart(12, "0")}`,
    propertyType: "apartment",
    offerType: "sale",
    price: 1_000_000,
    livingArea: 100,
    usableArea: null,
    plotArea: null,
    rooms: 4.5,
    municipality: "Bern",
    postalCode: "3012",
    canton: "BE",
    latitude: 46.95,
    longitude: 7.45,
    publishedAt: "2026-09-01T10:00:00Z",
    isDemo: false,
    ...overrides,
  };
}

describe("Vergleichsbewertung mit Angebotspreisen", () => {
  it("liefert insufficient_data OHNE Zahlen bei zu wenigen Vergleichsobjekten", () => {
    const result = computeOfferEstimate(subject, [candidate(), candidate(), candidate()], DEFAULT_VALUATION_PARAMS, NOW);
    expect(result.status).toBe("insufficient_data");
    expect(result.estimatedValue).toBeNull();
    expect(result.valueLow).toBeNull();
    expect(result.valueHigh).toBeNull();
    expect(result.suggestedListPrice).toBeNull();
    expect(result.confidence).toBe("none");
    expect(result.priceBasis).toBe("none");
    expect(result.comparables).toHaveLength(0);
    expect(result.missing.join(" ")).toContain("nur 3 vergleichbare Angebote");
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it("berechnet Median × Fläche und P25–P75 als Spanne", () => {
    const prices = [900_000, 950_000, 1_000_000, 1_050_000, 1_100_000];
    const result = computeOfferEstimate(subject, prices.map((price) => candidate({ price })), DEFAULT_VALUATION_PARAMS, NOW);
    expect(result.status).toBe("completed");
    expect(result.priceBasis).toBe("offer_prices");
    expect(result.estimatedValue).toBe(1_000_000);
    expect(result.valueLow).toBe(950_000);
    expect(result.valueHigh).toBe(1_050_000);
    expect(result.suggestedListPrice).toBe(1_000_000);
    expect(result.confidence).toBe("low");
    expect(result.dataQuality.sampleSize).toBe(5);
    expect(result.dataQuality.region).toBe("radius");
    expect(result.confidenceExplanation).toContain("höchstens «mittel»");
  });

  it("schliesst Demo-Inserate, das eigene Objekt, andere Objektarten, Flächen ausserhalb der Toleranz und alte Inserate aus", () => {
    const valid = [1, 2, 3, 4, 5].map(() => candidate());
    const invalid = [
      candidate({ isDemo: true }),
      candidate({ propertyId: subject.propertyId }),
      candidate({ propertyType: "single_family_house" }),
      candidate({ offerType: "rent", price: 2500 }),
      candidate({ livingArea: 200 }),
      candidate({ publishedAt: "2024-01-01T00:00:00Z" }),
      candidate({ latitude: 47.3769, longitude: 8.5417, canton: "ZH" }),
    ];
    const selection = selectComparables(subject, [...valid, ...invalid], {
      group: "apartment",
      params: DEFAULT_VALUATION_PARAMS,
      region: "radius",
      now: NOW,
    });
    expect(selection.comparables).toHaveLength(5);
    expect(selection.comparables.every((c) => valid.some((v) => v.listingId === c.listingId))).toBe(true);
  });

  it("verwirft unplausible Preise (z. B. fehlende Nullen)", () => {
    const list = [1, 2, 3, 4, 5].map(() => candidate());
    const result = computeOfferEstimate(subject, [...list, candidate({ price: 1250 })], DEFAULT_VALUATION_PARAMS, NOW);
    expect(result.dataQuality.sampleSize).toBe(5);
    expect(result.dataQuality.notes.join(" ")).toContain("unplausibler");
  });

  it("weicht bei zu wenigen Angeboten im Umkreis auf den Kanton aus (eingeschränkt, Vertrauen tief)", () => {
    const far = [1, 2, 3, 4, 5].map(() => candidate({ latitude: 46.75, longitude: 7.62, municipality: "Thun", canton: "BE" }));
    const result = computeOfferEstimate(subject, far, DEFAULT_VALUATION_PARAMS, NOW);
    expect(result.status).toBe("limited");
    expect(result.dataQuality.region).toBe("canton");
    expect(result.confidence).toBe("low");
    expect(result.estimatedValue).not.toBeNull();
  });

  it("vergleicht Mietobjekte mit Monatsmieten", () => {
    const rentSubject: ValuationSubject = { ...subject, offerType: "rent" };
    const rents = [2400, 2500, 2600, 2700, 2800].map((price) => candidate({ offerType: "rent", price }));
    const result = computeOfferEstimate(rentSubject, rents, DEFAULT_VALUATION_PARAMS, NOW);
    expect(result.status).toBe("completed");
    expect(result.estimatedValue).toBe(2600);
    expect(result.summary).toContain("pro m² und Monat");
  });

  it("liefert keine Zahl ohne Fläche oder für nicht vergleichbare Objektarten", () => {
    const many = Array.from({ length: 10 }, () => candidate());
    const noArea = computeOfferEstimate({ ...subject, livingArea: null }, many, DEFAULT_VALUATION_PARAMS, NOW);
    expect(noArea.status).toBe("insufficient_data");
    expect(noArea.estimatedValue).toBeNull();
    const project = computeOfferEstimate({ ...subject, propertyType: "new_build_project" }, many, DEFAULT_VALUATION_PARAMS, NOW);
    expect(project.status).toBe("insufficient_data");
    expect(project.estimatedValue).toBeNull();
  });

  it("speichert höchstens die ähnlichsten Vergleichsobjekte", () => {
    const many = Array.from({ length: 40 }, (_, i) => candidate({ price: 900_000 + i * 5_000 }));
    const result = computeOfferEstimate(subject, many, DEFAULT_VALUATION_PARAMS, NOW);
    expect(result.comparables.length).toBe(MAX_STORED_COMPARABLES);
    expect(result.dataQuality.sampleSize).toBe(40);
    expect(result.confidence).toBe("medium");
  });

  it("begrenzt Parameter auf sichere Werte (nie unter 3 Vergleichsobjekten)", () => {
    expect(parseValuationParams({ min_comparables: 1 }).min_comparables).toBe(3);
    expect(parseValuationParams({ radius_km: "abc" }).radius_km).toBe(15);
    expect(parseValuationParams(null)).toEqual(DEFAULT_VALUATION_PARAMS);
  });

  it("prüft die Voraussetzungen", () => {
    expect(checkValuationPrerequisites(subject).ready).toBe(true);
    expect(checkValuationPrerequisites({ ...subject, livingArea: null }).ready).toBe(false);
    const noCoords = checkValuationPrerequisites({ ...subject, latitude: null, longitude: null });
    expect(noCoords.ready).toBe(true);
    expect(noCoords.items.find((i) => i.key === "location")?.ok).toBe(false);
    expect(checkValuationPrerequisites({ ...subject, latitude: null, longitude: null, canton: null }).ready).toBe(false);
  });
});
