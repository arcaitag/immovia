import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

/** Überträgt Feldfehler einer Server Action in das Formular. Liefert true, wenn Fehler gesetzt wurden. */
export function applyServerFieldErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  fieldErrors: Record<string, string[]> | undefined,
): boolean {
  if (!fieldErrors) return false;
  let applied = false;
  for (const [key, messages] of Object.entries(fieldErrors)) {
    const message = messages?.[0];
    if (message) {
      setError(key as Path<T>, { type: "server", message });
      applied = true;
    }
  }
  return applied;
}
