import { describe, expect, it } from "vitest";
import { buildSlotSeries, firstSlotInPast, MAX_SLOTS_PER_REQUEST, type SlotSeriesInput } from "@/lib/viewings/series";
import { slotFormSchema } from "@/lib/validation/viewing";

function iso(result: ReturnType<typeof buildSlotSeries>): Array<[string, string]> {
  if (!result.ok) throw new Error(result.error);
  return result.slots.map((s): [string, string] => [s.startsAt.toISOString(), s.endsAt.toISOString()]);
}

const base: SlotSeriesInput = {
  date: "2026-11-14",
  startTime: "10:00",
  endTime: "12:00",
  durationMinutes: 0,
  repeat: "none",
  occurrences: 1,
};

describe("Besichtigungs-Zeitfenster (Zürcher Ortszeit)", () => {
  it("legt ein einzelnes Zeitfenster im Winter an (UTC+1)", () => {
    expect(iso(buildSlotSeries(base))).toEqual([["2026-11-14T09:00:00.000Z", "2026-11-14T11:00:00.000Z"]]);
  });

  it("legt ein einzelnes Zeitfenster im Sommer an (UTC+2)", () => {
    expect(iso(buildSlotSeries({ ...base, date: "2026-07-04" }))).toEqual([["2026-07-04T08:00:00.000Z", "2026-07-04T10:00:00.000Z"]]);
  });

  it("teilt einen Zeitraum in Termine auf und lässt Reste weg", () => {
    const result = buildSlotSeries({ ...base, endTime: "11:50", durationMinutes: 30 });
    expect(result.ok && result.slots.map((s) => `${s.localStart}–${s.localEnd}`)).toEqual(["10:00–10:30", "10:30–11:00", "11:00–11:30"]);
  });

  it("behält die Ortszeit über das Ende der Sommerzeit (25.10.2026) bei", () => {
    const result = buildSlotSeries({ ...base, date: "2026-10-17", endTime: "11:00", repeat: "weekly", occurrences: 3 });
    expect(result.ok && result.slots.map((s) => s.date)).toEqual(["2026-10-17", "2026-10-24", "2026-10-31"]);
    expect(iso(result)).toEqual([
      ["2026-10-17T08:00:00.000Z", "2026-10-17T09:00:00.000Z"],
      ["2026-10-24T08:00:00.000Z", "2026-10-24T09:00:00.000Z"],
      ["2026-10-31T09:00:00.000Z", "2026-10-31T10:00:00.000Z"],
    ]);
  });

  it("behält die Ortszeit über den Beginn der Sommerzeit (28.3.2027) bei", () => {
    const result = buildSlotSeries({ ...base, date: "2027-03-27", endTime: "10:30", repeat: "daily", occurrences: 3 });
    expect(iso(result)).toEqual([
      ["2027-03-27T09:00:00.000Z", "2027-03-27T09:30:00.000Z"],
      ["2027-03-28T08:00:00.000Z", "2027-03-28T08:30:00.000Z"],
      ["2027-03-29T08:00:00.000Z", "2027-03-29T08:30:00.000Z"],
    ]);
  });

  it("überspringt die nicht existierende Stunde in der Nacht der Umstellung ohne Überschneidungen", () => {
    expect(buildSlotSeries({ ...base, date: "2027-03-28", startTime: "02:00", endTime: "03:00" }).ok).toBe(false);
    const result = buildSlotSeries({ ...base, date: "2027-03-28", startTime: "01:30", endTime: "03:30", durationMinutes: 30 });
    const slots = iso(result);
    for (let i = 1; i < slots.length; i++) {
      expect(new Date(slots[i]![0]).getTime()).toBeGreaterThanOrEqual(new Date(slots[i - 1]![1]).getTime());
    }
    expect(slots[0]).toEqual(["2027-03-28T00:30:00.000Z", "2027-03-28T01:00:00.000Z"]);
  });

  it("wiederholt täglich über Monats- und Jahresgrenzen", () => {
    const result = buildSlotSeries({ ...base, date: "2026-12-30", repeat: "daily", occurrences: 4 });
    expect(result.ok && result.slots.map((s) => s.date)).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  });

  it("weist ungültige Angaben ab", () => {
    expect(buildSlotSeries({ ...base, endTime: "10:00" }).ok).toBe(false);
    expect(buildSlotSeries({ ...base, endTime: "11:00", durationMinutes: 90 }).ok).toBe(false);
    expect(buildSlotSeries({ ...base, startTime: "07:00", endTime: "16:00" }).ok).toBe(false);
    const tooMany = buildSlotSeries({ ...base, startTime: "08:00", endTime: "18:00", durationMinutes: 15, repeat: "daily", occurrences: 12 });
    expect(tooMany.ok).toBe(false);
    if (!tooMany.ok) expect(tooMany.error).toContain(String(MAX_SLOTS_PER_REQUEST));
  });

  it("erkennt Zeitfenster in der Vergangenheit", () => {
    const result = buildSlotSeries(base);
    if (!result.ok) throw new Error("unerwartet");
    expect(firstSlotInPast(result.slots, new Date("2026-11-14T09:30:00Z"))).not.toBeNull();
    expect(firstSlotInPast(result.slots, new Date("2026-11-13T09:30:00Z"))).toBeNull();
  });
});

describe("Formularvalidierung Zeitfenster", () => {
  const valid = {
    listingId: "3f0c2f9e-8b0a-4c51-9f3e-2a4b5c6d7e8f",
    mode: "series",
    date: "2026-11-14",
    startTime: "10:00",
    endTime: "12:00",
    durationMinutes: 30,
    repeat: "weekly",
    occurrences: 2,
    capacity: 2,
    note: "Bitte bei Müller klingeln",
  };

  it("akzeptiert gültige Eingaben", () => {
    expect(slotFormSchema.safeParse(valid).success).toBe(true);
  });

  it("meldet Endzeit vor Startzeit am Feld endTime", () => {
    const result = slotFormSchema.safeParse({ ...valid, endTime: "09:00" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.join(".") === "endTime")).toBe(true);
  });

  it("prüft Datum, Uhrzeit und Kapazität", () => {
    expect(slotFormSchema.safeParse({ ...valid, date: "2026-02-30" }).success).toBe(false);
    expect(slotFormSchema.safeParse({ ...valid, startTime: "24:00" }).success).toBe(false);
    expect(slotFormSchema.safeParse({ ...valid, capacity: 0 }).success).toBe(false);
    expect(slotFormSchema.safeParse({ ...valid, capacity: 51 }).success).toBe(false);
  });
});
