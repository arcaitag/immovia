import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { favoriteIds, setFavorite } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** Merkliste: IDs des angemeldeten Benutzers und Umschalten (ohne Anmeldung → Login). */
export function useFavorites() {
  const { userId } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = ["favorites", userId];
  const query = useQuery({ queryKey: key, queryFn: favoriteIds, enabled: Boolean(userId) });
  const ids = new Set(query.data ?? []);

  const mutation = useMutation({
    mutationFn: ({ listingId, favorite }: { listingId: string; favorite: boolean }) => setFavorite(userId!, listingId, favorite),
    onMutate: async ({ listingId, favorite }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<string[]>(key) ?? [];
      queryClient.setQueryData<string[]>(key, favorite ? [listingId, ...previous] : previous.filter((id) => id !== listingId));
      return { previous };
    },
    onError: (_error, _vars, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["favorite-listings"] });
    },
  });

  return {
    isFavorite: (listingId: string) => ids.has(listingId),
    toggle: (listingId: string) => {
      if (!userId) {
        router.push("/login");
        return;
      }
      Haptics.selectionAsync().catch(() => undefined);
      mutation.mutate({ listingId, favorite: !ids.has(listingId) });
    },
  };
}
