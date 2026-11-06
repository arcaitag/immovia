import "server-only";

import { createClient } from "@/lib/supabase/server";
import { AppError, fromDbError, validationError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import type { AppointmentStatus } from "@/lib/constants";
import { propertyImageUrl, publicStorageUrl } from "@/lib/storage";
import { buildSlotSeries, firstSlotInPast } from "@/lib/viewings/series";
import {
  appointmentActionSchema,
  appointmentNoteSchema,
  bookViewingSchema,
  cancelSlotSchema,
  deleteAppointmentNoteSchema,
  deleteSlotSchema,
  moveAppointmentSchema,
  slotFormSchema,
  type AppointmentAction,
  type SlotFormInput,
} from "@/lib/validation/viewing";

/**
 * Besichtigungen: Zeitfenster, Termine (Verkäufer und Interessent), Notizen, ICS.
 * Kritische Abläufe über die Datenbankfunktionen book_viewing, update_viewing_status,
 * move_viewing und cancel_viewing_slot (Zeilensperren, keine Doppelbuchung).
 */

const ACTIVE: AppointmentStatus[] = ["requested", "confirmed", "reschedule_requested"];
const PUBLIC_STATUSES = new Set(["published", "reserved"]);

export interface ViewingPerson {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface AppointmentNote {
  id: string;
  body: string;
  createdAt: string;
  isMine: boolean;
}

export interface AppointmentItem {
  id: string;
  slotId: string | null;
  listingId: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  guest: ViewingPerson | null;
  guestMessage: string | null;
  cancelReason: string | null;
  conversationId: string | null;
  leadId: string | null;
  notes: AppointmentNote[];
}

export interface SlotItem {
  id: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  note: string | null;
  booked: number;
  appointments: AppointmentItem[];
}

export interface MoveTarget {
  id: string;
  startsAt: string;
  endsAt: string;
  free: number;
}

export interface SellerSchedule {
  slots: SlotItem[];
  requests: AppointmentItem[];
  past: AppointmentItem[];
  moveTargets: MoveTarget[];
  stats: { openRequests: number; upcomingConfirmed: number; freeSpots: number };
}

export interface GuestAppointment {
  id: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  cancelReason: string | null;
  conversationId: string | null;
  listing: { id: string; title: string; slug: string | null; address: string | null; imageUrl: string | null; isPublic: boolean };
}

async function loadPeople(ids: string[]): Promise<Map<string, ViewingPerson>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("public_profiles").select("id, display_name, avatar_path").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id, { id: p.id, name: p.display_name, avatarUrl: publicStorageUrl("avatars", p.avatar_path) }]));
}

/**
 * Zeitfenster und Termine eines Inserats für die Verkäuferansicht.
 * range: Zeitraum der angezeigten Zeitfenster (Liste: ab heute, Woche: Mo–So).
 */
