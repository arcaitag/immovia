import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Stack } from "expo-router";
import * as React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Accordion, CheckList, CtaBand, Eyebrow, FeatureCard, IconTile, Section, SectionHeading, contentStyles, photo, useSiteLink, type IconName } from "@/components/content";
import { FadeUp } from "@/components/motion";
import { Button } from "@/components/ui";
import { getAiQuotas } from "@/lib/api-content";
import { FAQ } from "@/lib/content/faq";
import { formatNumber } from "@/lib/format";
import { MARKETING_IMAGES } from "@/lib/marketing-images";
import { colors, radius, space } from "@/lib/theme";

/** «Immobilie verkaufen» – Inhalt wie src/app/(site)/verkaufen/page.tsx der Website. */

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "home-outline", title: "Immobilie erfassen", text: "Ein Assistent fragt nur, was für Ihren Objekttyp wichtig ist. Alles wird automatisch zwischengespeichert." },
  { icon: "speedometer-outline", title: "Wert einschätzen", text: "Die Bewertung zeigt Spanne, Datenbasis und Unsicherheit – oder sagt ehrlich, wenn die Daten nicht reichen." },
  { icon: "images-outline", title: "Bilder hochladen", text: "Fotos direkt vom Smartphone hochladen, sortieren, zuschneiden und das Titelbild festlegen." },
  { icon: "create-outline", title: "Beschreibung erstellen", text: "KI-Textvorschläge auf Basis Ihrer Angaben – Sie prüfen, ändern und bestätigen jeden Text." },
  { icon: "document-text-outline", title: "Dossier erzeugen", text: "Ein PDF-Verkaufsdossier im Makler-Look, in drei Vorlagen und jederzeit neu erstellbar." },
  { icon: "location-outline", title: "Inserat festlegen", text: "Preis, Kontakt und Genauigkeit der Adresse bestimmen Sie selbst – mit Vorschau." },
  { icon: "rocket-outline", title: "Veröffentlichen", text: "Ihr Inserat erscheint in der Suche; passende Suchaufträge werden automatisch benachrichtigt." },
  { icon: "file-tray-outline", title: "Verkauf begleiten", text: "Anfragen, Nachrichten, Besichtigungen und Interessentenstatus an einem Ort – bis zum Abschluss." },
];

const FEATURES: { icon: IconName; title: string; text: string; href?: string }[] = [
  {
    icon: "speedometer-outline",
    title: "Ehrliche Bewertung",
    text: "Vergleich mit Angebotspreisen echter Inserate, klar gekennzeichnet. Ohne genügend Vergleichsobjekte zeigen wir keine Zahl.",
    href: "/bewerten",
  },
  {
    icon: "color-wand-outline",
    title: "Bilder verbessern",
    text: "Helligkeit, Kontrast, Weissabgleich und Schärfe automatisch optimieren. Das Original bleibt erhalten, veränderte Bilder sind gekennzeichnet.",
  },
  { icon: "sparkles-outline", title: "Texte in fünf Stilen", text: "Sachlich, modern, elegant, emotional oder premium – ohne erfundene Ausstattung oder Lagevorteile." },
  {
    icon: "calendar-outline",
    title: "Besichtigungen planen",
    text: "Zeitfenster freischalten, Interessierte buchen selbst. Doppelbuchungen verhindert die Datenbank zuverlässig.",
  },
  {
    icon: "lock-closed-outline",
    title: "Unterlagen sicher teilen",
    text: "Grundbuchauszug, Pläne oder Reglemente gezielt an einzelne Interessierte freigeben – und jederzeit widerrufen.",
  },
  { icon: "bar-chart-outline", title: "Echte Statistiken", text: "Aufrufe, Anfragen, Merklisten und Besichtigungen pro Inserat – gezählt aus tatsächlichen Ereignissen." },
];

const ADVANTAGES = [
  { title: "Kostenlos inserieren", text: "Keine Inseratgebühren für Privatpersonen" },
  { title: "Keine Provision", text: "Sie verkaufen direkt an die Käuferschaft" },
  { title: "Ihre Adresse, Ihre Wahl", text: "Exakt, nur Strasse oder nur Ort" },
  { title: "Daten in der Schweiz", text: "Datenbank in der Region Zürich" },
];

