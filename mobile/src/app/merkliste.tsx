import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as React from "react";
import { FlatList, RefreshControl } from "react-native";

import { ListingCard } from "@/components/listing-card";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { EmptyState, Loading, Notice } from "@/components/ui";
import { favoriteIds, listingsByIds } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useFavorites } from "@/lib/favorites";
import { errorMessage } from "@/lib/labels";
import { colors, space } from "@/lib/theme";

export default function FavoritesScreen() {
  const { userId, loading } = useAuth();
  const favorites = useFavorites();
  const query = useQuery({
    queryKey: ["favorite-listings", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const ids = await favoriteIds();
      const rows = await listingsByIds(ids);
      // Reihenfolge der Merkliste (zuletzt gemerkt zuerst)
      return rows.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    },
  });

  if (loading) return <Loading />;
  if (!userId) {
    return (
      <>
        <Stack.Screen options={{ title: "Merkliste" }} />
        <SignInPrompt icon="heart-outline" title="Ihre Merkliste" description="Melden Sie sich an, um Inserate zu merken und auf allen Geräten wiederzufinden." />
      </>
    );
  }
  const rows = (query.data ?? []).filter((row) => favorites.isFavorite(row.id));

  return (
    <>
    <Stack.Screen options={{ title: "Merkliste" }} />
    <FlatList
      contentContainerStyle={{ padding: space.lg, gap: space.lg }}
      data={rows}
      keyExtractor={(row) => row.id}
      renderItem={({ item }) => <ListingCard row={item} favorite onToggleFavorite={() => favorites.toggle(item.id)} />}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.brand} />}
      ListEmptyComponent={
        query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <Notice tone="error">{errorMessage(query.error)}</Notice>
        ) : (
          <EmptyState icon="heart-outline" title="Noch nichts gemerkt" description="Tippen Sie bei einem Inserat auf das Herz, um es hier zu speichern." />
        )
      }
    />
    </>
  );
}
