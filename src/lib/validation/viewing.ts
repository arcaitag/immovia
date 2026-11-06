import { z } from "zod";

/**
 * Validierung für Besichtigungen: Zeitfenster (einzeln oder Serie), Terminaktionen,
 * Notizen und Buchungen. Alle Zeiten werden als Zürcher Ortszeit erfasst und
 * serverseitig mit zurichLocalToUtc() umgerechnet (siehe src/lib/viewings/series.ts).
 */

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Prüft ein Kalenderdatum im Format JJJJ-MM-TT (inkl. Schaltjahre). */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(5, 7));
  const d = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export const isoDateSchema = z
  .string({ error: "Bitte wählen Sie ein Datum." })
  .refine(isValidIsoDate, "Bitte geben Sie ein gültiges Datum ein.");

export const timeSchema = z
  .string({ error: "Bitte geben Sie eine Uhrzeit ein." })
  .regex(TIME_PATTERN, "Bitte geben Sie eine Uhrzeit im Format HH:MM ein.");

export const SLOT_MODES = {
  single: { label: "Einzelnes Zeitfenster", description: "Ein Zeitfenster an einem Tag, z. B. für eine offene Besichtigung." },
  series: { label: "Serie", description: "Zeitraum in Einzeltermine aufteilen und optional wiederholen." },
} as const;
export type SlotMode = keyof typeof SLOT_MODES;

export const SLOT_REPEATS = {
  none: "Nicht wiederholen",
  daily: "Täglich",
  weekly: "Wöchentlich",
} as const;
export type SlotRepeat = keyof typeof SLOT_REPEATS;

/** 0 = ganzer Zeitraum als ein Termin. */
export const SLOT_DURATION_OPTIONS = [
  { value: 0, label: "Ganzer Zeitraum" },
  { value: 15, label: "15 Minuten" },
  { value: 20, label: "20 Minuten" },
  { value: 30, label: "30 Minuten" },
  { value: 45, label: "45 Minuten" },
  { value: 60, label: "1 Stunde" },
  { value: 90, label: "1,5 Stunden" },
  { value: 120, label: "2 Stunden" },
] as const;

export const slotFormSchema = z
  .object({
    listingId: z.guid("Bitte wählen Sie ein Inserat."),
    mode: z.enum(["single", "series"]),
    date: isoDateSchema,
    startTime: timeSchema,
    endTime: timeSchema,
    durationMinutes: z.number({ error: "Bitte wählen Sie eine Dauer." }).int().min(0).max(480),
    repeat: z.enum(["none", "daily", "weekly"]),
    occurrences: z
      .number({ error: "Bitte geben Sie eine Zahl ein." })
      .int("Bitte geben Sie eine ganze Zahl ein.")
      .min(1, "Mindestens 1.")
      .max(12, "Höchstens 12."),
    capacity: z
      .number({ error: "Bitte geben Sie eine Zahl ein." })
      .int("Bitte geben Sie eine ganze Zahl ein.")
      .min(1, "Mindestens 1 Person.")
      .max(50, "Höchstens 50 Personen."),
    note: z.string().trim().max(300, "Höchstens 300 Zeichen.").optional(),
  })
  .superRefine((value, ctx) => {
    if (TIME_PATTERN.test(value.startTime) && TIME_PATTERN.test(value.endTime) && value.endTime <= value.startTime) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "Die Endzeit muss nach der Startzeit liegen." });
    }
  });
export type SlotFormInput = z.input<typeof slotFormSchema>;
export type SlotFormValues = z.output<typeof slotFormSchema>;

export const APPOINTMENT_ACTIONS = ["confirm", "cancel", "complete", "no_show", "request_reschedule"] as const;
export type AppointmentAction = (typeof APPOINTMENT_ACTIONS)[number];

export const appointmentActionSchema = z.object({
  appointmentId: z.guid(),
  action: z.enum(APPOINTMENT_ACTIONS),
  reason: z.string().trim().max(500, "Höchstens 500 Zeichen.").optional(),
});

export const moveAppointmentSchema = z.object({
  appointmentId: z.guid(),
  slotId: z.guid("Bitte wählen Sie ein Zeitfenster."),
});

export const cancelSlotSchema = z.object({
  slotId: z.guid(),
  reason: z.string().trim().max(500, "Höchstens 500 Zeichen.").optional(),
});

export const deleteSlotSchema = z.object({ slotId: z.guid() });

export const appointmentNoteSchema = z.object({
  appointmentId: z.guid(),
  body: z.string().trim().min(1, "Bitte schreiben Sie eine Notiz.").max(2000, "Höchstens 2000 Zeichen."),
});

export const deleteAppointmentNoteSchema = z.object({ noteId: z.guid() });

export const bookViewingSchema = z.object({
  slotId: z.guid("Bitte wählen Sie ein Zeitfenster."),
  message: z.string().trim().max(1000, "Höchstens 1000 Zeichen.").optional(),
});
