import "server-only";

import { createClient } from "@/lib/supabase/server";
import { AppError, fromDbError } from "@/lib/errors";
import { zurichLocalToUtc } from "@/lib/format";
import type { Enums, Json } from "@/types/database";
import {
  ADMIN_PAGE_SIZE,
  type AppRole,
  type ContactStatus,
  type ListingModerationAction,
  type ModerationStatus,
  type ReportStatus,
  type SettingKey,
  type UserStatus,
  type VerificationKind,
  type VerificationStatus,
  escapeLikePattern,
  sanitizeOrFilterValue,
} from "@/lib/validation/admin";

/**
 * Administration. Lesen über den Benutzer-Client (RLS erlaubt Moderatoren bzw.
 * Admins den Zugriff), Schreiben ausschliesslich über die admin_*-Funktionen,
 * die Berechtigung prüfen und das Audit-Log schreiben.
 */

const ADMIN_ERRORS: Record<string, AppError> = {
  invalid_status: new AppError("validation", "Dieser Status ist nicht zulässig."),
  invalid_action: new AppError("validation", "Diese Aktion ist nicht zulässig."),
  invalid_subject: new AppError("validation", "Ungültiger Eintrag für die Verifizierung."),
  invalid_kind: new AppError("validation", "Diese Prüfung passt nicht zum gewählten Eintrag."),
};

function adminError(error: { message?: string; details?: string | null; code?: string } | null): AppError {
  const key = (error?.message ?? "").trim();
  return ADMIN_ERRORS[key] ?? fromDbError(error);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function asNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}
function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pageRange(page: number): { from: number; to: number } {
  const from = (Math.max(page, 1) - 1) * ADMIN_PAGE_SIZE;
  return { from, to: from + ADMIN_PAGE_SIZE - 1 };
}

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  pageCount: number;
}

function paged<T>(rows: T[], total: number, page: number): Paged<T> {
  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)) };
}

/** Neuester Eintrag pro Subjekt und Art (aktueller Verifizierungsstatus). */
export function latestVerifications<T extends { subject_id: string; kind: VerificationKind; created_at: string }>(rows: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const key = `${row.subject_id}:${row.kind}`;
    if (!map.has(key)) map.set(key, row);
  }
  return map;
}

// =============================================================================
// Übersicht
// =============================================================================
export const PLATFORM_STAT_KEYS = [
  "users_total",
  "users_active_30d",
  "users_new_7d",
  "users_suspended",
  "organizations",
  "properties",
  "listings_active",
  "listings_new_7d",
  "listings_pending_review",
  "listings_blocked",
  "inquiries_7d",
  "inquiries_total",
  "valuations_total",
  "dossiers_total",
  "image_ai_total",
  "reports_open",
  "jobs_failed_7d",
  "jobs_pending",
  "emails_failed_7d",
  "emails_pending",
  "ai_cost_usd_30d",
  "storage_bytes",
] as const;
export type PlatformStats = Record<(typeof PLATFORM_STAT_KEYS)[number], number>;

export async function getPlatformStats(): Promise<PlatformStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_platform_stats");
  if (error) throw adminError(error);
  const record = asRecord(data);
  return Object.fromEntries(PLATFORM_STAT_KEYS.map((key) => [key, asNumber(record[key])])) as PlatformStats;
}

export async function getAdminBadgeCounts(): Promise<{ reports: number; review: number }> {
  const supabase = await createClient();
  const [reports, review] = await Promise.all([
    supabase.from("user_reports").select("id", { count: "exact", head: true }).in("status", ["open", "in_review"]),
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review")
      .is("deleted_at", null),
  ]);
  return { reports: reports.count ?? 0, review: review.count ?? 0 };
}

// =============================================================================
// Benutzer
// =============================================================================
export interface AdminUserRow {
  id: string;
  email: string | null;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  accountType: Enums<"account_type">;
  status: UserStatus;
  statusReason: string | null;
  statusChangedAt: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
  /** null: für Moderatoren nicht sichtbar */
  roles: AppRole[] | null;
  identityVerified: boolean;
  listingCount: number;
}

