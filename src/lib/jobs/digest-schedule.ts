import { utcToZurichParts } from "@/lib/format";

/** Zusammenfassungen von Suchaufträgen gehen frühestens um diese Zürcher Uhrzeit raus. */
export const DIGEST_EARLIEST_HOUR = 7;

const DAYS_BETWEEN = { daily: 1, weekly: 7 } as const;

function dayNumber(dateKey: string): number {
  return Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / 86_400_000);
}

/**
 * Fälligkeit nach Zürcher Kalendertagen statt nach Stunden: täglich ab dem nächsten Kalendertag,
 * wöchentlich ab dem siebten, jeweils frühestens um 07:00. So bleibt die Versandzeit stabil, egal ob
 * der Cron stündlich (Vercel Pro) oder einmal täglich (Hobby) läuft.
 */
export function isDigestDue(frequency: string, lastNotifiedAt: string | null, now: Date): boolean {
  if (frequency !== "daily" && frequency !== "weekly") return false;
  const current = utcToZurichParts(now);
  if (Number(current.time.slice(0, 2)) < DIGEST_EARLIEST_HOUR) return false;
  if (!lastNotifiedAt) return true;
  const last = utcToZurichParts(lastNotifiedAt);
  return dayNumber(current.date) - dayNumber(last.date) >= DAYS_BETWEEN[frequency];
}
