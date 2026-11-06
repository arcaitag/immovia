import "server-only";

import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { AppError, fromDbError } from "@/lib/errors";
import { readUploadedImage } from "@/services/account";
import type { Tables } from "@/types/database";
import {
  parseInvitationPreview,
  type InvitationPreview,
  type OrgRole,
  type OrganizationProfileValues,
} from "@/lib/validation/organization";
import type { VerificationStatus } from "@/lib/validation/admin";

/**
 * Firmenkonten: Organisationen, Mitglieder, Einladungen.
 * Alle Abläufe über den Benutzer-Client (RLS) und die Datenbankfunktionen.
 */

/** Zusätzliche Fehlercodes aus Migration 20261106240000 (nicht in lib/errors). */
const ORG_ERRORS: Record<string, AppError> = {
  member_inactive: new AppError("invalid_state", "Dieses Mitglied ist derzeit gesperrt und kann nicht Inhaber/in werden."),
  member_already_owner: new AppError("conflict", "Diese Person besitzt bereits ein anderes Firmenkonto."),
};

function orgError(error: { message?: string; details?: string | null; code?: string } | null): AppError {
  const key = (error?.message ?? "").trim();
  return ORG_ERRORS[key] ?? fromDbError(error);
}

export type OrganizationRow = Tables<"organizations">;

export interface Membership {
  organizationId: string;
  role: OrgRole;
  joinedAt: string;
  /** null, wenn die Firma gesperrt oder gelöscht ist (per RLS nicht mehr sichtbar). */
  organization: Pick<OrganizationRow, "id" | "name" | "slug" | "status" | "logo_path"> | null;
}

export async function getMyMemberships(userId: string): Promise<Membership[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role, created_at, organizations(id, name, slug, status, logo_path)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw fromDbError(error);
  return (data ?? []).map((m) => ({
    organizationId: m.organization_id,
    role: m.role,
    joinedAt: m.created_at,
    organization: m.organizations ?? null,
  }));
}

export interface OrganizationMember {
  userId: string;
  role: OrgRole;
  displayName: string;
  avatarPath: string | null;
  email: string | null;
  joinedAt: string | null;
  isMe: boolean;
}

export interface OrganizationInvitation {
  id: string;
  email: string;
  role: OrgRole;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
}

export interface OrganizationDetail {
  organization: OrganizationRow;
  myRole: OrgRole;
  members: OrganizationMember[];
  invitations: OrganizationInvitation[];
  verification: { status: VerificationStatus; verifiedAt: string | null } | null;
  activeListings: number;
}

export async function getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_organization_members", { p_org: organizationId });
  if (error) throw fromDbError(error);
  return (data ?? [])
    .filter((m): m is typeof m & { user_id: string; role: OrgRole } => Boolean(m.user_id && m.role))
    .map((m) => ({
      userId: m.user_id,
      role: m.role,
      displayName: m.display_name ?? "Mitglied",
      avatarPath: m.avatar_path,
      email: m.email,
      joinedAt: m.joined_at,
      isMe: Boolean(m.is_me),
    }));
}

/** Detailansicht für Mitglieder; liefert null, wenn kein Zugriff besteht. */
export async function getOrganizationDetail(organizationId: string, userId: string): Promise<OrganizationDetail | null> {
  const supabase = await createClient();
  const now = Date.now();
  const [{ data: organization }, { data: membership }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", organizationId).maybeSingle(),
    supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (!organization || !membership) return null;
  const myRole = membership.role;
  const canManage = myRole === "owner" || myRole === "admin";

  const [members, invitationsRes, verificationRes, listingsRes] = await Promise.all([
    getOrganizationMembers(organizationId),
    canManage
      ? supabase
          .from("organization_invitations")
          .select("id, email, role, created_at, expires_at")
          .eq("organization_id", organizationId)
          .is("accepted_at", null)
          .is("revoked_at", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<{ id: string; email: string; role: OrgRole; created_at: string; expires_at: string }> }),
    supabase
      .from("verifications")
      .select("status, verified_at, created_at")
      .eq("subject_type", "organization")
      .eq("subject_id", organizationId)
      .eq("kind", "organization")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("status", ["published", "reserved"])
      .is("deleted_at", null),
  ]);

  return {
    organization,
    myRole,
    members,
    invitations: (invitationsRes.data ?? []).map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      createdAt: i.created_at,
      expiresAt: i.expires_at,
      expired: new Date(i.expires_at).getTime() < now,
    })),
    verification: verificationRes.data
      ? { status: verificationRes.data.status, verifiedAt: verificationRes.data.verified_at }
      : null,
    activeListings: listingsRes.count ?? 0,
  };
}