type SearchUsersRow = {
  id: string | null;
  email: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  account_type: Enums<"account_type"> | null;
  status: UserStatus | null;
  status_reason: string | null;
  status_changed_at: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed: boolean | null;
  roles: AppRole[] | null;
  identity_verified: boolean | null;
  listing_count: number | null;
  total_count: number | null;
};

function mapUserRow(row: SearchUsersRow): AdminUserRow {
  return {
    id: row.id ?? "",
    email: row.email,
    displayName: row.display_name ?? "–",
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    accountType: row.account_type ?? "private",
    status: row.status ?? "active",
    statusReason: row.status_reason,
    statusChangedAt: row.status_changed_at,
    createdAt: row.created_at,
    lastSignInAt: row.last_sign_in_at,
    emailConfirmed: Boolean(row.email_confirmed),
    roles: row.roles,
    identityVerified: Boolean(row.identity_verified),
    listingCount: Number(row.listing_count ?? 0),
  };
}

export async function searchUsers(filters: { q?: string; status?: UserStatus; role?: AppRole; page: number }): Promise<Paged<AdminUserRow>> {
  const supabase = await createClient();
  const { from } = pageRange(filters.page);
  const { data, error } = await supabase.rpc("admin_search_users", {
    p_query: filters.q,
    p_status: filters.status,
    p_role: filters.role,
    p_limit: ADMIN_PAGE_SIZE,
    p_offset: from,
  });
  if (error) throw adminError(error);
  const rows = (data ?? []).map(mapUserRow);
  return paged(rows, Number(data?.[0]?.total_count ?? 0), filters.page);
}

export interface AdminUserDetail {
  user: AdminUserRow;
  propertyCount: number;
  listings: Array<{
    id: string;
    slug: string | null;
    title: string | null;
    status: Enums<"listing_status">;
    moderationStatus: ModerationStatus;
    updatedAt: string;
  }>;
  memberships: Array<{ role: Enums<"org_role">; organization: { id: string; name: string; slug: string; status: string } | null }>;
  verifications: Array<{ id: string; status: VerificationStatus; method: string | null; verifiedAt: string | null; createdAt: string }>;
  reports: Array<{ id: string; reason: string; status: ReportStatus; createdAt: string }>;
  moderation: Array<{ id: string; action: string; reason: string | null; createdAt: string; actor: string | null }>;
}

export async function getUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_search_users", { p_user_id: userId, p_limit: 1 });
  if (error) throw adminError(error);
  const row = data?.[0];
  if (!row?.id) return null;

  const [properties, listings, memberships, verifications, reports, moderation] = await Promise.all([
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("owner_id", userId).is("deleted_at", null),
    supabase
      .from("listings")
      .select("id, slug, title, status, moderation_status, updated_at")
      .eq("owner_id", userId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase.from("organization_members").select("role, organizations(id, name, slug, status)").eq("user_id", userId),
    supabase
      .from("verifications")
      .select("id, status, method, verified_at, created_at")
      .eq("subject_type", "user")
      .eq("subject_id", userId)
      .eq("kind", "identity")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("user_reports")
      .select("id, reason, status, created_at")
      .eq("target_type", "user")
      .eq("target_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("moderation_actions")
      .select("id, action, reason, created_at, actor:profiles!moderation_actions_actor_id_fkey(display_name)")
      .eq("target_type", "user")
      .eq("target_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return {
    user: mapUserRow(row),
    propertyCount: properties.count ?? 0,
    listings: (listings.data ?? []).map((l) => ({
      id: l.id,
      slug: l.slug,
      title: l.title,
      status: l.status,
      moderationStatus: l.moderation_status,
      updatedAt: l.updated_at,
    })),
    memberships: (memberships.data ?? []).map((m) => ({ role: m.role, organization: m.organizations ?? null })),
    verifications: (verifications.data ?? []).map((v) => ({
      id: v.id,
      status: v.status,
      method: v.method,
      verifiedAt: v.verified_at,
      createdAt: v.created_at,
    })),
    reports: (reports.data ?? []).map((r) => ({ id: r.id, reason: r.reason, status: r.status, createdAt: r.created_at })),
    moderation: (moderation.data ?? []).map((m) => ({
      id: m.id,
      action: m.action,
      reason: m.reason,
      createdAt: m.created_at,
      actor: m.actor?.display_name ?? null,
    })),
  };
}

export async function setUserStatus(input: { userId: string; status: "active" | "suspended"; reason: string }): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_user_status", {
    p_user_id: input.userId,
    p_status: input.status,
    p_reason: input.reason || undefined,
  });
  if (error) throw adminError(error);
}

