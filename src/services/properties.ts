import "server-only";

import { randomUUID } from "node:crypto";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient, type ServerSupabaseClient } from "@/lib/supabase/server";
import { requireUser, type SessionUser } from "@/lib/auth/session";
import { AppError, fromDbError, validationError } from "@/lib/errors";
import { computeCompleteness, type Completeness } from "@/lib/properties/completeness";
import { formatPropertyAddress, propertyDisplayName } from "@/lib/properties/display";
import { computeStepStates, marketingProgress, nextStep, type PropertyStep, type StepStates } from "@/lib/properties/steps";
import {
  propertyConsistencyIssues,
  type CreatePropertyData,
  type PropertyPatch,
  type RenovationData,
} from "@/lib/validation/property";
import { isUuid } from "@/lib/utils";
import type { Tables, TablesUpdate } from "@/types/database";
import {
  createDraftListing,
  getListingsForProperties,
  getPublishingSettings,
  pickCurrentListing,
  type ListingRow,
  type PublishingSettings,
} from "@/services/listings";

/**
 * Immobilien des Verkäuferbereichs. Lesen und Schreiben immer mit dem Client
 * des angemeldeten Benutzers (RLS), zusätzlich explizite Besitzprüfung, damit
 * Moderatoren (die alle Objekte lesen dürfen) im eigenen Dashboard nur ihre
 * eigenen Immobilien sehen.
 */

export type PropertyRow = Tables<"properties">;
export type RenovationRow = Tables<"property_renovations">;

export function canManageProperty(user: SessionUser, property: { owner_id: string; organization_id: string | null }): boolean {
  return (
    property.owner_id === user.id ||
    (property.organization_id !== null && user.organizations.some((o) => o.id === property.organization_id))
  );
}

/** Filter für Abfragen über mehrere Immobilien: eigene und die der eigenen Firmenkonten. */
function scopeFilter(user: SessionUser): string | null {
  const orgIds = user.organizations.map((o) => o.id);
  return orgIds.length ? `owner_id.eq.${user.id},organization_id.in.(${orgIds.join(",")})` : null;
}

export function completenessOf(property: PropertyRow): Completeness {
  return computeCompleteness(property);
}

export interface PropertyCover {
  id: string;
  display_path: string | null;
  external_url: string | null;
}

export interface PropertyWorkspace {
  user: SessionUser;
  property: PropertyRow;
  listing: ListingRow | null;
  imageCount: number;
  cover: PropertyCover | null;
  latestValuation: { id: string; status: string; created_at: string } | null;
  latestDossierStatus: string | null;
  publishing: PublishingSettings;
  completeness: Completeness;
  steps: StepStates;
  displayName: string;
  address: string;
}

/** Lädt eine Immobilie für Änderungen (Server Actions). Wirft not_found, wenn nicht verwaltbar. */
export async function loadManagedProperty(
  supabase: ServerSupabaseClient,
  user: SessionUser,
  propertyId: string,
): Promise<PropertyRow> {
  if (!isUuid(propertyId)) throw new AppError("not_found", "Die Immobilie wurde nicht gefunden.");
  const { data, error } = await supabase.from("properties").select("*").eq("id", propertyId).is("deleted_at", null).maybeSingle();
  if (error) throw fromDbError(error);
  if (!data || !canManageProperty(user, data)) throw new AppError("not_found", "Die Immobilie wurde nicht gefunden.");
  return data;
}

/**
 * Arbeitsbereich einer Immobilie für Layout und Seiten (pro Request gecacht).
 * Leitet nicht angemeldete Benutzer zum Login und liefert 404 für fremde Objekte.
 */
