import "server-only";

import { z } from "zod";
import type { SessionUser } from "@/lib/auth/session";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { AppError, fromDbError, validationError } from "@/lib/errors";
import type { ListingStatus } from "@/lib/constants";
import {
  isDraftStatus,
  isPublishReady,
  isStatusActionAvailable,
  statusActionTarget,
  type StatusAction,
} from "@/lib/properties/listing-status";
import { listingTextsSignature, type ListingFormData } from "@/lib/validation/listing";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";

/**
 * Inserate aus Sicht der Eigentümer: Einstellungen, Inseratzeilen, Status,
 * Statistiken und Verkaufsaktivität. Alle Abfragen laufen mit dem Client des
 * angemeldeten Benutzers (RLS greift).
 */

export type ListingRow = Tables<"listings">;

// ---------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------

const publishingSettingsSchema = z.object({
  require_review: z.boolean().default(false).catch(false),
  min_images: z.number().int().min(0).max(100).default(1).catch(1),
  max_images: z.number().int().min(1).max(500).default(40).catch(40),
});

export interface PublishingSettings {
  requireReview: boolean;
  minImages: number;
  maxImages: number;
}

export async function getPublishingSettings(supabase: ServerSupabaseClient): Promise<PublishingSettings> {
  const { data } = await supabase.from("feature_settings").select("value").eq("key", "publishing").maybeSingle();
  const parsed = publishingSettingsSchema.safeParse(data?.value ?? {});
  const value = parsed.success ? parsed.data : { require_review: false, min_images: 1, max_images: 40 };
  return { requireReview: value.require_review, minImages: value.min_images, maxImages: value.max_images };
}

// ---------------------------------------------------------------------------
// Inseratzeilen
// ---------------------------------------------------------------------------

/** Das aktuelle Inserat einer Immobilie: offenes Inserat, sonst das zuletzt archivierte. */
export function pickCurrentListing<T extends { status: ListingStatus; created_at: string }>(listings: T[]): T | null {
  const sorted = [...listings].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return sorted.find((l) => l.status !== "archived") ?? sorted[0] ?? null;
}