export async function setUserRole(input: { userId: string; role: AppRole; grant: boolean }): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_role", { p_user_id: input.userId, p_role: input.role, p_grant: input.grant });
  if (error) throw adminError(error);
}

export async function setVerification(input: {
  subjectType: "user" | "property" | "organization";
  subjectId: string;
  kind: VerificationKind;
  status: "verified" | "rejected" | "revoked";
  method: string;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_verification", {
    p_subject_type: input.subjectType,
    p_subject_id: input.subjectId,
    p_kind: input.kind,
    p_status: input.status,
    p_method: input.method || undefined,
  });
  if (error) throw adminError(error);
}

// =============================================================================
// Inserate
// =============================================================================
export interface AdminListingRow {
  id: string;
  propertyId: string;
  slug: string | null;
  title: string | null;
  status: Enums<"listing_status">;
  moderationStatus: ModerationStatus;
  moderationReason: string | null;
  offerType: Enums<"offer_type">;
  propertyType: Enums<"property_type">;
  price: number | null;
  priceOnRequest: boolean;
  location: string;
  isDemo: boolean;
  updatedAt: string;
  statusChangedAt: string;
  owner: { id: string; displayName: string; email: string | null };
  organization: { name: string; slug: string } | null;
  verifications: Partial<Record<"ownership" | "documentation_complete", VerificationStatus>>;
  openReports: number;
}

export interface ListingFilters {
  q?: string;
  status?: Enums<"listing_status">;
  moderation?: ModerationStatus;
  page: number;
}

export async function listListings(filters: ListingFilters): Promise<Paged<AdminListingRow>> {
  const supabase = await createClient();
  const { from, to } = pageRange(filters.page);
  let query = supabase
    .from("listings")
    .select(
      "id, property_id, slug, title, status, moderation_status, moderation_reason, offer_type, property_type, price, price_on_request, postal_code, municipality, is_demo, updated_at, status_changed_at, owner_id, owner:profiles!listings_owner_id_fkey(display_name, email), organization:organizations!listings_organization_id_fkey(name, slug)",
      { count: "exact" },
    )
    .is("deleted_at", null);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.moderation) query = query.eq("moderation_status", filters.moderation);
  const q = filters.q ? sanitizeOrFilterValue(filters.q) : "";
  if (q) query = query.or(`title.ilike.%${q}%,municipality.ilike.%${q}%,postal_code.ilike.${q}%`);
  query =
    filters.status === "pending_review"
      ? query.order("status_changed_at", { ascending: true })
      : query.order("updated_at", { ascending: false });
  const { data, error, count } = await query.range(from, to);
  if (error) throw adminError(error);

  const rows = data ?? [];
  const propertyIds = rows.map((r) => r.property_id);
  const listingIds = rows.map((r) => r.id);
  const [verifications, reports] = await Promise.all([
    propertyIds.length
      ? supabase
          .from("verifications")
          .select("subject_id, kind, status, created_at")
          .eq("subject_type", "property")
          .in("subject_id", propertyIds)
      : Promise.resolve({ data: [] as Array<{ subject_id: string; kind: VerificationKind; status: VerificationStatus; created_at: string }> }),
    listingIds.length
      ? supabase
          .from("user_reports")
          .select("target_id")
          .eq("target_type", "listing")
          .in("target_id", listingIds)
          .in("status", ["open", "in_review"])
      : Promise.resolve({ data: [] as Array<{ target_id: string }> }),
  ]);
  const latest = latestVerifications(verifications.data ?? []);
  const reportCounts = new Map<string, number>();
  for (const r of reports.data ?? []) reportCounts.set(r.target_id, (reportCounts.get(r.target_id) ?? 0) + 1);

  return paged(
    rows.map((r) => ({
      id: r.id,
      propertyId: r.property_id,
      slug: r.slug,
      title: r.title,
      status: r.status,
      moderationStatus: r.moderation_status,
      moderationReason: r.moderation_reason,
      offerType: r.offer_type,
      propertyType: r.property_type,
      price: r.price === null ? null : Number(r.price),
      priceOnRequest: r.price_on_request,
      location: [r.postal_code, r.municipality].filter(Boolean).join(" "),
      isDemo: r.is_demo,
      updatedAt: r.updated_at,
      statusChangedAt: r.status_changed_at,
      owner: { id: r.owner_id, displayName: r.owner?.display_name ?? "–", email: r.owner?.email ?? null },
      organization: r.organization ?? null,
      verifications: {
        ownership: latest.get(`${r.property_id}:ownership`)?.status,
        documentation_complete: latest.get(`${r.property_id}:documentation_complete`)?.status,
      },
      openReports: reportCounts.get(r.id) ?? 0,
    })),
    count ?? 0,
    filters.page,
  );
}

