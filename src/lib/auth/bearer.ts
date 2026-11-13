import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SessionUser } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/**
 * Anmeldung für die mobile App: «Authorization: Bearer <Supabase-Access-Token>» statt Cookies.
 * Das Token wird beim Auth-Server geprüft (getUser); der Client arbeitet danach im Namen des
 * Benutzers, RLS greift wie auf der Website.
 */
export async function getBearerSession(request: Request): Promise<{ supabase: ServerSupabaseClient; user: SessionUser } | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim();
  if (!token || token.length > 4096) return null;

  const supabase = createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    cookies: { getAll: () => [], setAll: () => undefined },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  const authUser = data.user;

  const [profileRes, rolesRes, orgRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", authUser.id),
    supabase.from("organization_members").select("role, organizations(id, name, slug)").eq("user_id", authUser.id),
  ]);
  if (!profileRes.data || profileRes.data.status !== "active") return null;
  const roles = (rolesRes.data ?? []).map((r) => r.role);
  const organizations = (orgRes.data ?? [])
    .map((m) => (m.organizations ? { ...m.organizations, role: m.role } : null))
    .filter((o): o is NonNullable<typeof o> => o !== null);

  return {
    supabase,
    user: {
      id: authUser.id,
      email: authUser.email ?? profileRes.data.email,
      emailConfirmed: Boolean(authUser.email_confirmed_at),
      profile: profileRes.data,
      roles,
      isAdmin: roles.includes("admin"),
      isModerator: roles.includes("admin") || roles.includes("moderator"),
      organizations,
    },
  };
}
