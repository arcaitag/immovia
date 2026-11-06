"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertUser } from "@/lib/auth/session";
import { flushEmailOutbox } from "@/lib/email/outbox";
import { AppError, fromDbError, runAction, validationError, type ActionResult } from "@/lib/errors";
import { inquirySchema, reportSchema, type InquiryInput, type ReportInput } from "@/components/listing-detail/schemas";

function sendQueuedEmails() {
  after(async () => {
    try {
      await flushEmailOutbox();
    } catch (error) {
      console.error("[inserat] E-Mail-Versand nach Anfrage fehlgeschlagen", error);
    }
  });
}

/** Kontaktanfrage zu einem Inserat (Datenbankfunktion create_inquiry). Liefert die Konversation. */
export async function createInquiryAction(input: InquiryInput): Promise<ActionResult<{ conversationId: string }>> {
  return runAction(async () => {
    await assertUser();
    const parsed = inquirySchema.safeParse(input);
    if (!parsed.success) throw validationError(z.flattenError(parsed.error).fieldErrors);
    const { listingId, message, phone, wantsViewing, wantsDossier } = parsed.data;

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_inquiry", {
      p_listing_id: listingId,
      p_message: message,
      p_phone: phone || undefined,
      p_wants_viewing: wantsViewing,
      p_wants_dossier: wantsDossier,
    });
    if (error) throw fromDbError(error);
    if (!data) throw new AppError("unknown");
    sendQueuedEmails();
    revalidatePath("/dashboard/nachrichten");
    return { conversationId: data };
  }, "Ihre Anfrage wurde gesendet.");
}

/** Meldet ein Inserat an die Moderation (user_reports). */
export async function reportListingAction(input: ReportInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await assertUser();
    const parsed = reportSchema.safeParse(input);
    if (!parsed.success) throw validationError(z.flattenError(parsed.error).fieldErrors);
    const supabase = await createClient();

    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("id")
      .eq("id", parsed.data.listingId)
      .in("status", ["published", "reserved"])
      .maybeSingle();
    if (listingError) throw fromDbError(listingError);
    if (!listing) throw new AppError("not_found", "Dieses Inserat ist nicht mehr verfügbar.");

    const { data, error } = await supabase
      .from("user_reports")
      .insert({
        target_type: "listing",
        target_id: listing.id,
        reason: parsed.data.reason,
        details: parsed.data.details || null,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") {
        throw new AppError("conflict", "Sie haben dieses Inserat bereits gemeldet. Unser Team prüft Ihre Meldung.");
      }
      throw fromDbError(error);
    }
    return { id: data.id };
  }, "Vielen Dank. Ihre Meldung wurde an unser Team übermittelt.");
}