export async function getReviewQueue(limit = 5): Promise<AdminListingRow[]> {
  const result = await listListings({ status: "pending_review", page: 1 });
  return result.rows.slice(0, limit);
}

export async function moderateListing(input: {
  listingId: string;
  action: ListingModerationAction;
  reason: string;
}): Promise<{ slug: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_moderate_listing", {
    p_listing_id: input.listingId,
    p_action: input.action,
    p_reason: input.reason || undefined,
  });
  if (error) throw adminError(error);
  const { data } = await supabase.from("listings").select("slug").eq("id", input.listingId).maybeSingle();
  return { slug: data?.slug ?? null };
}

// =============================================================================
// Firmen
// =============================================================================
export interface AdminOrganizationRow {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  isPublic: boolean;
  location: string;
  email: string | null;
  uidNumber: string | null;
  createdAt: string;
  owner: { id: string; displayName: string; email: string | null } | null;
  memberCount: number;
  activeListings: number;
  verification: VerificationStatus | null;
}

export async function listOrganizations(filters: { q?: string; status?: "active" | "suspended"; page: number }): Promise<Paged<AdminOrganizationRow>> {
  const supabase = await createClient();
  const { from, to } = pageRange(filters.page);
  let query = supabase
    .from("organizations")
    .select("id, name, slug, status, is_public, postal_code, city, email, uid_number, created_at", { count: "exact" })
    .is("deleted_at", null);
  if (filters.status) query = query.eq("status", filters.status);
  const q = filters.q ? sanitizeOrFilterValue(filters.q) : "";
  if (q) query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%,city.ilike.%${q}%,uid_number.ilike.%${q}%`);
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) throw adminError(error);
  const rows = data ?? [];
  const ids = rows.map((r) => r.id);

  const [members, listings, verifications] = ids.length
    ? await Promise.all([
        supabase
          .from("organization_members")
          .select("organization_id, user_id, role, profile:profiles!organization_members_user_id_fkey(display_name, email)")
          .in("organization_id", ids),
        supabase
          .from("listings")
          .select("organization_id")
          .in("organization_id", ids)
          .in("status", ["published", "reserved"])
          .is("deleted_at", null),
        supabase
          .from("verifications")
          .select("subject_id, kind, status, created_at")
          .eq("subject_type", "organization")
          .in("subject_id", ids),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const latest = latestVerifications((verifications.data ?? []) as Array<{ subject_id: string; kind: VerificationKind; status: VerificationStatus; created_at: string }>);
  return paged(
    rows.map((r) => {
      const orgMembers = (members.data ?? []).filter((m) => m.organization_id === r.id);
      const owner = orgMembers.find((m) => m.role === "owner");
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        status: r.status === "suspended" ? "suspended" : "active",
        isPublic: r.is_public,
        location: [r.postal_code, r.city].filter(Boolean).join(" "),
        email: r.email,
        uidNumber: r.uid_number,
        createdAt: r.created_at,
        owner: owner ? { id: owner.user_id, displayName: owner.profile?.display_name ?? "–", email: owner.profile?.email ?? null } : null,
        memberCount: orgMembers.length,
        activeListings: (listings.data ?? []).filter((l) => l.organization_id === r.id).length,
        verification: latest.get(`${r.id}:organization`)?.status ?? null,
      };
    }),
    count ?? 0,
    filters.page,
  );
}

export async function setOrganizationStatus(input: {
  organizationId: string;
  status: "active" | "suspended";
  reason: string;
}): Promise<{ slug: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_org_status", {
    p_org_id: input.organizationId,
    p_status: input.status,
    p_reason: input.reason || undefined,
  });
  if (error) throw adminError(error);
  const { data } = await supabase.from("organizations").select("slug").eq("id", input.organizationId).maybeSingle();
  return { slug: data?.slug ?? null };
}

// =============================================================================
// Meldungen
// =============================================================================
export interface AdminReportRow {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  createdAt: string;
  handledAt: string | null;
  resolutionNote: string | null;
  reporter: { id: string; displayName: string; email: string | null } | null;
  handler: string | null;
}

export type ReportQueue = "offen" | "erledigt" | "alle";

export async function listReports(filters: { queue: ReportQueue; targetType?: string; page: number }): Promise<Paged<AdminReportRow>> {
  const supabase = await createClient();
  const { from, to } = pageRange(filters.page);
  let query = supabase
    .from("user_reports")
    .select(
      "id, target_type, target_id, reason, details, status, created_at, handled_at, resolution_note, reporter:profiles!user_reports_reporter_id_fkey(id, display_name, email), handler:profiles!user_reports_handled_by_fkey(display_name)",
      { count: "exact" },
    );
  if (filters.queue === "offen") query = query.in("status", ["open", "in_review"]);
  if (filters.queue === "erledigt") query = query.in("status", ["resolved", "dismissed"]);
  if (filters.targetType) query = query.eq("target_type", filters.targetType);
  query = query.order("created_at", { ascending: filters.queue === "offen" });
  const { data, error, count } = await query.range(from, to);
  if (error) throw adminError(error);
  return paged(
    (data ?? []).map((r) => ({
      id: r.id,
      targetType: r.target_type,
      targetId: r.target_id,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.created_at,
      handledAt: r.handled_at,
      resolutionNote: r.resolution_note,
      reporter: r.reporter ? { id: r.reporter.id, displayName: r.reporter.display_name, email: r.reporter.email } : null,
      handler: r.handler?.display_name ?? null,
    })),
    count ?? 0,
    filters.page,
  );
}

export async function getOpenReports(limit = 5): Promise<AdminReportRow[]> {
  return (await listReports({ queue: "offen", page: 1 })).rows.slice(0, limit);
}

export interface ReportTarget {
  type: string;
  id: string | null;
  title: string | null;
  slug: string | null;
  status: string | null;
  moderationStatus: ModerationStatus | null;
  ownerId: string | null;
  senderId: string | null;
  text: string | null;
  createdAt: string | null;
  exists: boolean;
}

export async function getReportTarget(reportId: string): Promise<ReportTarget> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_get_report_target", { p_report_id: reportId });
  if (error) throw adminError(error);
  const r = asRecord(data);
  const moderation = asString(r.moderation_status);
  return {
    type: asString(r.type) ?? "unknown",
    id: asString(r.id),
    title: asString(r.title) ?? asString(r.display_name) ?? asString(r.name),
    slug: asString(r.slug),
    status: asString(r.status),
    moderationStatus: moderation === "ok" || moderation === "flagged" || moderation === "blocked" ? moderation : null,
    ownerId: asString(r.owner_id),
    senderId: asString(r.sender_id),
    text: asString(r.description) ?? asString(r.body),
    createdAt: asString(r.created_at),
    exists: data !== null && Object.keys(r).length > 2,
  };
}

export async function updateReport(input: { reportId: string; status: ReportStatus; note: string }): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_report", {
    p_report_id: input.reportId,
    p_status: input.status,
    p_note: input.note || undefined,
  });
  if (error) throw adminError(error);
}

// =============================================================================
// Kontaktanfragen
// =============================================================================
export interface ContactRequestRow {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: ContactStatus;
  createdAt: string;
  userId: string | null;
}

export async function listContactRequests(filters: { status?: ContactStatus; q?: string; page: number }): Promise<Paged<ContactRequestRow>> {
  const supabase = await createClient();
  const { from, to } = pageRange(filters.page);
  let query = supabase
    .from("contact_requests")
    .select("id, name, email, subject, message, status, created_at, user_id", { count: "exact" });
  if (filters.status) query = query.eq("status", filters.status);
  const q = filters.q ? sanitizeOrFilterValue(filters.q) : "";
  if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,subject.ilike.%${q}%`);
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) throw adminError(error);
  return paged(
    (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      subject: r.subject,
      message: r.message,
      status: (["open", "answered", "closed", "spam"] as const).find((s) => s === r.status) ?? "open",
      createdAt: r.created_at,
      userId: r.user_id,
    })),
    count ?? 0,
    filters.page,
  );
}

