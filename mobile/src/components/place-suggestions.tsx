import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { PLACE_KIND_LABEL, suggestPlaces, type PlaceSuggestion } from "@/lib/api-places";
import { colors, radius, space } from "@/lib/theme";

/** Wert erst nach einer kurzen Tipp-Pause weitergeben. */
function useDebounced(value: string, delay: number): string {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Vorschlagsliste unter einem Ortsfeld: Gemeinden, PLZ, Kantone und Adressen, während getippt wird.
 * Freitext bleibt erlaubt; `onPick` liefert den gewählten Vorschlag. Die Liste steht im Seitenfluss
 * (kein schwebendes Fenster), damit sie in jeder Scroll-Ansicht antippbar bleibt.
 */
export function PlaceSuggestions({ query, visible, onPick }: { query: string; visible: boolean; onPick: (place: PlaceSuggestion) => void }) {
  const debounced = useDebounced(query.trim(), 250);
  const enabled = visible && debounced.length >= 2;
  const search = useQuery({
    queryKey: ["orte", debounced],
    queryFn: ({ signal }) => suggestPlaces(debounced, signal),
    enabled,
    staleTime: 10 * 60_000,
  });

  if (!visible || query.trim().length < 2) return null;
  const results = search.data ?? [];
  const waiting = search.isFetching || debounced !== query.trim();

  return (
    <View accessibilityRole="list" accessibilityLabel="Ortsvorschläge" style={styles.list}>
      {search.isError ? (
        <Text style={styles.hint}>Die Ortssuche ist momentan nicht erreichbar. Sie können den Ort auch frei eingeben.</Text>
      ) : results.length === 0 ? (
        <View style={styles.status}>
          {waiting ? <ActivityIndicator size="small" color={colors.brand} /> : null}
          <Text style={[styles.hint, { paddingHorizontal: 0 }]}>{waiting ? "Suche läuft …" : "Keine Treffer"}</Text>
        </View>
      ) : (
        results.map((result) => (
          <Pressable
            key={`${result.kind}-${result.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${result.label}, ${PLACE_KIND_LABEL[result.kind]}`}
            onPress={() => onPick(result)}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.mint100 }]}
          >
            <Ionicons name={result.kind === "address" ? "navigate-outline" : result.kind === "canton" ? "map-outline" : "location-outline"} size={18} color={colors.muted} />
            <Text numberOfLines={1} style={styles.label}>
              {result.label}
            </Text>
            <Text style={styles.kind}>{PLACE_KIND_LABEL[result.kind]}</Text>
          </Pressable>
        ))
      )}
      <Text style={styles.source}>Ortsdaten © swisstopo</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, padding: 6 },
  row: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: 10, borderRadius: radius.sm },
  label: { flex: 1, fontSize: 15.5, fontWeight: "500", color: colors.foreground },
  kind: { fontSize: 12.5, color: colors.muted },
  status: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: 10, paddingVertical: 12 },
  hint: { fontSize: 14, lineHeight: 20, color: colors.muted, paddingHorizontal: 10, paddingVertical: 12 },
  source: { fontSize: 10.5, color: colors.muted, paddingHorizontal: 10, paddingTop: 6, paddingBottom: 2 },
});
