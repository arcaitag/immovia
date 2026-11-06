import { formatDate, formatTime, utcToZurichParts } from "@/lib/format";
import { addDaysIso } from "@/lib/viewings/calendar";

export const CONVERSATIONS_QUERY_KEY = ["conversations"] as const;

/** Zeit in der Konversationsliste: heute Uhrzeit, diese Woche Wochentag, sonst Datum. */
export function formatConversationTime(value: string | null, now: Date): string {
  if (!value) return "";
  const date = new Date(value);
  const today = utcToZurichParts(now).date;
  const day = utcToZurichParts(date).date;
  if (day === today) return formatTime(date);
  if (day === addDaysIso(today, -1)) return "Gestern";
  if (now.getTime() - date.getTime() < 6 * 86_400_000) return formatDate(date, { weekday: "short", day: undefined, month: undefined, year: undefined });
  return formatDate(date, { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/** Trennlinie im Chat: «Heute», «Gestern» oder «Samstag, 14. November». */
export function dayLabel(dateKey: string, now: Date): string {
  const today = utcToZurichParts(now).date;
  if (dateKey === today) return "Heute";
  if (dateKey === addDaysIso(today, -1)) return "Gestern";
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12));
  const sameYear = dateKey.slice(0, 4) === today.slice(0, 4);
  return formatDate(date, { weekday: "long", day: "numeric", month: "long", year: sameYear ? undefined : "numeric" });
}

export function isImageMime(mime: string | null | undefined): boolean {
  return mime === "image/jpeg" || mime === "image/png" || mime === "image/webp";
}

/** Zeitstempel für Sortierung vereinheitlichen (Datenbank und Realtime liefern unterschiedliche Formate). */
export function normalizeTimestamp(value: string): string {
  let iso = value.trim().replace(" ", "T");
  if (/[+-]\d{2}$/.test(iso)) iso += ":00";
  const time = Date.parse(iso);
  return Number.isNaN(time) ? value : new Date(time).toISOString();
}

/**
 * Zeitstempel für conversation_participants.last_read_at: «gelesen bis einschliesslich dieser Nachricht».
 * Mit Mikrosekunden wird der Originalwert verwendet; ohne (z. B. nach Umwandlung) 1 ms später,
 * damit die Nachricht nicht wegen abgeschnittener Nachkommastellen ungelesen bleibt.
 */
export function readMarker(raw: string): string {
  if (/\.\d{6}/.test(raw)) return raw;
  const time = Date.parse(normalizeTimestamp(raw));
  return Number.isNaN(time) ? raw : new Date(time + 1).toISOString();
}
