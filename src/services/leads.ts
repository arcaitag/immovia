import "server-only";

import { createClient } from "@/lib/supabase/server";
import { AppError, fromDbError, validationError } from "@/lib/errors";
import { LEAD_STATUS_ORDER, type AppointmentStatus, type LeadStatus, type ListingStatus } from "@/lib/constants";
import { publicStorageUrl } from "@/lib/storage";
import type { SessionUser } from "@/lib/auth/session";
import { ownerOrgFilter } from "@/services/documents";
import {
  leadNoteCreateSchema,
  leadNoteDeleteSchema,
  leadNoteUpdateSchema,
  leadUpdateSchema,
  type LeadSort,
  type LeadUpdateInput,
} from "@/lib/validation/lead";

/**
 * Interessenten (Leads) und private Notizen. Nur für die Verkäuferseite lesbar (RLS leads_select).
 */

export const LEAD_PAGE_SIZE = 30;

export interface LeadPerson {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface LeadListItem {
  id: string;
  status: LeadStatus;
  rating: number | null;
  source: string;
  lastActivityAt: string;
  createdAt: string;
  conversationId: string | null;
  listing: { id: string; title: string; slug: string | null; status: ListingStatus } | null;
  interested: LeadPerson | null;
}

export interface ManagedListing {
  id: string;
  title: string;
  slug: string | null;
  status: ListingStatus;
  propertyId: string;
}

export interface LeadNote {
  id: string;
  body: string;
  authorId: string | null;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  isMine: boolean;
}

export interface LeadDetail {
  id: string;
  status: LeadStatus;
  rating: number | null;
  source: string;
  createdAt: string;
  lastActivityAt: string;
  isTeamLead: boolean;
  conversation: { id: string; lastMessageAt: string | null; lastMessagePreview: string | null } | null;
  listing: { id: string; title: string; slug: string | null; status: ListingStatus; propertyId: string } | null;
  interested: LeadPerson | null;
  inquiries: Array<{ id: string; message: string; phone: string | null; wantsViewing: boolean; wantsDossier: boolean; createdAt: string }>;
  appointments: Array<{ id: string; startsAt: string; endsAt: string; status: AppointmentStatus; cancelReason: string | null }>;
  notes: LeadNote[];
}

export async function getManagedListings(user: SessionUser): Promise<ManagedListing[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select("id, title, slug, status, property_id, updated_at")
    .is("deleted_at", null)
    .neq("status", "archived")
    .or(ownerOrgFilter(user))
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw fromDbError(error);
  return (data ?? []).map((l) => ({
    id: l.id,
    title: l.title?.trim() || "Inserat ohne Titel",
    slug: l.slug,
    status: l.status,
    propertyId: l.property_id,
  }));
}

async function people(ids: string[]): Promise<Map<string, LeadPerson>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("public_profiles").select("id, display_name, avatar_path").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id, { id: p.id, name: p.display_name, avatarUrl: publicStorageUrl("avatars", p.avatar_path) }]));
}

export async function listLeads(filter: {
  listingId?: string;
  status?: LeadStatus;
  sort: LeadSort;
  page: number;
}): Promise<{ items: LeadListItem[]; total: number; statusCounts: Record<LeadStatus, number> }> {
  const supabase = await createClient();
  let query = supabase
    .from("leads")
    .select("id, status, rating, source, last_activity_at, created_at, conversation_id, interested_id, listing:listings(id, title, slug, status)", {
      count: "exact",
    });
  if (filter.listingId) query = query.eq("listing_id", filter.listingId);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.sort === "neueste") query = query.order("created_at", { ascending: false });
  else if (filter.sort === "bewertung") query = query.order("rating", { ascending: false, nullsFirst: false }).order("last_activity_at", { ascending: false });
  else query = query.order("last_activity_at", { ascending: false });
  const from = (Math.max(1, filter.page) - 1) * LEAD_PAGE_SIZE;
  const { data, error, count } = await query.order("id").range(from, from + LEAD_PAGE_SIZE - 1);
  if (error) throw fromDbError(error);

  let countQuery = supabase.from("leads").select("status").limit(5000);
  if (filter.listingId) countQuery = countQuery.eq("listing_id", filter.listingId);
  const { data: statusRows } = await countQuery;
  const statusCounts = Object.fromEntries(LEAD_STATUS_ORDER.map((s) => [s, 0])) as Record<LeadStatus, number>;
  for (const row of statusRows ?? []) statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;

  const names = await people((data ?? []).map((l) => l.interested_id).filter((id): id is string => Boolean(id)));
  const items = (data ?? []).map((l) => ({
    id: l.id,
    status: l.status,
    rating: l.rating,
    source: l.source,
    lastActivityAt: l.last_activity_at,
    createdAt: l.created_at,
    conversationId: l.conversation_id,
    listing: l.listing ? { id: l.listing.id, title: l.listing.title?.trim() || "Inserat", slug: l.listing.slug, status: l.listing.status } : null,
    interested: l.interested_id ? (names.get(l.interested_id) ?? { id: l.interested_id, name: "Immovia-Mitglied", avatarUrl: null }) : null,
  }));
  return { items, total: count ?? items.length, statusCounts };
}

