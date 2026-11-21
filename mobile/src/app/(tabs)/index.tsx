import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { ActivityIndicator, Animated, FlatList, Keyboard, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HeroLogo } from "@/components/hero-logo";
import { ListingTile, TILE_GAP, TILE_WIDTH } from "@/components/listing-tile";
import { FadeUp } from "@/components/motion";
import { PlaceSuggestions } from "@/components/place-suggestions";
import { Button, Chip, EmptyState, Field, Notice, SectionTitle } from "@/components/ui";
import { EMPTY_FILTERS, PAGE_SIZE, activeFilterCount, searchListings, type SearchFilters } from "@/lib/api";
import { decodeFiltersParam, encodeFiltersParam } from "@/lib/api-account";
import { demoRowsFor } from "@/lib/demo-listings";
import { placeFromSuggestion, type PlaceSuggestion } from "@/lib/api-places";
import { useFavorites } from "@/lib/favorites";
import { formatNumber, parseNumber } from "@/lib/format";
import { useListingGalleries } from "@/lib/galleries";
import { PROPERTY_TYPES, errorMessage } from "@/lib/labels";
import type { Enums } from "@/lib/supabase";
import { colors, palette, space, text } from "@/lib/theme";

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

/** Zusätzlicher Abstand zwischen Logo und Titel (gegenüber der ersten Vorlage); das Alpenbild rückt mit. */
const LOGO_GAP = 23;

