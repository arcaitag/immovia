"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { AppError, fromDbError, runAction, validationError, type ActionResult } from "@/lib/errors";
import { contactSubmissionSchema, type ContactSubmission } from "./schema";

/** Mindestdauer zwischen Öffnen und Absenden – schneller füllen nur Bots ein Formular aus. */
const MIN_FILL_MS = 2500;

/**
 * Kontaktformular (auch ohne Konto). Speichert über die Datenbankfunktion submit_contact_request,
 * die pro E-Mail-Adresse und global ein Rate Limit anwendet.
 */
export async function submitContactAction(input: ContactSubmission): Promise<ActionResult<null>> {
  return runAction(async () => {
    const parsed = contactSubmissionSchema.safeParse(input);
    if (!parsed.success) throw validationError(z.flattenError(parsed.error).fieldErrors);
    const { name, email, subject, message, website, elapsedMs } = parsed.data;

    // Spam-Schutz: Honeypot ausgefüllt oder unrealistisch schnell – nicht speichern, aber keinen Hinweis geben.
    if ((website && website.trim() !== "") || elapsedMs < MIN_FILL_MS) return null;

    if (!isSupabaseConfigured()) {
      throw new AppError("service_unavailable", "Das Kontaktformular ist momentan nicht verfügbar. Bitte versuchen Sie es später erneut.");
    }
    const supabase = await createClient();
    const { error } = await supabase.rpc("submit_contact_request", {
      p_name: name,
      p_email: email,
      p_subject: subject,
      p_message: message,
    });
    if (error) throw fromDbError(error);
    return null;
  }, "Vielen Dank! Ihre Nachricht ist bei uns angekommen.");
}
