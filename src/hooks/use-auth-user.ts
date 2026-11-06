"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { publicStorageUrl } from "@/lib/storage";

export interface ClientAuthUser {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  isModerator: boolean;
}

export const AUTH_USER_QUERY_KEY = ["auth-user"] as const;

/** Angemeldeter Benutzer im Browser (für Header, Merkliste, Formulare). */
export function useAuthUser() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: AUTH_USER_QUERY_KEY,
    enabled: isSupabaseConfigured(),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ClientAuthUser | null> => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("public_profiles").select("display_name, avatar_path").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      return {
        id: user.id,
        email: user.email ?? null,
        displayName: profile?.display_name ?? user.email ?? "Mein Konto",
        avatarUrl: publicStorageUrl("avatars", profile?.avatar_path),
        isModerator: (roles ?? []).length > 0,
      };
    },
  });

  React.useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void queryClient.invalidateQueries({ queryKey: AUTH_USER_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: ["favorite-ids"] });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  return query;
}
