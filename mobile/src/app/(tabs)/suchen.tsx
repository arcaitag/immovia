import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ListingCard } from "@/components/listing-card";
import { SaveSearchSheet } from "@/components/save-search-sheet";
import { Button, Chip, EmptyState, Field, Loading, Notice, SectionTitle } from "@/components/ui";
import { EMPTY_FILTERS, PAGE_SIZE, activeFilterCount, searchListings, type SearchFilters } from "@/lib/api";
import { decodeFiltersParam } from "@/lib/api-account";
import { useAuth } from "@/lib/auth";
import { useFavorites } from "@/lib/favorites";
import { formatNumber, parseNumber } from "@/lib/format";
import { PROPERTY_TYPES, errorMessage } from "@/lib/labels";
import type { Enums } from "@/lib/supabase";
import { colors, radius, space, text } from "@/lib/theme";

const OFFERS: { value: SearchFilters["offer"]; label: string }[] = [
  { value: null, label: "Alle" },
  { value: "sale", label: "Kaufen" },
  { value: "rent", label: "Mieten" },
];
const SORTS: { value: SearchFilters["sort"]; label: string }[] = [
  { value: "newest", label: "Neueste" },
  { value: "price_asc", label: "Preis aufsteigend" },
  { value: "price_desc", label: "Preis absteigend" },
];
const ROOMS = [1, 2, 3, 4, 5];

