import "server-only";

import { createAdminClient, isServiceRoleConfigured, type AdminSupabaseClient } from "@/lib/supabase/admin";
import { publicEnv, serverEnv } from "@/lib/env";
import { PROPERTY_TYPES, SITE, type PropertyType } from "@/lib/constants";
import { formatArea, formatRooms } from "@/lib/format";
import { priceDisplay } from "@/lib/listings/price";
import { propertyImageUrl } from "@/lib/storage";
import { sleep } from "@/lib/utils";
import { EmailTemplateError, renderEmail } from "@/lib/email/templates";
import type { CalendarInput, EmailListingInput } from "@/lib/email/templates/shared";
import { sendEmail, type SendResult } from "@/lib/email/send";
import type { Tables } from "@/types/database";

/**
 * Versand der E-Mail-Outbox (Tabelle email_outbox, nur Service Role).
 * Ablauf pro Eintrag: claim_emails (FOR UPDATE SKIP LOCKED) → Empfänger ermitteln →
 * Daten anreichern → Vorlage rendern → Resend → Status sent/failed/skipped bzw. erneut pending.
 * Ohne RESEND_API_KEY bleiben alle Einträge unverändert «pending».
 */

type OutboxRow = Tables<"email_outbox">;
type Payload = Record<string, unknown>;

export const MAX_EMAIL_ATTEMPTS = 5;
/** Abstand zwischen zwei Sendungen (Resend erlaubt standardmässig wenige Anfragen pro Sekunde). */
const SEND_GAP_MS = 350;
/** Wartezeit vor dem nächsten Versuch, abhängig von der Anzahl bisheriger Versuche. */
const BACKOFF_SECONDS = [60, 5 * 60, 15 * 60, 60 * 60];

const PUBLIC_LISTING_STATUSES = new Set(["published", "reserved"]);
const VIEWING_TEMPLATES = new Set([
  "viewing_requested",
  "viewing_confirmed",
  "viewing_cancelled",
  "viewing_reschedule",
  "viewing_rescheduled",
  "viewing_reminder",
]);

type Outcome =
  | { kind: "sent"; providerId: string | null; note?: string }
  | { kind: "skipped"; reason: string }
  | { kind: "failed"; reason: string }
  | { kind: "retry"; reason: string; retryAfterMs?: number; stopBatch: boolean; restoreAttempt: boolean };