export async function getSellerSchedule(listingId: string, userId: string, range: { from: Date; to: Date | null }): Promise<SellerSchedule> {
  const supabase = await createClient();
  const now = new Date();
  const pastFrom = new Date(now.getTime() - 30 * 86_400_000);

  let slotQuery = supabase
    .from("viewing_slots")
    .select("id, starts_at, ends_at, capacity, note")
    .eq("listing_id", listingId)
    .eq("is_cancelled", false)
    .gte("ends_at", range.from.toISOString())
    .order("starts_at", { ascending: true })
    .limit(400);
  if (range.to) slotQuery = slotQuery.lt("starts_at", range.to.toISOString());

  const [slotsRes, appointmentsRes, leadsRes, futureSlotsRes] = await Promise.all([
    slotQuery,
    supabase
      .from("viewing_appointments")
      .select("id, slot_id, listing_id, starts_at, ends_at, status, guest_id, guest_message, cancel_reason, conversation_id")
      .eq("listing_id", listingId)
      .gte("ends_at", (range.from < pastFrom ? range.from : pastFrom).toISOString())
      .order("starts_at", { ascending: true })
      .limit(1000),
    supabase.from("leads").select("id, interested_id").eq("listing_id", listingId),
    supabase
      .from("viewing_slots")
      .select("id, starts_at, ends_at, capacity")
      .eq("listing_id", listingId)
      .eq("is_cancelled", false)
      .gt("starts_at", now.toISOString())
      .order("starts_at", { ascending: true })
      .limit(300),
  ]);
  if (slotsRes.error) throw fromDbError(slotsRes.error);
  if (appointmentsRes.error) throw fromDbError(appointmentsRes.error);

  const appointments = appointmentsRes.data ?? [];
  const appointmentIds = appointments.map((a) => a.id);
  const [{ data: notes }, peopleMap] = await Promise.all([
    appointmentIds.length
      ? supabase
          .from("viewing_appointment_notes")
          .select("id, appointment_id, author_id, body, created_at")
          .in("appointment_id", appointmentIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as Array<{ id: string; appointment_id: string; author_id: string | null; body: string; created_at: string }> }),
    loadPeople(appointments.map((a) => a.guest_id).filter((id): id is string => Boolean(id))),
  ]);
  const leadByGuest = new Map((leadsRes.data ?? []).filter((l) => l.interested_id).map((l) => [l.interested_id as string, l.id]));

  const items: AppointmentItem[] = appointments.map((a) => ({
    id: a.id,
    slotId: a.slot_id,
    listingId: a.listing_id,
    startsAt: a.starts_at,
    endsAt: a.ends_at,
    status: a.status,
    guest: a.guest_id ? (peopleMap.get(a.guest_id) ?? { id: a.guest_id, name: "Immovia-Mitglied", avatarUrl: null }) : null,
    guestMessage: a.guest_message,
    cancelReason: a.cancel_reason,
    conversationId: a.conversation_id,
    leadId: a.guest_id ? (leadByGuest.get(a.guest_id) ?? null) : null,
    notes: (notes ?? [])
      .filter((n) => n.appointment_id === a.id)
      .map((n) => ({ id: n.id, body: n.body, createdAt: n.created_at, isMine: n.author_id === userId })),
  }));

  const activeBySlot = new Map<string, number>();
  for (const a of items) {
    if (a.slotId && ACTIVE.includes(a.status)) activeBySlot.set(a.slotId, (activeBySlot.get(a.slotId) ?? 0) + 1);
  }

  const slots: SlotItem[] = (slotsRes.data ?? []).map((s) => ({
    id: s.id,
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    capacity: s.capacity,
    note: s.note,
    booked: activeBySlot.get(s.id) ?? 0,
    appointments: items.filter((a) => a.slotId === s.id && a.status !== "cancelled"),
  }));

  const nowMs = now.getTime();
  const requests = items.filter((a) => (a.status === "requested" || a.status === "reschedule_requested") && new Date(a.endsAt).getTime() > nowMs);
  const past = items
    .filter((a) => new Date(a.startsAt).getTime() <= nowMs && ["confirmed", "completed", "no_show"].includes(a.status))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const moveTargets: MoveTarget[] = (futureSlotsRes.data ?? [])
    .map((s) => ({ id: s.id, startsAt: s.starts_at, endsAt: s.ends_at, free: Math.max(0, s.capacity - (activeBySlot.get(s.id) ?? 0)) }))
    .filter((s) => s.free > 0);

  return {
    slots,
    requests,
    past,
    moveTargets,
    stats: {
      openRequests: requests.length,
      upcomingConfirmed: items.filter((a) => a.status === "confirmed" && new Date(a.startsAt).getTime() > nowMs).length,
      freeSpots: moveTargets.reduce((sum, s) => sum + s.free, 0),
    },
  };
}

