import { utcToZurichParts, zurichLocalToUtc } from "@/lib/format";

/**
 * Kalenderhilfen für Zürcher Ortszeit. Datumswerte sind Zeichenketten «JJJJ-MM-TT»
 * (Kalendertage in Europe/Zurich), damit Sommer-/Winterzeit nie zu Tagesverschiebungen führt.
 */

function parseIsoDate(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`Ungültiges Datum: ${date}`);
  return { y, m, d };
}

/** Addiert Kalendertage (nicht 24-Stunden-Blöcke) zu einem Datum. */
export function addDaysIso(date: string, days: number): string {
  const { y, m, d } = parseIsoDate(date);
  const result = new Date(Date.UTC(y, m - 1, d + days));
  return result.toISOString().slice(0, 10);
}

/** Wochentag nach ISO 8601: 1 = Montag … 7 = Sonntag. */
export function isoWeekday(date: string): number {
  const { y, m, d } = parseIsoDate(date);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Montag der Woche, in der das Datum liegt. */
export function startOfWeekIso(date: string): string {
  return addDaysIso(date, 1 - isoWeekday(date));
}

/** Die sieben Kalendertage (Mo–So) der Woche, in der das Datum liegt. */
export function weekDaysIso(date: string): string[] {
  const monday = startOfWeekIso(date);
  return Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i));
}

/** Zürcher Kalendertag eines Zeitpunkts. */
export function zurichDateKey(value: string | Date): string {
  return utcToZurichParts(value).date;
}

/** Beginn eines Zürcher Kalendertags als UTC-Zeitpunkt. */
export function zurichDayStartUtc(date: string): Date {
  return zurichLocalToUtc(date, "00:00");
}

/** Ende eines Zürcher Kalendertags (23:59) als UTC-Zeitpunkt, z. B. für Ablaufdaten von Freigaben. */
export function zurichDayEndUtc(date: string): Date {
  return new Date(zurichLocalToUtc(date, "23:59").getTime() + 59_000);
}

/** Minuten seit Mitternacht für «HH:MM». */
export function timeToMinutes(time: string): number {
  const [hh, mm] = time.split(":").map(Number);
  return (hh ?? 0) * 60 + (mm ?? 0);
}

/** «HH:MM» für Minuten seit Mitternacht (0–1439). */
export function minutesToTime(minutes: number): string {
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Gruppiert Einträge nach Zürcher Kalendertag (sortiert nach Datum). */
export function groupByZurichDay<T>(items: T[], getDate: (item: T) => string): Array<{ date: string; items: T[] }> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = zurichDateKey(getDate(item));
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, list]) => ({ date, items: list }));
}