function isRecord(value: unknown): value is Payload {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Kennzeichnet einen Eintrag, der bewusst nicht versendet wird (status «skipped»). */
class SkipEmail {
  constructor(readonly reason: string) {}
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function siteHost(): string {
  try {
    return new URL(publicEnv.siteUrl).hostname || "immovia.ch";
  } catch {
    return "immovia.ch";
  }
}

// -----------------------------------------------------------------------------
// Empfänger
// -----------------------------------------------------------------------------

interface Recipient {
  email: string;
  name: string | null;
}

async function resolveRecipient(admin: AdminSupabaseClient, row: OutboxRow): Promise<Recipient | SkipEmail> {
  let name: string | null = null;
  let profileEmail: string | null = null;
  if (row.user_id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("email, first_name, last_name, display_name, status")
      .eq("id", row.user_id)
      .maybeSingle();
    if (!profile) return new SkipEmail("Empfängerkonto existiert nicht mehr.");
    if (profile.status === "deleted") return new SkipEmail("Empfängerkonto wurde gelöscht.");
    profileEmail = profile.email;
    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
    name = fullName || (profile.display_name !== "Immovia-Mitglied" ? profile.display_name : null);
  }
  const email = (row.to_email ?? profileEmail ?? "").trim();
  if (!email || !email.includes("@")) return new SkipEmail("Keine E-Mail-Adresse vorhanden.");
  return { email, name };
}

// -----------------------------------------------------------------------------
// Anreicherung der Nutzdaten
// -----------------------------------------------------------------------------

/** Lädt öffentliche Inserate für E-Mails (Reihenfolge wie übergeben). */
async function loadEmailListings(admin: AdminSupabaseClient, ids: string[]): Promise<EmailListingInput[]> {
  const unique = [...new Set(ids)].slice(0, 50);
  if (!unique.length) return [];
  const { data: listings } = await admin
    .from("listings")
    .select(
      "id, slug, title, offer_type, property_type, price, price_on_request, additional_costs, rooms, living_area, plot_area, public_address, postal_code, municipality, status, moderation_status, deleted_at, property_id",
    )
    .in("id", unique);
  const visible = (listings ?? []).filter(
    (l) => l.slug && PUBLIC_LISTING_STATUSES.has(l.status) && l.moderation_status !== "blocked" && !l.deleted_at,
  );
  if (!visible.length) return [];

  const { data: images } = await admin
    .from("property_images")
    .select("property_id, display_path, external_url, is_cover, sort_order, created_at")
    .in("property_id", [...new Set(visible.map((l) => l.property_id))])
    .eq("status", "ready")
    .eq("is_floor_plan", false)
    .order("is_cover", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const coverByProperty = new Map<string, { display_path: string | null; external_url: string | null }>();
  for (const image of images ?? []) {
    if (!coverByProperty.has(image.property_id)) coverByProperty.set(image.property_id, image);
  }

  const byId = new Map(visible.map((l) => [l.id, l]));
  return unique
    .map((id) => byId.get(id))
    .filter((l): l is NonNullable<typeof l> => Boolean(l))
    .map((l) => {
      const price = priceDisplay({
        offerType: l.offer_type,
        price: l.price === null ? null : Number(l.price),
        priceOnRequest: l.price_on_request,
        additionalCosts: l.additional_costs === null ? null : Number(l.additional_costs),
      });
      const facts = [
        PROPERTY_TYPES[l.property_type as PropertyType]?.label ?? null,
        l.rooms !== null ? formatRooms(l.rooms) : null,
        l.living_area !== null ? formatArea(l.living_area) : l.plot_area !== null ? `${formatArea(l.plot_area)} Grundstück` : null,
      ].filter((f): f is string => Boolean(f));
      const imageUrl = propertyImageUrl(coverByProperty.get(l.property_id) ?? null, "md");
      return {
        title: l.title?.trim() || "Inserat",
        path: `/immobilien/${l.slug}`,
        location: l.public_address ?? ([l.postal_code, l.municipality].filter(Boolean).join(" ") || null),
        price: price.value,
        priceLabel: price.label,
        facts,
        imageUrl: imageUrl && /^https?:\/\//.test(imageUrl) ? imageUrl : null,
      };
    });
}

async function enrichNewMessage(admin: AdminSupabaseClient, row: OutboxRow, payload: Payload): Promise<Payload | SkipEmail> {
  const conversationId = asString(payload.conversation_id);
  if (!conversationId || !row.user_id) return payload;
  const { data: participant } = await admin
    .from("conversation_participants")
    .select("last_read_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", row.user_id)
    .maybeSingle();
  if (!participant) return new SkipEmail("Empfänger ist nicht mehr Teil der Konversation.");

  let unreadQuery = admin
    .from("messages")
    .select("body, sender_id, created_at", { count: "exact" })
    .eq("conversation_id", conversationId)
    .eq("kind", "text")
    .is("deleted_at", null)
    .neq("sender_id", row.user_id)
    .order("created_at", { ascending: false })
    .limit(1);
  if (participant.last_read_at) unreadQuery = unreadQuery.gt("created_at", participant.last_read_at);
  const { data: unread, count } = await unreadQuery;
  if (!count) return new SkipEmail("Die Nachricht wurde inzwischen gelesen.");
  const latest = unread?.[0];
  return { ...payload, unread_count: count, preview: latest?.body ?? payload.preview ?? null };
}

async function enrichViewing(admin: AdminSupabaseClient, row: OutboxRow, payload: Payload): Promise<Payload | SkipEmail> {
  const appointmentId = asString(payload.appointment_id);
  if (!appointmentId) return payload;
  const { data: appointment } = await admin
    .from("viewing_appointments")
    .select("id, listing_id, guest_id, owner_id, starts_at, ends_at, status, guest_message, updated_at")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appointment) return row.template === "viewing_reminder" ? new SkipEmail("Termin existiert nicht mehr.") : payload;
  if (row.template === "viewing_reminder" && (appointment.status !== "confirmed" || new Date(appointment.starts_at) <= new Date())) {
    return new SkipEmail("Termin ist nicht mehr bestätigt oder bereits vorbei.");
  }

  const { data: listing } = await admin
    .from("listings")
    .select("title, slug, public_address, status, moderation_status, deleted_at")
    .eq("id", appointment.listing_id)
    .maybeSingle();
  const listingPublic = Boolean(
    listing?.slug && PUBLIC_LISTING_STATUSES.has(listing.status) && listing.moderation_status !== "blocked" && !listing.deleted_at,
  );
  let guestName: string | null = null;
  if (appointment.guest_id) {
    const { data: guest } = await admin.from("public_profiles").select("display_name").eq("id", appointment.guest_id).maybeSingle();
    guestName = guest?.display_name ?? null;
  }

  const recipientRole = row.user_id && row.user_id === appointment.guest_id ? "guest" : "seller";
  const title = asString(payload.listing_title) ?? listing?.title ?? null;
  const address = listing?.public_address ?? null;
  const withCalendar =
    recipientRole === "guest" &&
    (row.template === "viewing_confirmed" || row.template === "viewing_rescheduled" || row.template === "viewing_reminder") &&
    appointment.status === "confirmed";
  const calendar: CalendarInput | null = withCalendar
    ? {
        uid: `${appointment.id}@${siteHost()}`,
        start: new Date(appointment.starts_at).toISOString(),
        end: new Date(appointment.ends_at).toISOString(),
        summary: `Besichtigung: ${title ?? "Immobilie"}`,
        location: address,
        path: listingPublic && listing?.slug ? `/immobilien/${listing.slug}` : "/dashboard/besichtigungen?ansicht=termine",
        status: "CONFIRMED",
        stamp: new Date(appointment.updated_at).toISOString(),
      }
    : null;

  return {
    ...payload,
    listing_id: appointment.listing_id,
    listing_title: title,
    address,
    slug: listingPublic ? listing?.slug : null,
    guest_name: guestName,
    guest_message: row.template === "viewing_requested" ? appointment.guest_message : payload.guest_message ?? null,
    recipient_role: recipientRole,
    calendar,
  };
}

async function enrichSearch(admin: AdminSupabaseClient, payload: Payload): Promise<Payload | SkipEmail> {
  const ids = Array.isArray(payload.listing_ids) ? payload.listing_ids.filter((id): id is string => typeof id === "string") : [];
  const listings = await loadEmailListings(admin, ids);
  if (!listings.length) return new SkipEmail("Die Inserate sind nicht mehr öffentlich.");
  return { ...payload, listings: listings.slice(0, 10) };
}

async function preparePayload(admin: AdminSupabaseClient, row: OutboxRow): Promise<Payload | SkipEmail> {
  const payload: Payload = isRecord(row.payload) ? { ...row.payload } : {};
  if (row.template === "new_message") return enrichNewMessage(admin, row, payload);
  if (VIEWING_TEMPLATES.has(row.template)) return enrichViewing(admin, row, payload);
  if (row.template === "search_alert" || row.template === "search_alert_digest") return enrichSearch(admin, payload);
  return payload;
}

// -----------------------------------------------------------------------------
// Verarbeitung
// -----------------------------------------------------------------------------

function toOutcome(result: SendResult): Outcome {
  if (result.ok) {
    return {
      kind: "sent",
      providerId: result.id,
      note: result.duplicate ? "Resend: Idempotenz-Schlüssel bereits verwendet, E-Mail wurde bereits angenommen." : undefined,
    };
  }
  if (result.reason === "not_configured") {
    return { kind: "retry", reason: result.message, stopBatch: true, restoreAttempt: true };
  }
  if (!result.retryable) return { kind: "failed", reason: result.message };
  return { kind: "retry", reason: result.message, retryAfterMs: result.retryAfterMs, stopBatch: result.stopBatch, restoreAttempt: false };
}

async function processRow(admin: AdminSupabaseClient, row: OutboxRow, apiKey: string): Promise<Outcome> {
  if (row.attempts > MAX_EMAIL_ATTEMPTS) {
    return { kind: "failed", reason: "Maximale Anzahl Versuche erreicht." };
  }
  const recipient = await resolveRecipient(admin, row);
  if (recipient instanceof SkipEmail) return { kind: "skipped", reason: recipient.reason };

  const prepared = await preparePayload(admin, row);
  if (prepared instanceof SkipEmail) return { kind: "skipped", reason: prepared.reason };

  let rendered;
  try {
    rendered = renderEmail(row.template, prepared, {
      siteUrl: publicEnv.siteUrl,
      recipientName: recipient.name,
      supportEmail: SITE.supportEmail,
    });
  } catch (error) {
    if (error instanceof EmailTemplateError) return { kind: "failed", reason: error.message.slice(0, 500) };
    throw error;
  }

  const result = await sendEmail(
    {
      to: recipient.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: serverEnv.emailReplyTo ?? null,
      attachments: rendered.attachments,
      tags: [{ name: "template", value: row.template }],
    },
    { apiKey, idempotencyKey: row.id },
  );
  return toOutcome(result);
}

async function applyOutcome(admin: AdminSupabaseClient, row: OutboxRow, outcome: Outcome): Promise<"sent" | "failed" | "skipped" | "pending"> {
  const now = new Date();
  if (outcome.kind === "sent") {
    await admin
      .from("email_outbox")
      .update({
        status: "sent",
        sent_at: now.toISOString(),
        provider_message_id: outcome.providerId,
        last_error: outcome.note ?? null,
        locked_at: null,
      })
      .eq("id", row.id);
    return "sent";
  }
  if (outcome.kind === "skipped" || outcome.kind === "failed") {
    await admin
      .from("email_outbox")
      .update({ status: outcome.kind, last_error: outcome.reason.slice(0, 1000), locked_at: null })
      .eq("id", row.id);
    return outcome.kind;
  }
  const attempts = outcome.restoreAttempt ? Math.max(0, row.attempts - 1) : row.attempts;
  if (!outcome.restoreAttempt && attempts >= MAX_EMAIL_ATTEMPTS) {
    await admin
      .from("email_outbox")
      .update({ status: "failed", last_error: outcome.reason.slice(0, 1000), locked_at: null })
      .eq("id", row.id);
    return "failed";
  }
  const backoff = BACKOFF_SECONDS[Math.min(Math.max(attempts - 1, 0), BACKOFF_SECONDS.length - 1)] ?? 60;
  const delayMs = outcome.restoreAttempt ? 0 : Math.max(backoff * 1000, outcome.retryAfterMs ?? 0);
  await admin
    .from("email_outbox")
    .update({
      status: "pending",
      attempts,
      scheduled_at: new Date(now.getTime() + delayMs).toISOString(),
      last_error: outcome.reason.slice(0, 1000),
      locked_at: null,
    })
    .eq("id", row.id);
  return "pending";
}

/** Gibt reservierte, aber nicht bearbeitete Einträge wieder frei (Versuch wird nicht gezählt). */
async function releaseRows(admin: AdminSupabaseClient, rows: OutboxRow[]): Promise<void> {
  for (const row of rows) {
    await admin
      .from("email_outbox")
      .update({ status: "pending", attempts: Math.max(0, row.attempts - 1), locked_at: null })
      .eq("id", row.id)
      .eq("status", "sending");
  }
}

/**
 * Versand der E-Mail-Outbox (Tabelle email_outbox).
 * Ohne RESEND_API_KEY werden keine Einträge reserviert: sie bleiben «pending».
 */
export async function processEmailOutbox(limit = 25): Promise<{ sent: number; failed: number; skipped: number }> {
  const totals = { sent: 0, failed: 0, skipped: 0 };
  if (!isServiceRoleConfigured()) return totals;
  const apiKey = serverEnv.resendApiKey;
  if (!apiKey) return totals;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_emails", { p_limit: Math.max(1, Math.min(limit, 50)) });
  if (error) {
    console.error("[email] claim_emails fehlgeschlagen", error.message);
    return totals;
  }
  const rows = (data ?? []) as OutboxRow[];
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (!row) continue;
    let outcome: Outcome;
    try {
      outcome = await processRow(admin, row, apiKey);
    } catch (err) {
      console.error(`[email] Fehler bei ${row.template} ${row.id}`, err);
      outcome = {
        kind: "retry",
        reason: `Interner Fehler: ${err instanceof Error ? err.message : String(err)}`,
        stopBatch: false,
        restoreAttempt: false,
      };
    }
    const status = await applyOutcome(admin, row, outcome);
    if (status === "sent") totals.sent++;
    else if (status === "failed") totals.failed++;
    else if (status === "skipped") totals.skipped++;

    if (outcome.kind === "retry" && outcome.stopBatch) {
      await releaseRows(admin, rows.slice(index + 1));
      break;
    }
    if (outcome.kind === "sent" && index < rows.length - 1) await sleep(SEND_GAP_MS);
  }
  return totals;
}

/** Wird von Abläufen aufgerufen, die E-Mails erzeugen (in after()). Wirft nie. */
export async function flushEmailOutbox(): Promise<void> {
  try {
    await processEmailOutbox(10);
  } catch (error) {
    console.error("[email] Versand der Outbox fehlgeschlagen", error);
  }
}
