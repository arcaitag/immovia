import { zurichLocalToUtc } from "@/lib/format";
import { addDaysIso, minutesToTime, timeToMinutes } from "@/lib/viewings/calendar";
import type { SlotRepeat } from "@/lib/validation/viewing";

/**
 * Erzeugt Besichtigungs-Zeitfenster aus Eingaben in Zürcher Ortszeit.
 * Jeder Termin wird einzeln mit zurichLocalToUtc() umgerechnet. So bleibt
 * «Samstag 10:00» auch über die Umstellung auf Sommer- bzw. Winterzeit 10:00 Uhr.
 */

/** Datenbankregel viewing_slots_time_check: höchstens 8 Stunden pro Zeitfenster. */
export const MAX_SLOT_MINUTES = 8 * 60;
/** Obergrenze pro Vorgang, damit niemand versehentlich hunderte Zeitfenster anlegt. */
export const MAX_SLOTS_PER_REQUEST = 100;

export interface SlotSeriesInput {
  /** Erster Tag, JJJJ-MM-TT (Zürich) */
  date: string;
  /** HH:MM (Zürich) */
  startTime: string;
  /** HH:MM (Zürich), muss nach startTime liegen */
  endTime: string;
  /** Dauer pro Termin in Minuten; 0 = ganzer Zeitraum als ein Termin */
  durationMinutes: number;
  repeat: SlotRepeat;
  /** Anzahl Tage (täglich) bzw. Wochen (wöchentlich); ohne Wiederholung ignoriert */
  occurrences: number;
}

export interface GeneratedSlot {
  /** Zürcher Kalendertag */
  date: string;
  /** Lokale Startzeit HH:MM */
  localStart: string;
  /** Lokale Endzeit HH:MM */
  localEnd: string;
  startsAt: Date;
  endsAt: Date;
}

export type SlotSeriesResult = { ok: true; slots: GeneratedSlot[] } | { ok: false; error: string };

export function buildSlotSeries(input: SlotSeriesInput): SlotSeriesResult {
  const start = timeToMinutes(input.startTime);
  const end = timeToMinutes(input.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { ok: false, error: "Die Endzeit muss nach der Startzeit liegen." };
  }

  const duration = Math.trunc(input.durationMinutes);
  const span = end - start;
  if (duration < 0) return { ok: false, error: "Ungültige Dauer." };
  if (duration === 0 && span > MAX_SLOT_MINUTES) {
    return { ok: false, error: "Ein Zeitfenster darf höchstens 8 Stunden dauern. Teilen Sie den Zeitraum in Termine auf." };
  }
  if (duration > MAX_SLOT_MINUTES) return { ok: false, error: "Ein Termin darf höchstens 8 Stunden dauern." };
  if (duration > span) {
    return { ok: false, error: "Die Dauer pro Termin ist länger als der gewählte Zeitraum." };
  }

  const repeat = input.repeat;
  const occurrences = repeat === "none" ? 1 : Math.max(1, Math.trunc(input.occurrences));
  const stepDays = repeat === "weekly" ? 7 : 1;
  const perDay = duration === 0 ? 1 : Math.floor(span / duration);
  if (perDay * occurrences > MAX_SLOTS_PER_REQUEST) {
    return {
      ok: false,
      error: `Das ergibt ${perDay * occurrences} Zeitfenster. Pro Vorgang sind höchstens ${MAX_SLOTS_PER_REQUEST} möglich.`,
    };
  }

  const slots: GeneratedSlot[] = [];
  for (let i = 0; i < occurrences; i++) {
    const day = addDaysIso(input.date, i * stepDays);
    const chunk = duration === 0 ? span : duration;
    let previousEnd = Number.NEGATIVE_INFINITY;
    for (let from = start; from + chunk <= end; from += chunk) {
      const localStart = minutesToTime(from);
      const localEnd = minutesToTime(from + chunk);
      const startsAt = zurichLocalToUtc(day, localStart);
      const endsAt = zurichLocalToUtc(day, localEnd);
      // In der Nacht der Zeitumstellung gibt es lokale Zeiten nicht (Frühling) bzw. doppelt (Herbst):
      // leere oder sich überschneidende Zeitfenster werden ausgelassen.
      if (endsAt.getTime() <= startsAt.getTime() || startsAt.getTime() < previousEnd) continue;
      previousEnd = endsAt.getTime();
      slots.push({ date: day, localStart, localEnd, startsAt, endsAt });
    }
  }

  if (!slots.length) return { ok: false, error: "Mit diesen Angaben entsteht kein Zeitfenster." };
  return { ok: true, slots };
}

/** Prüft, ob alle Zeitfenster nach dem angegebenen Zeitpunkt beginnen. */
export function firstSlotInPast(slots: GeneratedSlot[], now: Date): GeneratedSlot | null {
  return slots.find((slot) => slot.startsAt.getTime() <= now.getTime()) ?? null;
}
