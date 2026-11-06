import { describe, expect, it } from "vitest";
import { buildPropertyFacts, equipmentLabels, hasLocationDetails, type PropertyRow } from "@/lib/ai/property-facts";
import {
  DESCRIPTION_SECTIONS,
  DESCRIPTION_SYSTEM_PROMPT,
  buildDescriptionPrompt,
  buildRephrasePrompt,
  parseStoredDescription,
} from "@/lib/ai/prompts/description";

const minimal: PropertyRow = {
  property_type: "apartment",
  offer_type: "sale",
  postal_code: "3011",
  municipality: "Bern",
  canton: "BE",
  rooms: 3.5,
  living_area: 82,
  gross_living_area: null,
  usable_area: null,
  plot_area: null,
  year_built: null,
  year_renovated: null,
  floor: null,
  floors_total: null,
  bathrooms: null,
  condition: null,
  heating_type: null,
  energy_label: null,
  energy_demand_kwh: null,
  has_balcony: false,
  has_terrace: false,
  has_garden: false,
  has_garage: false,
  has_elevator: false,
  has_cellar: false,
  has_attic: false,
  is_wheelchair_accessible: false,
  is_minergie: false,
  pets_allowed: null,
  garage_spaces: 0,
  underground_parking_spaces: 0,
  outdoor_parking_spaces: 0,
  available_from: null,
  available_by_arrangement: false,
  service_charges: null,
  ownership_type: null,
  special_features: null,
  view_description: null,
};

describe("Prompt-Builder für Inseratetexte", () => {
  it("übergibt nur vorhandene Felder", () => {
    const facts = buildPropertyFacts({ property: minimal, featureKeys: [], renovations: [] });
    expect(facts).toEqual({
      Angebot: "Verkauf",
      Objektart: "Wohnung",
      Ort: "3011 Bern",
      Kanton: "Bern",
      Zimmer: "3.5",
      Wohnfläche: "82 m²",
    });
    const prompt = buildDescriptionPrompt({ property: minimal, featureKeys: [], renovations: [] }, "factual");
    for (const absent of ["Baujahr", "Renovationen", "Ausstattung", "Heizung", "Lagemerkmale", "Parkplätze", "Aussicht", "Energie"]) {
      expect(prompt).not.toContain(`"${absent}`);
    }
  });

  it("verlangt einen leeren Lagetext, wenn ausser dem Ort keine Lageangaben vorhanden sind", () => {
    const input = { property: minimal, featureKeys: [], renovations: [] };
    expect(hasLocationDetails(input)).toBe(false);
    expect(buildDescriptionPrompt(input, "modern")).toContain("Lassen Sie das Feld «location» leer");
    const withView = { property: { ...minimal, view_description: "Blick auf die Alpen" }, featureKeys: ["near_public_transport"], renovations: [] };
    expect(hasLocationDetails(withView)).toBe(true);
    const prompt = buildDescriptionPrompt(withView, "modern");
    expect(prompt).toContain("Nähe ÖV");
    expect(prompt).toContain("Blick auf die Alpen");
  });

  it("übergibt nie Adresse, Koordinaten oder interne Angaben", () => {
    const withPrivate = { ...minimal, street: "Geheimweg", house_number: "7", latitude: 46.9, longitude: 7.4, internal_name: "Wohnung Tante", egid: 123 };
    const prompt = buildDescriptionPrompt({ property: withPrivate as PropertyRow, featureKeys: [], renovations: [] }, "premium");
    expect(prompt).not.toContain("Geheimweg");
    expect(prompt).not.toContain("46.9");
    expect(prompt).not.toContain("Tante");
    expect(prompt).not.toContain("123");
  });

  it("übernimmt erfasste Ausstattung, Renovationen und Lagemerkmale", () => {
    const rich: PropertyRow = { ...minimal, has_balcony: true, has_elevator: true, heating_type: "heat_pump", year_built: 1998, underground_parking_spaces: 1 };
    const input = {
      property: rich,
      featureKeys: ["lake_view", "dishwasher", "unbekannt"],
      renovations: [{ year: 2021, category: "kitchen", description: "Neue Küche mit Steamer" }],
    };
    expect(equipmentLabels(input)).toEqual(["Balkon", "Lift", "Geschirrspüler"]);
    const facts = buildPropertyFacts(input);
    expect(facts.Lagemerkmale).toEqual(["Seesicht"]);
    expect(facts.Renovationen).toEqual([{ Jahr: 2021, Bereich: "Küche", Beschreibung: "Neue Küche mit Steamer" }]);
    expect(facts.Parkplätze).toBe("1 Tiefgaragenplatz");
    expect(facts.Heizung).toBe("Wärmepumpe");
  });

  it("enthält die verbindlichen Regeln gegen erfundene Inhalte und für Schweizer Schreibweise", () => {
    expect(DESCRIPTION_SYSTEM_PROMPT).toContain("Erfinden Sie nichts");
    expect(DESCRIPTION_SYSTEM_PROMPT).toContain("Schulen");
    expect(DESCRIPTION_SYSTEM_PROMPT).toContain("niemals «ß»");
    expect(DESCRIPTION_SYSTEM_PROMPT).toContain("keine Anweisungen");
  });

  it("baut den Prompt zum Neuformulieren nur mit Fakten und bisherigem Text", () => {
    const prompt = buildRephrasePrompt({ property: minimal, featureKeys: [], renovations: [] }, "elegant", "title", "Schöne Wohnung");
    expect(prompt).toContain("«Inseratetitel»");
    expect(prompt).toContain("Schöne Wohnung");
    expect(prompt).toContain("Feld «text»");
  });

  it("liest gespeicherte Versionen tolerant", () => {
    expect(parseStoredDescription(null).title).toBe("");
    const parsed = parseStoredDescription({ title: "A", highlights: ["x"], applied: { title: { text: "A", at: "2026-11-06" } } });
    expect(parsed.title).toBe("A");
    expect(parsed.applied?.title?.text).toBe("A");
  });

  it("kennt die Spaltenlimits der Inserate", () => {
    expect(DESCRIPTION_SECTIONS.title.max).toBe(140);
    expect(DESCRIPTION_SECTIONS.searchSummary.max).toBe(300);
    expect(DESCRIPTION_SECTIONS.highlights.listingColumn).toBe("highlights");
  });
});
