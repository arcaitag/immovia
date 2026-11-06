import { describe, expect, it } from "vitest";
import {
  createPropertySchema,
  parseSwissNumber,
  propertyConsistencyIssues,
  propertyFormSchema,
  propertyPatchSchema,
  propertyToFormValues,
  renovationSchema,
  type PropertyFormValues,
} from "@/lib/validation/property";
import { listingFormSchema, listingTextsSignature, type ListingFormValues } from "@/lib/validation/listing";

const thisYear = new Date().getFullYear();

const EMPTY_PROPERTY = propertyToFormValues(
  {
    property_type: "apartment",
    offer_type: "sale",
    internal_name: null,
    street: null,
    house_number: null,
    postal_code: null,
    municipality: null,
    canton: null,
    latitude: null,
    longitude: null,
    egid: null,
    rooms: null,
    bathrooms: null,
    living_area: null,
    gross_living_area: null,
    usable_area: null,
    plot_area: null,
    year_built: null,
    year_renovated: null,
    floor: null,
    floors_total: null,
    condition: null,
    heating_type: null,
    energy_label: null,
    energy_demand_kwh: null,
    is_minergie: false,
    has_balcony: false,
    has_terrace: false,
    has_garden: false,
    has_garage: false,
    has_elevator: false,
    has_cellar: false,
    has_attic: false,
    is_wheelchair_accessible: false,
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
  },
  [],
);

function patch(values: Partial<PropertyFormValues>) {
  return propertyPatchSchema.safeParse(values);
}

describe("Schweizer Zahleneingaben", () => {
  it("versteht Apostroph, Leerzeichen und Komma", () => {
    expect(parseSwissNumber("1'250.5")).toBe(1250.5);
    expect(parseSwissNumber("1’250")).toBe(1250);
    expect(parseSwissNumber(" 4,5 ")).toBe(4.5);
    expect(parseSwissNumber("")).toBeNull();
    expect(Number.isNaN(parseSwissNumber("vier") as number)).toBe(true);
  });
});

describe("Zimmerzahl", () => {
  it("erlaubt halbe Schritte", () => {
    expect(patch({ rooms: "3.5" }).data?.rooms).toBe(3.5);
    expect(patch({ rooms: "4,5" }).data?.rooms).toBe(4.5);
    expect(patch({ rooms: "5" }).data?.rooms).toBe(5);
    expect(patch({ rooms: "" }).data?.rooms).toBeNull();
  });

  it("lehnt andere Schritte und Werte ausserhalb 0.5–50 ab", () => {
    expect(patch({ rooms: "3.3" }).success).toBe(false);
    expect(patch({ rooms: "0" }).success).toBe(false);
    expect(patch({ rooms: "51" }).success).toBe(false);
    const error = patch({ rooms: "3.25" }).error?.issues[0]?.message;
    expect(error).toContain("halben Schritten");
  });
});

describe("Baujahr und Renovation", () => {
  it("akzeptiert plausible Jahre und lehnt Unsinn ab", () => {
    expect(patch({ year_built: "1990" }).data?.year_built).toBe(1990);
    expect(patch({ year_built: "990" }).success).toBe(false);
    expect(patch({ year_built: String(thisYear + 20) }).success).toBe(false);
    expect(patch({ year_built: "1990.5" }).success).toBe(false);
    expect(patch({ year_renovated: String(thisYear) }).success).toBe(true);
  });

  it("verlangt, dass die Renovation nicht vor dem Baujahr liegt", () => {
    expect(propertyConsistencyIssues({ year_built: 2000, year_renovated: 1995 })).toEqual([
      { field: "year_renovated", message: expect.stringContaining("Baujahr") },
    ]);
    expect(propertyConsistencyIssues({ year_built: 1960, year_renovated: 2015 })).toEqual([]);
    const result = propertyFormSchema.safeParse({ ...EMPTY_PROPERTY, year_built: "2000", year_renovated: "1990" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === "year_renovated")).toBe(true);
  });

  it("prüft die Etage gegen die Anzahl Stockwerke", () => {
    expect(propertyConsistencyIssues({ floor: 6, floors_total: 4 })[0]?.field).toBe("floor");
    expect(propertyConsistencyIssues({ floor: 0, floors_total: 4 })).toEqual([]);
  });
});

