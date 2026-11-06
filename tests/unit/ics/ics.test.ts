import { describe, expect, it } from "vitest";
import { buildIcsEvent, escapeIcsText, foldIcsLine, formatIcsDate, icsFileName } from "@/lib/ics";
import { zurichLocalToUtc } from "@/lib/format";

const encoder = new TextEncoder();

function unfold(ics: string): string {
  return ics.replace(/\r\n /g, "");
}

const sample = () =>
  buildIcsEvent({
    uid: "0b5e2f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b@immovia.ch",
    start: zurichLocalToUtc("2026-11-14", "10:00"),
    end: zurichLocalToUtc("2026-11-14", "10:30"),
    summary: "Besichtigung: 4.5-Zimmer-Wohnung, Ostermundigen; mit Balkon",
    location: "Bernstrasse 12, 3072 Ostermundigen",
    url: "https://www.immovia.ch/immobilien/wohnung-4-5-zimmer-ostermundigen-0b5e2f",
    description: "Zeile 1\nZeile 2 mit Backslash \\ und Komma, Semikolon;",
    stamp: new Date("2026-11-06T12:00:00Z"),
    alarmMinutesBefore: 60,
  });

describe("ICS-Kalenderdatei", () => {
  it("hat die Pflichtstruktur VCALENDAR/VEVENT mit UID und DTSTAMP", () => {
    const ics = sample();
    const lines = unfold(ics).split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("VERSION:2.0");
    expect(lines.some((l) => l.startsWith("PRODID:"))).toBe(true);
    expect(lines).toContain("BEGIN:VEVENT");
    expect(lines).toContain("END:VEVENT");
    expect(lines).toContain("UID:0b5e2f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b@immovia.ch");
    expect(lines).toContain("DTSTAMP:20261106T120000Z");
    expect(lines.filter(Boolean).at(-1)).toBe("END:VCALENDAR");
  });

  it("verwendet CRLF als Zeilenende (auch am Dateiende)", () => {
    const ics = sample();
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });

  it("schreibt Zeiten in UTC (Zürcher Ortszeit korrekt umgerechnet)", () => {
    const lines = unfold(sample()).split("\r\n");
    expect(lines).toContain("DTSTART:20261114T090000Z");
    expect(lines).toContain("DTEND:20261114T093000Z");
    expect(formatIcsDate(zurichLocalToUtc("2026-07-04", "10:00"))).toBe("20260704T080000Z");
  });

  it("escaped Kommas, Semikolons, Backslashes und Zeilenumbrüche", () => {
    expect(escapeIcsText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    expect(escapeIcsText("x\r\ny")).toBe("x\\ny");
    const unfolded = unfold(sample());
    expect(unfolded).toContain("SUMMARY:Besichtigung: 4.5-Zimmer-Wohnung\\, Ostermundigen\\; mit Balkon");
    expect(unfolded).toContain("LOCATION:Bernstrasse 12\\, 3072 Ostermundigen");
    expect(unfolded).toContain("DESCRIPTION:Zeile 1\\nZeile 2 mit Backslash \\\\ und Komma\\, Semikolon\\;");
  });

  it("faltet Zeilen nach höchstens 75 Oktetten, ohne Mehrbyte-Zeichen zu trennen", () => {
    const long = `SUMMARY:${"Besichtigung Grössere Wohnung mit Seesicht und Bergsicht – Zürich ".repeat(4)}`;
    const folded = foldIcsLine(long);
    for (const line of folded.split("\r\n")) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(folded.replace(/\r\n /g, "")).toBe(long);
    for (const line of sample().split("\r\n")) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it("enthält URL, STATUS und Erinnerung", () => {
    const unfolded = unfold(sample());
    expect(unfolded).toContain("URL:https://www.immovia.ch/immobilien/wohnung-4-5-zimmer-ostermundigen-0b5e2f");
    expect(unfolded).toContain("STATUS:CONFIRMED");
    expect(unfolded).toContain("BEGIN:VALARM");
    expect(unfolded).toContain("TRIGGER:-PT60M");
  });

  it("lässt bei abgesagten Terminen die Erinnerung weg", () => {
    const ics = buildIcsEvent({
      uid: "x@immovia.ch",
      start: new Date("2026-11-14T09:00:00Z"),
      end: new Date("2026-11-14T09:30:00Z"),
      summary: "Besichtigung",
      status: "CANCELLED",
      alarmMinutesBefore: 60,
    });
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).not.toContain("VALARM");
  });

  it("weist ungültige Zeiträume ab und erzeugt sichere Dateinamen", () => {
    expect(() =>
      buildIcsEvent({ uid: "x", start: new Date("2026-11-14T10:00:00Z"), end: new Date("2026-11-14T10:00:00Z"), summary: "x" }),
    ).toThrow();
    expect(icsFileName(new Date("2026-11-14T09:00:00Z"), "2026-11-14")).toBe("besichtigung-2026-11-14.ics");
    expect(icsFileName(new Date("2026-11-14T09:00:00Z"), "../../etc")).toBe("besichtigung-2026-11-14.ics");
  });
});