export async function getListingsForProperties(supabase: ServerSupabaseClient, propertyIds: string[]): Promise<ListingRow[]> {
  if (propertyIds.length === 0) return [];
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .in("property_id", propertyIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw fromDbError(error);
  return data ?? [];
}

export function canManageListing(user: SessionUser, listing: { owner_id: string; organization_id: string | null }): boolean {
  return (
    listing.owner_id === user.id ||
    (listing.organization_id !== null && user.organizations.some((o) => o.id === listing.organization_id))
  );
}

/** Lädt ein Inserat für Änderungen und prüft die Berechtigung (für Server Actions). */
export async function loadManagedListing(
  supabase: ServerSupabaseClient,
  user: SessionUser,
  listingId: string,
): Promise<ListingRow> {
  const { data, error } = await supabase.from("listings").select("*").eq("id", listingId).is("deleted_at", null).maybeSingle();
  if (error) throw fromDbError(error);
  if (!data || !canManageListing(user, data)) throw new AppError("not_found", "Das Inserat wurde nicht gefunden.");
  return data;
}

/** Legt ein leeres Inserat (Entwurf) für eine Immobilie an, vorbelegt mit den Kontaktdaten. */
export async function createDraftListing(
  supabase: ServerSupabaseClient,
  user: SessionUser,
  propertyId: string,
): Promise<ListingRow> {
  const profile = user.profile;
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || profile.display_name;
  const phone = profile.phone && /^\+?[0-9 ()/-]{6,24}$/.test(profile.phone) ? profile.phone : null;
  // Besitz, Angebotsart und Objektdaten setzt der Trigger listings_before_write aus der Immobilie.
  const draft: Pick<TablesInsert<"listings">, "property_id" | "contact_name" | "contact_email" | "contact_phone" | "location_precision"> = {
    property_id: propertyId,
    contact_name: name.slice(0, 120) || null,
    contact_email: user.email,
    contact_phone: phone,
    location_precision: "area",
  };
  const { data, error } = await supabase
    .from("listings")
    .insert(draft as TablesInsert<"listings">)
    .select("*")
    .single();
  if (error || !data) throw fromDbError(error);
  return data;
}

/** Liefert das offene Inserat einer Immobilie oder legt ein neues an (z. B. nach dem Archivieren). */
export async function ensureOpenListing(
  supabase: ServerSupabaseClient,
  user: SessionUser,
  propertyId: string,
): Promise<ListingRow> {
  const current = pickCurrentListing(await getListingsForProperties(supabase, [propertyId]));
  if (current && current.status !== "archived") return current;
  return createDraftListing(supabase, user, propertyId);
}

/**
 * Speichert Preis, Texte, Standortgenauigkeit und Kontakt (Schritt 6).
 * Geänderte Texte müssen neu bestätigt werden; «Preis auf Anfrage» entfernt den Preis
 * aus dem öffentlichen Datensatz.
 */
export async function saveListingContent(
  supabase: ServerSupabaseClient,
  user: SessionUser,
  listingId: string,
  data: ListingFormData,
): Promise<ListingRow> {
  const listing = await loadManagedListing(supabase, user, listingId);
  if (listing.status === "archived") {
    throw new AppError("invalid_state", "Archivierte Inserate können nicht mehr bearbeitet werden.");
  }

  const textsChanged = listingTextsSignature(listing) !== listingTextsSignature(data);
  let textsConfirmedAt = listing.texts_confirmed_at;
  if (!data.texts_confirmed) textsConfirmedAt = null;
  else if (textsChanged || !listing.texts_confirmed_at) textsConfirmedAt = new Date().toISOString();

  if (data.dossier_public && !listing.dossier_public) {
    const dossiers = await getDossierSummary(supabase, listing.property_id);
    if (!dossiers.latestReady) {
      throw validationError(
        { dossier_public: ["Es ist noch kein fertiges Verkaufsdossier vorhanden."] },
        "Es ist noch kein fertiges Verkaufsdossier vorhanden.",
      );
    }
    if (!dossiers.publicVersion) {
      // Freigegeben wird die neueste fertige Version (höchstens eine öffentliche Version pro Immobilie).
      const { error } = await supabase.from("generated_dossiers").update({ is_public: true }).eq("id", dossiers.latestReady.id);
      if (error) throw fromDbError(error);
    }
  }

  const update: TablesUpdate<"listings"> = {
    price: data.price_on_request ? null : data.price,
    price_on_request: data.price_on_request,
    additional_costs: listing.offer_type === "rent" ? data.additional_costs : null,
    parking_price: data.parking_price,
    title: data.title,
    short_description: data.short_description,
    description: data.description,
    location_description: data.location_description,
    equipment_description: data.equipment_description,
    highlights: data.highlights,
    search_summary: data.search_summary,
    location_precision: data.location_precision,
    contact_name: data.contact_name,
    contact_phone: data.contact_phone,
    contact_email: data.contact_email,
    show_contact_phone: data.show_contact_phone,
    dossier_public: data.dossier_public,
    texts_confirmed_at: textsConfirmedAt,
  };
  const { data: saved, error } = await supabase.from("listings").update(update).eq("id", listingId).select("*").single();
  if (error || !saved) throw fromDbError(error);
  return saved;
}

export interface StatusChangeResult {
  before: ListingStatus;
  after: ListingStatus;
  slug: string | null;
  propertyId: string;
}

/** Statuswechsel über eine Benutzeraktion; die Datenbank prüft Übergang und Pflichtangaben erneut. */
export async function changeListingStatus(
  supabase: ServerSupabaseClient,
  user: SessionUser,
  listingId: string,
  action: StatusAction,
): Promise<StatusChangeResult> {
  const listing = await loadManagedListing(supabase, user, listingId);
  const settings = await getPublishingSettings(supabase);
  const ctx = {
    status: listing.status,
    offerType: listing.offer_type,
    requireReview: settings.requireReview,
    approved: Boolean(listing.approved_at),
  };
  if (!isStatusActionAvailable(action, ctx)) {
    throw new AppError("invalid_state", "Diese Aktion ist im aktuellen Status des Inserats nicht möglich.");
  }
  const target = statusActionTarget(action, ctx);
  if (!target) throw new AppError("invalid_state");
  const { data, error } = await supabase
    .from("listings")
    .update({ status: target })
    .eq("id", listingId)
    .select("status, slug")
    .single();
  if (error || !data) throw fromDbError(error);
  return { before: listing.status, after: data.status, slug: data.slug ?? listing.slug, propertyId: listing.property_id };
}

/**
 * Pflegt die Vorstufen draft → in_progress → ready automatisch anhand der
 * Checkliste. Veröffentlichte oder geprüfte Inserate bleiben unverändert.
 */
export async function syncDraftStatus(supabase: ServerSupabaseClient, propertyId: string): Promise<void> {
  const { data: listings } = await supabase
    .from("listings")
    .select("id, status, created_at, title, description, short_description, price, price_on_request, texts_confirmed_at, postal_code, municipality")
    .eq("property_id", propertyId)
    .is("deleted_at", null);
  const listing = pickCurrentListing(listings ?? []);
  if (!listing || !isDraftStatus(listing.status)) return;

  const [{ count }, settings] = await Promise.all([
    supabase
      .from("property_images")
      .select("id", { count: "exact", head: true })
      .eq("property_id", propertyId)
      .eq("status", "ready"),
    getPublishingSettings(supabase),
  ]);
  const imageCount = count ?? 0;
  const ready = isPublishReady({
    title: listing.title,
    description: listing.description,
    price: listing.price,
    priceOnRequest: listing.price_on_request,
    postalCode: listing.postal_code,
    municipality: listing.municipality,
    textsConfirmedAt: listing.texts_confirmed_at,
    imageCount,
    minImages: settings.minImages,
  });
  const started =
    imageCount > 0 ||
    Boolean(listing.title || listing.description || listing.short_description) ||
    listing.price !== null ||
    listing.price_on_request;
  const target: ListingStatus = ready ? "ready" : started ? "in_progress" : "draft";
  if (target === listing.status) return;
  const { error } = await supabase.from("listings").update({ status: target }).eq("id", listing.id);
  if (error) console.error("[listings] Status konnte nicht nachgeführt werden", error.message);
}

// ---------------------------------------------------------------------------
// Dossiers (nur lesend; erstellt werden sie im Schritt «Dossier»)
// ---------------------------------------------------------------------------

export interface DossierSummary {
  latestStatus: string | null;
  readyCount: number;
  latestReady: { id: string; version: number; created_at: string; is_public: boolean } | null;
  publicVersion: { id: string; version: number; created_at: string } | null;
}

export async function getDossierSummary(supabase: ServerSupabaseClient, propertyId: string): Promise<DossierSummary> {
  const { data } = await supabase
    .from("generated_dossiers")
    .select("id, version, status, is_public, created_at")
    .eq("property_id", propertyId)
    .order("version", { ascending: false })
    .limit(30);
  const rows = data ?? [];
  const ready = rows.filter((d) => d.status === "ready");
  const latestReady = ready[0] ?? null;
  const publicRow = ready.find((d) => d.is_public) ?? null;
  return {
    latestStatus: rows[0]?.status ?? null,
    readyCount: ready.length,
    latestReady: latestReady
      ? { id: latestReady.id, version: latestReady.version, created_at: latestReady.created_at, is_public: latestReady.is_public }
      : null,
    publicVersion: publicRow ? { id: publicRow.id, version: publicRow.version, created_at: publicRow.created_at } : null,
  };
}

// ---------------------------------------------------------------------------
// Statusverlauf
// ---------------------------------------------------------------------------

export async function getStatusHistory(supabase: ServerSupabaseClient, listingId: string, limit = 20) {
  const { data } = await supabase
    .from("listing_status_history")
    .select("id, from_status, to_status, changed_by, reason, created_at")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Kennzahlen (RPC – nur echte Ereignisse)
// ---------------------------------------------------------------------------

const count = z.coerce.number().int().nonnegative().catch(0);

const ownerOverviewSchema = z.object({
  active_listings: count,
  draft_listings: count,
  total_views: count,
  views_last_7_days: count,
  favorites_on_my_listings: count,
  new_leads: count,
  open_viewings: count,
  pending_viewing_requests: count,
  my_favorites: count,
  properties: count,
});

export type OwnerOverview = z.output<typeof ownerOverviewSchema>;

export async function getOwnerOverview(supabase: ServerSupabaseClient): Promise<OwnerOverview | null> {
  const { data, error } = await supabase.rpc("get_owner_overview");
  if (error) {
    console.error("[dashboard] get_owner_overview fehlgeschlagen", error.message);
    return null;
  }
  const parsed = ownerOverviewSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

const statisticsSchema = z.object({
  listing_id: z.string(),
  published_at: z.string().nullable().catch(null),
  views_total: count,
  favorites: count,
  inquiries: count,
  leads: count,
  viewings: count,
  series: z
    .array(z.object({ date: z.string(), views: count, inquiries: count }))
    .catch([]),
});

export type ListingStatistics = z.output<typeof statisticsSchema>;

export async function getListingStatistics(
  supabase: ServerSupabaseClient,
  listingId: string,
  days: number,
): Promise<ListingStatistics | null> {
  const { data, error } = await supabase.rpc("get_listing_statistics", { p_listing_id: listingId, p_days: days });
  if (error) {
    if (error.message !== "not_found") console.error("[statistik] get_listing_statistics fehlgeschlagen", error.message);
    return null;
  }
  const parsed = statisticsSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

// ---------------------------------------------------------------------------
// Verkaufsaktivität (Dashboard, Verkaufsverwaltung)
// ---------------------------------------------------------------------------

export type ConversationSummary = Awaited<ReturnType<typeof getRecentConversations>>[number];

export async function getRecentConversations(
  supabase: ServerSupabaseClient,
  options: { limit: number; listingId?: string },
) {
  const { data, error } = await supabase.rpc("get_my_conversations");
  if (error) {
    console.error("[dashboard] get_my_conversations fehlgeschlagen", error.message);
    return [];
  }
  return (data ?? [])
    .filter((c) => c.conversation_id && (!options.listingId || c.listing_id === options.listingId))
    .slice(0, options.limit);
}

export async function getRecentNotifications(supabase: ServerSupabaseClient, limit: number) {
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export interface UpcomingViewing {
  id: string;
  listingId: string;
  listingTitle: string | null;
  startsAt: string;
  endsAt: string;
  status: Tables<"viewing_appointments">["status"];
  /** true, wenn der Benutzer selbst Gast (Interessent) ist */
  asGuest: boolean;
  guestName: string | null;
}

export async function getUpcomingViewings(
  supabase: ServerSupabaseClient,
  user: SessionUser,
  options: { limit: number; listingId?: string },
): Promise<UpcomingViewing[]> {
  let query = supabase
    .from("viewing_appointments")
    .select("id, listing_id, guest_id, starts_at, ends_at, status")
    .gte("ends_at", new Date().toISOString())
    .in("status", ["requested", "confirmed", "reschedule_requested"])
    .order("starts_at", { ascending: true })
    .limit(options.limit);
  if (options.listingId) query = query.eq("listing_id", options.listingId);
  const { data } = await query;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const listingIds = Array.from(new Set(rows.map((r) => r.listing_id)));
  const guestIds = Array.from(new Set(rows.map((r) => r.guest_id).filter((id): id is string => Boolean(id) && id !== user.id)));
  const [listingsRes, guestsRes] = await Promise.all([
    supabase.from("listings").select("id, title").in("id", listingIds),
    guestIds.length
      ? supabase.from("public_profiles").select("id, display_name").in("id", guestIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
  ]);
  const titles = new Map((listingsRes.data ?? []).map((l) => [l.id, l.title]));
  const names = new Map((guestsRes.data ?? []).map((p) => [p.id, p.display_name]));
  return rows.map((r) => ({
    id: r.id,
    listingId: r.listing_id,
    listingTitle: titles.get(r.listing_id) ?? null,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    status: r.status,
    asGuest: r.guest_id === user.id,
    guestName: r.guest_id && r.guest_id !== user.id ? (names.get(r.guest_id) ?? null) : null,
  }));
}

export async function getLeadStatusCounts(
  supabase: ServerSupabaseClient,
  listingId: string,
): Promise<{ total: number; byStatus: Partial<Record<Tables<"leads">["status"], number>> }> {
  const { data } = await supabase.from("leads").select("status").eq("listing_id", listingId);
  const byStatus: Partial<Record<Tables<"leads">["status"], number>> = {};
  for (const row of data ?? []) byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
  return { total: (data ?? []).length, byStatus };
}

/** Inserate des Benutzers, die schon einmal veröffentlicht waren (für Statistiken). */
export async function getStatisticsListings(supabase: ServerSupabaseClient, user: SessionUser) {
  const orgIds = user.organizations.map((o) => o.id);
  let query = supabase
    .from("listings")
    .select("id, title, status, slug, property_id, first_published_at, offer_type, municipality, rooms, property_type")
    .is("deleted_at", null)
    .not("first_published_at", "is", null)
    .order("first_published_at", { ascending: false })
    .limit(100);
  query = orgIds.length ? query.or(`owner_id.eq.${user.id},organization_id.in.(${orgIds.join(",")})`) : query.eq("owner_id", user.id);
  const { data, error } = await query;
  if (error) throw fromDbError(error);
  return data ?? [];
}
