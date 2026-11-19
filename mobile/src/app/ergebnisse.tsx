import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { ListingCard } from "@/components/listing-card";
import { SaveSearchSheet } from "@/components/save-search-sheet";
import { Button, EmptyState, Loading, Notice } from "@/components/ui";
import { EMPTY_FILTERS, PAGE_SIZE, searchListings } from "@/lib/api";
import { decodeFiltersParam } from "@/lib/api-account";
import { useAuth } from "@/lib/auth";
import { useFavorites } from "@/lib/favorites";
import { formatNumber } from "@/lib/format";
import { useListingGalleries } from "@/lib/galleries";
import { errorMessage } from "@/lib/labels";
import { colors, palette, space } from "@/lib/theme";

/**
 * Alle Treffer der Suche von der Startseite («Alle anzeigen»), untereinander mit Fotogalerie.
 * Die Suche kommt als Parameter «suche» und nutzt dieselben zwischengespeicherten Daten wie die Startseite.
 */
export default function ResultsScreen() {
  const params = useLocalSearchParams<{ suche?: string }>();
  const filters = React.useMemo(() => decodeFiltersParam(params.suche) ?? EMPTY_FILTERS, [params.suche]);
  const [saveOpen, setSaveOpen] = React.useState(false);
  const favorites = useFavorites();
  const router = useRouter();
  const { userId } = useAuth();

  const search = useInfiniteQuery({
    queryKey: ["search", filters],
    queryFn: ({ pageParam }) => searchListings(filters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (pages.length * PAGE_SIZE < last.total ? pages.length : undefined),
  });
  const pages = search.data?.pages ?? [];
  const rows = pages.flatMap((p) => p.rows);
  const total = pages[0]?.total ?? 0;
  const galleries = useListingGalleries(pages.map((page) => page.rows));

  return (
    <View style={{ flex: 1, backgroundColor: palette.screen }}>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <ListingCard row={item} gallery={galleries[item.id]} favorite={favorites.isFavorite(item.id)} onToggleFavorite={() => favorites.toggle(item.id)} />
          </View>
        )}
        ItemSeparatorComponent={CardGap}
        contentContainerStyle={{ paddingBottom: space.xl }}
        onEndReached={() => search.hasNextPage && !search.isFetchingNextPage && search.fetchNextPage()}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl refreshing={search.isRefetching && !search.isFetchingNextPage} onRefresh={() => void search.refetch()} tintColor={palette.pine} />}
        ListHeaderComponent={
          <View style={styles.resultRow}>
            <Text accessibilityRole="summary" style={styles.count}>
              {search.isSuccess ? (total === 1 ? "1 Immobilie gefunden" : `${formatNumber(total)} Immobilien gefunden`) : ""}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Suche speichern"
              accessibilityHint="Speichert die aktuelle Suche als Suchauftrag"
              hitSlop={{ top: 8, bottom: 8 }}
              onPress={() => (userId ? setSaveOpen(true) : router.push("/login"))}
              style={({ pressed }) => [styles.saveButton, pressed && { backgroundColor: colors.mint100 }]}
            >
              <Ionicons name="bookmark-outline" size={15} color={palette.saveText} />
              <Text style={styles.saveText}>Suche speichern</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.cardWrap}>
            {search.isPending ? (
              <Loading />
            ) : search.isError ? (
              <View style={{ gap: space.md }}>
                <Notice tone="error">{errorMessage(search.error)}</Notice>
                <Button title="Erneut versuchen" variant="outline" onPress={() => search.refetch()} />
              </View>
            ) : (
              <EmptyState icon="search-outline" title="Keine Treffer" description="Für diese Suche gibt es im Moment keine Inserate." />
            )}
          </View>
        }
        ListFooterComponent={search.isFetchingNextPage ? <Loading /> : undefined}
      />
      <SaveSearchSheet
        open={saveOpen}
        filters={filters}
        onClose={() => setSaveOpen(false)}
        onShowList={() => {
          setSaveOpen(false);
          router.push("/suchauftraege");
        }}
      />
    </View>
  );
}

function CardGap() {
  return <View style={{ height: space.lg }} />;
}

const styles = StyleSheet.create({
  resultRow: { marginTop: 16, marginBottom: 16.5, paddingLeft: 23, paddingRight: 15, flexDirection: "row", alignItems: "center", gap: space.sm },
  count: { flex: 1, fontSize: 11.5, color: palette.count },
  saveButton: {
    height: 29.6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 11.5,
    paddingRight: 9.5,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: palette.saveBorder,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  saveText: { fontSize: 11.5, fontWeight: "600", color: palette.saveText },
  cardWrap: { paddingHorizontal: 23 },
});
