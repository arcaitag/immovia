import { describe, expect, it } from "vitest";
import { formatArea, formatChf, formatRooms, zurichLocalToUtc, utcToZurichParts } from "@/lib/format";

describe("Schweizer Formatierung", () => {
  it("formatiert CHF mit Apostroph", () => {
    expect(formatChf(765000)).toMatch(/^CHF 765.000$/);
    expect(formatChf(765000).charAt(7)).toMatch(/['’]/);
    expect(formatChf(null)).toBe("–");
  });
  it("formatiert Flächen und Zimmer", () => {
    expect(formatArea(112)).toBe("112 m²");
    expect(formatRooms(4.5)).toBe("4.5 Zimmer");
    expect(formatRooms(3)).toBe("3 Zimmer");
  });
  it("rechnet Zürcher Lokalzeit korrekt in UTC um (Sommer- und Winterzeit)", () => {
    expect(zurichLocalToUtc("2026-07-01", "10:00").toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(zurichLocalToUtc("2026-12-01", "10:00").toISOString()).toBe("2026-12-01T09:00:00.000Z");
    expect(utcToZurichParts("2026-12-01T09:00:00.000Z")).toEqual({ date: "2026-12-01", time: "10:00" });
  });
});
