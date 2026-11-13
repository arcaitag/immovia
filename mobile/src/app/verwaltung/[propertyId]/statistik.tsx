import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import * as React from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { Card, editorStyles } from "@/components/editor/shared";
import { Chip, EmptyState, Loading, Notice, SectionTitle } from "@/components/ui";
import { formatDate, listingStatistics, managedListing, type ListingStatistics } from "@/lib/api-owner";
import { useAuth } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import { errorMessage } from "@/lib/labels";
import { colors, radius, space, text } from "@/lib/theme";

type Range = 30 | 90;

interface Bucket {
  label: string;
  value: number;
}

const shortDate = (date: string) => {
  const [, month, day] = date.split("-");
  return `${day}.${month}.`;
};

/** 30 Tage: ein Balken pro Tag. 90 Tage: ein Balken pro 7 Tage, damit die Balken lesbar bleiben. */
function buckets(series: ListingStatistics["series"], key: "views" | "inquiries", range: Range): Bucket[] {
  if (range === 30) return series.map((point) => ({ label: shortDate(point.date), value: point[key] }));
  const result: Bucket[] = [];
  // Vom jüngsten Tag rückwärts gruppieren, damit der letzte Balken eine volle Woche zeigt
  for (let end = series.length; end > 0; end -= 7) {
    const chunk = series.slice(Math.max(0, end - 7), end);
    result.unshift({
      label: `${shortDate(chunk[0]!.date)}–${shortDate(chunk[chunk.length - 1]!.date)}`,
      value: chunk.reduce((sum, point) => sum + point[key], 0),
    });
  }
  return result;
}

const CHART_HEIGHT = 120;

function BarChart({ title, hint, data, unit }: { title: string; hint: string; data: Bucket[]; unit: { one: string; many: string } }) {
  const [selected, setSelected] = React.useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const active = selected !== null && selected < data.length ? data[selected]! : null;
  const count = (n: number) => `${formatNumber(n)} ${n === 1 ? unit.one : unit.many}`;
  return (
    <Card>
      <View style={{ gap: 2 }}>
        <Text style={[text.body, { fontWeight: "700" }]}>{title}</Text>
        <Text style={text.small}>{hint}</Text>
      </View>
      <Text style={text.small} accessibilityLiveRegion="polite">
        {active ? `${active.label}: ${count(active.value)}` : `Im Zeitraum: ${count(total)}. Tippen Sie auf einen Balken für den Wert.`}
      </Text>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${title}: ${count(total)} im Zeitraum, höchster Wert ${count(max === 1 && total === 0 ? 0 : max)}.`}
        style={styles.chart}
      >
        <View style={styles.gridLine} />
        <View style={[styles.gridLine, { top: CHART_HEIGHT / 2 }]} />
        {data.map((d, index) => (
          <Pressable key={index} onPress={() => setSelected(selected === index ? null : index)} style={styles.barSlot} accessible={false}>
            <View
              style={[
                styles.bar,
                { height: d.value === 0 ? 2 : Math.max(4, (d.value / max) * CHART_HEIGHT) },
                d.value === 0 && { backgroundColor: colors.border },
                selected === index && { backgroundColor: colors.forest },
              ]}
            />
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={text.small}>{data[0]?.label.split("–")[0] ?? ""}</Text>
        <Text style={text.small}>Höchstwert: {formatNumber(total === 0 ? 0 : max)}</Text>
        <Text style={text.small}>{data[data.length - 1]?.label.split("–").pop() ?? ""}</Text>
      </View>
    </Card>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${formatNumber(value)}${hint ? `, ${hint}` : ""}`}>
      <Text style={text.small}>{label}</Text>
      <Text style={styles.statValue}>{formatNumber(value)}</Text>
      {hint ? <Text style={text.small}>{hint}</Text> : null}
    </View>
  );
}

