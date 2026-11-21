import { Ionicons } from "@expo/vector-icons";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import * as React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EMPTY_FILTERS, activeFilterCount, countListings, placeRadius, type SearchFilters, type SortOption } from "@/lib/api";
import { demoRowsFor } from "@/lib/demo-listings";
import {
  AREA_STEPS,
  FEATURE_FILTERS,
  PLOT_STEPS,
  RADIUS_STEPS,
  ROOM_STEPS,
  YEAR_STEPS,
  maxOptions,
  minOptions,
  priceSteps,
  type FeatureKey,
} from "@/lib/filter-options";
import { formatNumber } from "@/lib/format";
import { CONDITIONS, PROPERTY_TYPES } from "@/lib/labels";
import type { Enums } from "@/lib/supabase";
import { colors, palette } from "@/lib/theme";

const OFFERS: { value: SearchFilters["offer"]; label: string }[] = [
  { value: null, label: "Alle" },
  { value: "sale", label: "Kaufen" },
  { value: "rent", label: "Mieten" },
];

const SORTS: { value: SortOption; label: string; radiusOnly?: boolean }[] = [
  { value: "newest", label: "Neueste zuerst" },
  { value: "price_asc", label: "Preis aufsteigend" },
  { value: "price_desc", label: "Preis absteigend" },
  { value: "area_desc", label: "Grösste Fläche" },
  { value: "distance", label: "Nächste zuerst", radiusOnly: true },
];

type NumberField = "priceMin" | "priceMax" | "roomsMin" | "roomsMax" | "areaMin" | "areaMax" | "plotMin" | "plotMax" | "yearMin";
type Picker = { field: NumberField; title: string; empty: string; options: number[]; format: (value: number) => string };

const rooms = (v: number) => String(v).replace(/\.0$/, "");
const squareMetres = (v: number) => `${formatNumber(v)} m²`;

/**
 * Filter der Suche als Vollbild: Angebot, Ort mit Umkreis, Objektart, Preis, Zimmer, Flächen, Merkmale,
 * Zustand, Baujahr und Sortierung. Der Knopf unten zeigt laufend, wie viele Inserate passen; erst er übernimmt
 * die Auswahl.
 */
export function FilterSheet(props: { open: boolean; filters: SearchFilters; onClose: () => void; onApply: (filters: SearchFilters) => void }) {
  return (
    <Modal visible={props.open} animationType="slide" presentationStyle="pageSheet" onRequestClose={props.onClose}>
      {/* Inhalt bei jedem Öffnen neu aufbauen: übernimmt die aktuellen Filter als Ausgangswerte */}
      {props.open ? <FilterForm {...props} /> : null}
    </Modal>
  );
}

