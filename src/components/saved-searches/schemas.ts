import { z } from "zod";

/** Validierung für Suchaufträge (Client-Formular und Server Action). */
export const savedSearchNameSchema = z
  .string()
  .trim()
  .min(1, "Bitte geben Sie einen Namen ein.")
  .max(120, "Der Name darf höchstens 120 Zeichen lang sein.");

export const alertFrequencySchema = z.enum(["instant", "daily", "weekly"], { error: "Bitte wählen Sie eine Häufigkeit." });

export const saveSearchSchema = z.object({
  name: savedSearchNameSchema,
  alertEnabled: z.boolean(),
  frequency: alertFrequencySchema,
  /** Rohkriterien aus der URL; werden serverseitig feldweise geprüft. */
  criteria: z.record(z.string(), z.unknown()),
});
export type SaveSearchInput = z.infer<typeof saveSearchSchema>;

export const updateSavedSearchSchema = z.object({
  id: z.uuid("Ungültiger Suchauftrag."),
  name: savedSearchNameSchema.optional(),
  alertEnabled: z.boolean().optional(),
  frequency: alertFrequencySchema.optional(),
});
export type UpdateSavedSearchInput = z.infer<typeof updateSavedSearchSchema>;

export const deleteSavedSearchSchema = z.object({ id: z.uuid("Ungültiger Suchauftrag.") });

/** Formularfelder des Dialogs «Suchauftrag speichern» */
export const saveSearchFormSchema = z.object({
  name: savedSearchNameSchema,
  alertEnabled: z.boolean(),
  frequency: alertFrequencySchema,
});
export type SaveSearchFormValues = z.infer<typeof saveSearchFormSchema>;
