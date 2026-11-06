import { describe, expect, it } from "vitest";
import {
  ASSISTANT_BASE_PROMPT,
  ASSISTANT_CONTEXT_MODULES,
  ASSISTANT_EXAMPLE_QUESTIONS,
  buildAssistantSystemPrompt,
  computeMissingItems,
  type AssistantPropertyContext,
  type MissingItemsInput,
} from "@/lib/ai/prompts/assistant";
import { buildValuationExplanationData, buildValuationExplanationPrompt, numbersAreGrounded } from "@/lib/ai/prompts/valuation";
import { computeOfferEstimate } from "@/lib/valuation/estimate";
import { DEFAULT_VALUATION_PARAMS } from "@/lib/valuation/config";
import { decodeDossierOptions, dossierOptionsSchema, encodeDossierOptions, isSectionEnabled } from "@/lib/pdf/dossier/options";

const property: MissingItemsInput["property"] = {
  property_type: "apartment",
  offer_type: "sale",
  postal_code: "3011",
  municipality: "Bern",
  rooms: 3.5,
  living_area: 80,
  plot_area: null,
  usable_area: null,
  year_built: 1990,
  condition: "good",
  heating_type: "gas",
  energy_label: "C",
  available_from: null,
  available_by_arrangement: true,
  latitude: 46.9,
  longitude: 7.4,
};

describe("KI-Assistent", () => {
  it("bietet die Beispielfragen der Spezifikation an", () => {
    expect(ASSISTANT_EXAMPLE_QUESTIONS).toContain("Welche Angaben fehlen noch?");
    expect(ASSISTANT_EXAMPLE_QUESTIONS).toHaveLength(5);
  });

  it("enthält die Leitplanken (keine Rechts-/Steuerberatung, keine fremden Daten, Unsicherheit)", () => {
    expect(ASSISTANT_BASE_PROMPT).toContain("Keine verbindliche Rechts-, Steuer- oder Finanzberatung");
    expect(ASSISTANT_BASE_PROMPT).toContain("niemals Daten anderer Benutzer");
    expect(ASSISTANT_BASE_PROMPT).toContain("Unsicherheiten transparent");
    expect(ASSISTANT_BASE_PROMPT).toContain("nie «ß»");
  });

  it("ermittelt fehlende Angaben deterministisch", () => {
    const complete = computeMissingItems({
      property,
      listing: { title: "T", description: "D", price: 800000, priceOnRequest: false, textsConfirmed: true, hasContact: true },
      imageCount: 8,
      floorPlanCount: 1,
    });
    expect(complete).toEqual([]);
    const missing = computeMissingItems({
      property: { ...property, living_area: null, latitude: null, energy_label: null },
      listing: null,
      imageCount: 2,
      floorPlanCount: 0,
    });
    expect(missing).toEqual(
      expect.arrayContaining(["Wohnfläche", "Grundriss", "Inserat mit Titel, Beschreibung und Preis", "Weitere Fotos (aktuell 2, empfohlen sind mindestens 5)"]),
    );
  });

  it("baut den Systemprompt nur aus dem übergebenen Kontext", () => {
    const context: AssistantPropertyContext = {
      label: "Wohnung in Bern",
      facts: { Objektart: "Wohnung", Ort: "3011 Bern" },
      listing: null,
      imageCount: 3,
      floorPlanCount: 0,
      documentCategories: [],
      latestValuation: null,
      dossierVersions: 0,
      missing: ["Grundriss"],
    };
    const prompt = buildAssistantSystemPrompt(context, new Date("2026-11-06T10:00:00Z"));
    expect(prompt).toContain("Wohnung in Bern");
    expect(prompt).toContain("3011 Bern");
    expect(prompt).toContain("- Grundriss");
    expect(prompt).toContain("Inserat: noch nicht angelegt.");
    expect(ASSISTANT_CONTEXT_MODULES.map((m) => m.id)).toEqual(["property", "listing", "media", "missing"]);
    expect(buildAssistantSystemPrompt(null)).toContain("keine Immobilie ausgewählt");
  });
});

describe("KI-Erklärung der Bewertung", () => {
  const estimate = computeOfferEstimate(
    {
      propertyId: "p",
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
    },
    [900_000, 950_000, 1_000_000, 1_050_000, 1_100_000].map((price, i) => ({
      listingId: `l${i}`,
      propertyId: `x${i}`,
      propertyType: "apartment" as const,
      offerType: "sale" as const,
      price,
      livingArea: 100,
      usableArea: null,
      plotArea: null,
      rooms: 4.5,
      municipality: "Bern",
      postalCode: "3012",
      canton: "BE",
      latitude: 46.95,
      longitude: 7.45,
      publishedAt: "2026-10-01T00:00:00Z",
      isDemo: false,
    })),
    DEFAULT_VALUATION_PARAMS,
    new Date("2026-11-06T12:00:00Z"),
  );
  const input = { estimate, offerType: "sale" as const, propertyType: "apartment" as const, area: 100, canton: "BE", positive: [], negative: [] };

  it("übergibt nur berechnete Daten", () => {
    const data = buildValuationExplanationData(input);
    expect(data.Schätzung).toMatch(/^CHF 1.000.000$/);
    expect(data["Anzahl Vergleichsangebote"]).toBe(5);
    expect(buildValuationExplanationPrompt(input)).toContain("DATEN (JSON)");
  });

  it("verwirft Erklärungen mit erfundenen Zahlen", () => {
    const source = JSON.stringify(buildValuationExplanationData(input));
    expect(numbersAreGrounded("Die Schätzung von CHF 1’000’000 beruht auf 5 Angeboten.", source)).toBe(true);
    expect(numbersAreGrounded("Vergleichbare Wohnungen wurden für CHF 1’230’000 verkauft.", source)).toBe(false);
    expect(numbersAreGrounded("Im Jahr 2019 stiegen die Preise um 7 %.", source)).toBe(false);
  });
});

describe("Dossier-Optionen", () => {
  it("kodiert und dekodiert Optionen für den Vorschau-Link (inkl. Umlaute)", () => {
    const options = dossierOptionsSchema.parse({ templateId: "premium", sections: { gallery: false }, title: "Schöne Aussicht über Zürich" });
    const decoded = decodeDossierOptions(encodeDossierOptions(options));
    expect(decoded).toEqual(options);
    expect(decoded && isSectionEnabled(decoded, "gallery")).toBe(false);
    expect(decoded && isSectionEnabled(decoded, "description")).toBe(true);
  });

  it("weist ungültige Werte zurück", () => {
    expect(decodeDossierOptions("kaputt")).toBeNull();
    expect(decodeDossierOptions(null)).toBeNull();
    expect(dossierOptionsSchema.safeParse({ templateId: "bunt" }).success).toBe(false);
    expect(dossierOptionsSchema.safeParse({ contact: { email: "keine-mail" } }).success).toBe(false);
  });
});
