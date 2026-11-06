import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { AppError, fromDbError, validationError } from "@/lib/errors";
import { PROPERTY_TYPES, type DocumentCategory, type DocumentVisibility, type PropertyType } from "@/lib/constants";
import { publicStorageUrl } from "@/lib/storage";
import type { SessionUser } from "@/lib/auth/session";
import { zurichDayEndUtc } from "@/lib/viewings/calendar";
import {
  documentCreateSchema,
  documentDeleteSchema,
  documentGrantSchema,
  documentStoragePath,
  documentUpdateSchema,
  revokeGrantSchema,
  sanitizeFileName,
  type DocumentCreateInput,
  type DocumentGrantInput,
  type DocumentUpdateInput,
  type FileMime,
} from "@/lib/validation/document";

/**
 * Dokumentencenter: Dokumente je Immobilie, Freigaben und Downloads.
 * Private Dateien sind nur über kurzlebige signierte Links abrufbar (RLS: can_read_document).
 */

export interface ManagedProperty {
  id: string;
  label: string;
  address: string | null;
  organizationId: string | null;
  ownerId: string;
  listings: Array<{ id: string; title: string | null; slug: string | null; status: string }>;
}

export interface DocumentGrantItem {
  id: string;
  granteeId: string;
  granteeName: string;
  expiresAt: string | null;
  createdAt: string;
  isExpired: boolean;
}

export interface DocumentItem {
  id: string;
  propertyId: string;
  title: string;
  category: DocumentCategory;
  fileName: string | null;
  mimeType: string;
  sizeBytes: number;
  visibility: DocumentVisibility;
  containsPersonalData: boolean;
  createdAt: string;
  canManage: boolean;
  grants: DocumentGrantItem[];
}

export interface ShareCandidate {
  userId: string;
  name: string;
  avatarUrl: string | null;
  listingTitle: string | null;
}

export interface SharedDocumentItem {
  grantId: string;
  documentId: string;
  title: string;
  category: DocumentCategory;
  mimeType: string;
  sizeBytes: number;
  sharedAt: string;
  expiresAt: string | null;
  sharedBy: string | null;
  listing: { title: string | null; slug: string | null } | null;
}

const PUBLIC_STATUSES = new Set(["published", "reserved"]);

function orgIds(user: SessionUser): string[] {
  return user.organizations.map((o) => o.id);
}

/** Filter «eigene oder Team-Datensätze» (verhindert, dass Moderatoren fremde Objekte als eigene sehen). */
export function ownerOrgFilter(user: SessionUser): string {
  const orgs = orgIds(user);
  return orgs.length ? `owner_id.eq.${user.id},organization_id.in.(${orgs.join(",")})` : `owner_id.eq.${user.id}`;
}

export function propertyLabel(
  property: { internal_name: string | null; property_type: string; municipality: string | null },
  listingTitle?: string | null,
): string {
  const internal = property.internal_name?.trim();
  if (internal) return internal;
  if (listingTitle?.trim()) return listingTitle.trim();
  const type = PROPERTY_TYPES[property.property_type as PropertyType]?.label ?? "Immobilie";
  return property.municipality ? `${type} in ${property.municipality}` : type;
}

export async function getManagedProperties(user: SessionUser): Promise<ManagedProperty[]> {
  const supabase = await createClient();
  const { data: properties, error } = await supabase
    .from("properties")
    .select("id, owner_id, organization_id, internal_name, property_type, street, house_number, postal_code, municipality, created_at")
    .is("deleted_at", null)
    .or(ownerOrgFilter(user))
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw fromDbError(error);
  if (!properties?.length) return [];
  const { data: listings } = await supabase
    .from("listings")
    .select("id, property_id, title, slug, status, created_at")
    .in("property_id", properties.map((p) => p.id))
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  return properties.map((p) => {
    const own = (listings ?? []).filter((l) => l.property_id === p.id);
    const street = [p.street, p.house_number].filter(Boolean).join(" ");
    const place = [p.postal_code, p.municipality].filter(Boolean).join(" ");
    return {
      id: p.id,
      label: propertyLabel(p, own[0]?.title),
      address: [street, place].filter(Boolean).join(", ") || null,
      organizationId: p.organization_id,
      ownerId: p.owner_id,
      listings: own.map((l) => ({ id: l.id, title: l.title, slug: l.slug, status: l.status })),
    };
  });
}

