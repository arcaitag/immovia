import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  groupByZurichDay,
  isoWeekday,
  minutesToTime,
  startOfWeekIso,
  timeToMinutes,
  weekDaysIso,
  zurichDateKey,
  zurichDayEndUtc,
  zurichDayStartUtc,
} from "@/lib/viewings/calendar";

describe("Kalenderhilfen (Europe/Zurich)", () => {
  it("addiert Kalendertage über Monats-, Jahres- und Schaltjahresgrenzen", () => {
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysIso("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysIso("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("berechnet Wochentage und Wochenbeginn (Montag)", () => {
    expect(isoWeekday("2026-11-14")).toBe(6);
    expect(isoWeekday("2026-11-15")).toBe(7);
    expect(startOfWeekIso("2026-11-15")).toBe("2026-11-09");
    expect(weekDaysIso("2026-11-11")).toEqual([
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
    ]);
  });

  it("ermittelt den Zürcher Kalendertag eines UTC-Zeitpunkts", () => {
    expect(zurichDateKey("2026-11-14T23:30:00Z")).toBe("2026-11-15");
    expect(zurichDateKey("2026-07-01T21:59:00Z")).toBe("2026-07-01");
    expect(zurichDateKey("2026-07-01T22:00:00Z")).toBe("2026-07-02");
  });

  it("liefert Tagesbeginn und -ende in UTC, auch an Umstellungstagen", () => {
    expect(zurichDayStartUtc("2026-11-14").toISOString()).toBe("2026-11-13T23:00:00.000Z");
    expect(zurichDayEndUtc("2026-11-14").toISOString()).toBe("2026-11-14T22:59:59.000Z");
    expect(zurichDayEndUtc("2026-07-01").toISOString()).toBe("2026-07-01T21:59:59.000Z");
    expect(zurichDayEndUtc("2026-10-25").toISOString()).toBe("2026-10-25T22:59:59.000Z");
  });

  it("wandelt Uhrzeiten in Minuten und zurück", () => {
    expect(timeToMinutes("09:45")).toBe(585);
    expect(minutesToTime(585)).toBe("09:45");
    expect(minutesToTime(0)).toBe("00:00");
  });

  it("gruppiert nach Zürcher Kalendertag", () => {
    const groups = groupByZurichDay(
      [{ at: "2026-11-14T23:30:00Z" }, { at: "2026-11-14T09:00:00Z" }, { at: "2026-11-15T08:00:00Z" }],
      (i) => i.at,
    );
    expect(groups.map((g) => [g.date, g.items.length])).toEqual([
      ["2026-11-14", 1],
      ["2026-11-15", 2],
    ]);
  });
});
