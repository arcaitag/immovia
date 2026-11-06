import { describe, expect, it } from "vitest";
import { formatPropertyAddress, propertyDisplayName, publicAddressPreview } from "@/lib/properties/display";
import { FLOOR_OPTIONS, fieldLabel, isSectionKey } from "@/lib/properties/fields";

const ADDRESS = { street: "Bernstrasse", house_number: "12", postal_code: "3072", municipality: "Ostermundigen", canton: "BE" };

describe("Anzeige von Immobilien", () => {
  it("bildet einen sprechenden Namen, bevorzugt die interne Bezeichnung", () => {
    expect(propertyDisplayName({ internal_name: null, property_type: "apartment", rooms: 4.5, municipality: "Bern" })).toBe(
      "4.5-Zimmer-Wohnung in Bern",
    );
    expect(propertyDisplayName({ internal_name: "  Wohnung Mutter ", property_type: "apartment", rooms: 3, municipality: "Bern" })).toBe(
      "Wohnung Mutter",
    );
    expect(propertyDisplayName({ internal_name: null, property_type: "plot", rooms: 2, municipality: "Thun" })).toBe("Grundstück in Thun");
  });

  it("formatiert die private Adresse", () => {
    expect(formatPropertyAddress(ADDRESS)).toBe("Bernstrasse 12, 3072 Ostermundigen BE");
    expect(formatPropertyAddress({ street: null, house_number: null, postal_code: null, municipality: null, canton: null })).toBe(
      "Adresse noch nicht erfasst",
    );
  });

  it("zeigt öffentlich nur so viel Adresse wie gewählt (wie der Datenbank-Trigger)", () => {
    expect(publicAddressPreview(ADDRESS, "exact")).toBe("Bernstrasse 12, 3072 Ostermundigen");
    expect(publicAddressPreview(ADDRESS, "street")).toBe("Bernstrasse, 3072 Ostermundigen");
    expect(publicAddressPreview(ADDRESS, "area")).toBe("3072 Ostermundigen");
  });
});

describe("Feldkonfiguration", () => {
  it("bietet Etagen vom 2. Untergeschoss bis zum 40. Obergeschoss an", () => {
    expect(FLOOR_OPTIONS[0]).toEqual({ value: "-2", label: "2. Untergeschoss" });
    expect(FLOOR_OPTIONS.find((o) => o.value === "0")?.label).toBe("Erdgeschoss");
    expect(FLOOR_OPTIONS.at(-1)).toEqual({ value: "40", label: "40. Obergeschoss" });
  });

  it("verwendet typabhängige Beschriftungen", () => {
    expect(fieldLabel("rooms", "office")).toBe("Räume");
    expect(fieldLabel("rooms", "apartment")).toBe("Zimmer");
    expect(fieldLabel("floors_total", "single_family_house")).toBe("Anzahl Etagen");
  });

  it("erkennt gültige Abschnitte aus der URL", () => {
    expect(isSectionKey("flaechen")).toBe(true);
    expect(isSectionKey("unbekannt")).toBe(false);
    expect(isSectionKey(["flaechen"])).toBe(false);
  });
});
