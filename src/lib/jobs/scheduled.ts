import "server-only";

import { createAdminClient, isServiceRoleConfigured, type AdminSupabaseClient } from "@/lib/supabase/admin";
import { formatTimeRange } from "@/lib/format";
import { queueEmail } from "@/lib/email/queue";
import { searchCriteriaSchema, toSearchParams } from "@/lib/search/criteria";
import { zurichDateKey } from "@/lib/viewings/calendar";
import type { Json } from "@/types/database";

/**
 * Zeitgesteuerte Aufgaben, die vom Cron-Endpoint ausgeführt werden:
 * 1. Erinnerungen an bestätigte Besichtigungen in den nächsten 24 Stunden
 * 2. Tägliche/wöchentliche Zusammenfassungen für Suchabos
 * 3. Aufräumen alter, gelesener Benachrichtigungen (älter als 180 Tage)
 * Jede Aufgabe läuft unabhängig; Fehler werden gezählt und protokolliert.
 */

const REMINDER_WINDOW_HOURS = 24;
const REMINDER_BATCH = 200;
/** Toleranz, damit ein täglicher Cron um 06:00 nicht wegen Sekunden einen Tag überspringt. */
const DIGEST_DUE_HOURS = { daily: 20, weekly: 6 * 24 + 12 } as const;
const DIGEST_MAX_LISTINGS = 10;
const NOTIFICATION_RETENTION_DAYS = 180;

type Counters = Record<string, number>;

async function sendViewingReminders(admin: AdminSupabaseClient, now: Date, counters: Counters): Promise<void> {
  const until = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 3600_000);
  const { data: appointments, error } = await admin
    .from("viewing_appointments")
    .select("id, listing_id, owner_id, guest_id, starts_at, ends_at")
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .gt("starts_at", now.toISOString())
    .lte("starts_at", until.toISOString())
    .order("starts_at", { ascending: true })
    .limit(REMINDER_BATCH);
  if (error) throw new Error(`Termine laden: ${error.message}`);
  if (!appointments?.length) return;

  const listingIds = [...new Set(appointments.map((a) => a.listing_id))];
  const guestIds = [...new Set(appointments.map((a) => a.guest_id).filter((id): id is string => Boolean(id)))];
  const [{ data: listings }, { data: guests }] = await Promise.all([
    admin.from("listings").select("id, title, slug, public_address").in("id", listingIds),
    guestIds.length
      ? admin.from("public_profiles").select("id, display_name").in("id", guestIds)
      : Promise.resolve({ data: [] as Array<{ id: string; display_name: string }> }),
  ]);
  const listingById = new Map((listings ?? []).map((l) => [l.id, l]));
  const guestName = new Map((guests ?? []).map((g) => [g.id, g.display_name]));

  for (const appointment of appointments) {
    // Reservieren: verhindert doppelte Erinnerungen bei parallelen Läufen
    const { data: claimed } = await admin
      .from("viewing_appointments")
      .update({ reminder_sent_at: now.toISOString() })
      .eq("id", appointment.id)
      .is("reminder_sent_at", null)
      .eq("status", "confirmed")
      .select("id");
    if (!claimed?.length) continue;

    const listing = listingById.get(appointment.listing_id);
    const title = listing?.title?.trim() || "Ihre Besichtigung";
    const when = formatTimeRange(appointment.starts_at, appointment.ends_at);
    const base = {
      appointment_id: appointment.id,
      listing_id: appointment.listing_id,
      listing_title: listing?.title ?? null,
      when,
      guest_name: appointment.guest_id ? (guestName.get(appointment.guest_id) ?? null) : null,
    };

    if (appointment.guest_id) {
      await admin.rpc("notify_user", {
        p_user: appointment.guest_id,
        p_type: "viewing_reminder",
        p_title: `Erinnerung: Besichtigung ${when}`,
        p_body: title,
        p_link: "/dashboard/besichtigungen?ansicht=termine",
        p_data: { appointment_id: appointment.id } as Json,
      });
      if (
        await queueEmail(admin, {
          userId: appointment.guest_id,
          template: "viewing_reminder",
          payload: { ...base, role: "guest" } as Json,
          setting: "email_viewings",
          dedupeKey: `viewing_reminder:${appointment.id}:guest`,
        })
      ) {
        counters.reminderEmails = (counters.reminderEmails ?? 0) + 1;
      }
    }

    await admin.rpc("notify_user", {
      p_user: appointment.owner_id,
      p_type: "viewing_reminder",
      p_title: "Anstehende Besichtigungen",
      p_body: `${when} · ${title}`,
      p_link: `/dashboard/besichtigungen?inserat=${appointment.listing_id}`,
      p_data: { appointment_id: appointment.id } as Json,
      p_group_key: `viewing_reminders:${zurichDateKey(now)}`,
    });
    if (
      await queueEmail(admin, {
        userId: appointment.owner_id,
        template: "viewing_reminder",
        payload: { ...base, role: "seller" } as Json,
        setting: "email_viewings",
        dedupeKey: `viewing_reminder:${appointment.id}:seller`,
      })
    ) {
      counters.reminderEmails = (counters.reminderEmails ?? 0) + 1;
    }
    counters.reminders = (counters.reminders ?? 0) + 1;
  }
}

function searchPathFromCriteria(criteria: Json): string | null {
  const parsed = searchCriteriaSchema.safeParse(criteria);
  if (!parsed.success) return null;
  const offer = parsed.data.offer;
  const base = offer === "sale" ? "/kaufen" : offer === "rent" ? "/mieten" : "/immobilien";
  const params = toSearchParams({ criteria: parsed.data }, { omitOffer: Boolean(offer) }).toString();
  return params ? `${base}?${params}` : base;
}

