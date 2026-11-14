import * as Crypto from "expo-crypto";

import { CONFIG } from "@/lib/config";
import { supabase, type Database, type Enums, type Tables } from "@/lib/supabase";

/**
 * Datenzugriff der App. Alles läuft mit dem Konto des Benutzers direkt gegen Supabase
 * (Row Level Security und Datenbank-Trigger prüfen wie auf der Website). Einzige Ausnahme ist die
 * Bildverarbeitung, die der Server der Website übernimmt (/api/mobile/images).
 */

/** Zeile von search_listings (die generierten Typen kennen keine Pflichtfelder, deshalb hier festgehalten). */
export interface SearchRow {
  id: string;
  slug: string | null;
  title: string | null;
  offer_type: Enums<"offer_type">;
  property_type: Enums<"property_type">;
  status: Enums<"listing_status">;
  price: number | null;
  price_on_request: boolean;
  additional_costs: number | null;
  rooms: number | null;
  living_area: number | null;
  plot_area: number | null;
  municipality: string | null;
  postal_code: string | null;
  canton: string | null;
  cover_path: string | null;
  cover_external_url: string | null;
  image_count: number;
  total_count: number;
}

export interface SearchFilters {
  offer: Enums<"offer_type"> | null;
  query: string;
  types: Enums<"property_type">[];
  priceMax: number | null;
  roomsMin: number | null;
  areaMin: number | null;
  sort: "newest" | "price_asc" | "price_desc";
}

export const EMPTY_FILTERS: SearchFilters = { offer: null, query: "", types: [], priceMax: null, roomsMin: null, areaMin: null, sort: "newest" };

export function activeFilterCount(f: SearchFilters): number {
  return f.types.length + (f.priceMax !== null ? 1 : 0) + (f.roomsMin !== null ? 1 : 0) + (f.areaMin !== null ? 1 : 0);
}

export const PAGE_SIZE = 20;

export async function searchListings(filters: SearchFilters, page: number): Promise<{ rows: SearchRow[]; total: number }> {
  const { data, error } = await supabase.rpc("search_listings", {
    p_offer_type: filters.offer ?? undefined,
    p_query: filters.query.trim() || undefined,
    p_property_types: filters.types.length ? filters.types : undefined,
    p_price_max: filters.priceMax ?? undefined,
    p_rooms_min: filters.roomsMin ?? undefined,
    p_area_min: filters.areaMin ?? undefined,
    p_sort: filters.sort,
    p_limit: PAGE_SIZE,
    p_offset: page * PAGE_SIZE,
  });
  if (error) throw error;
  const rows = (data ?? []) as unknown as SearchRow[];
  return { rows, total: Number(rows[0]?.total_count ?? 0) };
}

export async function listingsByIds(ids: string[]): Promise<SearchRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.rpc("search_listings", { p_listing_ids: ids, p_limit: 100 });
  if (error) throw error;
  return (data ?? []) as unknown as SearchRow[];
}

// --- Merkliste ---------------------------------------------------------------

export async function favoriteIds(): Promise<string[]> {
  const { data, error } = await supabase.from("favorites").select("listing_id").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => row.listing_id);
}

export async function setFavorite(userId: string, listingId: string, favorite: boolean): Promise<void> {
  if (favorite) {
    const { error } = await supabase.from("favorites").insert({ listing_id: listingId });
    if (error && error.code !== "23505") throw error;
  } else {
    const { error } = await supabase.from("favorites").delete().eq("user_id", userId).eq("listing_id", listingId);
    if (error) throw error;
  }
}

// --- Inserat -----------------------------------------------------------------

export type ListingRow = Tables<"listings">;
export type ImageRow = Pick<
  Tables<"property_images">,
  "id" | "display_path" | "external_url" | "caption" | "is_floor_plan" | "is_ai_visualization" | "is_cover" | "width" | "height" | "status" | "sort_order"
>;
const IMAGE_COLUMNS = "id, display_path, external_url, caption, is_floor_plan, is_ai_visualization, is_cover, width, height, status, sort_order";

export interface ListingDetail {
  listing: ListingRow;
  images: ImageRow[];
  contact: { name: string | null; phone: string | null };
  seller: { display_name: string | null; member_since: string | null } | null;
}