/** Firmen, deren Inhaber/in der Benutzer ist und die weitere Mitglieder haben (blockiert die Kontolöschung). */
export async function getOwnedOrganizationsWithMembers(userId: string): Promise<Array<{ id: string; name: string }>> {
  const memberships = await getMyMemberships(userId);
  const owned = memberships.filter((m) => m.role === "owner");
  if (owned.length === 0) return [];
  const supabase = await createClient();
  const result: Array<{ id: string; name: string }> = [];
  for (const m of owned) {
    const { count } = await supabase
      .from("organization_members")
      .select("user_id", { count: "exact", head: true })
      .eq("organization_id", m.organizationId)
      .neq("user_id", userId);
    if ((count ?? 0) > 0) result.push({ id: m.organizationId, name: m.organization?.name ?? "Firmenkonto" });
  }
  return result;
}

// -----------------------------------------------------------------------------
// Anlegen und bearbeiten
// -----------------------------------------------------------------------------
export async function createOrganization(input: { name: string; email: string | null; phone: string | null }): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_organization", {
    p_name: input.name,
    p_email: input.email ?? undefined,
    p_phone: input.phone ?? undefined,
  });
  if (error || !data) throw orgError(error);
  return data;
}

export async function updateOrganizationProfile(values: OrganizationProfileValues): Promise<OrganizationRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .update({
      name: values.name,
      description: values.description,
      street: values.street,
      postal_code: values.postalCode,
      city: values.city,
      canton: values.canton,
      phone: values.phone,
      email: values.email,
      website: values.website,
      uid_number: values.uidNumber,
      is_public: values.isPublic,
    })
    .eq("id", values.organizationId)
    .select("*")
    .maybeSingle();
  if (error) throw orgError(error);
  // Kein Treffer: keine Berechtigung (RLS) oder nicht vorhanden
  if (!data) throw new AppError("forbidden", "Nur Inhaber und Administratoren können das Firmenprofil bearbeiten.");
  return data;
}

/** Logo: max. 512 px (Seitenverhältnis bleibt), WebP mit Transparenz, ohne Metadaten. */
export async function renderLogo(input: Buffer): Promise<Buffer> {
  return sharp(input, { failOn: "error" })
    .rotate()
    .resize(512, 512, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 90, alphaQuality: 100 })
    .toBuffer();
}

async function assertCanManage(organizationId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_org_admin", { p_org: organizationId });
  if (error) throw fromDbError(error);
  if (!data) throw new AppError("forbidden", "Nur Inhaber und Administratoren können diese Änderung vornehmen.");
}

