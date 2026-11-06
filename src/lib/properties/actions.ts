"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertUser } from "@/lib/auth/session";
import { AppError, runAction, validationError, type ActionResult } from "@/lib/errors";
import { revalidatePropertyViews } from "@/lib/properties/revalidate";
import { isPublicStatus } from "@/lib/properties/listing-status";
import {
  createPropertySchema,
  propertyPatchSchema,
  renovationSchema,
  wizardStepSchema,
} from "@/lib/validation/property";
import {
  addRenovation,
  deleteRenovation,
  setWizardStep,
  softDeleteProperty,
  updatePropertyFields,
  updateRenovation,
  createPropertyWithListing,
  type RenovationRow,
} from "@/services/properties";
import { getListingsForProperties, pickCurrentListing, syncDraftStatus } from "@/services/listings";

/**
 * Server Actions für Immobilien (Schritt 1 und Verwaltung).
 * Dünne Hülle: Eingaben prüfen, Service aufrufen, Seiten invalidieren.
 */

const idSchema = z.uuid("Ungültige Kennung.");

function parseId(value: unknown): string {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) throw new AppError("not_found");
  return parsed.data;
}

export async function createPropertyAction(input: unknown): Promise<ActionResult<{ id: string; redirectTo: string }>> {
  return runAction(async () => {
    const user = await assertUser();
    const parsed = createPropertySchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
    const supabase = await createClient();
    const { propertyId } = await createPropertyWithListing(supabase, user, parsed.data);
    revalidatePropertyViews();
    const target = parsed.data.goal === "bewertung" ? "bewertung" : "bearbeiten";
    return { id: propertyId, redirectTo: `/dashboard/immobilien/${propertyId}/${target}` };
  }, "Die Immobilie wurde angelegt.");
}

/** Automatisches Zwischenspeichern: nur geänderte Felder (Rohwerte aus dem Formular). */
export async function savePropertyFieldsAction(
  propertyId: unknown,
  patch: unknown,
): Promise<ActionResult<{ savedAt: string }>> {
  return runAction(async () => {
    const user = await assertUser();
    const id = parseId(propertyId);
    const parsed = propertyPatchSchema.safeParse(patch);
    if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
    if (Object.keys(parsed.data).length === 0) return { savedAt: new Date().toISOString() };

    const supabase = await createClient();
    await updatePropertyFields(supabase, user, id, parsed.data);

    const listing = pickCurrentListing(await getListingsForProperties(supabase, [id]));
    if (["postal_code", "municipality", "property_type", "offer_type"].some((key) => key in parsed.data)) {
      await syncDraftStatus(supabase, id);
    }
    revalidatePropertyViews({ publicSlugs: listing && isPublicStatus(listing.status) ? [listing.slug] : [] });
    return { savedAt: new Date().toISOString() };
  });
}

export async function setWizardStepAction(propertyId: unknown, step: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const id = parseId(propertyId);
    const parsed = wizardStepSchema.safeParse(step);
    if (!parsed.success) throw new AppError("validation");
    const supabase = await createClient();
    await setWizardStep(supabase, user, id, parsed.data);
    return null;
  });
}

export async function addRenovationAction(propertyId: unknown, input: unknown): Promise<ActionResult<RenovationRow[]>> {
  return runAction(async () => {
    const user = await assertUser();
    const id = parseId(propertyId);
    const parsed = renovationSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
    const supabase = await createClient();
    const rows = await addRenovation(supabase, user, id, parsed.data);
    revalidatePropertyViews();
    return rows;
  }, "Renovation hinzugefügt.");
}

export async function updateRenovationAction(renovationId: unknown, input: unknown): Promise<ActionResult<RenovationRow[]>> {
  return runAction(async () => {
    const user = await assertUser();
    const id = parseId(renovationId);
    const parsed = renovationSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
    const supabase = await createClient();
    const rows = await updateRenovation(supabase, user, id, parsed.data);
    revalidatePropertyViews();
    return rows;
  }, "Renovation gespeichert.");
}

export async function deleteRenovationAction(renovationId: unknown): Promise<ActionResult<RenovationRow[]>> {
  return runAction(async () => {
    const user = await assertUser();
    const id = parseId(renovationId);
    const supabase = await createClient();
    const rows = await deleteRenovation(supabase, user, id);
    revalidatePropertyViews();
    return rows;
  }, "Renovation entfernt.");
}

/**
 * Soft Delete einer Immobilie. Mit redirectToList (Aufruf von einer Seite der Immobilie)
 * wird direkt zur Liste weitergeleitet, damit die gelöschte Seite nicht neu gerendert wird.
 */
export async function deletePropertyAction(propertyId: unknown, redirectToList = false): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const id = parseId(propertyId);
    const supabase = await createClient();
    const { publicSlugs } = await softDeleteProperty(supabase, user, id);
    revalidatePropertyViews({ publicSlugs, visibilityChanged: publicSlugs.length > 0 });
    if (redirectToList === true) redirect("/dashboard/immobilien?geloescht=1");
    return null;
  }, "Die Immobilie wurde gelöscht.");
}
