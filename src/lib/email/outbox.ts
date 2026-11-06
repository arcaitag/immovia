import "server-only";

/**
 * Versand der E-Mail-Outbox (Tabelle email_outbox).
 * Implementierung: siehe src/lib/email/send.ts (Fachbereich Kommunikation).
 */
export async function processEmailOutbox(_limit = 25): Promise<{ sent: number; failed: number; skipped: number }> {
  return { sent: 0, failed: 0, skipped: 0 };
}

/** Wird von Abläufen aufgerufen, die E-Mails erzeugen (in after()). */
export async function flushEmailOutbox(): Promise<void> {
  await processEmailOutbox(10);
}