export const getPropertyWorkspace = cache(async (propertyId: string): Promise<PropertyWorkspace> => {
  if (!isUuid(propertyId)) notFound();
  const user = await requireUser(`/dashboard/immobilien/${propertyId}`);
  const supabase = await createClient();
  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!property || !canManageProperty(user, property)) notFound();

  const [listings, imagesCount, coverRes, valuationRes, dossierRes, publishing] = await Promise.all([
    getListingsForProperties(supabase, [propertyId]),
    supabase
      .from("property_images")
      .select("id", { count: "exact", head: true })
      .eq("property_id", propertyId)
      .eq("status", "ready"),
    supabase
      .from("property_images")
      .select("id, display_path, external_url")
      .eq("property_id", propertyId)
      .eq("status", "ready")
      .order("is_cover", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("property_valuations")
      .select("id, status, created_at")
      .eq("property_id", propertyId)
      .neq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("generated_dossiers")
      .select("status")
      .eq("property_id", propertyId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getPublishingSettings(supabase),
  ]);

  const listing = pickCurrentListing(listings);
  const imageCount = imagesCount.count ?? 0;
  const completeness = completenessOf(property);
  const steps = computeStepStates({
    completeness,
    hasValuation: Boolean(valuationRes.data),
    imageCount,
    minImages: publishing.minImages,
    dossierStatus: dossierRes.data?.status ?? null,
    listing,
  });

  return {
    user,
    property,
    listing,
    imageCount,
    cover: coverRes.data ?? null,
    latestValuation: valuationRes.data ?? null,
    latestDossierStatus: dossierRes.data?.status ?? null,
    publishing,
    completeness,
    steps,
    displayName: propertyDisplayName(property, listing?.title),
    address: formatPropertyAddress(property),
  };
});

/** Seitentitel eines Schritts, z. B. «Bilder · 4.5-Zimmer-Wohnung in Bern». */
export async function propertyStepTitle(propertyId: string, label: string): Promise<string> {
  const workspace = await getPropertyWorkspace(propertyId);
  return `${label} · ${workspace.displayName}`;
}

export interface PropertyOverview {
  property: PropertyRow;
  listing: ListingRow | null;
  cover: PropertyCover | null;
  imageCount: number;
  completeness: Completeness;
  steps: StepStates;
  progress: { done: number; total: number; percent: number };
  next: PropertyStep | null;
  displayName: string;
  address: string;
}

/** Übersicht aller verwaltbaren Immobilien mit Fortschritt (Dashboard, Meine Immobilien). */
export async function listPropertyOverviews(
  supabase: ServerSupabaseClient,
  user: SessionUser,
  options: { limit?: number } = {},
): Promise<PropertyOverview[]> {
  const filter = scopeFilter(user);
  let query = supabase.from("properties").select("*").is("deleted_at", null);
  query = filter ? query.or(filter) : query.eq("owner_id", user.id);
  const { data: properties, error } = await query.order("updated_at", { ascending: false }).limit(options.limit ?? 100);
  if (error) throw fromDbError(error);
  const rows = properties ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((p) => p.id);
  const [listings, imagesRes, valuationsRes, dossiersRes, publishing] = await Promise.all([
    getListingsForProperties(supabase, ids),
    supabase
      .from("property_images")
      .select("id, property_id, display_path, external_url, is_cover, sort_order")
      .in("property_id", ids)
      .eq("status", "ready"),
    supabase.from("property_valuations").select("property_id").in("property_id", ids).neq("status", "failed"),
    supabase.from("generated_dossiers").select("property_id, status, version").in("property_id", ids),
    getPublishingSettings(supabase),
  ]);

  const images = imagesRes.data ?? [];
  const valuated = new Set((valuationsRes.data ?? []).map((v) => v.property_id));
  const latestDossier = new Map<string, { status: string; version: number }>();
  for (const d of dossiersRes.data ?? []) {
    const current = latestDossier.get(d.property_id);
    if (!current || d.version > current.version) latestDossier.set(d.property_id, { status: d.status, version: d.version });
  }

  return rows.map((property) => {
    const listing = pickCurrentListing(listings.filter((l) => l.property_id === property.id));
    const own = images
      .filter((img) => img.property_id === property.id)
      .sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order);
    const cover = own[0] ? { id: own[0].id, display_path: own[0].display_path, external_url: own[0].external_url } : null;
    const completeness = completenessOf(property);
    const steps = computeStepStates({
      completeness,
      hasValuation: valuated.has(property.id),
      imageCount: own.length,
      minImages: publishing.minImages,
      dossierStatus: latestDossier.get(property.id)?.status ?? null,
      listing,
    });
    return {
      property,
      listing,
      cover,
      imageCount: own.length,
      completeness,
      steps,
      progress: marketingProgress(steps),
      next: nextStep(steps),
      displayName: propertyDisplayName(property, listing?.title),
      address: formatPropertyAddress(property),
    };
  });
}

