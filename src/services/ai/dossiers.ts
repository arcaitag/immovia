import "server-only";

import type { SessionUser } from "@/lib/auth/session";
import { AppError, fromDbError, validationError } from "@/lib/errors";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { dossierOptionsSchema } from "@/lib/pdf/dossier/options";
import { isUuid } from "@/lib/utils";
import {
  assertAvailable,
  canManageProperty,
  enforceRateLimit,
  enqueueAndRun,
  getFeatureAvailability,
  requireManagedProperty,
} from "@/services/ai/access";
import { revalidateProperty } from "@/services/ai/revalidate";
import { getDossierSummary } from "@/services/listings";

/** Verkaufsdossier: Erstellung als Job, Freigabe und Löschen von Versionen. */

export async function requestDossierJob(
  supabase: ServerSupabaseClient,
  user: SessionUser,
  propertyId: string,
  rawOptions: unknown,
): Promise<{ jobId: string }> {
  await requireManagedProperty(supabase, user, propertyId);
  const parsed = dossierOptionsSchema.safeParse(rawOptions ?? {});
  if (!parsed.success) throw new AppError("validation", parsed.error.issues[0]?.message);
  assertAvailable(
    await getFeatureAvailability({ supabase, userId: user.id, flag: "dossiers", requiresAi: false, requiresConsent: false }),
  );
  await enforceRateLimit(`dossier:${user.id}`, 10, 3600);
  const job = await enqueueAndRun({
    userId: user.id,
    type: "dossier_pdf",
    propertyId,
    input: { options: parsed.data } as unknown as Json,
    maxAttempts: 2,
  });
  return { jobId: job.id };
}

async function loadOwnDossier(supabase: ServerSupabaseClient, user: SessionUser, dossierId: string) {
  if (!isUuid(dossierId)) throw new AppError("not_found");
  const { data: dossier } = await supabase
    .from("generated_dossiers")
    .select("id, property_id, status, storage_path, is_public")
    .eq("id", dossierId)
    .maybeSingle();
  if (!dossier) throw new AppError("not_found", "Die Dossier-Version wurde nicht gefunden.");
  const { data: property } = await supabase.from("properties").select("owner_id, organization_id").eq("id", dossier.property_id).maybeSingle();
  if (!property || !canManageProperty(user, property)) throw new AppError("not_found", "Die Dossier-Version wurde nicht gefunden.");
  return dossier;
}

/** Gibt genau eine Version für das Inserat frei (bzw. hebt die Freigabe auf). */
export async function setDossierPublic(supabase: ServerSupabaseClient, user: SessionUser, dossierId: string, isPublic: boolean): Promise<void> {
  const dossier = await loadOwnDossier(supabase, user, dossierId);
  if (isPublic && dossier.status !== "ready") throw new AppError("invalid_state", "Nur fertig erstellte Versionen können freigegeben werden.");
  if (isPublic) {
    const { error: resetError } = await supabase
      .from("generated_dossiers")
      .update({ is_public: false })
      .eq("property_id", dossier.property_id)
      .eq("is_public", true)
      .neq("id", dossier.id);
    if (resetError) throw fromDbError(resetError);
  }
  const { error } = await supabase.from("generated_dossiers").update({ is_public: isPublic }).eq("id", dossier.id);
  if (error) throw fromDbError(error);
  await revalidateProperty(supabase, dossier.property_id, [`/dashboard/immobilien/${dossier.property_id}/dossier`, "/dashboard/dossiers"]);
}

/**
 * Schalter im Inserat: Dossier öffentlich zum Download anbieten. Wie im Inserat-Schritt des
 * Verkäuferbereichs wird beim Einschalten die neueste fertige Version freigegeben, falls noch
 * keine Version freigegeben ist.
 */
export async function setListingDossierPublic(supabase: ServerSupabaseClient, user: SessionUser, propertyId: string, value: boolean): Promise<void> {
  await requireManagedProperty(supabase, user, propertyId);
  const { data: listing } = await supabase
    .from("listings")
    .select("id")
    .eq("property_id", propertyId)
    .is("deleted_at", null)
    .neq("status", "archived")
    .maybeSingle();
  if (!listing) throw new AppError("invalid_state", "Es gibt noch kein Inserat für diese Immobilie.");
  if (value) {
    const summary = await getDossierSummary(supabase, propertyId);
    if (!summary.latestReady) {
      throw validationError({ dossier_public: ["Es ist noch kein fertiges Verkaufsdossier vorhanden."] }, "Es ist noch kein fertiges Verkaufsdossier vorhanden.");
    }
    if (!summary.publicVersion) {
      const { error: publishError } = await supabase.from("generated_dossiers").update({ is_public: true }).eq("id", summary.latestReady.id);
      if (publishError) throw fromDbError(publishError);
    }
  }
  const { error } = await supabase.from("listings").update({ dossier_public: value }).eq("id", listing.id);
  if (error) throw fromDbError(error);
  await revalidateProperty(supabase, propertyId, [`/dashboard/immobilien/${propertyId}/dossier`, "/dashboard/dossiers"]);
}

/**
 * Löscht eine Version mit dem Benutzer-Client: Datensatz (Policy generated_dossiers_delete,
 * Migration 20261106220000_c_dossier_delete) und Datei (Storage-Policy). Laufende Erstellungen
 * werden nicht gelöscht, damit der Auftrag nicht ins Leere schreibt.
 */
export async function deleteDossierVersion(supabase: ServerSupabaseClient, user: SessionUser, dossierId: string): Promise<void> {
  const dossier = await loadOwnDossier(supabase, user, dossierId);
  if (dossier.status === "generating") throw new AppError("invalid_state", "Diese Version wird gerade erstellt. Bitte warten Sie, bis sie fertig ist.");
  const { data: deleted, error } = await supabase.from("generated_dossiers").delete().eq("id", dossier.id).select("id");
  if (error) throw fromDbError(error);
  if (!deleted?.length) throw new AppError("forbidden", "Die Version konnte nicht gelöscht werden.");
  if (dossier.storage_path) {
    const { error: storageError } = await supabase.storage.from("dossiers").remove([dossier.storage_path]);
    if (storageError) console.warn("[dossier] PDF-Datei konnte nicht entfernt werden", dossier.storage_path, storageError.message);
  }
  await revalidateProperty(supabase, dossier.property_id, [`/dashboard/immobilien/${dossier.property_id}/dossier`, "/dashboard/dossiers"]);
}