export async function listingBySlug(slug: string): Promise<ListingDetail | null> {
  const { data: listing, error } = await supabase
    .from("listings")
    .select("*")
    .eq("slug", slug)
    .in("status", ["published", "reserved"])
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!listing) return null;
  const [imagesRes, contactRes, sellerRes] = await Promise.all([
    supabase
      .from("property_images")
      .select(IMAGE_COLUMNS)
      .eq("property_id", listing.property_id)
      .eq("status", "ready")
      .order("is_cover", { ascending: false })
      .order("sort_order", { ascending: true }),
    supabase.rpc("get_listing_public_contact", { p_listing_id: listing.id }),
    supabase.from("public_profiles").select("display_name, member_since").eq("id", listing.owner_id).maybeSingle(),
  ]);
  const contact = (Array.isArray(contactRes.data) ? contactRes.data[0] : contactRes.data) as
    | { contact_name?: string | null; contact_phone?: string | null }
    | null
    | undefined;
  return {
    listing,
    images: imagesRes.data ?? [],
    contact: { name: contact?.contact_name ?? null, phone: contact?.contact_phone ?? null },
    seller: sellerRes.data ?? null,
  };
}

export async function createInquiry(input: { listingId: string; message: string; phone: string | null; wantsViewing: boolean }): Promise<string> {
  const { data, error } = await supabase.rpc("create_inquiry", {
    p_listing_id: input.listingId,
    p_message: input.message,
    p_phone: input.phone ?? undefined,
    p_wants_viewing: input.wantsViewing,
    p_wants_dossier: false,
  });
  if (error) throw error;
  return data as string;
}

// --- Nachrichten -------------------------------------------------------------

export interface ConversationRow {
  conversation_id: string;
  listing_title: string | null;
  cover_path: string | null;
  cover_external_url: string | null;
  other_display_name: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
}

export async function conversations(): Promise<ConversationRow[]> {
  const { data, error } = await supabase.rpc("get_my_conversations", { p_archived: false });
  if (error) throw error;
  return (data ?? []) as unknown as ConversationRow[];
}

export type MessageRow = Pick<Tables<"messages">, "id" | "sender_id" | "body" | "kind" | "created_at" | "deleted_at" | "attachment_name">;

export async function messages(conversationId: string): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, body, kind, created_at, deleted_at, attachment_name")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(conversationId: string, body: string): Promise<void> {
  const { error } = await supabase.from("messages").insert({ id: Crypto.randomUUID(), conversation_id: conversationId, body });
  if (error) throw error;
}

export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
}

// --- Eigene Immobilien -------------------------------------------------------

export type PropertyRow = Tables<"properties">;

export interface MyProperty {
  property: PropertyRow;
  listing: ListingRow | null;
  cover: ImageRow | null;
  imageCount: number;
}

function currentListing(rows: ListingRow[]): ListingRow | null {
  const open = rows.filter((l) => l.status !== "archived");
  const sorted = (open.length ? open : rows).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return sorted[0] ?? null;
}