function isDigestDue(frequency: string, lastNotifiedAt: string | null, now: Date): boolean {
  if (frequency !== "daily" && frequency !== "weekly") return false;
  if (!lastNotifiedAt) return true;
  const hours = DIGEST_DUE_HOURS[frequency];
  return now.getTime() - new Date(lastNotifiedAt).getTime() >= hours * 3600_000;
}

async function sendSearchDigests(admin: AdminSupabaseClient, now: Date, counters: Counters): Promise<void> {
  const { data: searches, error } = await admin
    .from("saved_searches")
    .select("id, user_id, name, criteria, alert_frequency, last_notified_at")
    .eq("alert_enabled", true)
    .in("alert_frequency", ["daily", "weekly"])
    .order("last_notified_at", { ascending: true, nullsFirst: true })
    .limit(1000);
  if (error) throw new Error(`Suchabos laden: ${error.message}`);
  const due = (searches ?? []).filter((s) => isDigestDue(s.alert_frequency, s.last_notified_at, now));
  if (!due.length) return;

  const { data: matches } = await admin
    .from("saved_search_matches")
    .select("saved_search_id, listing_id, matched_at")
    .in("saved_search_id", due.map((s) => s.id))
    .is("notified_at", null)
    .lte("matched_at", now.toISOString())
    .order("matched_at", { ascending: false })
    .limit(5000);
  const pendingBySearch = new Map<string, string[]>();
  for (const match of matches ?? []) {
    const list = pendingBySearch.get(match.saved_search_id) ?? [];
    list.push(match.listing_id);
    pendingBySearch.set(match.saved_search_id, list);
  }
  const relevant = due.filter((s) => pendingBySearch.has(s.id));
  if (!relevant.length) return;

  const userIds = [...new Set(relevant.map((s) => s.user_id))];
  const listingIds = [...new Set([...pendingBySearch.values()].flat())];
  const [{ data: activeUsers }, { data: listings }] = await Promise.all([
    admin.from("profiles").select("id").in("id", userIds).eq("status", "active"),
    admin.from("listings").select("id, status, moderation_status, deleted_at").in("id", listingIds),
  ]);
  const active = new Set((activeUsers ?? []).map((u) => u.id));
  const publicListings = new Set(
    (listings ?? [])
      .filter((l) => (l.status === "published" || l.status === "reserved") && l.moderation_status !== "blocked" && !l.deleted_at)
      .map((l) => l.id),
  );
  const today = zurichDateKey(now);

  for (const search of relevant) {
    const pending = pendingBySearch.get(search.id) ?? [];
    const visible = pending.filter((id) => publicListings.has(id));

    if (active.has(search.user_id) && visible.length) {
      const queued = await queueEmail(admin, {
        userId: search.user_id,
        template: "search_alert_digest",
        payload: {
          saved_search_id: search.id,
          search_name: search.name,
          frequency: search.alert_frequency,
          listing_ids: visible.slice(0, DIGEST_MAX_LISTINGS),
          total: visible.length,
          search_path: searchPathFromCriteria(search.criteria),
        } as Json,
        setting: "email_search_alerts",
        dedupeKey: `search_digest:${search.id}:${today}`,
      });
      if (queued) {
        counters.digests = (counters.digests ?? 0) + 1;
        counters.digestListings = (counters.digestListings ?? 0) + visible.length;
      }
      await admin.from("saved_searches").update({ last_notified_at: now.toISOString() }).eq("id", search.id);
    }

    // Alle offenen Treffer als erledigt markieren (auch nicht mehr öffentliche), damit sie sich nicht stauen
    await admin
      .from("saved_search_matches")
      .update({ notified_at: now.toISOString() })
      .eq("saved_search_id", search.id)
      .in("listing_id", pending)
      .is("notified_at", null);
  }
}

async function cleanupNotifications(admin: AdminSupabaseClient, now: Date, counters: Counters): Promise<void> {
  const cutoff = new Date(now.getTime() - NOTIFICATION_RETENTION_DAYS * 86_400_000).toISOString();
  const { count, error } = await admin
    .from("notifications")
    .delete({ count: "exact" })
    .not("read_at", "is", null)
    .lt("created_at", cutoff);
  if (error) throw new Error(`Benachrichtigungen aufräumen: ${error.message}`);
  counters.notificationsDeleted = count ?? 0;
}

export async function runScheduledTasks(): Promise<Record<string, number>> {
  const counters: Counters = { reminders: 0, reminderEmails: 0, digests: 0, digestListings: 0, notificationsDeleted: 0, errors: 0 };
  if (!isServiceRoleConfigured()) return counters;
  const admin = createAdminClient();
  const now = new Date();

  const tasks: Array<[string, (a: AdminSupabaseClient, n: Date, c: Counters) => Promise<void>]> = [
    ["Termin-Erinnerungen", sendViewingReminders],
    ["Suchabo-Zusammenfassungen", sendSearchDigests],
    ["Benachrichtigungen aufräumen", cleanupNotifications],
  ];
  for (const [label, task] of tasks) {
    try {
      await task(admin, now, counters);
    } catch (error) {
      counters.errors = (counters.errors ?? 0) + 1;
      console.error(`[cron] ${label} fehlgeschlagen`, error);
    }
  }
  return counters;
}