/** Offene Anfragen über alle verwalteten Inserate (für Hinweise in der Inseratauswahl). */
export async function countOpenRequestsByListing(listingIds: string[]): Promise<Map<string, number>> {
  if (!listingIds.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("viewing_appointments")
    .select("listing_id")
    .in("listing_id", listingIds)
    .in("status", ["requested", "reschedule_requested"])
    .gt("ends_at", new Date().toISOString());
  const counts = new Map<string, number>();
  for (const row of data ?? []) counts.set(row.listing_id, (counts.get(row.listing_id) ?? 0) + 1);
  return counts;
}

export async function createSlots(input: SlotFormInput): Promise<{ count: number; listingId: string; slug: string | null }> {
  const parsed = slotFormSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
  const value = parsed.data;
  const supabase = await createClient();
  const { data: listing } = await supabase.from("listings").select("id, slug, status, deleted_at").eq("id", value.listingId).maybeSingle();
  const { data: canManage } = await supabase.rpc("can_manage_listing", { p_listing: value.listingId });
  if (!listing || !canManage || listing.deleted_at) throw new AppError("not_found", "Das Inserat wurde nicht gefunden.");

  const series = buildSlotSeries({
    date: value.date,
    startTime: value.startTime,
    endTime: value.endTime,
    durationMinutes: value.mode === "single" ? 0 : value.durationMinutes,
    repeat: value.mode === "single" ? "none" : value.repeat,
    occurrences: value.occurrences,
  });
  if (!series.ok) throw new AppError("validation", series.error);
  const past = firstSlotInPast(series.slots, new Date());
  if (past) throw new AppError("validation", `Das Zeitfenster am ${formatDateTime(past.startsAt)} liegt in der Vergangenheit.`);

  const note = value.note?.trim() || null;
  const { data, error } = await supabase
    .from("viewing_slots")
    .insert(
      series.slots.map((slot) => ({
        listing_id: value.listingId,
        starts_at: slot.startsAt.toISOString(),
        ends_at: slot.endsAt.toISOString(),
        capacity: value.capacity,
        note,
      })),
    )
    .select("id");
  if (error) {
    if (error.code === "23P01") {
      throw new AppError(
        "conflict",
        series.slots.length > 1
          ? "Mindestens ein Zeitfenster überschneidet sich mit einem bestehenden Zeitfenster. Es wurde nichts angelegt."
          : "Dieses Zeitfenster überschneidet sich mit einem bestehenden Zeitfenster.",
      );
    }
    throw fromDbError(error);
  }
  return { count: data?.length ?? 0, listingId: value.listingId, slug: PUBLIC_STATUSES.has(listing.status) ? listing.slug : null };
}

export async function cancelSlot(input: { slotId: string; reason?: string }): Promise<number> {
  const parsed = cancelSlotSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
  const supabase = await createClient();
  const reason = parsed.data.reason?.trim();
  const { data, error } = await supabase.rpc("cancel_viewing_slot", { p_slot_id: parsed.data.slotId, ...(reason ? { p_reason: reason } : {}) });
  if (error) throw fromDbError(error);
  return data ?? 0;
}

export async function deleteSlot(input: { slotId: string }): Promise<void> {
  const parsed = deleteSlotSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
  const supabase = await createClient();
  const { data, error } = await supabase.from("viewing_slots").delete().eq("id", parsed.data.slotId).select("id");
  if (error) throw fromDbError(error);
  if (!data?.length) throw new AppError("not_found");
}

export async function updateAppointmentStatus(input: { appointmentId: string; action: AppointmentAction; reason?: string }): Promise<AppointmentStatus> {
  const parsed = appointmentActionSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
  const supabase = await createClient();
  const reason = parsed.data.reason?.trim();
  const { data, error } = await supabase.rpc("update_viewing_status", {
    p_appointment_id: parsed.data.appointmentId,
    p_action: parsed.data.action,
    ...(reason ? { p_reason: reason } : {}),
  });
  if (error) {
    if (error.message === "invalid_message") throw new AppError("validation", "Die Begründung darf höchstens 500 Zeichen lang sein.");
    throw fromDbError(error);
  }
  return data;
}

export async function moveAppointment(input: { appointmentId: string; slotId: string }): Promise<void> {
  const parsed = moveAppointmentSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_viewing", { p_appointment_id: parsed.data.appointmentId, p_new_slot_id: parsed.data.slotId });
  if (error) throw fromDbError(error);
}

export async function addAppointmentNote(input: { appointmentId: string; body: string }): Promise<AppointmentNote> {
  const parsed = appointmentNoteSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("viewing_appointment_notes")
    .insert({ appointment_id: parsed.data.appointmentId, body: parsed.data.body })
    .select("id, body, created_at")
    .single();
  if (error) throw fromDbError(error);
  return { id: data.id, body: data.body, createdAt: data.created_at, isMine: true };
}

export async function deleteAppointmentNote(input: { noteId: string }): Promise<void> {
  const parsed = deleteAppointmentNoteSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
  const supabase = await createClient();
  const { data, error } = await supabase.from("viewing_appointment_notes").delete().eq("id", parsed.data.noteId).select("id");
  if (error) throw fromDbError(error);
  if (!data?.length) throw new AppError("not_found", "Sie können nur eigene Notizen löschen.");
}

export async function getGuestAppointments(userId: string): Promise<GuestAppointment[]> {
  const supabase = await createClient();
  const { data: appointments, error } = await supabase
    .from("viewing_appointments")
    .select("id, listing_id, starts_at, ends_at, status, cancel_reason, conversation_id")
    .eq("guest_id", userId)
    .order("starts_at", { ascending: false })
    .limit(100);
  if (error) throw fromDbError(error);
  if (!appointments?.length) return [];

  const listingIds = [...new Set(appointments.map((a) => a.listing_id))];
  const conversationIds = appointments.map((a) => a.conversation_id).filter((id): id is string => Boolean(id));
  const [{ data: listings }, { data: conversations }] = await Promise.all([
    supabase.from("listings").select("id, title, slug, status, public_address, property_id, moderation_status, deleted_at").in("id", listingIds),
    conversationIds.length
      ? supabase.from("conversations").select("id, listing_id, subject").in("id", conversationIds)
      : Promise.resolve({ data: [] as Array<{ id: string; listing_id: string | null; subject: string | null }> }),
  ]);
  const listingById = new Map((listings ?? []).map((l) => [l.id, l]));
  const subjectByListing = new Map((conversations ?? []).filter((c) => c.listing_id).map((c) => [c.listing_id as string, c.subject]));

  const propertyIds = [...new Set((listings ?? []).map((l) => l.property_id))];
  const { data: images } = propertyIds.length
    ? await supabase
        .from("property_images")
        .select("property_id, display_path, external_url, is_cover, sort_order")
        .in("property_id", propertyIds)
        .eq("status", "ready")
        .eq("is_floor_plan", false)
        .order("is_cover", { ascending: false })
        .order("sort_order", { ascending: true })
    : { data: [] };
  const coverByProperty = new Map<string, { display_path: string | null; external_url: string | null }>();
  for (const image of images ?? []) if (!coverByProperty.has(image.property_id)) coverByProperty.set(image.property_id, image);

  return appointments.map((a) => {
    const listing = listingById.get(a.listing_id);
    const isPublic = Boolean(listing && PUBLIC_STATUSES.has(listing.status) && listing.moderation_status !== "blocked" && !listing.deleted_at);
    return {
      id: a.id,
      startsAt: a.starts_at,
      endsAt: a.ends_at,
      status: a.status,
      cancelReason: a.cancel_reason,
      conversationId: a.conversation_id,
      listing: {
        id: a.listing_id,
        title: listing?.title?.trim() || subjectByListing.get(a.listing_id)?.trim() || "Inserat",
        slug: isPublic ? (listing?.slug ?? null) : null,
        address: listing?.public_address ?? null,
        imageUrl: listing ? propertyImageUrl(coverByProperty.get(listing.property_id) ?? null, "sm") : null,
        isPublic,
      },
    };
  });
}

export async function bookViewing(input: { slotId: string; message?: string }): Promise<string> {
  const parsed = bookViewingSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
  const supabase = await createClient();
  const message = parsed.data.message?.trim();
  const { data, error } = await supabase.rpc("book_viewing", { p_slot_id: parsed.data.slotId, ...(message ? { p_message: message } : {}) });
  if (error) {
    if (error.message === "invalid_message") throw new AppError("validation", "Die Nachricht darf höchstens 1000 Zeichen lang sein.");
    throw fromDbError(error);
  }
  return data;
}

export interface IcsAppointment {
  id: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  updatedAt: string;
  title: string;
  address: string | null;
  slug: string | null;
}

/** Termin für die Kalenderdatei. Nur Gast oder Verkäuferseite (RLS viewing_appointments_select). */
export async function getAppointmentForIcs(appointmentId: string): Promise<IcsAppointment | null> {
  const supabase = await createClient();
  const { data: appointment } = await supabase
    .from("viewing_appointments")
    .select("id, listing_id, conversation_id, starts_at, ends_at, status, updated_at")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appointment) return null;
  const [{ data: listing }, { data: conversation }] = await Promise.all([
    supabase.from("listings").select("title, slug, status, public_address, moderation_status, deleted_at").eq("id", appointment.listing_id).maybeSingle(),
    appointment.conversation_id
      ? supabase.from("conversations").select("subject").eq("id", appointment.conversation_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const isPublic = Boolean(listing && PUBLIC_STATUSES.has(listing.status) && listing.moderation_status !== "blocked" && !listing.deleted_at);
  return {
    id: appointment.id,
    startsAt: appointment.starts_at,
    endsAt: appointment.ends_at,
    status: appointment.status,
    updatedAt: appointment.updated_at,
    title: listing?.title?.trim() || conversation?.subject?.trim() || "Immobilie",
    address: listing?.public_address ?? null,
    slug: isPublic ? (listing?.slug ?? null) : null,
  };
}