export default function StatisticsScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { userId } = useAuth();
  const [range, setRange] = React.useState<Range>(30);
  const managed = useQuery({ queryKey: ["managed-listing", propertyId], queryFn: () => managedListing(propertyId), enabled: Boolean(userId) });
  const listing = managed.data?.listing ?? null;
  const stats = useQuery({
    queryKey: ["listing-statistics", listing?.id, range],
    queryFn: () => listingStatistics(listing!.id, range),
    enabled: Boolean(listing?.first_published_at),
  });

  let body: React.ReactNode;
  if (!userId) {
    body = <EmptyState icon="lock-closed-outline" title="Bitte anmelden" description="Melden Sie sich an, um die Statistik zu sehen." />;
  } else if (managed.isPending) {
    body = <Loading />;
  } else if (managed.isError) {
    body = <Notice tone="error">{errorMessage(managed.error)}</Notice>;
  } else if (!listing) {
    body = <EmptyState icon="home-outline" title="Nicht gefunden" description="Diese Immobilie gibt es nicht mehr oder sie gehört zu einem anderen Konto." />;
  } else if (!listing.first_published_at) {
    body = (
      <EmptyState
        icon="bar-chart-outline"
        title="Noch keine Statistik"
        description="Sobald das Inserat veröffentlicht ist, sehen Sie hier, wie oft es aufgerufen, gemerkt und angefragt wird."
      />
    );
  } else if (stats.isPending) {
    body = <Loading />;
  } else if (stats.isError) {
    body = <Notice tone="error">{errorMessage(stats.error)}</Notice>;
  } else {
    const data = stats.data;
    const periodViews = data.series.reduce((sum, point) => sum + point.views, 0);
    const perBar = range === 30 ? "pro Tag" : "pro 7 Tage";
    body = (
      <>
        <View style={editorStyles.wrap} accessibilityRole="radiogroup" accessibilityLabel="Zeitraum">
          <Chip label="30 Tage" selected={range === 30} onPress={() => setRange(30)} />
          <Chip label="90 Tage" selected={range === 90} onPress={() => setRange(90)} />
        </View>
        <Card>
          <SectionTitle>{listing.title?.trim() || "Inserat ohne Titel"}</SectionTitle>
          <Text style={text.small}>Veröffentlicht seit {formatDate(data.published_at ?? listing.first_published_at)}</Text>
          <View style={styles.stats}>
            <Stat label="Aufrufe" value={data.views_total} hint={`${formatNumber(periodViews)} in ${range} Tagen`} />
            <Stat label="Auf Merklisten" value={data.favorites} />
            <Stat label="Anfragen" value={data.inquiries} />
            <Stat label="Interessenten" value={data.leads} />
            <Stat label="Besichtigungen" value={data.viewings} hint="bestätigt oder durchgeführt" />
          </View>
        </Card>
        <BarChart
          key={`views-${range}`}
          title={`Aufrufe ${perBar}`}
          hint="Pro Besucher und Tag einmal gezählt"
          data={buckets(data.series, "views", range)}
          unit={{ one: "Aufruf", many: "Aufrufe" }}
        />
        <BarChart
          key={`inquiries-${range}`}
          title={`Anfragen ${perBar}`}
          hint="Kontaktanfragen über das Inserat"
          data={buckets(data.series, "inquiries", range)}
          unit={{ one: "Anfrage", many: "Anfragen" }}
        />
        <Text style={text.small}>
          Datengrundlage: Aufrufe der öffentlichen Inseratseite (anonymisiert), Merklisten, Kontaktanfragen und Besichtigungstermine. Gezählt werden nur echte Ereignisse.
        </Text>
      </>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 }}
      refreshControl={
        <RefreshControl
          refreshing={stats.isRefetching}
          onRefresh={() => {
            void managed.refetch();
            if (listing?.first_published_at) void stats.refetch();
          }}
          tintColor={colors.brand}
        />
      }
    >
      <Stack.Screen options={{ title: "Statistik" }} />
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  stat: { flexGrow: 1, flexBasis: "45%", gap: 2, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  statValue: { fontSize: 24, fontWeight: "800", letterSpacing: -0.4, color: colors.foreground },
  chart: { height: CHART_HEIGHT, flexDirection: "row", alignItems: "flex-end", gap: 2, borderBottomWidth: 1, borderBottomColor: colors.input },
  gridLine: { position: "absolute", left: 0, right: 0, top: 0, height: 1, backgroundColor: colors.border },
  barSlot: { flex: 1, height: CHART_HEIGHT, justifyContent: "flex-end" },
  bar: { borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: colors.brand },
});