export async function updateContactRequest(input: { requestId: string; status: ContactStatus }): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_contact_request", { p_request_id: input.requestId, p_status: input.status });
  if (error) throw adminError(error);
}

// =============================================================================
// KI-Nutzung und Zeitreihen
// =============================================================================
export interface AiUsageSummary {
  days: number;
  from: string | null;
  to: string | null;
  totals: { events: number; failed: number; inputTokens: number; outputTokens: number; images: number; costUsd: number; users: number };
  previous: { events: number; costUsd: number };
  byDay: Array<{ date: string; events: number; costUsd: number }>;
  byFeature: Array<{ feature: string; events: number; failed: number; costUsd: number; inputTokens: number; outputTokens: number; images: number }>;
  byModel: Array<{ provider: string; model: string; events: number; costUsd: number; inputTokens: number; outputTokens: number }>;
  topUsers: Array<{ userId: string; displayName: string | null; email: string | null; events: number; costUsd: number }>;
}

export async function getAiUsageSummary(days: number): Promise<AiUsageSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_ai_usage_summary", { p_days: days });
  if (error) throw adminError(error);
  const r = asRecord(data);
  const totals = asRecord(r.totals);
  const previous = asRecord(r.previous);
  return {
    days: asNumber(r.days),
    from: asString(r.from),
    to: asString(r.to),
    totals: {
      events: asNumber(totals.events),
      failed: asNumber(totals.failed),
      inputTokens: asNumber(totals.input_tokens),
      outputTokens: asNumber(totals.output_tokens),
      images: asNumber(totals.images),
      costUsd: asNumber(totals.cost_usd),
      users: asNumber(totals.users),
    },
    previous: { events: asNumber(previous.events), costUsd: asNumber(previous.cost_usd) },
    byDay: asArray(r.by_day).map((d) => {
      const x = asRecord(d);
      return { date: asString(x.date) ?? "", events: asNumber(x.events), costUsd: asNumber(x.cost_usd) };
    }),
    byFeature: asArray(r.by_feature).map((f) => {
      const x = asRecord(f);
      return {
        feature: asString(x.feature) ?? "",
        events: asNumber(x.events),
        failed: asNumber(x.failed),
        costUsd: asNumber(x.cost_usd),
        inputTokens: asNumber(x.input_tokens),
        outputTokens: asNumber(x.output_tokens),
        images: asNumber(x.images),
      };
    }),
    byModel: asArray(r.by_model).map((m) => {
      const x = asRecord(m);
      return {
        provider: asString(x.provider) ?? "",
        model: asString(x.model) ?? "",
        events: asNumber(x.events),
        costUsd: asNumber(x.cost_usd),
        inputTokens: asNumber(x.input_tokens),
        outputTokens: asNumber(x.output_tokens),
      };
    }),
    topUsers: asArray(r.top_users).map((u) => {
      const x = asRecord(u);
      return {
        userId: asString(x.user_id) ?? "",
        displayName: asString(x.display_name),
        email: asString(x.email),
        events: asNumber(x.events),
        costUsd: asNumber(x.cost_usd),
      };
    }),
  };
}