function FilterForm({ filters, onClose, onApply }: { filters: SearchFilters; onClose: () => void; onApply: (filters: SearchFilters) => void }) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = React.useState(filters);
  const [picker, setPicker] = React.useState<Picker | null>(null);
  const set = (patch: Partial<SearchFilters>) => setDraft((d) => ({ ...d, ...patch }));

  // Trefferzahl für den Knopf: kurz nach der letzten Änderung zählen
  const [counted, setCounted] = React.useState(draft);
  React.useEffect(() => {
    const timer = setTimeout(() => setCounted(draft), 250);
    return () => clearTimeout(timer);
  }, [draft]);
  const count = useQuery({
    queryKey: ["anzahl", counted],
    queryFn: () => countListings(counted),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  // Platzhalter der Vorschau (lib/demo-listings) erscheinen in der Liste und zählen deshalb mit
  const total = count.data === undefined ? null : count.data + demoRowsFor(counted).length;
  const counting = count.isFetching || counted !== draft;

  const place = draft.place;
  const radius = placeRadius(place);
  const canRadius = Boolean(place && typeof place.lat === "number" && typeof place.lng === "number");
  const placeOnly = Boolean(place?.municipality || place?.postalCode);
  const dirty = activeFilterCount(draft) > 0 || draft.sort !== "newest";

  function setOffer(offer: SearchFilters["offer"]) {
    if (offer === draft.offer) return;
    // Preise passen nicht zur anderen Angebotsart; «Haustiere erlaubt» gibt es nur beim Mieten
    set({ offer, priceMin: null, priceMax: null, features: offer === "rent" ? draft.features : draft.features.filter((f) => f !== "pets") });
  }

  function setRadius(km: number | undefined) {
    if (!place) return;
    set({ place: { ...place, radiusKm: km }, sort: !km && draft.sort === "distance" ? "newest" : draft.sort });
  }

  function toggle<T extends string>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  function openRange(min: NumberField, max: NumberField, which: "min" | "max", title: string, steps: number[], format: (v: number) => string) {
    const options = which === "min" ? minOptions(steps, draft[min], draft[max]) : maxOptions(steps, draft[max], draft[min]);
    setPicker({ field: which === "min" ? min : max, title: `${title} ${which === "min" ? "von" : "bis"}`, empty: which === "min" ? "Kein Min." : "Kein Max.", options, format });
  }

  const priceTitle = draft.offer === "rent" ? "Miete pro Monat (CHF)" : draft.offer === "sale" ? "Kaufpreis (CHF)" : "Preis (CHF)";
  const buttonLabel =
    total === null ? "Inserate anzeigen" : total === 0 ? "Keine Inserate gefunden" : `${formatNumber(total)} ${total === 1 ? "Inserat" : "Inserate"} anzeigen`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Schliessen" hitSlop={10} onPress={onClose} style={styles.headerSide}>
          <Ionicons name="close" size={26} color={colors.forest} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.headerTitle}>
          Filter
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !dirty }}
          disabled={!dirty}
          hitSlop={10}
          onPress={() => setDraft({ ...EMPTY_FILTERS, offer: draft.offer, query: draft.query, place: draft.place })}
          style={[styles.headerSide, { alignItems: "flex-end" }]}
        >
          <Text style={[styles.resetText, !dirty && { opacity: 0.35 }]}>Zurücksetzen</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View accessibilityRole="radiogroup" style={styles.segment}>
          {OFFERS.map((offer) => {
            const selected = draft.offer === offer.value;
            return (
              <Pressable
                key={offer.label}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setOffer(offer.value)}
                style={[styles.segmentItem, selected && styles.segmentItemActive]}
              >
                <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{offer.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {place || draft.query ? (
          <Section title="Ort">
            <View style={styles.placeChip}>
              <Ionicons name="location" size={16} color={colors.white} />
              <Text style={styles.placeChipText} numberOfLines={1}>
                {place ? place.label : draft.query}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Ort entfernen" hitSlop={10} onPress={() => set({ place: null, query: "", sort: draft.sort === "distance" ? "newest" : draft.sort })}>
                <Ionicons name="close-circle" size={20} color={colors.white} />
              </Pressable>
            </View>
            {canRadius ? (
              <>
                <Text style={styles.subLabel}>Umkreis</Text>
                <View style={styles.wrap}>
                  {placeOnly ? <Pill label="Nur dieser Ort" selected={!radius} onPress={() => setRadius(undefined)} /> : null}
                  {RADIUS_STEPS.map((km) => (
                    <Pill key={km} label={`+ ${km} km`} selected={radius === km} onPress={() => setRadius(km)} />
                  ))}
                </View>
              </>
            ) : null}
          </Section>
        ) : null}

        <Section title="Objektart">
          <View style={styles.wrap}>
            {(Object.keys(PROPERTY_TYPES) as Enums<"property_type">[]).map((type) => (
              <Pill key={type} label={PROPERTY_TYPES[type]} selected={draft.types.includes(type)} onPress={() => set({ types: toggle(draft.types, type) })} />
            ))}
          </View>
        </Section>

        <Section title={priceTitle}>
          <RangeRow
            label="Preis"
            min={draft.priceMin}
            max={draft.priceMax}
            format={(v) => formatNumber(v)}
            onPick={(which) => openRange("priceMin", "priceMax", which, "Preis", priceSteps(draft.offer), (v) => `CHF ${formatNumber(v)}`)}
            onClear={(which) => set(which === "min" ? { priceMin: null } : { priceMax: null })}
          />
          {draft.offer === "rent" ? <Text style={styles.hint}>Miete inklusive Nebenkosten.</Text> : null}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Nur Inserate mit Preis</Text>
            <Switch
              accessibilityLabel="Nur Inserate mit Preis"
              value={draft.withPrice}
              onValueChange={(withPrice) => set({ withPrice })}
              trackColor={{ true: palette.pine, false: "#d5d8d1" }}
            />
          </View>
        </Section>

        <Section title="Zimmer">
          <RangeRow
            label="Zimmer"
            min={draft.roomsMin}
            max={draft.roomsMax}
            format={rooms}
            onPick={(which) => openRange("roomsMin", "roomsMax", which, "Zimmer", ROOM_STEPS, rooms)}
            onClear={(which) => set(which === "min" ? { roomsMin: null } : { roomsMax: null })}
          />
        </Section>

        <Section title="Wohnfläche">
          <RangeRow
            label="Wohnfläche"
            min={draft.areaMin}
            max={draft.areaMax}
            format={squareMetres}
            onPick={(which) => openRange("areaMin", "areaMax", which, "Wohnfläche", AREA_STEPS, squareMetres)}
            onClear={(which) => set(which === "min" ? { areaMin: null } : { areaMax: null })}
          />
        </Section>

        <Section title="Grundstücksfläche">
          <RangeRow
            label="Grundstücksfläche"
            min={draft.plotMin}
            max={draft.plotMax}
            format={squareMetres}
            onPick={(which) => openRange("plotMin", "plotMax", which, "Grundstücksfläche", PLOT_STEPS, squareMetres)}
            onClear={(which) => set(which === "min" ? { plotMin: null } : { plotMax: null })}
          />
        </Section>

        <Section title="Merkmale und Ausstattung">
          <View style={styles.wrap}>
            {FEATURE_FILTERS.filter((f) => !f.rentOnly || draft.offer === "rent").map((feature) => (
              <Pill
                key={feature.key}
                label={feature.label}
                selected={draft.features.includes(feature.key)}
                onPress={() => set({ features: toggle<FeatureKey>(draft.features, feature.key) })}
              />
            ))}
          </View>
          {draft.offer !== "rent" ? <Text style={styles.hint}>«Haustiere erlaubt» gibt es bei Mietobjekten.</Text> : null}
        </Section>

        <Section title="Zustand">
          <View style={styles.wrap}>
            {(Object.keys(CONDITIONS) as Enums<"property_condition">[]).map((condition) => (
              <Pill
                key={condition}
                label={CONDITIONS[condition]}
                selected={draft.conditions.includes(condition)}
                onPress={() => set({ conditions: toggle(draft.conditions, condition) })}
              />
            ))}
          </View>
        </Section>

        <Section title="Baujahr">
          <SelectButton
            accessibilityLabel="Baujahr ab"
            value={draft.yearMin === null ? null : `ab ${draft.yearMin}`}
            placeholder="Alle"
            onPress={() =>
              setPicker({ field: "yearMin", title: "Baujahr ab", empty: "Alle", options: minOptions(YEAR_STEPS, draft.yearMin, null), format: (v) => `ab ${v}` })
            }
            onClear={() => set({ yearMin: null })}
          />
        </Section>

        <Section title="Sortierung">
          <View style={styles.wrap}>
            {SORTS.filter((s) => !s.radiusOnly || radius).map((sort) => (
              <Pill key={sort.value} label={sort.label} selected={draft.sort === sort.value} onPress={() => set({ sort: sort.value })} />
            ))}
          </View>
        </Section>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={buttonLabel}
          accessibilityState={{ busy: counting }}
          onPress={() => {
            onApply(draft);
            onClose();
          }}
          style={({ pressed }) => [styles.applyButton, pressed && { backgroundColor: palette.pineDark }]}
        >
          <Text style={[styles.applyText, counting && { opacity: 0.75 }]}>{buttonLabel}</Text>
        </Pressable>
      </View>

      {picker ? (
        <View style={StyleSheet.absoluteFill}>
          <Pressable accessibilityRole="button" accessibilityLabel="Auswahl schliessen" style={styles.backdrop} onPress={() => setPicker(null)} />
          <View style={[styles.pickerCard, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Text accessibilityRole="header" style={styles.pickerTitle}>
              {picker.title}
            </Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {[null, ...picker.options].map((value) => {
                const selected = draft[picker.field] === value;
                return (
                  <Pressable
                    key={String(value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      set({ [picker.field]: value } as Partial<SearchFilters>);
                      setPicker(null);
                    }}
                    style={({ pressed }) => [styles.pickerRow, pressed && { backgroundColor: colors.mutedBg }]}
                  >
                    <Text style={[styles.pickerText, selected && styles.pickerTextSelected]}>{value === null ? picker.empty : picker.format(value)}</Text>
                    {selected ? <Ionicons name="checkmark" size={20} color={palette.pine} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Pill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, selected && styles.pillSelected, pressed && !selected && { backgroundColor: "#f0f3ec" }]}
    >
      <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function SelectButton({
  value,
  placeholder,
  onPress,
  onClear,
  accessibilityLabel,
}: {
  value: string | null;
  placeholder: string;
  onPress: () => void;
  onClear: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${accessibilityLabel}: ${value ?? placeholder}`}
      onPress={onPress}
      style={({ pressed }) => [styles.select, pressed && { backgroundColor: colors.mutedBg }]}
    >
      <Text style={[styles.selectText, value === null && styles.selectPlaceholder]} numberOfLines={1}>
        {value ?? placeholder}
      </Text>
      {value !== null ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${accessibilityLabel} entfernen`} hitSlop={10} onPress={onClear}>
          <Ionicons name="close-circle" size={20} color="#6f716d" />
        </Pressable>
      ) : (
        <Ionicons name="chevron-down" size={18} color="#6f716d" />
      )}
    </Pressable>
  );
}

function RangeRow({
  label,
  min,
  max,
  format,
  onPick,
  onClear,
}: {
  label: string;
  min: number | null;
  max: number | null;
  format: (value: number) => string;
  onPick: (which: "min" | "max") => void;
  onClear: (which: "min" | "max") => void;
}) {
  return (
    <View style={styles.rangeRow}>
      <View style={{ flex: 1 }}>
        <SelectButton
          accessibilityLabel={`${label} von`}
          value={min === null ? null : format(min)}
          placeholder="Kein Min."
          onPress={() => onPick("min")}
          onClear={() => onClear("min")}
        />
      </View>
      <Text style={styles.rangeBis}>bis</Text>
      <View style={{ flex: 1 }}>
        <SelectButton
          accessibilityLabel={`${label} bis`}
          value={max === null ? null : format(max)}
          placeholder="Kein Max."
          onPress={() => onPick("max")}
          onClear={() => onClear("max")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#dfe2db",
  },
  headerSide: { width: 110, justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: palette.sectionTitle },
  resetText: { fontSize: 15, fontWeight: "600", color: palette.sectionLink },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24 },
  segment: { flexDirection: "row", padding: 4, borderRadius: 14, backgroundColor: "#eef1ea" },
  segmentItem: { flex: 1, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  segmentItemActive: { backgroundColor: colors.white, boxShadow: "0 1px 3px rgba(20,30,15,0.14)" },
  segmentText: { fontSize: 15, fontWeight: "500", color: "#4d504b" },
  segmentTextActive: { fontWeight: "700", color: palette.sectionTitle },
  section: { marginTop: 22, paddingTop: 20, gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#dfe2db" },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: palette.sectionTitle },
  subLabel: { marginTop: 4, fontSize: 14, fontWeight: "600", color: "#4d504b" },
  hint: { fontSize: 13, lineHeight: 18, color: colors.muted },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#c9cdc5",
    backgroundColor: colors.white,
    justifyContent: "center",
  },
  pillSelected: { backgroundColor: palette.pine, borderColor: palette.pine },
  pillText: { fontSize: 15, color: "#1c1e1c" },
  pillTextSelected: { color: colors.white, fontWeight: "600" },
  placeChip: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: 20,
    backgroundColor: "#2b2f29",
  },
  placeChipText: { flexShrink: 1, fontSize: 15, fontWeight: "500", color: colors.white },
  rangeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  rangeBis: { fontSize: 15, color: "#4d504b" },
  select: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#c9cdc5",
    backgroundColor: colors.white,
  },
  selectText: { flex: 1, fontSize: 16, color: "#1c1e1c" },
  selectPlaceholder: { color: "#7b7d79" },
  switchRow: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  switchLabel: { flex: 1, fontSize: 16, color: "#1c1e1c" },
  footer: {
    paddingTop: 12,
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#dfe2db",
    backgroundColor: colors.white,
  },
  applyButton: { height: 52, borderRadius: 14, backgroundColor: palette.pine, alignItems: "center", justifyContent: "center" },
  applyText: { fontSize: 17, fontWeight: "700", color: colors.white },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(15,20,12,0.38)" },
  pickerCard: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.white,
    boxShadow: "0 -4px 20px rgba(15,20,12,0.12)",
  },
  pickerTitle: { paddingHorizontal: 20, paddingBottom: 8, fontSize: 17, fontWeight: "700", color: palette.sectionTitle },
  pickerRow: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 },
  pickerText: { fontSize: 17, color: "#1c1e1c" },
  pickerTextSelected: { fontWeight: "700", color: palette.pine },
});