export default function SearchScreen() {
  const [filters, setFilters] = React.useState<SearchFilters>(EMPTY_FILTERS);
  const [queryInput, setQueryInput] = React.useState("");
  const [filterOpen, setFilterOpen] = React.useState(false);
  const favorites = useFavorites();
  const router = useRouter();

  // Suchauftrag ausführen: Filter kommen als Parameter («suche», «t» = Zeitpunkt des Aufrufs) und werden einmal übernommen
  const params = useLocalSearchParams<{ suche?: string; t?: string }>();
  const incoming = params.suche ? `${params.t ?? ""}:${params.suche}` : null;
  const [applied, setApplied] = React.useState<string | null>(null);
  if (incoming && incoming !== applied) {
    setApplied(incoming);
    const next = decodeFiltersParam(params.suche);
    if (next) {
      setFilters(next);
      setQueryInput(next.place ? next.place.label : next.query);
    }
  }

  // Eingabe erst nach kurzer Pause suchen. Ein gewählter Ort bleibt, solange sein Name im Feld steht;
  // wird der Text geändert, gilt wieder der Freitext.
  React.useEffect(() => {
    const timer = setTimeout(
      () =>
        setFilters((f) => {
          if (f.place) return f.place.label === queryInput ? f : { ...f, place: null, query: queryInput };
          return f.query === queryInput ? f : { ...f, query: queryInput };
        }),
      350,
    );
    return () => clearTimeout(timer);
  }, [queryInput]);

  const [inputFocused, setInputFocused] = React.useState(false);
  const showSuggestions = inputFocused && queryInput !== filters.place?.label;

  function pickPlace(result: PlaceSuggestion) {
    const place = placeFromSuggestion(result);
    setQueryInput(place.label);
    setFilters((f) => ({ ...f, query: "", place }));
    Keyboard.dismiss();
  }

  const search = useInfiniteQuery({
    queryKey: ["search", filters],
    queryFn: ({ pageParam }) => searchListings(filters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (pages.length * PAGE_SIZE < last.total ? pages.length : undefined),
  });
  const pages = search.data?.pages ?? [];
  const rows = pages.flatMap((p) => p.rows);
  const total = pages[0]?.total ?? 0;
  // Platzhalter für die Vorschau (lib/demo-listings) folgen nach den echten Inseraten, sobald alle geladen sind
  const demos = search.isSuccess && !search.hasNextPage ? demoRowsFor(filters) : [];
  const items = [...rows, ...demos];
  const count = activeFilterCount(filters);
  // Ohne Ort, Suchtext und Filter zeigt die Reihe die neuesten Inserate, sonst die Treffer der Suche
  const searching = Boolean(filters.query || filters.place || count > 0);
  const sectionTitle = searching && search.isSuccess ? (total === 1 ? "1 Immobilie gefunden" : `${formatNumber(total)} Immobilien gefunden`) : "Aktuelle Immobilien";

  // Kennzeichnung von KI-Titelbildern: eine Abfrage pro Seite der Ergebnisse
  const galleries = useListingGalleries(pages.map((page) => page.rows));

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const heroShift = insets.top - 59 + LOGO_GAP;
  const heroHeight = (width * 760) / 863;
  // Leiste hinter der Statusanzeige erscheint, sobald die Seite gescrollt ist
  const [scrollY] = React.useState(() => new Animated.Value(0));
  const shade = scrollY.interpolate({ inputRange: [0, 24], outputRange: [0, 1], extrapolate: "clamp" });

  const loadMore = () => {
    if (search.hasNextPage && !search.isFetchingNextPage) void search.fetchNextPage();
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.screen }}>
      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: Platform.OS !== "web" })}
        refreshControl={
          <RefreshControl
            refreshing={search.isRefetching && !search.isFetchingNextPage}
            onRefresh={() => void search.refetch()}
            tintColor={palette.pine}
            progressViewOffset={insets.top}
          />
        }
      >
        {/* Das Bild stammt aus der Vorlage (Statusleiste 59 pt): bei anderer Höhe mitverschieben, damit die Berge hinter dem Text bleiben */}
        {heroShift > 0 ? <View style={[styles.heroFill, { height: heroShift + 2 }]} /> : null}
        <View testID="hero-image" style={{ position: "absolute", top: heroShift, left: 0, width, height: heroHeight }}>
          <Image source={require("../../../assets/images/hero-alpen.jpg")} style={StyleSheet.absoluteFill} contentFit="cover" />
          {/* weicher Übergang vom Bild in den etwas helleren Seitenhintergrund */}
          <View style={{ position: "absolute", top: heroHeight - 1, left: 0, right: 0, height: 160 }}>
            <VerticalGradient from={palette.heroBottom} to={palette.screen} />
          </View>
        </View>
        <View testID="hero-content" style={[styles.hero, { paddingTop: insets.top }]}>
          <HeroLogo />
          <FadeUp>
            <Text accessibilityRole="header" style={styles.headline}>
              {"Immobilien in der Schweiz\neinfach finden"}
            </Text>
            <Text style={styles.lead}>{"Kaufen, mieten oder entdecken –\nIhre Immobilie beginnt hier."}</Text>
          </FadeUp>
        </View>

        <FadeUp delay={120} style={styles.searchCard}>
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={23} color={palette.searchIcon} />
              <TextInput
                accessibilityLabel="Ort, PLZ oder Region"
                placeholder="Ort, PLZ oder Region"
                placeholderTextColor={palette.placeholder}
                value={queryInput}
                onChangeText={setQueryInput}
                returnKeyType="search"
                autoCorrect={false}
                onFocus={() => setInputFocused(true)}
                // kurze Verzögerung, damit ein Tipp auf einen Vorschlag noch ankommt
                onBlur={() => setTimeout(() => setInputFocused(false), 150)}
                style={styles.searchInput}
              />
              {queryInput ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Suche leeren" hitSlop={10} onPress={() => setQueryInput("")}>
                  <Ionicons name="close-circle" size={19} color={palette.placeholder} />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={count ? `Filter, ${count} aktiv` : "Filter"}
              onPress={() => setFilterOpen(true)}
              style={({ pressed }) => [styles.filterButton, pressed && { opacity: 0.88 }]}
            >
              <VerticalGradient from={palette.pineLight} to={palette.pineDark} />
              <Ionicons name="options-outline" size={24} color={colors.white} />
              {count > 0 ? (
                <View style={styles.filterCount}>
                  <Text style={{ color: palette.pine, fontSize: 11, fontWeight: "800" }}>{count}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
          <View style={{ marginTop: showSuggestions ? 10 : 0 }}>
            <PlaceSuggestions query={queryInput} visible={showSuggestions} onPick={pickPlace} />
          </View>
          <View accessibilityRole="radiogroup" style={styles.offerRow}>
            {OFFERS.map((o) => (
              <OfferChip key={o.label} label={o.label} selected={filters.offer === o.value} onPress={() => setFilters((f) => ({ ...f, offer: o.value }))} />
            ))}
          </View>
        </FadeUp>

        {search.isError ? (
          <View style={styles.rowMessage}>
            <Notice tone="error">{errorMessage(search.error)}</Notice>
            <Button title="Erneut versuchen" variant="outline" onPress={() => search.refetch()} />
          </View>
        ) : search.isSuccess && items.length === 0 ? (
          <View style={styles.rowMessage}>
            <EmptyState
              icon="search-outline"
              title="Keine Treffer"
              description="Für diese Suche gibt es im Moment keine Inserate. Passen Sie Ort oder Filter an."
              action={
                searching || filters.offer ? (
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
          </View>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text accessibilityRole="header" style={styles.sectionTitle} numberOfLines={1}>
                {sectionTitle}
              </Text>
              {items.length > 0 ? (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Alle anzeigen"
                  accessibilityHint="Zeigt alle Treffer untereinander, mit Fotos und «Suche speichern»"
                  hitSlop={10}
                  onPress={() => router.push({ pathname: "/ergebnisse", params: { suche: encodeFiltersParam(filters) } })}
                  style={({ pressed }) => [styles.allLink, pressed && { opacity: 0.6 }]}
                >
                  <Text style={styles.allText}>Alle anzeigen</Text>
                  <Ionicons name="arrow-forward" size={17} color={palette.sectionLink} />
                </Pressable>
              ) : null}
            </View>
            {search.isPending ? (
              <View style={styles.rowLoading}>
                <ActivityIndicator color={palette.pine} />
              </View>
            ) : (
              // Waagrechte Reihe: die Karten rasten ein, beim Blättern werden laufend weitere Treffer geladen
              <FlatList
                horizontal
                data={items}
                keyExtractor={(row) => row.id}
                renderItem={({ item }) => (
                  <ListingTile row={item} gallery={galleries[item.id]} favorite={favorites.isFavorite(item.id)} onToggleFavorite={() => favorites.toggle(item.id)} />
                )}
                ItemSeparatorComponent={TileGap}
                showsHorizontalScrollIndicator={false}
                snapToInterval={TILE_WIDTH + TILE_GAP}
                decelerationRate="fast"
                contentContainerStyle={styles.row}
                onEndReached={loadMore}
                onEndReachedThreshold={1.5}
                ListFooterComponent={
                  search.isFetchingNextPage ? (
                    <View style={styles.rowMore}>
                      <ActivityIndicator color={palette.pine} />
                    </View>
                  ) : undefined
                }
              />
            )}
          </>
        )}
      </Animated.ScrollView>
      <Animated.View pointerEvents="none" style={[styles.statusShade, { height: insets.top, opacity: shade }]} />

      <FilterSheet open={filterOpen} filters={filters} onClose={() => setFilterOpen(false)} onApply={setFilters} />
    </View>
  );
}

function TileGap() {
  return <View style={{ width: TILE_GAP }} />;
}

/** Senkrechter Farbverlauf aus überlappenden Streifen (ohne zusätzliche Bibliothek, ohne sichtbare Fugen). */
function VerticalGradient({ from, to }: { from: string; to: string }) {
  const steps = 12;
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: steps }, (_, i) => {
        const t = i / (steps - 1);
        const c = a.map((v, k) => Math.round(v + (b[k]! - v) * t));
        // jeder Streifen reicht bis ans Ende: der nächste überdeckt ihn, so entstehen keine Haarlinien
        return <View key={i} style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: `${(i * 100) / steps}%`, backgroundColor: `rgb(${c.join(",")})` }} />;
      })}
    </View>
  );
}