export const TIMESERIES_METRICS = ["registrations", "listings_published", "inquiries", "valuations", "dossiers"] as const;
export type TimeseriesMetric = (typeof TIMESERIES_METRICS)[number];

export interface Timeseries {
  days: number;
  from: string | null;
  to: string | null;
  series: Array<{ date: string } & Record<TimeseriesMetric, number>>;
  previous: Record<TimeseriesMetric, number>;
}

export async function getTimeseries(days: number): Promise<Timeseries> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_timeseries", { p_days: days });
  if (error) throw adminError(error);
  const r = asRecord(data);
  const previous = asRecord(r.previous);
  return {
    days: asNumber(r.days),
    from: asString(r.from),
    to: asString(r.to),
    series: asArray(r.series).map((point) => {
      const x = asRecord(point);
      return {
        date: asString(x.date) ?? "",
        registrations: asNumber(x.registrations),
        listings_published: asNumber(x.listings_published),
        inquiries: asNumber(x.inquiries),
        valuations: asNumber(x.valuations),
        dossiers: asNumber(x.dossiers),
      };
    }),
    previous: Object.fromEntries(TIMESERIES_METRICS.map((m) => [m, asNumber(previous[m])])) as Record<TimeseriesMetric, number>,
  };
}

// =============================================================================
// Einstellungen
// =============================================================================
export interface SettingRow {
  key: string;
  value: Json;
  updatedAt: string;
  updatedBy: string | null;
}