export async function myProperties(userId: string): Promise<MyProperty[]> {
  const { data: properties, error } = await supabase
    .from("properties")
    .select("*")
    .eq("owner_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const ids = (properties ?? []).map((p) => p.id);
  if (ids.length === 0) return [];
  const [listingsRes, imagesRes] = await Promise.all([
    supabase.from("listings").select("*").in("property_id", ids).is("deleted_at", null),
    supabase.from("property_images").select(`property_id, ${IMAGE_COLUMNS}`).in("property_id", ids).order("sort_order", { ascending: true }),
  ]);
  if (listingsRes.error) throw listingsRes.error;
  return (properties ?? []).map((property) => {
    const images = (imagesRes.data ?? []).filter((i) => i.property_id === property.id);
    return {
      property,
      listing: currentListing((listingsRes.data ?? []).filter((l) => l.property_id === property.id)),
      cover: images.find((i) => i.is_cover) ?? images[0] ?? null,
      imageCount: images.length,
    };
  });
}

export interface PropertyWorkspace {
  property: PropertyRow;
  listing: ListingRow;
  images: ImageRow[];
  contactEmail: string | null;
}

export async function propertyWorkspace(propertyId: string): Promise<PropertyWorkspace | null> {
  const [propertyRes, listingsRes, imagesRes] = await Promise.all([
    supabase.from("properties").select("*").eq("id", propertyId).is("deleted_at", null).maybeSingle(),
    supabase.from("listings").select("*").eq("property_id", propertyId).is("deleted_at", null),
    supabase.from("property_images").select(IMAGE_COLUMNS).eq("property_id", propertyId).order("sort_order", { ascending: true }),
  ]);
  if (propertyRes.error) throw propertyRes.error;
  const listing = currentListing(listingsRes.data ?? []);
  if (!propertyRes.data || !listing) return null;
  const { data: contact } = await supabase.from("listing_contacts").select("contact_email").eq("listing_id", listing.id).maybeSingle();
  return { property: propertyRes.data, listing, images: imagesRes.data ?? [], contactEmail: contact?.contact_email ?? null };
}

export interface NewPropertyInput {
  property_type: Enums<"property_type">;
  offer_type: Enums<"offer_type">;
  street: string | null;
  house_number: string | null;
  postal_code: string;
  municipality: string;
  canton: string;
}

/** Legt Immobilie und Inserat-Entwurf an (wie createPropertyWithListing auf der Website). */
export async function createProperty(input: NewPropertyInput, user: { email: string | null }): Promise<string> {
  const propertyId = Crypto.randomUUID();
  const { error } = await supabase.from("properties").insert({
    id: propertyId,
    ...input,
    condition: input.property_type === "new_build_project" ? "new_build" : null,
    ownership_type: input.property_type === "apartment" && input.offer_type === "sale" ? "condominium" : null,
    wizard_step: 1,
  });
  if (error) throw error;
  try {
    const { data: profile } = await supabase.from("profiles").select("first_name, last_name, display_name").maybeSingle();
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() || profile?.display_name || null;
    const listingId = Crypto.randomUUID();
    const { error: listingError } = await supabase.from("listings").insert({
      id: listingId,
      property_id: propertyId,
      contact_name: name ? name.slice(0, 120) : null,
      location_precision: "area",
    } as Database["public"]["Tables"]["listings"]["Insert"]);
    if (listingError) throw listingError;
    const { error: contactError } = await supabase.from("listing_contacts").insert({ listing_id: listingId, contact_email: user.email, contact_phone: null });
    if (contactError) throw contactError;
    return propertyId;
  } catch (cause) {
    await supabase.from("properties").delete().eq("id", propertyId);
    throw cause;
  }
}

export type PropertyPatch = Partial<
  Pick<
    PropertyRow,
    | "rooms" | "living_area" | "plot_area" | "year_built" | "floor" | "bathrooms" | "condition"
    | "has_balcony" | "has_terrace" | "has_garden" | "has_garage" | "has_elevator" | "has_cellar" | "pets_allowed"
  >
>;

export async function updateProperty(propertyId: string, patch: PropertyPatch): Promise<void> {
  const { error } = await supabase.from("properties").update(patch).eq("id", propertyId);
  if (error) throw error;
}

export interface ListingContentInput {
  title: string | null;
  short_description: string | null;
  description: string | null;
  price: number | null;
  price_on_request: boolean;
  additional_costs: number | null;
  texts_confirmed: boolean;
}

/** Speichert Texte und Preis. Geänderte Texte müssen neu bestätigt werden (wie auf der Website). */
export async function saveListingContent(listing: ListingRow, data: ListingContentInput): Promise<void> {
  const signature = (l: { title: string | null; short_description: string | null; description: string | null }) =>
    JSON.stringify([l.title ?? "", l.short_description ?? "", l.description ?? ""]);
  const textsChanged = signature(listing) !== signature(data);
  let confirmedAt = listing.texts_confirmed_at;
  if (!data.texts_confirmed) confirmedAt = null;
  else if (textsChanged || !listing.texts_confirmed_at) confirmedAt = new Date().toISOString();
  const { error } = await supabase
    .from("listings")
    .update({
      title: data.title,
      short_description: data.short_description,
      description: data.description,
      price: data.price_on_request ? null : data.price,
      price_on_request: data.price_on_request,
      additional_costs: listing.offer_type === "rent" ? data.additional_costs : null,
      texts_confirmed_at: confirmedAt,
    })
    .eq("id", listing.id);
  if (error) throw error;
}

export async function setListingStatus(listingId: string, status: Enums<"listing_status">): Promise<void> {
  const { error } = await supabase.from("listings").update({ status }).eq("id", listingId);
  if (error) throw error;
}

// --- Fotos -------------------------------------------------------------------

const EXT_BY_MIME: Record<string, "jpg" | "png" | "webp"> = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp" };

/**
 * Lädt ein Foto hoch: Original in den privaten Speicher, danach erzeugt der Server der Website
 * die öffentlichen Varianten ohne Standortdaten (gleiche Verarbeitung wie beim Upload im Browser).
 */
const EXT_BY_SUFFIX: Record<string, "jpg" | "png" | "webp"> = { jpg: "jpg", jpeg: "jpg", png: "png", webp: "webp" };

/** Format aus dem MIME-Typ; fehlt er oder ist er unbekannt, aus der Dateiendung (iOS meldet ihn nicht immer passend). */
function photoExt(asset: { uri: string; mimeType?: string | null; fileName?: string | null }): "jpg" | "png" | "webp" | null {
  const byMime = asset.mimeType ? EXT_BY_MIME[asset.mimeType.toLowerCase()] : undefined;
  if (byMime) return byMime;
  for (const name of [asset.uri, asset.fileName ?? ""]) {
    const suffix = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(name)?.[1]?.toLowerCase();
    if (suffix && EXT_BY_SUFFIX[suffix]) return EXT_BY_SUFFIX[suffix];
  }
  return null;
}

export async function uploadPhoto(propertyId: string, asset: { uri: string; mimeType?: string | null; fileName?: string | null }): Promise<void> {
  const ext = photoExt(asset);
  if (!ext) throw new Error("unsupported_format");
  const imageId = Crypto.randomUUID();
  const path = `${propertyId}/${imageId}.${ext}`;
  const body = await (await fetch(asset.uri)).arrayBuffer();
  if (body.byteLength > 25 * 1024 * 1024) throw new Error("too_large");
  const { error: uploadError } = await supabase.storage
    .from("property-originals")
    .upload(path, body, { contentType: ext === "jpg" ? "image/jpeg" : `image/${ext}`, upsert: true });
  if (uploadError) throw uploadError;

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("not_authenticated");
  const response = await fetch(`${CONFIG.siteUrl}/api/mobile/images`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ propertyId, imageId, ext }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    await supabase.storage.from("property-originals").remove([path]);
    throw new Error(payload?.error ? `server:${payload.error}` : "processing_failed");
  }
}

