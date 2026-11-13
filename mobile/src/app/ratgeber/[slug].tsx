import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import * as React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { ArticleCard, CheckList, Note, contentStyles, photo, useSiteLink } from "@/components/content";
import { Badge, Button, EmptyState } from "@/components/ui";
import { getArticle, readingMinutes, type Article, type ArticleBlock } from "@/lib/content/ratgeber";
import { colors, radius, space } from "@/lib/theme";

/** Ratgeber-Artikel – Inhalt wie src/app/(site)/ratgeber/[slug]/page.tsx der Website. */

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** «2026-11-06» → «6. November 2026» (ohne Intl, damit es auf jedem Gerät gleich aussieht). */
function formatDateLong(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${day}. ${MONTHS[month - 1]} ${year}`;
}

function Block({ block }: { block: ArticleBlock }) {
  switch (block.type) {
    case "p":
      return <Text style={styles.p}>{block.text}</Text>;
    case "h2":
      return (
        <Text accessibilityRole="header" style={styles.h2}>
          {block.text}
        </Text>
      );
    case "h3":
      return (
        <Text accessibilityRole="header" style={styles.h3}>
          {block.text}
        </Text>
      );
    case "ul":
    case "ol":
      return (
        <View accessibilityRole="list" style={{ gap: space.sm }}>
          {block.items.map((item, index) => (
            <View key={item} style={{ flexDirection: "row", gap: space.md }}>
              <Text style={[styles.p, { width: 20, color: colors.brand, fontWeight: "700" }]}>{block.type === "ol" ? `${index + 1}.` : "•"}</Text>
              <Text style={[styles.p, { flex: 1 }]}>{item}</Text>
            </View>
          ))}
        </View>
      );
    case "checklist":
      return (
        <View style={styles.checklist}>
          <CheckList items={block.items} />
        </View>
      );
    case "note":
      return (
        <Note title={block.title} tone={block.tone}>
          {block.text}
        </Note>
      );
  }
}

export default function ArticleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const open = useSiteLink();
  const article = getArticle(slug);

  if (!article) {
    return (
      <>
        <Stack.Screen options={{ title: "Ratgeber" }} />
        <EmptyState icon="book-outline" title="Artikel nicht gefunden" description="Diesen Ratgeber gibt es nicht oder nicht mehr." action={<Button title="Alle Ratgeber" onPress={() => open("/ratgeber")} />} />
      </>
    );
  }

  const related = article.related.map(getArticle).filter((a): a is Article => Boolean(a));

  return (
    <ScrollView style={{ backgroundColor: colors.white }}>
      <Stack.Screen options={{ title: "Ratgeber" }} />
      <View style={{ backgroundColor: colors.surface, paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: 28, gap: space.md }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.md }}>
          <Badge tone="green" label={article.category} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="time-outline" size={15} color={colors.muted} />
            <Text style={styles.meta}>{readingMinutes(article)} Min. Lesezeit</Text>
          </View>
          <Text style={styles.meta}>Stand: {formatDateLong(article.updatedAt)}</Text>
        </View>
        <Text accessibilityRole="header" style={[contentStyles.pageTitle, { fontSize: 29, lineHeight: 33 }]}>
          {article.title}
        </Text>
        <Text style={contentStyles.lead}>{article.description}</Text>
      </View>

      <View style={{ padding: space.lg, paddingTop: space.xl, gap: space.lg }}>
        <Image source={photo(article.image.src)} accessibilityLabel={article.image.alt} style={styles.image} contentFit="cover" transition={150} />
        <Note tone={article.legalTopic ? "warning" : "info"} title="Keine Rechts- oder Steuerberatung">
          Dieser Ratgeber gibt einen allgemeinen Überblick für die Schweiz. Kantonale Regeln können abweichen. Für Ihren Einzelfall wenden Sie sich an eine Fachperson, etwa ein Notariat, eine Steuerberatung oder die zuständige Behörde.
        </Note>
        {article.blocks.map((block, index) => (
          <Block key={index} block={block} />
        ))}
        {article.cta ? (
          <View style={styles.cta}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.forest }}>Mit Immovia umsetzen</Text>
            <Button title={article.cta.label} onPress={() => open(article.cta!.href)} />
          </View>
        ) : null}
      </View>

      {related.length ? (
        <View style={{ padding: space.lg, paddingTop: space.xl, paddingBottom: 40, gap: space.lg }}>
          <Text accessibilityRole="header" style={[contentStyles.sectionTitle, { fontSize: 23 }]}>
            Weitere Ratgeber
          </Text>
          {related.map((item) => (
            <ArticleCard key={item.slug} article={item} />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  meta: { fontSize: 13.5, color: colors.muted },
  image: { aspectRatio: 16 / 9, borderRadius: 24, backgroundColor: colors.mutedBg },
  p: { fontSize: 17, lineHeight: 27, color: colors.foreground },
  h2: { fontSize: 23, fontWeight: "800", letterSpacing: -0.4, lineHeight: 29, color: colors.foreground, marginTop: space.lg },
  h3: { fontSize: 18.5, fontWeight: "700", lineHeight: 25, color: colors.foreground, marginTop: space.sm },
  checklist: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: space.xl },
  cta: { borderRadius: radius.lg, backgroundColor: colors.mint100, padding: space.xl, gap: space.md, marginTop: space.lg },
});
