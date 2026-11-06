import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { AppError } from "@/lib/errors";
import type { Tables } from "@/types/database";

export interface SessionUser {
  id: string;
  email: string | null;
  emailConfirmed: boolean;
  profile: Tables<"profiles">;
  roles: Array<"admin" | "moderator">;
  isAdmin: boolean;
  isModerator: boolean;
  organizations: Array<{ id: string; name: string; slug: string; role: "owner" | "admin" | "member" }>;
}

/**
 * Liefert den eingeloggten Benutzer inkl. Profil, Rollen und Organisationen.
 * Pro Request gecacht. getUser() validiert das Token beim Auth-Server.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const user = data.user;

  const [profileRes, rolesRes, orgRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase
      .from("organization_members")
      .select("role, organizations(id, name, slug)")
      .eq("user_id", user.id),
  ]);
  if (!profileRes.data) return null;

  const roles = (rolesRes.data ?? []).map((r) => r.role);
  const organizations = (orgRes.data ?? [])
    .map((m) => (m.organizations ? { ...m.organizations, role: m.role } : null))
    .filter((o): o is NonNullable<typeof o> => o !== null);

  return {
    id: user.id,
    email: user.email ?? profileRes.data.email,
    emailConfirmed: Boolean(user.email_confirmed_at),
    profile: profileRes.data,
    roles,
    isAdmin: roles.includes("admin"),
    isModerator: roles.includes("admin") || roles.includes("moderator"),
    organizations,
  };
});

/** Für Seiten: leitet auf das Login um, wenn niemand angemeldet ist. */
export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(next ? `/login?weiter=${encodeURIComponent(next)}` : "/login");
  }
  return user;
}

export async function requireModerator(): Promise<SessionUser> {
  const user = await requireUser("/admin");
  if (!user.isModerator) redirect("/dashboard");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser("/admin");
  // Moderatoren zurück in den für sie freigegebenen Admin-Bereich, alle anderen ins Dashboard
  if (!user.isAdmin) redirect(user.isModerator ? "/admin" : "/dashboard");
  return user;
}

/** Für Server Actions und Route Handlers: wirft statt umzuleiten. */
export async function assertUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AppError("not_authenticated");
  if (user.profile.status !== "active") throw new AppError("account_inactive");
  return user;
}

export async function assertAdmin(): Promise<SessionUser> {
  const user = await assertUser();
  if (!user.isAdmin) throw new AppError("forbidden");
  return user;
}

export async function assertModerator(): Promise<SessionUser> {
  const user = await assertUser();
  if (!user.isModerator) throw new AppError("forbidden");
  return user;
}