export function photoErrorMessage(error: unknown): string | null {
  const message = error instanceof Error ? error.message : "";
  if (message === "unsupported_format") return "Dieses Bildformat wird nicht unterstützt. Bitte wählen Sie ein JPG-, PNG- oder WebP-Bild.";
  if (message === "too_large") return "Das Bild ist grösser als 25 MB.";
  if (message.startsWith("server:")) return message.slice(7);
  if (message === "processing_failed") return "Das Foto konnte nicht verarbeitet werden. Bitte versuchen Sie es erneut.";
  return null;
}

export async function deletePhoto(propertyId: string, imageId: string): Promise<void> {
  const { error } = await supabase.from("property_images").delete().eq("id", imageId);
  if (error) throw error;
  const folder = `${propertyId}/${imageId}`;
  const { data: files } = await supabase.storage.from("property-images").list(folder, { limit: 100 });
  if (files?.length) await supabase.storage.from("property-images").remove(files.map((f) => `${folder}/${f.name}`));
  await supabase.storage.from("property-originals").remove(["jpg", "png", "webp"].map((ext) => `${folder}.${ext}`));
}

export async function setCoverPhoto(imageId: string): Promise<void> {
  const { error } = await supabase.from("property_images").update({ is_cover: true }).eq("id", imageId);
  if (error) throw error;
}