function hexToRgb(hex: string): number[] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function OfferChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      hitSlop={{ top: 4, bottom: 4 }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && !selected && { backgroundColor: "#dfe5d8" }]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
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
              onApply({ ...EMPTY_FILTERS, offer: filters.offer, query: filters.query, place: filters.place });
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
  // Masse aus der Gestaltungsvorlage (393 pt breit)
  hero: { paddingHorizontal: 22 },
  headline: { marginTop: 31 + LOGO_GAP, fontSize: 26, lineHeight: 28, fontWeight: "700", letterSpacing: -0.5, color: palette.headline },
  lead: { marginTop: 2.5, fontSize: 14.5, lineHeight: 18.2, color: palette.lead },
  searchCard: {
    marginTop: 17,
    marginHorizontal: 11,
    paddingTop: 22,
    paddingBottom: 21,
    paddingHorizontal: 13,
    borderRadius: 17,
    backgroundColor: palette.searchCard,
    // boxShadow statt shadow*: gleiche Unschärfe auf iOS, Android und im Web
    boxShadow: "0 6px 16px rgba(30,46,25,0.09)",
  },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  searchBox: {
    flex: 1,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingLeft: 17,
    paddingRight: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.inputBorder,
    backgroundColor: "#fbfbfa",
    boxShadow: "0 2px 4px rgba(25,40,20,0.09), 0 8px 20px rgba(25,40,20,0.09)",
  },
  // minWidth 0: das Feld darf schrumpfen, damit der Leeren-Knopf neben dem Filterknopf Platz behält
  searchInput: { flex: 1, minWidth: 0, fontSize: 16, color: colors.foreground, paddingVertical: 10 },
  filterButton: { width: 49, height: 49, borderRadius: 11, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  filterCount: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 8.5,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  offerRow: { marginTop: 21, flexDirection: "row", gap: 10 },
  chip: { height: 38, minWidth: 67, paddingHorizontal: 18, borderRadius: 19, backgroundColor: palette.chip, alignItems: "center", justifyContent: "center" },
  chipSelected: { backgroundColor: palette.pine },
  chipText: { fontSize: 15, fontWeight: "500", color: palette.chipText },
  chipTextSelected: { fontWeight: "600", color: colors.white },
  // Abschnitt «Aktuelle Immobilien» und Reihe (zweite Gestaltungsvorlage)
  sectionHeader: { marginTop: 32, paddingHorizontal: 16.5, flexDirection: "row", alignItems: "center", gap: space.md },
  sectionTitle: { flex: 1, fontSize: 18.5, lineHeight: 22, fontWeight: "700", letterSpacing: -0.3, color: palette.sectionTitle },
  allLink: { flexDirection: "row", alignItems: "center", gap: 6 },
  allText: { fontSize: 13.5, fontWeight: "500", color: palette.sectionLink },
  row: { paddingHorizontal: 16, paddingTop: 13, paddingBottom: 14 },
  rowLoading: { height: 290, alignItems: "center", justifyContent: "center" },
  rowMore: { width: 56, alignItems: "center", justifyContent: "center" },
  rowMessage: { marginTop: 24, paddingHorizontal: 23, gap: space.md },
  statusShade: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: palette.heroTop },
  heroFill: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: palette.heroTop },
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
