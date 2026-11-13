import { Stack } from "expo-router";
import * as React from "react";
import { ScrollView, Text, View } from "react-native";

import { ArticleCard, CtaBand, Note, PageIntro, contentStyles } from "@/components/content";
import { ARTICLES, ARTICLE_CATEGORIES } from "@/lib/content/ratgeber";
import { colors, space } from "@/lib/theme";

/** Ratgeber-Übersicht – Inhalt wie src/app/(site)/ratgeber/page.tsx der Website. */
export default function GuideScreen() {
  return (
    <ScrollView style={{ backgroundColor: colors.white }}>
      <Stack.Screen options={{ title: "Ratgeber" }} />
      <PageIntro
        eyebrow="Ratgeber"
        title="Gut vorbereitet verkaufen und vermieten"
        lead="Verständliche Anleitungen für Privatpersonen in der Schweiz – von den richtigen Unterlagen bis zur Übergabe."
      />
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.xl, gap: 36 }}>
        <Note>Die Ratgeber bieten allgemeine Informationen und ersetzen keine Rechts- oder Steuerberatung. Kantonale Regeln können abweichen.</Note>
        {ARTICLE_CATEGORIES.map((category) => {
          const articles = ARTICLES.filter((a) => a.category === category);
          if (!articles.length) return null;
          return (
            <View key={category} style={{ gap: space.lg }}>
              <Text accessibilityRole="header" style={[contentStyles.sectionTitle, { fontSize: 23, lineHeight: 28 }]}>
                {category}
              </Text>
              {articles.map((article) => (
                <ArticleCard key={article.slug} article={article} />
              ))}
            </View>
          );
        })}
      </View>
      <CtaBand
        title="Bereit für den Verkauf?"
        text="Erfassen Sie Ihre Immobilie Schritt für Schritt – kostenlos und mit allen Werkzeugen für einen professionellen Auftritt."
        primary={{ href: "/verkaufen/start", label: "Kostenlos starten" }}
        secondary={{ href: "/so-funktionierts", label: "So funktioniert Immovia" }}
      />
    </ScrollView>
  );
}