export default function SearchScreen() {
  const [filters, setFilters] = React.useState<SearchFilters>(EMPTY_FILTERS);
  const [queryInput, setQueryInput] = React.useState("");
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [saveOpen, setSaveOpen] = React.useState(false);
  const favorites = useFavorites();
  const router = useRouter();
  const { userId } = useAuth();

  // Suchauftrag ausführen: Filter kommen als Parameter («suche», «t» = Zeitpunkt des Aufrufs) und werden einmal übernommen
  const params = useLocalSearchParams<{ suche?: string; t?: string }>();
  const incoming = params.suche ? `${params.t ?? ""}:${params.suche}` : null;
  const [applied, setApplied] = React.useState<string | null>(null);
  if (incoming && incoming !== applied) {
    setApplied(incoming);
    const next = decodeFiltersParam(params.suche);
    if (next) {
      setFilters(next);
      setQueryInput(next.query);
    }
  }

  // Eingabe erst nach kurzer Pause suchen
  React.useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => (f.query === queryInput ? f : { ...f, query: queryInput })), 350);
    return () => clearTimeout(timer);
  }, [queryInput]);

  const search = useInfiniteQuery({
    queryKey: ["search", filters],
    queryFn: ({ pageParam }) => searchListings(filters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (pages.length * PAGE_SIZE < last.total ? pages.length : undefined),
  });
  const rows = search.data?.pages.flatMap((p) => p.rows) ?? [];
  const total = search.data?.pages[0]?.total ?? 0;
  const count = activeFilterCount(filters);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.white }}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text accessibilityRole="header" style={text.title}>
            Immobilien finden
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Merkliste" hitSlop={6} onPress={() => router.push("/merkliste")} style={styles.headerButton}>
            <Ionicons name="heart-outline" size={24} color={colors.forest} />
          </Pressable>
        </View>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={19} color={colors.muted} />
            <TextInput
              accessibilityLabel="Ort, PLZ oder Region"
              placeholder="Ort, PLZ oder Region"
              placeholderTextColor="#98a29b"
              value={queryInput}
              onChangeText={setQueryInput}
              returnKeyType="search"
              autoCorrect={false}
              style={styles.searchInput}
            />
            {queryInput ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Suche leeren" hitSlop={10} onPress={() => setQueryInput("")}>
                <Ionicons name="close-circle" size={19} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={count ? `Filter, ${count} aktiv` : "Filter"}
            onPress={() => setFilterOpen(true)}
            style={[styles.filterButton, count > 0 && { backgroundColor: colors.mint100, borderColor: colors.brand }]}
          >
            <Ionicons name="options-outline" size={22} color={colors.forest} />
            {count > 0 ? (
              <View style={styles.filterCount}>
                <Text style={{ color: colors.white, fontSize: 11, fontWeight: "700" }}>{count}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          {OFFERS.map((o) => (
            <Chip key={o.label} label={o.label} selected={filters.offer === o.value} onPress={() => setFilters((f) => ({ ...f, offer: o.value }))} />
          ))}
        </View>
      </View>

      <FlatList
        style={{ backgroundColor: colors.surface }}
        contentContainerStyle={{ padding: space.lg, gap: space.lg }}
        data={rows}
        keyExtractor={(row) => row.id}
        renderItem={({ item }) => <ListingCard row={item} favorite={favorites.isFavorite(item.id)} onToggleFavorite={() => favorites.toggle(item.id)} />}
        onEndReached={() => search.hasNextPage && !search.isFetchingNextPage && search.fetchNextPage()}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl refreshing={search.isRefetching && !search.isFetchingNextPage} onRefresh={() => void search.refetch()} tintColor={colors.brand} />}
        ListHeaderComponent={
          search.isSuccess ? (
            <View style={styles.resultRow}>
              <Text accessibilityRole="summary" style={[text.small, { flex: 1 }]}>
                {total === 1 ? "1 Immobilie gefunden" : `${formatNumber(total)} Immobilien gefunden`}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Suche speichern"
                accessibilityHint="Speichert die aktuelle Suche als Suchauftrag"
                onPress={() => (userId ? setSaveOpen(true) : router.push("/login"))}
                style={({ pressed }) => [styles.saveButton, pressed && { backgroundColor: colors.mint100 }]}
              >
                <Ionicons name="bookmark-outline" size={18} color={colors.forest} />
                <Text style={{ fontSize: 14.5, fontWeight: "600", color: colors.forest }}>Suche speichern</Text>
              </Pressable>
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          search.isPending ? (
            <Loading />
          ) : search.isError ? (
            <View style={{ gap: space.md }}>
              <Notice tone="error">{errorMessage(search.error)}</Notice>
              <Button title="Erneut versuchen" variant="outline" onPress={() => search.refetch()} />
            </View>
          ) : (
            <EmptyState
              icon="search-outline"
              title="Keine Treffer"
              description="Für diese Suche gibt es im Moment keine Inserate. Passen Sie Ort oder Filter an."
              action={
                count > 0 || filters.query || filters.offer ? (
                  <Button
                    title="Filter zurücksetzen"
                    variant="outline"
                    onPress={() => {
                      setQueryInput("");
                      setFilters(EMPTY_FILTERS);
                    }}
                  />
                ) : undefined
              }
            />
          )
        }
        ListFooterComponent={search.isFetchingNextPage ? <Loading /> : undefined}
      />

      <FilterSheet open={filterOpen} filters={filters} onClose={() => setFilterOpen(false)} onApply={setFilters} />
      <SaveSearchSheet
        open={saveOpen}
        filters={filters}
        onClose={() => setSaveOpen(false)}
        onShowList={() => {
          setSaveOpen(false);
          router.push("/suchauftraege");
        }}
      />
    </SafeAreaView>
  );
}

function FilterSheet(props: { open: boolean; filters: SearchFilters; onClose: () => void; onApply: (filters: SearchFilters) => void }) {
  return (
    <Modal visible={props.open} animationType="slide" presentationStyle="pageSheet" onRequestClose={props.onClose}>
      {/* Inhalt bei jedem Öffnen neu aufbauen: übernimmt die aktuellen Filter als Ausgangswerte */}
      {props.open ? <FilterForm {...props} /> : null}
    </Modal>
  );
}

function FilterForm({ filters, onClose, onApply }: { filters: SearchFilters; onClose: () => void; onApply: (filters: SearchFilters) => void }) {
  const [draft, setDraft] = React.useState(filters);
  const [price, setPrice] = React.useState(filters.priceMax !== null ? String(filters.priceMax) : "");
  const [area, setArea] = React.useState(filters.areaMin !== null ? String(filters.areaMin) : "");

  const toggleType = (type: Enums<"property_type">) =>
    setDraft((d) => ({ ...d, types: d.types.includes(type) ? d.types.filter((t) => t !== type) : [...d.types, type] }));

  return (
      <View style={{ flex: 1, backgroundColor: colors.white }}>
        <View style={styles.sheetHeader}>
          <Text style={text.heading}>Filter</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Schliessen" hitSlop={10} onPress={onClose}>
            <Ionicons name="close" size={26} color={colors.forest} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
          <SectionTitle>Immobilientyp</SectionTitle>
          <View style={styles.wrap}>
            {(Object.keys(PROPERTY_TYPES) as Enums<"property_type">[]).map((type) => (
              <Chip key={type} label={PROPERTY_TYPES[type]} selected={draft.types.includes(type)} onPress={() => toggleType(type)} />
            ))}
          </View>
          <SectionTitle>Zimmer ab</SectionTitle>
          <View style={styles.wrap}>
            <Chip label="Egal" selected={draft.roomsMin === null} onPress={() => setDraft((d) => ({ ...d, roomsMin: null }))} />
            {ROOMS.map((n) => (
              <Chip key={n} label={`${n}+`} selected={draft.roomsMin === n} onPress={() => setDraft((d) => ({ ...d, roomsMin: n }))} />
            ))}
          </View>
          <Field
            label={draft.offer === "rent" ? "Miete bis (CHF pro Monat)" : "Preis bis (CHF)"}
            value={price}
            onChangeText={setPrice}
            keyboardType="number-pad"
            placeholder="Kein Maximum"
          />
          <Field label="Wohnfläche ab (m²)" value={area} onChangeText={setArea} keyboardType="number-pad" placeholder="Kein Minimum" />
          <SectionTitle>Sortierung</SectionTitle>
          <View style={styles.wrap}>
            {SORTS.map((s) => (
              <Chip key={s.value} label={s.label} selected={draft.sort === s.value} onPress={() => setDraft((d) => ({ ...d, sort: s.value }))} />
            ))}
          </View>
        </ScrollView>
        <View style={styles.sheetFooter}>
          <Button
            title="Zurücksetzen"
            variant="outline"
            style={{ flex: 1 }}
            onPress={() => {
              onApply({ ...EMPTY_FILTERS, offer: filters.offer, query: filters.query });
              onClose();
            }}
          />
          <Button
            title="Anzeigen"
            style={{ flex: 1 }}
            onPress={() => {
              onApply({ ...draft, priceMax: parseNumber(price), areaMin: parseNumber(area) });
              onClose();
            }}
          />
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md, gap: space.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -8 },
  searchRow: { flexDirection: "row", gap: space.sm },
  searchBox: {
    flex: 1,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.white,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.foreground, paddingVertical: 10 },
  filterButton: { width: 50, height: 50, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.input, alignItems: "center", justifyContent: "center" },
  filterCount: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  resultRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  saveButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetFooter: { flexDirection: "row", gap: space.md, padding: space.lg, paddingBottom: space.xl, borderTopWidth: 1, borderTopColor: colors.border },
});
