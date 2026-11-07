import { describe, expect, it } from "vitest";
import { isDigestDue } from "@/lib/jobs/digest-schedule";

/** Zürich: Winterzeit UTC+1 (November), Sommerzeit UTC+2 (Juli). */
const at = (iso: string) => new Date(iso);

describe("isDigestDue", () => {
  it("sendet nicht vor 07:00 Zürcher Zeit, auch wenn noch nie gesendet wurde", () => {
    expect(isDigestDue("daily", null, at("2026-11-10T05:30:00Z"))).toBe(false); // 06:30
    expect(isDigestDue("daily", null, at("2026-11-10T06:00:00Z"))).toBe(true); // 07:00
  });

  it("täglich: einmal pro Zürcher Kalendertag, auch bei stündlichem Cron", () => {
    const sent = "2026-11-10T06:17:00Z"; // 07:17
    expect(isDigestDue("daily", sent, at("2026-11-10T07:17:00Z"))).toBe(false); // gleicher Tag, 08:17
    expect(isDigestDue("daily", sent, at("2026-11-10T22:17:00Z"))).toBe(false); // 23:17
    expect(isDigestDue("daily", sent, at("2026-11-11T02:17:00Z"))).toBe(false); // nächster Tag, 03:17 (zu früh)
    expect(isDigestDue("daily", sent, at("2026-11-11T06:17:00Z"))).toBe(true); // nächster Tag, 07:17
  });

  it("täglich: der Versand wandert nicht in die Nacht", () => {
    // Früher «fällig nach 20 Stunden»: aus 07:17 wurde am Folgetag 03:17
    let last = "2026-11-10T06:17:00Z";
    for (let day = 11; day <= 14; day += 1) {
      const runs = Array.from({ length: 24 }, (_, hour) => new Date(Date.UTC(2026, 10, day, hour, 17)));
      const first = runs.find((run) => isDigestDue("daily", last, run));
      expect(first?.toISOString()).toBe(`2026-11-${day}T06:17:00.000Z`);
      last = first!.toISOString();
    }
  });

  it("wöchentlich: frühestens am siebten Kalendertag ab 07:00", () => {
    const sent = "2026-11-09T06:17:00Z"; // Montag 07:17
    expect(isDigestDue("weekly", sent, at("2026-11-15T20:00:00Z"))).toBe(false); // Sonntag 21:00
    expect(isDigestDue("weekly", sent, at("2026-11-16T05:17:00Z"))).toBe(false); // Montag 06:17
    expect(isDigestDue("weekly", sent, at("2026-11-16T06:17:00Z"))).toBe(true); // Montag 07:17
  });

  it("rechnet mit Zürcher Datum, auch über die Sommerzeit", () => {
    // 23:30 UTC am 14. Juli ist in Zürich bereits der 15. Juli 01:30
    const sent = "2026-07-14T23:30:00Z";
    expect(isDigestDue("daily", sent, at("2026-07-15T05:00:00Z"))).toBe(false); // 15. Juli 07:00, gleicher Tag
    expect(isDigestDue("daily", sent, at("2026-07-16T05:00:00Z"))).toBe(true); // 16. Juli 07:00
  });

  it("sofortige oder deaktivierte Benachrichtigungen sind nie fällig", () => {
    expect(isDigestDue("instant", null, at("2026-11-10T09:00:00Z"))).toBe(false);
    expect(isDigestDue("none", null, at("2026-11-10T09:00:00Z"))).toBe(false);
  });
});
