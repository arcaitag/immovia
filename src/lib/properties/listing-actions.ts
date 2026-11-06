"use server";

import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertUser } from "@/lib/auth/session";
import { AppError, runAction, validationError, type ActionResult } from "@/lib/errors";
import { flushEmailOutbox } from "@/lib/email/outbox";
import { revalidatePropertyViews } from "@/lib/properties/revalidate";
import { isPublicStatus, statusActionCopy } from "@/lib/properties/listing-status";
import { listingFormSchema, statusActionSchema } from "@/lib/validation/listing";
import { loadManagedProperty } from "@/services/properties";
import {
  changeListingStatus,
  ensureOpenListing,
  getPublishingSettings,
  loadManagedListing,
  saveListingContent,
  syncDraftStatus,
} from "@/services/listings";
import type { ListingStatus } from "@/lib/constants";

/** Server Actions für Inserate (Schritte 6–8). */

const uuid = z.uuid("Ungültige Kennung.");

function parseId(value: unknown, message = "Das Inserat wurde nicht gefunden."): string {
  const parsed = uuid.safeParse(value);
  if (!parsed.success) throw new AppError("not_found", message);
  return parsed.data;
}

export async function saveListingAction(
  listingId: unknown,
  input: unknown,
): Promise<ActionResult<{ textsConfirmedAt: string | null; status: ListingStatus }>> {
  return runAction(async () => {
    const user = await assertUser();
    const id = parseId(listingId);
    const parsed = listingFormSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
    const supabase = await createClient();
    const saved = await saveListingContent(supabase, user, id, parsed.data);
    await syncDraftStatus(supabase, saved.property_id);
    revalidatePropertyViews({ publicSlugs: isPublicStatus(saved.status) ? [saved.slug] : [] });
    return { textsConfirmedAt: saved.texts_confirmed_at, status: saved.status };
  }, "Das Inserat wurde gespeichert.");
}

/** Legt ein neues Inserat an, wenn keines offen ist (z. B. nach dem Archivieren). */
export async function ensureListingAction(propertyId: unknown): Promise<ActionResult<{ listingId: string }>> {
  return runAction(async () => {
    const user = await assertUser();
    const id = parseId(propertyId, "Die Immobilie wurde nicht gefunden.");
    const supabase = await createClient();
    await loadManagedProperty(supabase, user, id);
    const listing = await ensureOpenListing(supabase, user, id);
    revalidatePropertyViews();
    return { listingId: listing.id };
  }, "Ein neues Inserat wurde angelegt.");
}

/**
 * Statuswechsel (Veröffentlichen, Pausieren, Reservieren, Verkauft/Vermietet, Archivieren …).
 * Fehler des Triggers (fehlende Pflichtangaben, Prüfpflicht, Sperre) werden über fromDbError übersetzt.
 */
export async function changeListingStatusAction(
  listingId: unknown,
  action: unknown,
): Promise<ActionResult<{ status: ListingStatus; slug: string | null; message: string }>> {
  return runAction(async () => {
    const user = await assertUser();
    const id = parseId(listingId);
    const parsedAction = statusActionSchema.safeParse(action);
    if (!parsedAction.success) throw new AppError("validation", "Unbekannte Aktion.");
    const supabase = await createClient();
    const [settings, listing] = await Promise.all([getPublishingSettings(supabase), loadManagedListing(supabase, user, id)]);
    const copy = statusActionCopy(parsedAction.data, {
      offerType: listing.offer_type,
      requireReview: settings.requireReview,
      approved: Boolean(listing.approved_at),
    });

    const result = await changeListingStatus(supabase, user, id, parsedAction.data);
    const wasPublic = isPublicStatus(result.before);
    const isPublic = isPublicStatus(result.after);
    revalidatePropertyViews({
      publicSlugs: wasPublic || isPublic ? [result.slug] : [],
      visibilityChanged: wasPublic !== isPublic || result.after === "reserved" || result.before === "reserved",
    });
    if (result.after === "published" || result.after === "pending_review") {
      // Benachrichtigungs-E-Mail «Inserat veröffentlicht» sofort versenden
      after(() => flushEmailOutbox());
    }
    return { status: result.after, slug: result.slug, message: copy.success };
  });
}