export async function getLeadDetail(leadId: string, userId: string): Promise<LeadDetail | null> {
  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("leads")
    .select(
      "id, status, rating, source, created_at, last_activity_at, organization_id, interested_id, conversation_id, listing_id, listing:listings(id, title, slug, status, property_id)",
    )
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return null;

  const [inquiriesRes, appointmentsRes, notesRes, conversationRes] = await Promise.all([
    lead.interested_id
      ? supabase
          .from("listing_inquiries")
          .select("id, message, phone, wants_viewing, wants_dossier, created_at")
          .eq("listing_id", lead.listing_id)
          .eq("sender_id", lead.interested_id)
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
    lead.interested_id
      ? supabase
          .from("viewing_appointments")
          .select("id, starts_at, ends_at, status, cancel_reason")
          .eq("listing_id", lead.listing_id)
          .eq("guest_id", lead.interested_id)
          .order("starts_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    supabase.from("lead_notes").select("id, body, author_id, created_at, updated_at").eq("lead_id", lead.id).order("created_at", { ascending: false }),
    lead.conversation_id
      ? supabase.from("conversations").select("id, last_message_at, last_message_preview").eq("id", lead.conversation_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const personMap = await people(
    [lead.interested_id, ...(notesRes.data ?? []).map((n) => n.author_id)].filter((id): id is string => Boolean(id)),
  );

  return {
    id: lead.id,
    status: lead.status,
    rating: lead.rating,
    source: lead.source,
    createdAt: lead.created_at,
    lastActivityAt: lead.last_activity_at,
    isTeamLead: Boolean(lead.organization_id),
    conversation: conversationRes.data
      ? { id: conversationRes.data.id, lastMessageAt: conversationRes.data.last_message_at, lastMessagePreview: conversationRes.data.last_message_preview }
      : null,
    listing: lead.listing
      ? {
          id: lead.listing.id,
          title: lead.listing.title?.trim() || "Inserat",
          slug: lead.listing.slug,
          status: lead.listing.status,
          propertyId: lead.listing.property_id,
        }
      : null,
    interested: lead.interested_id ? (personMap.get(lead.interested_id) ?? { id: lead.interested_id, name: "Immovia-Mitglied", avatarUrl: null }) : null,
    inquiries: (inquiriesRes.data ?? []).map((i) => ({
      id: i.id,
      message: i.message,
      phone: i.phone,
      wantsViewing: i.wants_viewing,
      wantsDossier: i.wants_dossier,
      createdAt: i.created_at,
    })),
    appointments: (appointmentsRes.data ?? []).map((a) => ({
      id: a.id,
      startsAt: a.starts_at,
      endsAt: a.ends_at,
      status: a.status,
      cancelReason: a.cancel_reason,
    })),
    notes: (notesRes.data ?? []).map((n) => ({
      id: n.id,
      body: n.body,
      authorId: n.author_id,
      authorName: n.author_id === userId ? "Sie" : (n.author_id ? personMap.get(n.author_id)?.name : null) ?? "Teammitglied",
      createdAt: n.created_at,
      updatedAt: n.updated_at,
      isMine: n.author_id === userId,
    })),
  };
}

export async function updateLead(input: LeadUpdateInput): Promise<{ id: string; listingId: string; conversationId: string | null }> {
  const parsed = leadUpdateSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
  const changes: { status?: LeadStatus; rating?: number | null } = {};
  if (parsed.data.status !== undefined) changes.status = parsed.data.status;
  if (parsed.data.rating !== undefined) changes.rating = parsed.data.rating;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .update(changes)
    .eq("id", parsed.data.leadId)
    .select("id, listing_id, conversation_id");
  if (error) throw fromDbError(error);
  const row = data?.[0];
  if (!row) throw new AppError("not_found");
  return { id: row.id, listingId: row.listing_id, conversationId: row.conversation_id };
}

export async function createLeadNote(input: { leadId: string; body: string }): Promise<LeadNote> {
  const parsed = leadNoteCreateSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_notes")
    .insert({ lead_id: parsed.data.leadId, body: parsed.data.body })
    .select("id, body, author_id, created_at, updated_at")
    .single();
  if (error) throw fromDbError(error);
  return { id: data.id, body: data.body, authorId: data.author_id, authorName: "Sie", createdAt: data.created_at, updatedAt: data.updated_at, isMine: true };
}

export async function updateLeadNote(input: { noteId: string; body: string }): Promise<string> {
  const parsed = leadNoteUpdateSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
  const supabase = await createClient();
  const { data, error } = await supabase.from("lead_notes").update({ body: parsed.data.body }).eq("id", parsed.data.noteId).select("lead_id");
  if (error) throw fromDbError(error);
  if (!data?.length) throw new AppError("not_found", "Sie können nur eigene Notizen bearbeiten.");
  return data[0]!.lead_id;
}

export async function deleteLeadNote(input: { noteId: string }): Promise<string> {
  const parsed = leadNoteDeleteSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
  const supabase = await createClient();
  const { data, error } = await supabase.from("lead_notes").delete().eq("id", parsed.data.noteId).select("lead_id");
  if (error) throw fromDbError(error);
  if (!data?.length) throw new AppError("not_found", "Sie können nur eigene Notizen löschen.");
  return data[0]!.lead_id;
}