describe("Adresse", () => {
  it("prüft Schweizer Postleitzahlen", () => {
    expect(patch({ postal_code: "3072" }).data?.postal_code).toBe("3072");
    expect(patch({ postal_code: "0123" }).success).toBe(false);
    expect(patch({ postal_code: "30721" }).success).toBe(false);
    expect(patch({ postal_code: "" }).data?.postal_code).toBeNull();
  });

  it("akzeptiert nur gültige Kantonskürzel", () => {
    expect(patch({ canton: "BE" }).data?.canton).toBe("BE");
    expect(patch({ canton: "XX" }).success).toBe(false);
  });

  it("verlangt beim Erfassen PLZ, Gemeinde und Kanton", () => {
    const base = {
      property_type: "apartment" as const,
      offer_type: "sale" as const,
      street: "Bernstrasse",
      house_number: "12",
      latitude: null,
      longitude: null,
      egid: null,
      organization_id: "",
    };
    const missing = createPropertySchema.safeParse({ ...base, postal_code: "", municipality: "", canton: "" });
    expect(missing.success).toBe(false);
    const paths = missing.error?.issues.map((issue) => issue.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["postal_code", "municipality", "canton"]));
    const ok = createPropertySchema.safeParse({ ...base, postal_code: "3072", municipality: "Ostermundigen", canton: "BE" });
    expect(ok.success).toBe(true);
    expect(ok.data?.organization_id).toBeNull();
    expect(ok.data?.goal).toBe("");
  });
});

describe("Zwischenspeichern", () => {
  it("lehnt unbekannte Felder ab (z. B. geschützte Spalten)", () => {
    expect(propertyPatchSchema.safeParse({ owner_id: "x" }).success).toBe(false);
    expect(propertyPatchSchema.safeParse({ is_demo: true }).success).toBe(false);
  });

  it("wandelt Formularwerte in Datenbanktypen um", () => {
    const result = patch({
      living_area: "112.46",
      garage_spaces: "",
      pets_allowed: "yes",
      service_charges: "380.555",
      available_from: "2027-04-01",
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      living_area: 112.5,
      garage_spaces: 0,
      pets_allowed: true,
      service_charges: 380.56,
      available_from: "2027-04-01",
    });
  });

  it("lehnt ungültige Daten ab", () => {
    expect(patch({ available_from: "2027-02-30" }).success).toBe(false);
    expect(patch({ available_from: "01.04.2027" }).success).toBe(false);
  });

  it("entfernt doppelte Merkmale und lehnt unbekannte ab", () => {
    expect(patch({ features: ["lake_view", "lake_view", "sauna"] }).data?.features).toEqual(["lake_view", "sauna"]);
    expect(propertyPatchSchema.safeParse({ features: ["swimming_lake"] }).success).toBe(false);
  });
});

describe("Renovationen", () => {
  it("verlangt Jahr, Kategorie und Beschreibung", () => {
    expect(renovationSchema.safeParse({ year: "2019", category: "kitchen", description: "Neue Küche" }).success).toBe(true);
    expect(renovationSchema.safeParse({ year: "", category: "kitchen", description: "Neue Küche" }).success).toBe(false);
    expect(renovationSchema.safeParse({ year: "1850", category: "kitchen", description: "Neue Küche" }).success).toBe(false);
    expect(renovationSchema.safeParse({ year: "2019", category: "pool", description: "Neue Küche" }).success).toBe(false);
    expect(renovationSchema.safeParse({ year: "2019", category: "roof", description: "x" }).success).toBe(false);
  });
});

describe("Inserat", () => {
  const base: ListingFormValues = {
    price: "765'000",
    price_on_request: false,
    additional_costs: "",
    parking_price: "",
    title: "Helle 4.5-Zimmer-Wohnung",
    short_description: "",
    description: "Schöne Wohnung",
    location_description: "",
    equipment_description: "",
    highlights: ["Balkon", "Lift"],
    search_summary: "",
    location_precision: "area",
    contact_name: "Anna Muster",
    contact_phone: "",
    contact_email: "anna@example.ch",
    show_contact_phone: false,
    dossier_public: false,
    texts_confirmed: true,
  };

  it("wandelt Preise um und speichert leere Texte als null", () => {
    const result = listingFormSchema.safeParse(base);
    expect(result.success).toBe(true);
    expect(result.data?.price).toBe(765000);
    expect(result.data?.short_description).toBeNull();
  });

  it("verlangt eine Telefonnummer, wenn sie angezeigt werden soll", () => {
    const result = listingFormSchema.safeParse({ ...base, show_contact_phone: true });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["contact_phone"]);
    expect(listingFormSchema.safeParse({ ...base, show_contact_phone: true, contact_phone: "+41 79 123 45 67" }).success).toBe(true);
  });

  it("begrenzt Highlights auf 12 und entfernt Doppelte", () => {
    const many = Array.from({ length: 13 }, (_, i) => `Highlight ${i + 1}`);
    expect(listingFormSchema.safeParse({ ...base, highlights: many }).success).toBe(false);
    expect(listingFormSchema.safeParse({ ...base, highlights: ["Balkon", "balkon"] }).data?.highlights).toEqual(["Balkon"]);
  });

  it("erkennt geänderte Texte über die Signatur", () => {
    const texts = {
      title: "A",
      short_description: null,
      description: "B",
      location_description: null,
      equipment_description: null,
      search_summary: null,
      highlights: ["x"],
    };
    expect(listingTextsSignature(texts)).toBe(listingTextsSignature({ ...texts, title: " A " }));
    expect(listingTextsSignature(texts)).not.toBe(listingTextsSignature({ ...texts, description: "C" }));
  });
});
