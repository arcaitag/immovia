import { describe, expect, it } from "vitest";
import { maxOptions, minOptions, priceSteps, PRICE_STEPS_RENT, PRICE_STEPS_SALE } from "@/lib/search/filter-options";

describe("Auswahlwerte der Filter", () => {
  it("schliessen widersprüchliche Werte aus", () => {
    expect(minOptions([1, 2, 3, 4], undefined, 3)).toEqual([1, 2, 3]);
    expect(maxOptions([1, 2, 3, 4], undefined, 2)).toEqual([2, 3, 4]);
  });

  it("behalten einen Wert ausserhalb der Liste (z. B. aus einem Link)", () => {
    expect(minOptions([100, 200], 150, undefined)).toEqual([100, 150, 200]);
    expect(maxOptions([100, 200], 250, 120)).toEqual([200, 250]);
  });

  it("wählen die Preise nach Angebotsart", () => {
    expect(priceSteps("rent")).toBe(PRICE_STEPS_RENT);
    expect(priceSteps("sale")).toBe(PRICE_STEPS_SALE);
    expect(priceSteps(undefined)).toEqual([...PRICE_STEPS_RENT, ...PRICE_STEPS_SALE]);
  });
});
