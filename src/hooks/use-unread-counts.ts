"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export const UNREAD_QUERY_KEY = ["unread-counts"] as const;

/** Ungelesene Nachrichten und Benachrichtigungen (wird per Realtime/Intervall aktualisiert). */
export function useUnreadCounts(enabled = true) {
  return useQuery({
    queryKey: UNREAD_QUERY_KEY,
    enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await createClient().rpc("get_unread_counts");
      if (error || !data || typeof data !== "object" || Array.isArray(data)) return { messages: 0, notifications: 0 };
      const value = data as { messages?: number; notifications?: number };
      return { messages: Number(value.messages ?? 0), notifications: Number(value.notifications ?? 0) };
    },
  });
}