/** Legt Immobilie und Inserat (Entwurf) an. Schlägt das Inserat fehl, wird die Immobilie wieder entfernt. */
export async function createPropertyWithListing(
  supabase: ServerSupabaseClient,
  user: SessionUser,
  input: CreatePropertyData,
): Promise<{ propertyId: string; listingId: string }> {
  if (input.organization_id && !user.organizations.some((o) => o.id === input.organization_id)) {
    throw new AppError("forbidden", "Sie sind nicht Mitglied dieses Firmenkontos.");
  }
  // Die ID wird hier erzeugt: Ein INSERT … RETURNING scheitert an der SELECT-Policy
  // (can_manage_property sieht die neue Zeile im selben Statement noch nicht).
  const propertyId = randomUUID();
  const { error } = await supabase
    .from("properties")
    .insert({
      id: propertyId,
      property_type: input.property_type,
      offer_type: input.offer_type,
      organization_id: input.organization_id,
      street: input.street,
      house_number: input.house_number,
      postal_code: input.postal_code,
      municipality: input.municipality,
      canton: input.canton,
      latitude: input.latitude,
      longitude: input.longitude,
      egid: input.egid,
      condition: input.property_type === "new_build_project" ? "new_build" : null,
      ownership_type: input.property_type === "apartment" && input.offer_type === "sale" ? "condominium" : null,
      wizard_step: 1,
    });
  if (error) throw fromDbError(error);

  try {
    const listing = await createDraftListing(supabase, user, propertyId);
    return { propertyId, listingId: listing.id };
  } catch (cause) {
    await supabase.from("properties").delete().eq("id", propertyId);
    throw cause;
  }
}

