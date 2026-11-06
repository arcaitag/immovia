/**
 * Kalenderdateien (iCalendar, RFC 5545) für Besichtigungstermine.
 * - Zeilenende CRLF, Zeilenfaltung nach 75 Oktetten (UTF-8-sicher)
 * - Zeiten in UTC (…Z), damit jeder Kalender sie korrekt in die eigene Zeitzone umrechnet
 * - TEXT-Werte escaped (\\ ; , Zeilenumbruch)
 */

const CRLF = "\r\n";
const MAX_LINE_OCTETS = 75;

export type IcsStatus = "CONFIRMED" | "TENTATIVE" | "CANCELLED";

export interface IcsEventInput {
  /** Global eindeutig und stabil, z. B. «{appointmentId}@immovia.ch» */
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  status?: IcsStatus;
  /** Zeitpunkt der Erstellung der Datei (DTSTAMP) */
  stamp?: Date;
  /** Letzte Änderung des Termins */
  lastModified?: Date | null;
  /** Erinnerung x Minuten vor Beginn (0 oder leer = keine) */
  alarmMinutesBefore?: number | null;
}

/** Escaping für TEXT-Werte gemäss RFC 5545, Abschnitt 3.3.11. */
export function escapeIcsText(value: string): string {
  let cleaned = "";
  for (const char of value.replace(/\r\n|\r/g, "\n")) {
    const code = char.codePointAt(0) ?? 0;
    // Steuerzeichen sind in TEXT nicht erlaubt (ausser Tab und Zeilenumbruch, der escaped wird)
    if ((code < 32 && char !== "\n" && char !== "\t") || code === 127) continue;
    cleaned += char;
  }
  return cleaned.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** UTC-Zeitstempel im Format JJJJMMTTTHHMMSSZ. */
export function formatIcsDate(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new Error("Ungültiges Datum für ICS");
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

const encoder = new TextEncoder();

/**
 * Faltet eine Inhaltszeile nach höchstens 75 Oktetten. Folgezeilen beginnen mit
 * einem Leerzeichen. Mehrbyte-Zeichen werden nie getrennt.
 */
export function foldIcsLine(line: string): string {
  if (encoder.encode(line).length <= MAX_LINE_OCTETS) return line;
  const parts: string[] = [];
  let current = "";
  let currentOctets = 0;
  let limit = MAX_LINE_OCTETS;
  for (const char of line) {
    const octets = encoder.encode(char).length;
    if (currentOctets + octets > limit) {
      parts.push(current);
      current = "";
      currentOctets = 0;
      // Folgezeilen: führendes Leerzeichen zählt mit
      limit = MAX_LINE_OCTETS - 1;
    }
    current += char;
    currentOctets += octets;
  }
  if (current) parts.push(current);
  return parts.join(`${CRLF} `);
}

function property(name: string, value: string): string {
  return foldIcsLine(`${name}:${value}`);
}

/** Erzeugt einen vollständigen VCALENDAR mit einem VEVENT. */
export function buildIcsEvent(input: IcsEventInput): string {
  if (!(input.end.getTime() > input.start.getTime())) {
    throw new Error("Das Ende des Termins muss nach dem Beginn liegen.");
  }
  const stamp = input.stamp ?? new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Immovia//Besichtigungen//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    property("UID", escapeIcsText(input.uid)),
    property("DTSTAMP", formatIcsDate(stamp)),
    property("DTSTART", formatIcsDate(input.start)),
    property("DTEND", formatIcsDate(input.end)),
    property("SUMMARY", escapeIcsText(input.summary)),
  ];
  if (input.lastModified) lines.push(property("LAST-MODIFIED", formatIcsDate(input.lastModified)));
  if (input.location) lines.push(property("LOCATION", escapeIcsText(input.location)));
  if (input.description) lines.push(property("DESCRIPTION", escapeIcsText(input.description)));
  // URL ist vom Typ URI (kein TEXT): nicht escapen, aber Zeilenumbrüche und Leerzeichen entfernen
  if (input.url) lines.push(property("URL", input.url.replace(/[\r\n\s]/g, "")));
  lines.push(property("STATUS", input.status ?? "CONFIRMED"));
  lines.push("TRANSP:OPAQUE");
  if (input.alarmMinutesBefore && input.alarmMinutesBefore > 0 && input.status !== "CANCELLED") {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      property("DESCRIPTION", escapeIcsText(input.summary)),
      `TRIGGER:-PT${Math.round(input.alarmMinutesBefore)}M`,
      "END:VALARM",
    );
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join(CRLF) + CRLF;
}

/** Dateiname ohne Sonderzeichen, z. B. «besichtigung-2026-11-14.ics». */
export function icsFileName(start: Date, zurichDate: string): string {
  const safe = /^\d{4}-\d{2}-\d{2}$/.test(zurichDate) ? zurichDate : start.toISOString().slice(0, 10);
  return `besichtigung-${safe}.ics`;
}