export async function getSettingRows(): Promise<SettingRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feature_settings")
    .select("key, value, updated_at, updater:profiles!feature_settings_updated_by_fkey(display_name)");
  if (error) throw adminError(error);
  return (data ?? []).map((r) => ({
    key: r.key,
    value: r.value,
    updatedAt: r.updated_at,
    updatedBy: r.updater?.display_name ?? null,
  }));
}

export async function updateSetting(key: SettingKey, value: Json): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_setting", { p_key: key, p_value: value });
  if (error) throw adminError(error);
}

// =============================================================================
// Protokoll (admin_audit_logs, unveränderlich)
// =============================================================================
export interface AuditLogRow {
  id: number;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Json;
  createdAt: string;
  actor: { id: string; displayName: string; email: string | null } | null;
}

export interface AuditFilters {
  entityType?: string;
  action?: string;
  entityId?: string;
  from?: string;
  to?: string;
  page: number;
}

export async function listAuditLogs(filters: AuditFilters): Promise<Paged<AuditLogRow>> {
  const supabase = await createClient();
  const { from, to } = pageRange(filters.page);
  let query = supabase
    .from("admin_audit_logs")
    .select("id, action, entity_type, entity_id, details, created_at, actor:profiles!admin_audit_logs_actor_id_fkey(id, display_name, email)", {
      count: "exact",
    });
  if (filters.entityType) query = query.eq("entity_type", filters.entityType);
  if (filters.action) query = query.ilike("action", `${escapeLikePattern(filters.action)}%`);
  if (filters.entityId) query = query.eq("entity_id", filters.entityId);
  if (filters.from) query = query.gte("created_at", zurichLocalToUtc(filters.from, "00:00").toISOString());
  if (filters.to) {
    const end = zurichLocalToUtc(filters.to, "00:00");
    end.setUTCDate(end.getUTCDate() + 1);
    query = query.lt("created_at", end.toISOString());
  }
  const { data, error, count } = await query.order("id", { ascending: false }).range(from, to);
  if (error) throw adminError(error);
  return paged(
    (data ?? []).map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      details: r.details,
      createdAt: r.created_at,
      actor: r.actor ? { id: r.actor.id, displayName: r.actor.display_name, email: r.actor.email } : null,
    })),
    count ?? 0,
    filters.page,
  );
}