export async function uploadOrganizationLogo(organizationId: string, file: unknown): Promise<{ slug: string; path: string }> {
  await assertCanManage(organizationId);
  const input = await readUploadedImage(file);
  const output = await renderLogo(input);
  const supabase = await createClient();
  const path = `${organizationId}/logo-${Date.now()}.webp`;
  const { error: uploadError } = await supabase.storage
    .from("org-logos")
    .upload(path, output, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (uploadError) {
    console.error("[organizations] Logo-Upload fehlgeschlagen", uploadError.message);
    throw new AppError("unknown", "Das Logo konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.");
  }
  const { data, error } = await supabase
    .from("organizations")
    .update({ logo_path: path })
    .eq("id", organizationId)
    .select("slug")
    .maybeSingle();
  if (error || !data) {
    await supabase.storage.from("org-logos").remove([path]);
    throw error ? orgError(error) : new AppError("forbidden");
  }
  await removeOtherLogos(organizationId, path);
  return { slug: data.slug, path };
}

export async function removeOrganizationLogo(organizationId: string): Promise<{ slug: string }> {
  await assertCanManage(organizationId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .update({ logo_path: null })
    .eq("id", organizationId)
    .select("slug")
    .maybeSingle();
  if (error) throw orgError(error);
  if (!data) throw new AppError("forbidden");
  await removeOtherLogos(organizationId, null);
  return { slug: data.slug };
}

async function removeOtherLogos(organizationId: string, keepPath: string | null): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.storage.from("org-logos").list(organizationId, { limit: 100 });
  const stale = (data ?? [])
    .filter((entry) => entry.id !== null)
    .map((entry) => `${organizationId}/${entry.name}`)
    .filter((path) => path !== keepPath);
  if (stale.length) {
    const { error } = await supabase.storage.from("org-logos").remove(stale);
    if (error) console.error("[organizations] Alte Logos konnten nicht gelöscht werden", error.message);
  }
}

// -----------------------------------------------------------------------------
// Mitglieder und Einladungen
// -----------------------------------------------------------------------------
export async function inviteMember(input: { organizationId: string; email: string; role: "admin" | "member" }): Promise<string> {
  await assertCanManage(input.organizationId);
  const members = await getOrganizationMembers(input.organizationId);
  if (members.some((m) => m.email?.toLowerCase() === input.email.toLowerCase())) {
    throw new AppError("conflict", "Diese Person ist bereits Mitglied Ihres Firmenkontos.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_organization_member", {
    p_org: input.organizationId,
    p_email: input.email,
    p_role: input.role,
  });
  if (error || !data) throw orgError(error);
  return data;
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_organization_invitation", { p_invitation_id: invitationId });
  if (error) throw orgError(error);
}

/** Erneut senden: erstellt eine neue Einladung mit neuem Link (die alte wird ungültig). */
export async function resendInvitation(invitationId: string): Promise<void> {
  const supabase = await createClient();
  const { data: invitation, error } = await supabase
    .from("organization_invitations")
    .select("organization_id, email, role, accepted_at")
    .eq("id", invitationId)
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!invitation || invitation.accepted_at) throw new AppError("not_found", "Die Einladung wurde nicht gefunden.");
  const role = invitation.role === "admin" ? "admin" : "member";
  const { error: inviteError } = await supabase.rpc("invite_organization_member", {
    p_org: invitation.organization_id,
    p_email: invitation.email,
    p_role: role,
  });
  if (inviteError) throw orgError(inviteError);
}

export async function changeMemberRole(input: {
  organizationId: string;
  userId: string;
  actorId: string;
  role: "admin" | "member";
}): Promise<void> {
  if (input.userId === input.actorId) {
    throw new AppError("forbidden", "Ihre eigene Rolle können Sie nicht ändern.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .update({ role: input.role })
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .neq("role", "owner")
    .select("user_id")
    .maybeSingle();
  if (error) throw orgError(error);
  if (!data) throw new AppError("forbidden", "Diese Rolle können Sie nicht ändern.");
}

export async function removeMember(input: { organizationId: string; userId: string; actorId: string }): Promise<void> {
  if (input.userId === input.actorId) {
    throw new AppError("invalid_state", "Um das Firmenkonto zu verlassen, verwenden Sie «Firmenkonto verlassen».");
  }
  await assertCanManage(input.organizationId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .delete()
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .neq("role", "owner")
    .select("user_id")
    .maybeSingle();
  if (error) throw orgError(error);
  if (!data) throw new AppError("forbidden", "Dieses Mitglied kann nicht entfernt werden.");
}

export async function leaveOrganization(input: { organizationId: string; userId: string }): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .delete()
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .neq("role", "owner")
    .select("user_id")
    .maybeSingle();
  if (error) throw orgError(error);
  if (!data) {
    throw new AppError("invalid_state", "Als Inhaber/in können Sie das Firmenkonto nicht verlassen. Übertragen Sie zuerst die Inhaberschaft.");
  }
}

export async function transferOwnership(input: { organizationId: string; newOwnerId: string }): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_organization_ownership", {
    p_org: input.organizationId,
    p_new_owner: input.newOwnerId,
  });
  if (error) throw orgError(error);
}

// -----------------------------------------------------------------------------
// Einladung annehmen (/einladung/[token])
// -----------------------------------------------------------------------------
export async function getInvitationPreview(token: string): Promise<InvitationPreview> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_organization_invitation", { p_token: token });
  if (error) {
    console.error("[organizations] Einladungsvorschau fehlgeschlagen", error.message);
    return parseInvitationPreview(null);
  }
  return parseInvitationPreview(data);
}

export async function acceptInvitation(token: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_organization_invitation", { p_token: token });
  if (error || !data) throw orgError(error);
  return data;
}
