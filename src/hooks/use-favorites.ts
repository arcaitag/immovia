"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthUser } from "@/hooks/use-auth-user";

export const FAVORITE_IDS_KEY = ["favorite-ids"] as const;

/** IDs der gemerkten Inserate des angemeldeten Benutzers. */
export function useFavoriteIds() {
  const { data: user } = useAuthUser();
  return useQuery({
    queryKey: [...FAVORITE_IDS_KEY, user?.id ?? "anon"],
    enabled: Boolean(user),
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await createClient().from("favorites").select("listing_id");
      return new Set((data ?? []).map((f) => f.listing_id));
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  const { data: user } = useAuthUser();
  return useMutation({
    mutationFn: async ({ listingId, favorite }: { listingId: string; favorite: boolean }) => {
      const supabase = createClient();
      if (favorite) {
        const { error } = await supabase.from("favorites").insert({ listing_id: listingId });
        if (error && error.code !== "23505") throw error;
      } else {
        const { error } = await supabase.from("favorites").delete().eq("listing_id", listingId);
        if (error) throw error;
      }
    },
    onMutate: async ({ listingId, favorite }) => {
      const key = [...FAVORITE_IDS_KEY, user?.id ?? "anon"];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Set<string>>(key);
      const next = new Set(previous ?? []);
      if (favorite) next.add(listingId);
      else next.delete(listingId);
      queryClient.setQueryData(key, next);
      return { previous, key };
    },
    onError: (_error, _vars, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: FAVORITE_IDS_KEY });
    },
  });
}
