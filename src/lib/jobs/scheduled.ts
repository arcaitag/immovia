import "server-only";

/**
 * Zeitgesteuerte Aufgaben, die vom Cron-Endpoint ausgeführt werden
 * (z. B. Termin-Erinnerungen, tägliche/wöchentliche Suchabo-Zusammenfassungen).
 * Implementierung im Fachbereich Kommunikation.
 */
export async function runScheduledTasks(): Promise<Record<string, number>> {
  return {};
}
