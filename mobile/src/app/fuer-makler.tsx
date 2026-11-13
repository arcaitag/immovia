import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Stack } from "expo-router";
import * as React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { CheckList, CtaBand, Eyebrow, FeatureCard, Section, SectionHeading, contentStyles, photo, useSiteLink, type IconName } from "@/components/content";
import { Button } from "@/components/ui";
import { getBusinessPlans } from "@/lib/api-content";
import { formatNumber } from "@/lib/format";
import { MARKETING_IMAGES } from "@/lib/marketing-images";
import { colors, radius, space } from "@/lib/theme";

/** «Für Immobilienfirmen» – Inhalt wie src/app/(site)/fuer-makler/page.tsx der Website. */

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: "people-outline", title: "Team mit Rollen", text: "Inhaber, Administratoren und Mitarbeitende – jede Person sieht nur die Objekte Ihrer Firma." },
  { icon: "file-tray-outline", title: "Gemeinsames Postfach", text: "Anfragen und Nachrichten zu Firmeninseraten sind für das ganze Team zugänglich." },
  { icon: "calendar-outline", title: "Besichtigungen im Team", text: "Zeitfenster planen, Termine bestätigen und private Notizen für Kolleginnen und Kollegen erfassen." },
  { icon: "globe-outline", title: "Öffentliches Firmenprofil", text: "Logo, Beschreibung, Kontakt und alle aktuellen Inserate auf einer eigenen Seite." },
  { icon: "document-text-outline", title: "Dossiers und Texte", text: "Dieselben Werkzeuge wie für Privatpersonen: Bewertung, Bildbearbeitung, KI-Texte und Verkaufsdossier." },
  { icon: "bar-chart-outline", title: "Statistiken pro Inserat", text: "Aufrufe, Anfragen, Merklisten und Besichtigungen – aus tatsächlichen Ereignissen." },
];

const SETUP = [
  "Konto registrieren und als Kontotyp «Immobilienfirma» wählen.",
  "Im Dashboard unter «Firmenkonto» Ihre Firma mit Logo und Kontaktangaben anlegen.",
  "Mitarbeitende per E-Mail einladen und Rollen vergeben.",
  "Objekte erfassen und im Namen der Firma veröffentlichen.",
];

const BUSINESS_SIGNUP = `/registrieren?weiter=${encodeURIComponent("/dashboard/firma")}`;

export default function BusinessScreen() {
  const open = useSiteLink();
  const plans = useQuery({ queryKey: ["content", "business-plans"], queryFn: getBusinessPlans, staleTime: 3_600_000 });

  return (
    <ScrollView style={{ backgroundColor: colors.white }}>
      <Stack.Screen options={{ title: "Für Immobilienfirmen" }} />

      <View style={styles.hero}>
        <Eyebrow color={colors.mint200}>Für Immobilienfirmen</Eyebrow>
        <Text accessibilityRole="header" style={[contentStyles.pageTitle, { color: colors.white }]}>
          Ein Konto für Ihr ganzes Team
        </Text>
        <Text style={{ fontSize: 17, lineHeight: 26, color: "rgba(255,255,255,0.8)" }}>
          Makler, Verwaltungen und Bauträger verwalten Objekte, Mitarbeitende und Interessenten zentral – mit öffentlichem Firmenprofil und klaren Rollen.
        </Text>
        <View style={{ gap: space.md, marginTop: space.sm }}>
          <Pressable
            accessibilityRole="link"
            accessibilityHint="Öffnet die Website"
            onPress={() => open(BUSINESS_SIGNUP)}
            style={({ pressed }) => [styles.heroButton, { backgroundColor: pressed ? colors.mint200 : colors.mint100 }]}
          >
            <Ionicons name="business-outline" size={19} color={colors.forest} />
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.forest }}>Firmenkonto erstellen</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => open("/kontakt")}
            style={({ pressed }) => [styles.heroButton, { borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", backgroundColor: pressed ? "rgba(255,255,255,0.1)" : "transparent" }]}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.white }}>Kontakt aufnehmen</Text>
          </Pressable>
        </View>
        <Text style={{ fontSize: 13.5, lineHeight: 19, color: "rgba(255,255,255,0.7)" }}>Das Firmenkonto richten Sie auf der Website ein; die App öffnet sie dafür.</Text>
        <Image source={photo(MARKETING_IMAGES.auth.src)} accessibilityLabel={MARKETING_IMAGES.auth.alt} style={styles.photo} contentFit="cover" transition={150} />
      </View>

      <Section>
        <SectionHeading eyebrow="Funktionen" title="Gemacht für die Zusammenarbeit" />
        <View style={{ gap: space.md }}>
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} icon={feature.icon} title={feature.title} text={feature.text} />
          ))}
        </View>
      </Section>

      <Section tone="surface">
        <SectionHeading eyebrow="Einrichtung" title="In wenigen Minuten startklar" />
        <View style={{ gap: space.md }}>
          {SETUP.map((step, index) => (
            <View key={step} style={styles.setup}>
              <View style={styles.setupNumber}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.forest }}>{index + 1}</Text>
              </View>
              <Text style={{ flex: 1, fontSize: 15.5, lineHeight: 22, color: colors.foreground }}>{step}</Text>
            </View>
          ))}
        </View>
        <View style={[contentStyles.card, { borderRadius: 24, padding: 28, gap: space.md }]}>
          <Eyebrow>Konditionen</Eyebrow>
          <Text accessibilityRole="header" style={[contentStyles.sectionTitle, { fontSize: 23 }]}>
            Startphase ohne Kosten
          </Text>
          <Text style={contentStyles.sectionText}>
            Firmenkonten sind in der Startphase kostenlos. Sie brauchen keine Kreditkarte. Über künftige Angebote informieren wir rechtzeitig.
          </Text>
          {(plans.data ?? []).map((plan) => (
            <View key={plan.id} style={styles.plan}>
              <Text style={{ fontSize: 16.5, fontWeight: "700", color: colors.foreground }}>{plan.name}</Text>
              <CheckList
                items={[
                  plan.priceChfMonthly > 0 ? `CHF ${formatNumber(plan.priceChfMonthly)} pro Monat` : "Kostenlos",
                  ...(plan.activeListings !== null ? [`Bis ${formatNumber(plan.activeListings)} aktive Inserate`] : []),
                  ...(plan.members !== null ? [`Bis ${formatNumber(plan.members)} Teammitglieder`] : []),
                ]}
              />
            </View>
          ))}
          <Button title="Jetzt Firmenkonto erstellen" onPress={() => open(BUSINESS_SIGNUP)} />
        </View>
      </Section>

      <CtaBand
        title="Fragen zu Firmenkonten?"
        text="Wir beraten Sie gerne bei der Einrichtung für Ihr Team."
        primary={{ href: "/kontakt", label: "Kontakt aufnehmen" }}
        secondary={{ href: "/faq#firmen", label: "Häufige Fragen" }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.forest, paddingHorizontal: space.lg, paddingTop: 32, paddingBottom: 36, gap: space.md },
  heroButton: { minHeight: 50, borderRadius: radius.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: space.lg },
  photo: { aspectRatio: 4 / 3, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.1)", marginTop: space.md },
  setup: { flexDirection: "row", alignItems: "center", gap: space.lg, backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg },
  setupNumber: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.mint100, alignItems: "center", justifyContent: "center" },
  plan: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: space.lg, gap: space.md },
});