async function profileNames(ids: string[]): Promise<Map<string, { name: string; avatarUrl: string | null }>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("public_profiles").select("id, display_name, avatar_path").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id, { name: p.display_name, avatarUrl: publicStorageUrl("avatars", p.avatar_path) }]));
}

/** Interessenten mit Kontakt zu Inseraten dieser Immobilie (nur an sie darf freigegeben werden). */
export async function getShareCandidates(propertyId: string): Promise<ShareCandidate[]> {
  const supabase = await createClient();
  const { data: listings } = await supabase.from("listings").select("id, title").eq("property_id", propertyId);
  if (!listings?.length) return [];
  const { data: conversations } = await supabase
    .from("conversations")
    .select("interested_id, listing_id, last_message_at")
    .in("listing_id", listings.map((l) => l.id))
    .not("interested_id", "is", null)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  const titleByListing = new Map(listings.map((l) => [l.id, l.title]));
  const seen = new Map<string, string | null>();
  for (const c of conversations ?? []) {
    if (c.interested_id && !seen.has(c.interested_id)) seen.set(c.interested_id, c.listing_id ? (titleByListing.get(c.listing_id) ?? null) : null);
  }
  const names = await profileNames([...seen.keys()]);
  return [...seen.entries()]
    .map(([userId, listingTitle]) => ({
      userId,
      name: names.get(userId)?.name ?? "Immovia-Mitglied",
      avatarUrl: names.get(userId)?.avatarUrl ?? null,
      listingTitle,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de-CH"));
}

export async function getPropertyDocuments(property: ManagedProperty, user: SessionUser): Promise<DocumentItem[]> {
  const supabase = await createClient();
  const { data: docs, error } = await supabase
    .from("property_documents")
    .select("id, property_id, uploaded_by, category, title, file_name, mime_type, size_bytes, visibility, contains_personal_data, created_at")
    .eq("property_id", property.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw fromDbError(error);
  if (!docs?.length) return [];

  const { data: grants } = await supabase
    .from("document_access_grants")
    .select("id, document_id, grantee_id, expires_at, created_at")
    .in("document_id", docs.map((d) => d.id))
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  const names = await profileNames((grants ?? []).map((g) => g.grantee_id));
  const now = Date.now();
  const isMember = property.organizationId ? orgIds(user).includes(property.organizationId) : false;

  return docs.map((d) => ({
    id: d.id,
    propertyId: d.property_id,
    title: d.title,
    category: d.category,
    fileName: d.file_name,
    mimeType: d.mime_type,
    sizeBytes: d.size_bytes,
    visibility: d.visibility,
    containsPersonalData: d.contains_personal_data,
    createdAt: d.created_at,
    canManage: property.ownerId === user.id || d.uploaded_by === user.id || (d.visibility !== "owner" && isMember),
    grants: (grants ?? [])
      .filter((g) => g.document_id === d.id)
      .map((g) => ({
        id: g.id,
        granteeId: g.grantee_id,
        granteeName: names.get(g.grantee_id)?.name ?? "Immovia-Mitglied",
        expiresAt: g.expires_at,
        createdAt: g.created_at,
        isExpired: Boolean(g.expires_at && new Date(g.expires_at).getTime() <= now),
      })),
  }));
}

async function revalidateTargets(propertyId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("listings").select("slug, status").eq("property_id", propertyId);
  return (data ?? []).filter((l) => l.slug && PUBLIC_STATUSES.has(l.status)).map((l) => `/immobilien/${l.slug}`);
}

/** Legt den Datensatz an, nachdem der Browser die Datei nach documents/{propertyId}/{id}.{ext} geladen hat. */
export async function createDocument(input: DocumentCreateInput, user: SessionUser): Promise<{ id: string; paths: string[] }> {
  const parsed = documentCreateSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
  const value = parsed.data;
  const supabase = await createClient();
  const { data: property } = await supabase
    .from("properties")
    .select("id, organization_id")
    .eq("id", value.propertyId)
    .is("deleted_at", null)
    .or(ownerOrgFilter(user))
    .maybeSingle();
  if (!property) throw new AppError("not_found", "Die Immobilie wurde nicht gefunden.");
  if (value.visibility === "organization" && !property.organization_id) {
    throw validationError({ visibility: ["Diese Immobilie gehört zu keinem Firmenkonto."] });
  }

  const storagePath = documentStoragePath(value.propertyId, value.id, value.mimeType as FileMime);
  // Ohne RETURNING: die Leserechte (can_read_document) greifen erst nach dem Einfügen
  const { error } = await supabase.from("property_documents").insert({
    id: value.id,
    property_id: value.propertyId,
    category: value.category,
    title: value.title.trim(),
    storage_path: storagePath,
    file_name: sanitizeFileName(value.fileName),
    mime_type: value.mimeType,
    size_bytes: value.sizeBytes,
    visibility: value.visibility,
    contains_personal_data: value.containsPersonalData,
  });
  if (error) throw fromDbError(error);

  const { data: info, error: infoError } = await supabase.storage.from("documents").info(storagePath);
  if (infoError || !info) {
    await supabase.from("property_documents").update({ deleted_at: new Date().toISOString() }).eq("id", value.id);
    throw new AppError("validation", "Die Datei wurde nicht gefunden. Bitte laden Sie sie erneut hoch.");
  }
  return { id: value.id, paths: value.visibility === "public" ? await revalidateTargets(value.propertyId) : [] };
}

export async function updateDocument(input: DocumentUpdateInput): Promise<{ paths: string[] }> {
  const parsed = documentUpdateSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
  const value = parsed.data;
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("property_documents")
    .select("id, property_id, visibility")
    .eq("id", value.documentId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!current) throw new AppError("not_found");
  const { data: canManage } = await supabase.rpc("can_manage_document", { p_document: value.documentId });
  if (!canManage) throw new AppError("forbidden");
  if (value.visibility === "organization") {
    const { data: property } = await supabase.from("properties").select("organization_id").eq("id", current.property_id).maybeSingle();
    if (!property?.organization_id) throw validationError({ visibility: ["Diese Immobilie gehört zu keinem Firmenkonto."] });
  }
  const { data, error } = await supabase
    .from("property_documents")
    .update({
      title: value.title.trim(),
      category: value.category,
      visibility: value.visibility,
      contains_personal_data: value.containsPersonalData,
    })
    .eq("id", value.documentId)
    .select("id");
  if (error) throw fromDbError(error);
  if (!data?.length) throw new AppError("not_found");
  const touchesPublic = current.visibility === "public" || value.visibility === "public";
  return { paths: touchesPublic ? await revalidateTargets(current.property_id) : [] };
}

/** Entfernt die Datei aus dem Speicher und markiert den Datensatz als gelöscht. */
export async function deleteDocument(input: { documentId: string }): Promise<{ paths: string[] }> {
  const parsed = documentDeleteSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("property_documents")
    .select("id, property_id, storage_path, visibility")
    .eq("id", parsed.data.documentId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!doc) throw new AppError("not_found");
  const { data: canManage } = await supabase.rpc("can_manage_document", { p_document: doc.id });
  if (!canManage) throw new AppError("forbidden");

  // Zuerst die Datei entfernen: danach ist sie (wegen deleted_at) nicht mehr lesbar
  const { error: storageError } = await supabase.storage.from("documents").remove([doc.storage_path]);
  if (storageError) throw new AppError("unknown", "Die Datei konnte nicht gelöscht werden. Bitte versuchen Sie es erneut.");
  const { error } = await supabase.from("property_documents").update({ deleted_at: new Date().toISOString() }).eq("id", doc.id);
  if (error) throw fromDbError(error);
  return { paths: doc.visibility === "public" ? await revalidateTargets(doc.property_id) : [] };
}

export async function grantDocumentAccess(input: DocumentGrantInput): Promise<string> {
  const parsed = documentGrantSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
  const supabase = await createClient();
  const expiresAt = parsed.data.expiresOn ? zurichDayEndUtc(parsed.data.expiresOn).toISOString() : undefined;
  const { data, error } = await supabase.rpc("grant_document_access", {
    p_document_id: parsed.data.documentId,
    p_grantee_id: parsed.data.granteeId,
    ...(expiresAt ? { p_expires_at: expiresAt } : {}),
  });
  if (error) throw fromDbError(error);
  return data;
}

export async function revokeDocumentAccess(input: { grantId: string }): Promise<void> {
  const parsed = revokeGrantSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_document_access", { p_grant_id: parsed.data.grantId });
  if (error) throw fromDbError(error);
}

export async function getSharedWithMe(userId: string): Promise<SharedDocumentItem[]> {
  const supabase = await createClient();
  const { data: grants, error } = await supabase
    .from("document_access_grants")
    .select("id, document_id, granted_by, expires_at, created_at")
    .eq("grantee_id", userId)
    .is("revoked_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw fromDbError(error);
  if (!grants?.length) return [];

  const { data: docs } = await supabase
    .from("property_documents")
    .select("id, property_id, title, category, mime_type, size_bytes")
    .in("id", grants.map((g) => g.document_id))
    .is("deleted_at", null);
  const docById = new Map((docs ?? []).map((d) => [d.id, d]));
  const propertyIds = [...new Set((docs ?? []).map((d) => d.property_id))];
  const [{ data: listings }, names] = await Promise.all([
    propertyIds.length
      ? supabase.from("listings").select("property_id, title, slug, status").in("property_id", propertyIds).is("deleted_at", null)
      : Promise.resolve({ data: [] as Array<{ property_id: string; title: string | null; slug: string | null; status: string }> }),
    profileNames(grants.map((g) => g.granted_by).filter((id): id is string => Boolean(id))),
  ]);

  return grants
    .map((g): SharedDocumentItem | null => {
      const doc = docById.get(g.document_id);
      if (!doc) return null;
      const listing = (listings ?? []).find((l) => l.property_id === doc.property_id) ?? null;
      return {
        grantId: g.id,
        documentId: doc.id,
        title: doc.title,
        category: doc.category,
        mimeType: doc.mime_type,
        sizeBytes: doc.size_bytes,
        sharedAt: g.created_at,
        expiresAt: g.expires_at,
        sharedBy: g.granted_by ? (names.get(g.granted_by)?.name ?? null) : null,
        listing: listing ? { title: listing.title, slug: PUBLIC_STATUSES.has(listing.status) ? listing.slug : null } : null,
      };
    })
    .filter((item): item is SharedDocumentItem => item !== null);
}

/**
 * Kurzlebiger Download-Link (60 s). Angemeldet mit Benutzer-Client, sonst anonym
 * (nur öffentliche Dokumente veröffentlichter Inserate). null = kein Zugriff.
 */
export async function getDocumentDownloadUrl(documentId: string, options: { inline: boolean; authenticated: boolean }): Promise<string | null> {
  const supabase = options.authenticated ? await createClient() : createPublicClient();
  if (!supabase) return null;
  const { data: doc } = await supabase
    .from("property_documents")
    .select("storage_path, file_name, title, mime_type")
    .eq("id", documentId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!doc) return null;
  const extension = doc.storage_path.split(".").pop() ?? "pdf";
  const fileName = sanitizeFileName(doc.file_name ?? `${doc.title}.${extension}`);
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, 60, options.inline ? undefined : { download: fileName });
  if (error || !data) return null;
  return data.signedUrl;
}

/** Dokumente einer Immobilie für die Freigabe an eine bestimmte Person (Interessenten-Detail). */
export async function getDocumentsForGrantee(
  propertyId: string,
  granteeId: string,
): Promise<{ shared: Array<{ grant: DocumentGrantItem; document: Pick<DocumentItem, "id" | "title" | "category" | "mimeType" | "sizeBytes"> }>; available: Array<Pick<DocumentItem, "id" | "title" | "category" | "visibility" | "containsPersonalData">> }> {
  const supabase = await createClient();
  const { data: docs } = await supabase
    .from("property_documents")
    .select("id, title, category, mime_type, size_bytes, visibility, contains_personal_data")
    .eq("property_id", propertyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (!docs?.length) return { shared: [], available: [] };
  const { data: grants } = await supabase
    .from("document_access_grants")
    .select("id, document_id, grantee_id, expires_at, created_at")
    .eq("grantee_id", granteeId)
    .in("document_id", docs.map((d) => d.id))
    .is("revoked_at", null);
  const now = Date.now();
  const grantByDoc = new Map((grants ?? []).map((g) => [g.document_id, g]));
  const shared = docs
    .filter((d) => grantByDoc.has(d.id))
    .map((d) => {
      const g = grantByDoc.get(d.id)!;
      return {
        grant: {
          id: g.id,
          granteeId: g.grantee_id,
          granteeName: "",
          expiresAt: g.expires_at,
          createdAt: g.created_at,
          isExpired: Boolean(g.expires_at && new Date(g.expires_at).getTime() <= now),
        },
        document: { id: d.id, title: d.title, category: d.category, mimeType: d.mime_type, sizeBytes: d.size_bytes },
      };
    });
  const available = docs
    .filter((d) => !grantByDoc.has(d.id) || shared.find((s) => s.document.id === d.id)?.grant.isExpired)
    .map((d) => ({ id: d.id, title: d.title, category: d.category, visibility: d.visibility, containsPersonalData: d.contains_personal_data }));
  return { shared, available };
}