/** Letzte Bewertung mit Zahlen (für den Preisvorschlag im Inserat). */
export async function getLatestValuationSuggestion(
  supabase: ServerSupabaseClient,
  propertyId: string,
): Promise<{ suggestedListPrice: number | null; createdAt: string } | null> {
  const { data } = await supabase
    .from("property_valuations")
    .select("suggested_list_price, created_at")
    .eq("property_id", propertyId)
    .in("status", ["completed", "limited"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { suggestedListPrice: data.suggested_list_price, createdAt: data.created_at };
}

export async function getPropertyFeatures(supabase: ServerSupabaseClient, propertyId: string): Promise<string[]> {
  const { data } = await supabase.from("property_features").select("feature_key").eq("property_id", propertyId);
  return (data ?? []).map((f) => f.feature_key);
}

/**
 * Speichert geänderte Felder (automatisches Zwischenspeichern). Kreuzprüfungen
 * laufen gegen den zusammengeführten Stand aus Datenbank und Änderung.
 */
export async function updatePropertyFields(
  supabase: ServerSupabaseClient,
  user: SessionUser,
  propertyId: string,
  patch: PropertyPatch,
): Promise<PropertyRow> {
  const current = await loadManagedProperty(supabase, user, propertyId);
  const { features, ...columns } = patch;

  const merged = { ...current, ...columns };
  const issues = propertyConsistencyIssues(merged);
  if (issues.length) {
    throw validationError(Object.fromEntries(issues.map((issue) => [issue.field, [issue.message]])));
  }

  const update: TablesUpdate<"properties"> = { ...columns };
  if (columns.available_by_arrangement === true) update.available_from = null;
  if (columns.property_type === "new_build_project" && !current.condition && columns.condition === undefined) {
    update.condition = "new_build";
  }

  let row = current;
  if (Object.keys(update).length > 0) {
    const { data, error } = await supabase.from("properties").update(update).eq("id", propertyId).select("*").single();
    if (error || !data) throw fromDbError(error);
    row = data;
  }

  if (features) {
    const existing = new Set(await getPropertyFeatures(supabase, propertyId));
    const wanted = new Set<string>(features);
    const toAdd = [...wanted].filter((key) => !existing.has(key));
    const toRemove = [...existing].filter((key) => !wanted.has(key));
    if (toRemove.length) {
      const { error } = await supabase.from("property_features").delete().eq("property_id", propertyId).in("feature_key", toRemove);
      if (error) throw fromDbError(error);
    }
    if (toAdd.length) {
      const { error } = await supabase
        .from("property_features")
        .insert(toAdd.map((feature_key) => ({ property_id: propertyId, feature_key })));
      if (error && error.code !== "23505") throw fromDbError(error);
    }
  }
  return row;
}

export async function setWizardStep(
  supabase: ServerSupabaseClient,
  user: SessionUser,
  propertyId: string,
  step: number,
): Promise<void> {
  await loadManagedProperty(supabase, user, propertyId);
  const { error } = await supabase.from("properties").update({ wizard_step: step }).eq("id", propertyId);
  if (error) throw fromDbError(error);
}

// ---------------------------------------------------------------------------
// Renovationen
// ---------------------------------------------------------------------------

export async function listRenovations(supabase: ServerSupabaseClient, propertyId: string): Promise<RenovationRow[]> {
  const { data } = await supabase
    .from("property_renovations")
    .select("*")
    .eq("property_id", propertyId)
    .order("year", { ascending: false })
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function addRenovation(
  supabase: ServerSupabaseClient,
  user: SessionUser,
  propertyId: string,
  input: RenovationData,
): Promise<RenovationRow[]> {
  await loadManagedProperty(supabase, user, propertyId);
  const { error } = await supabase.from("property_renovations").insert({ property_id: propertyId, ...input });
  if (error) throw fromDbError(error);
  return listRenovations(supabase, propertyId);
}

async function loadManagedRenovation(supabase: ServerSupabaseClient, user: SessionUser, renovationId: string) {
  if (!isUuid(renovationId)) throw new AppError("not_found");
  const { data } = await supabase.from("property_renovations").select("id, property_id").eq("id", renovationId).maybeSingle();
  if (!data) throw new AppError("not_found");
  await loadManagedProperty(supabase, user, data.property_id);
  return data;
}

export async function updateRenovation(
  supabase: ServerSupabaseClient,
  user: SessionUser,
  renovationId: string,
  input: RenovationData,
): Promise<RenovationRow[]> {
  const renovation = await loadManagedRenovation(supabase, user, renovationId);
  const { error } = await supabase.from("property_renovations").update(input).eq("id", renovationId);
  if (error) throw fromDbError(error);
  return listRenovations(supabase, renovation.property_id);
}

export async function deleteRenovation(
  supabase: ServerSupabaseClient,
  user: SessionUser,
  renovationId: string,
): Promise<RenovationRow[]> {
  const renovation = await loadManagedRenovation(supabase, user, renovationId);
  const { error } = await supabase.from("property_renovations").delete().eq("id", renovationId);
  if (error) throw fromDbError(error);
  return listRenovations(supabase, renovation.property_id);
}

// ---------------------------------------------------------------------------
// Löschen (Soft Delete)
// ---------------------------------------------------------------------------

/**
 * Archiviert die Inserate (Trigger setzt bei deleted_at den Status «archiviert») und markiert
 * die Immobilie als gelöscht. Läuft über die Datenbankfunktion soft_delete_property: Ein direktes
 * Update lehnt die Zeilensicherheit ab, weil die gelöschte Zeile danach nicht mehr lesbar ist.
 */
export async function softDeleteProperty(
  supabase: ServerSupabaseClient,
  user: SessionUser,
  propertyId: string,
): Promise<{ publicSlugs: string[] }> {
  await loadManagedProperty(supabase, user, propertyId);
  const { data, error } = await supabase.rpc("soft_delete_property", { p_property: propertyId });
  if (error) throw fromDbError(error);
  return { publicSlugs: data ?? [] };
}
