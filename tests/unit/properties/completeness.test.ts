import { describe, expect, it } from "vitest";
import { computeCompleteness, completenessRules, type CompletenessSource } from "@/lib/properties/completeness";
import { fieldsHiddenAfterChange, isFieldVisible, visibleSections } from "@/lib/properties/fields";

const ADDRESS = { postal_code: "3072", municipality: "Ostermundigen", canton: "BE" };

describe("Vollständigkeit je Objekttyp", () => {
  it("verlangt bei Wohnungen Zimmer, Wohnfläche und Etage", () => {
    const result = computeCompleteness({ property_type: "apartment", offer_type: "sale", ...ADDRESS });
    expect(result.isComplete).toBe(false);
    expect(result.missingRequired).toEqual(["rooms", "living_area", "floor"]);
    expect(result.missingRequired).not.toContain("plot_area");
  });

  it("zählt das Erdgeschoss (0) als ausgefüllte Etage", () => {
    const result = computeCompleteness({
      property_type: "apartment",
      offer_type: "sale",
      ...ADDRESS,
      rooms: 4.5,
      living_area: 112,
      floor: 0,
    });
    expect(result.isComplete).toBe(true);
    expect(result.missingRequired).toHaveLength(0);
  });

  it("akzeptiert Formularwerte als Strings und behandelt leere Strings als fehlend", () => {
    const source: CompletenessSource = {
      property_type: "apartment",
      offer_type: "rent",
      postal_code: "3011",
      municipality: "Bern",
      canton: "",
      rooms: "3.5",
      living_area: "  ",
      floor: "2",
    };
    const result = computeCompleteness(source);
    expect(result.missingRequired).toEqual(["canton", "living_area"]);
  });

  it("verlangt bei Grundstücken nur die Grundstücksfläche – keine Zimmer oder Etage", () => {
    const empty = computeCompleteness({ property_type: "plot", offer_type: "sale", ...ADDRESS });
    expect(empty.missingRequired).toEqual(["plot_area"]);
    const filled = computeCompleteness({ property_type: "plot", offer_type: "sale", ...ADDRESS, plot_area: 820 });
    expect(filled.isComplete).toBe(true);
    const rules = completenessRules("plot", "sale");
    expect([...rules.required, ...rules.recommended]).not.toEqual(expect.arrayContaining(["rooms"]));
    expect(rules.recommended).not.toContain("house_number");
  });

  it("verlangt bei Häusern die Grundstücksfläche", () => {
    const result = computeCompleteness({
      property_type: "single_family_house",
      offer_type: "sale",
      ...ADDRESS,
      rooms: 5.5,
      living_area: 160,
    });
    expect(result.missingRequired).toEqual(["plot_area"]);
  });

  it("verlangt bei Büros und Gewerbe die Nutzfläche statt der Wohnfläche", () => {
    for (const type of ["office", "commercial"] as const) {
      const result = computeCompleteness({ property_type: type, offer_type: "rent", ...ADDRESS });
      expect(result.missingRequired).toEqual(["usable_area"]);
      expect(result.missingRequired).not.toContain("living_area");
    }
  });

  it("gewichtet Pflichtfelder doppelt und liefert 0–100 %", () => {
    const none = computeCompleteness({ property_type: "apartment", offer_type: "sale" });
    expect(none.percent).toBe(0);
    const full = computeCompleteness({
      property_type: "apartment",
      offer_type: "sale",
      ...ADDRESS,
      street: "Bernstrasse",
      house_number: "12",
      rooms: 4.5,
      living_area: 112,
      floor: 2,
      bathrooms: 2,
      floors_total: 5,
      year_built: 1998,
      condition: "good",
      heating_type: "heat_pump",
      energy_label: "C",
      available_by_arrangement: true,
      ownership_type: "condominium",
      service_charges: 380,
    });
    expect(full.percent).toBe(100);
    expect(full.missingRecommended).toHaveLength(0);
  });

  it("empfiehlt die Eigentumsform nur beim Verkauf und Nebenkosten bei Mietobjekten", () => {
    expect(completenessRules("single_family_house", "sale").recommended).toContain("ownership_type");
    expect(completenessRules("single_family_house", "rent").recommended).not.toContain("ownership_type");
    expect(completenessRules("single_family_house", "rent").recommended).toContain("service_charges");
    expect(completenessRules("single_family_house", "sale").recommended).not.toContain("service_charges");
    expect(completenessRules("apartment", "sale").recommended).toContain("service_charges");
  });

  it("wertet «nach Vereinbarung» oder ein Datum als Verfügbarkeit", () => {
    const base = { property_type: "plot" as const, offer_type: "sale" as const, ...ADDRESS, plot_area: 500 };
    expect(computeCompleteness(base).missingRecommended).toContain("available");
    expect(computeCompleteness({ ...base, available_from: "2027-01-01" }).missingRecommended).not.toContain("available");
    expect(computeCompleteness({ ...base, available_by_arrangement: true }).missingRecommended).not.toContain("available");
  });
});

describe("Typabhängige Felder", () => {
  it("zeigt Etage bei Wohnungen, aber nicht bei Einfamilienhäusern", () => {
    expect(isFieldVisible("floor", "apartment", "sale")).toBe(true);
    expect(isFieldVisible("floor", "single_family_house", "sale")).toBe(false);
  });

  it("zeigt keine Grundstücksfläche bei Wohnungen und keine Zimmer bei Grundstücken", () => {
    expect(isFieldVisible("plot_area", "apartment", "sale")).toBe(false);
    expect(isFieldVisible("rooms", "plot", "sale")).toBe(false);
    expect(isFieldVisible("bathrooms", "plot", "sale")).toBe(false);
  });

  it("zeigt Haustiere nur bei Mietobjekten und die Eigentumsform nur beim Verkauf", () => {
    expect(isFieldVisible("pets_allowed", "apartment", "rent")).toBe(true);
    expect(isFieldVisible("pets_allowed", "apartment", "sale")).toBe(false);
    expect(isFieldVisible("ownership_type", "apartment", "rent")).toBe(false);
  });

  it("blendet Gebäudeabschnitte bei Grundstücken aus", () => {
    const keys = visibleSections("plot").map((s) => s.key);
    expect(keys).not.toContain("gebaeude");
    expect(keys).not.toContain("renovationen");
    expect(keys).toContain("adresse");
    expect(visibleSections("apartment")).toHaveLength(10);
  });

  it("nennt die Felder, die beim Typwechsel nicht mehr passen", () => {
    const hidden = fieldsHiddenAfterChange({ type: "apartment", offer: "sale" }, { type: "single_family_house", offer: "sale" });
    expect(hidden).toContain("floor");
    expect(hidden).not.toContain("rooms");
    const toPlot = fieldsHiddenAfterChange({ type: "single_family_house", offer: "sale" }, { type: "plot", offer: "sale" });
    expect(toPlot).toEqual(expect.arrayContaining(["rooms", "living_area", "year_built"]));
    expect(toPlot).not.toContain("plot_area");
  });
});
