/**
 * Schweizer Formatierung: CHF mit Apostroph als Tausendertrennzeichen,
 * Datum TT.MM.JJJJ, Zeitzone Europe/Zurich, Flächen in m².
 */

export const TIME_ZONE = "Europe/Zurich";
export const LOCALE = "de-CH";

const integerFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const centsFormat = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** «CHF 765’000» bzw. «CHF 1’650.50» bei Rappenbeträgen. */
export function formatChf(value: number | string | null | undefined, options: { cents?: boolean } = {}): string {
  const n = toNumber(value);
  if (n === null) return "–";
  const hasCents = options.cents ?? !Number.isInteger(n);
  return `CHF ${hasCents ? centsFormat.format(n) : integerFormat.format(n)}`;
}

export function formatNumber(value: number | string | null | undefined, fractionDigits = 0): string {
  const n = toNumber(value);
  if (n === null) return "–";
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: fractionDigits }).format(n);
}

export function formatArea(value: number | string | null | undefined): string {
  const n = toNumber(value);
  if (n === null) return "–";
  return `${decimalFormat.format(n)} m²`;
}

/** Zimmerzahl nach Schweizer Konvention: 3.5 statt 3,5. */
export function formatRooms(value: number | string | null | undefined, withLabel = true): string {
  const n = toNumber(value);
  if (n === null) return "–";
  const text = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return withLabel ? `${text} Zimmer` : text;
}

export function formatFloor(value: number | null | undefined): string {
  if (value === null || value === undefined) return "–";
  if (value === 0) return "Erdgeschoss";
  if (value < 0) return `${Math.abs(value)}. Untergeschoss`;
  return `${value}. OG`;
}

export function formatDate(value: string | Date | null | undefined, options: Intl.DateTimeFormatOptions = {}): string {
  if (!value) return "–";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "–";
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...options,
  }).format(date);
}

export function formatDateLong(value: string | Date | null | undefined): string {
  return formatDate(value, { day: "numeric", month: "long", year: "numeric" });
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "–";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "–";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** «Sa, 14.11.2026, 10:00–10:30» */
export function formatTimeRange(start: string | Date, end: string | Date): string {
  return `${formatDateTime(start)}–${formatTime(end)}`;
}

/** Relative Zeitangabe («vor 5 Minuten», «gestern»). */
export function formatRelative(value: string | Date | null | undefined, now: Date = new Date()): string {
  if (!value) return "–";
  const date = typeof value === "string" ? new Date(value) : value;
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  const abs = Math.abs(diffSeconds);
  if (abs < 60) return "gerade eben";
  if (abs < 3600) return rtf.format(Math.round(diffSeconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSeconds / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(diffSeconds / 86400), "day");
  return formatDate(date);
}

/** Wandelt eine lokale Zürcher Zeit (YYYY-MM-DD, HH:MM) in einen UTC-Zeitpunkt um. */
export function zurichLocalToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  if (!y || !m || !d || hh === undefined || mm === undefined || Number.isNaN(hh) || Number.isNaN(mm)) {
    throw new Error("Ungültiges Datum oder ungültige Zeit");
  }
  // Startschätzung: als UTC interpretieren, dann um den Zürcher Offset korrigieren (2 Iterationen für DST-Grenzen)
  let utc = Date.UTC(y, m - 1, d, hh, mm);
  for (let i = 0; i < 2; i++) {
    const offset = zurichOffsetMinutes(new Date(utc));
    utc = Date.UTC(y, m - 1, d, hh, mm) - offset * 60_000;
  }
  return new Date(utc);
}

/** Offset von Europe/Zurich gegenüber UTC in Minuten (60 im Winter, 120 im Sommer). */
export function zurichOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** Zürcher Datum (YYYY-MM-DD) und Zeit (HH:MM) eines Zeitpunkts – für Formularfelder. */
export function utcToZurichParts(value: string | Date): { date: string; time: string } {
  const at = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return "–";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024, 0)} KB`;
  return `${formatNumber(bytes / (1024 * 1024), 1)} MB`;
}

/** Normalisiert Schweizer Telefonnummern (+41 …) für die Anzeige. */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "";
  const digits = value.replace(/[^\d+]/g, "");
  const m = digits.match(/^(?:\+41|0041|0)(\d{2})(\d{3})(\d{2})(\d{2})$/);
  if (m) return `+41 ${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  return value.trim();
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}