const DOSSIER_TEMPLATES = [
  { name: "Modern", text: "Weiss und Hellgrün, viel Freiraum, klare Kacheln für die Eckdaten.", image: MARKETING_IMAGES.interior.src, dark: false },
  { name: "Premium", text: "Grossflächige Fotografie, reduzierte Typografie, dunkles Grün als Akzent.", image: MARKETING_IMAGES.chalet.src, dark: true },
  { name: "Klassisch", text: "Sachlich und besonders übersichtlich mit Tabellen für alle Angaben.", image: MARKETING_IMAGES.kitchen.src, dark: false },
];

export default function SellScreen() {
  const open = useSiteLink();
  const quotas = useQuery({ queryKey: ["content", "ai-quotas"], queryFn: getAiQuotas, staleTime: 3_600_000 });
  const faq = FAQ.filter((item) => item.category === "verkaufen" || item.category === "bewertung");
  const quotaItems = [
    quotas.data?.descriptionPerMonth != null ? `${formatNumber(quotas.data.descriptionPerMonth)} KI-Textentwürfe` : null,
    quotas.data?.valuationPerMonth != null ? `${formatNumber(quotas.data.valuationPerMonth)} Bewertungen` : null,
    quotas.data?.imageEnhancePerMonth != null ? `${formatNumber(quotas.data.imageEnhancePerMonth)} Bildoptimierungen` : null,
  ].filter((v): v is string => Boolean(v));

  return (
    <ScrollView style={{ backgroundColor: colors.white }}>
      <Stack.Screen options={{ title: "Verkaufen" }} />

      <Section tone="surface" style={{ paddingTop: 28 }}>
        <FadeUp style={{ gap: space.md }}>
          <Eyebrow>Immobilie verkaufen oder vermieten</Eyebrow>
          <Text accessibilityRole="header" style={contentStyles.pageTitle}>
            Selbst verkaufen – mit den Werkzeugen der Profis
          </Text>
          <Text style={contentStyles.lead}>
            Inserieren Sie Wohnung, Haus oder Grundstück kostenlos. Immovia führt Sie von der Erfassung über Bewertung, Bilder und Verkaufsdossier bis zur Besichtigung –
            und Sie behalten jederzeit die Kontrolle.
          </Text>
        </FadeUp>
        <View style={{ gap: space.md }}>
          <Button title="Jetzt kostenlos starten" onPress={() => open("/verkaufen/start")} />
          <Button title="Wie die Bewertung funktioniert" icon="speedometer-outline" variant="outline" onPress={() => open("/bewerten")} />
        </View>
        <Image source={photo(MARKETING_IMAGES.sell.src)} accessibilityLabel={MARKETING_IMAGES.sell.alt} style={styles.photo} contentFit="cover" transition={150} />
      </Section>

      <Section style={{ paddingVertical: space.xl }}>
        <View accessibilityLabel="Ihre Vorteile" style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: space.xl, gap: space.xl }}>
          {ADVANTAGES.map((item) => (
            <View key={item.title} style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
              <IconTile icon="shield-checkmark-outline" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16.5, fontWeight: "700", color: colors.foreground }}>{item.title}</Text>
                <Text style={contentStyles.cardText}>{item.text}</Text>
              </View>
            </View>
          ))}
        </View>
      </Section>

      <Section style={{ paddingTop: space.md }}>
        <SectionHeading eyebrow="Ablauf" title="In acht Schritten zum Verkauf" text="Sie können jederzeit zwischen den Schritten wechseln, ohne Daten zu verlieren." />
        <View style={{ gap: space.md }}>
          {STEPS.map((step, index) => (
            <FeatureCard key={step.title} icon={step.icon} title={step.title} text={step.text} badge={<Text style={styles.stepNumber}>{index + 1}</Text>} />
          ))}
        </View>
      </Section>

      <Section tone="surface">
        <SectionHeading eyebrow="Funktionen" title="Alles, was ein guter Verkauf braucht" />
        <View style={{ gap: space.md }}>
          {FEATURES.map((feature) => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              text={feature.text}
              link={feature.href ? { label: "Mehr erfahren", onPress: () => open(feature.href!) } : undefined}
            />
          ))}
        </View>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Verkaufsdossier"
          title="Ein Dossier wie vom Makler"
          text="Aus Ihren Angaben entsteht ein PDF mit Titelseite, Eckdaten, Beschreibung, Lage, Bildgalerie, Grundrissen und Kontakt."
        />
        <CheckList
          items={[
            "Drei Vorlagen zur Auswahl, Vorschau vor dem Erstellen",
            "Texte anpassen und Bilder sortieren",
            "Neue Version nach Änderungen – mit Datum gespeichert",
            "Im Inserat öffentlich freigeben oder nur gezielt senden",
          ]}
        />
        <View accessibilityLabel="Dossier-Vorlagen" style={{ gap: space.md }}>
          {DOSSIER_TEMPLATES.map((template) => (
            <View key={template.name} style={styles.template}>
              <View style={{ width: 96, aspectRatio: 3 / 4 }}>
                <Image source={photo(template.image, 400)} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                <View style={[styles.templateBand, { backgroundColor: template.dark ? "rgba(39,75,50,0.85)" : "rgba(255,255,255,0.9)" }]} />
              </View>
              <View style={{ flex: 1, padding: space.lg, justifyContent: "center", gap: 4 }}>
                <Text style={{ fontSize: 16.5, fontWeight: "700", color: colors.foreground }}>{template.name}</Text>
                <Text style={contentStyles.cardText}>{template.text}</Text>
              </View>
            </View>
          ))}
        </View>
      </Section>

      <View style={{ paddingHorizontal: space.lg }}>
        <View style={styles.costs}>
          <Eyebrow color="rgba(39,75,50,0.8)">Kosten</Eyebrow>
          <Text accessibilityRole="header" style={[contentStyles.sectionTitle, { color: colors.forest }]}>
            Für Privatpersonen kostenlos
          </Text>
          <Text style={{ fontSize: 16, lineHeight: 24, color: "rgba(39,75,50,0.8)" }}>
            Registrierung, Inserat, Dossier, Nachrichten und Besichtigungsplanung kosten nichts. Sie brauchen keine Kreditkarte.
          </Text>
          <View style={styles.quota}>
            <Text style={{ fontSize: 15.5, fontWeight: "600", color: colors.forest }}>Rechenintensive Funktionen mit monatlichem Freikontingent</Text>
            {quotaItems.length ? (
              <CheckList items={quotaItems.map((item) => `${item} pro Monat`)} />
            ) : (
              <Text style={{ fontSize: 14.5, lineHeight: 21, color: "rgba(39,75,50,0.8)" }}>
                KI-Texte, Bewertungen und Bildoptimierungen sind in einem grosszügigen Rahmen enthalten.
              </Text>
            )}
          </View>
        </View>
      </View>

      {faq.length ? (
        <Section>
          <SectionHeading eyebrow="Häufige Fragen" title="Gut zu wissen" />
          <Accordion items={faq} />
          <Button title="Alle Fragen" variant="outline" onPress={() => open("/faq")} />
        </Section>
      ) : null}

      <CtaBand
        title="Starten Sie jetzt – kostenlos"
        text="Konto erstellen, Immobilie erfassen und Schritt für Schritt zum professionellen Inserat."
        primary={{ href: "/verkaufen/start", label: "Kostenlos starten" }}
        secondary={{ href: "/ratgeber/verkaufen-ohne-makler", label: "Ratgeber: Ablauf ohne Makler" }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  photo: { aspectRatio: 4 / 3, borderRadius: 24, backgroundColor: colors.mutedBg },
  stepNumber: { fontSize: 34, fontWeight: "800", color: colors.mint200, lineHeight: 38 },
  template: { flexDirection: "row", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: "hidden" },
  templateBand: { position: "absolute", left: 0, right: 0, bottom: 0, height: "33%" },
  costs: { borderRadius: 24, backgroundColor: colors.mint100, padding: 28, gap: space.md },
  quota: { borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.85)", padding: space.xl, gap: space.md, marginTop: space.sm },
});
