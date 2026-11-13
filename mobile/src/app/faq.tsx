import { Stack } from "expo-router";
import * as React from "react";
import { ScrollView, Text, View } from "react-native";

import { Accordion, CtaBand, PageIntro, TextLink, contentStyles, useSiteLink } from "@/components/content";
import { FAQ, FAQ_CATEGORIES, type FaqItem } from "@/lib/content/faq";
import { colors, space } from "@/lib/theme";

/** «Häufige Fragen» – Inhalt wie src/app/(site)/faq/page.tsx der Website. */
export default function FaqScreen() {
  const open = useSiteLink();
  const categories = Object.entries(FAQ_CATEGORIES) as [FaqItem["category"], string][];
  return (
    <ScrollView style={{ backgroundColor: colors.white }}>
      <Stack.Screen options={{ title: "Häufige Fragen" }} />
      <PageIntro eyebrow="Hilfe" title="Häufige Fragen" lead="Kurze Antworten auf die wichtigsten Fragen. Ausführliche Anleitungen finden Sie im Ratgeber.">
        <TextLink label="Zum Ratgeber" onPress={() => open("/ratgeber")} />
      </PageIntro>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.xl, gap: 36 }}>
        {categories.map(([key, label]) => {
          const items = FAQ.filter((item) => item.category === key);
          if (!items.length) return null;
          return (
            <View key={key} style={{ gap: space.md }}>
              <Text accessibilityRole="header" style={[contentStyles.sectionTitle, { fontSize: 22, lineHeight: 27 }]}>
                {label}
              </Text>
              <Accordion items={items} />
            </View>
          );
        })}
      </View>
      <CtaBand
        title="Ihre Frage ist nicht dabei?"
        text="Schreiben Sie uns – wir antworten so rasch wie möglich."
        primary={{ href: "/kontakt", label: "Kontakt aufnehmen" }}
        secondary={{ href: "/ratgeber", label: "Zum Ratgeber" }}
      />
    </ScrollView>
  );
}
