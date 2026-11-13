import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as React from "react";
import { ScrollView, Text, View } from "react-native";

import { CheckList, CtaBand, FeatureCard, IconTile, Note, PageIntro, Section, SectionHeading, TextLink, contentStyles, useSiteLink, type IconName } from "@/components/content";
import { Badge, Button, Notice } from "@/components/ui";
import { getValuationSettings } from "@/lib/api-content";
import { formatNumber } from "@/lib/format";
import { colors, space, text } from "@/lib/theme";

/** «Immobilie bewerten» – Inhalt wie src/app/(site)/bewerten/page.tsx der Website. */

const PRICE_KINDS: { icon: IconName; title: string; text: string; used: boolean }[] = [
  { icon: "pricetags-outline", title: "Angebotspreise", text: "Preise in Inseraten. Sie zeigen die Erwartung der Verkaufsseite, nicht den tatsächlichen Abschluss.", used: true },
  { icon: "scale-outline", title: "Transaktionspreise", text: "Tatsächlich bezahlte Preise aus Kaufverträgen. Diese Daten sind meist nur lizenziert erhältlich.", used: false },
  {
    icon: "trending-up-outline",
    title: "Statistische Indikatoren",
    text: "Preisindizes und regionale Durchschnittswerte. Gut für Entwicklungen, ungeeignet für ein einzelnes Objekt.",
    used: false,
  },
  { icon: "calculator-outline", title: "Modellschätzungen", text: "Berechnungen aus Objektmerkmalen und Vergleichsdaten. Nur so gut wie die Daten, auf denen sie beruhen.", used: false },
];

const METHOD: { icon: IconName; title: string; text: string }[] = [
  { icon: "document-outline", title: "Ihre Angaben", text: "Grundlage sind die Daten, die Sie erfassen: Lage, Typ, Fläche, Zimmer, Baujahr, Zustand und Ausstattung." },
  { icon: "layers-outline", title: "Vergleichsobjekte", text: "Wir suchen ähnliche, echte und veröffentlichte Inserate auf Immovia. Demo-Inserate sind ausgeschlossen." },
  {
    icon: "calculator-outline",
    title: "Spanne und Sicherheit",
    text: "Aus den Vergleichsobjekten berechnet ein nachvollziehbares Verfahren eine Preisspanne und einen möglichen Inseratepreis. Die KI erklärt nur die Faktoren – sie erfindet keine Zahlen.",
  },
  { icon: "ban-outline", title: "Keine Zahl ohne Daten", text: "Gibt es zu wenige passende Vergleichsobjekte, sagt die Bewertung das offen und nennt keinen Wert." },
];

export default function ValuationInfoScreen() {
  const open = useSiteLink();
  const settings = useQuery({ queryKey: ["content", "valuation-settings"], queryFn: getValuationSettings, staleTime: 3_600_000 });
  const s = settings.data;
  const parameters = [
    s?.minComparables != null ? `mindestens ${formatNumber(s.minComparables)} Vergleichsobjekte für eine Zahl` : null,
    s?.radiusKm != null ? `im Umkreis von ${formatNumber(s.radiusKm)} km` : null,
    s?.maxAgeDays != null ? `Vergleichsdaten nicht älter als ${formatNumber(s.maxAgeDays)} Tage` : null,
    s?.areaTolerance != null ? `Fläche höchstens ${formatNumber(s.areaTolerance * 100)} % abweichend` : null,
  ].filter((v): v is string => Boolean(v));

  return (
    <ScrollView style={{ backgroundColor: colors.white }}>
      <Stack.Screen options={{ title: "Bewerten" }} />
      <PageIntro
        eyebrow="Immobilie bewerten"
        title="Was ist meine Immobilie wert? Ehrlich eingeschätzt."
        lead="Die Bewertung von Immovia zeigt immer, worauf sie beruht: welche Daten, wie viele Vergleichsobjekte und wie sicher das Ergebnis ist. Reichen die Daten nicht aus, zeigen wir keine Zahl."
      >
        <Button title="Bewertung starten" icon="speedometer-outline" onPress={() => open("/verkaufen/start")} />
        <Button title="Ratgeber: Preis festlegen" variant="outline" onPress={() => open("/ratgeber/angebotspreis-festlegen")} />
        <Text style={text.small}>Für die Bewertung erfassen Sie Ihre Immobilie in einem kostenlosen Konto.</Text>
      </PageIntro>

      {s?.enabled === false ? (
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.xl }}>
          <Notice tone="warning">
            Die Bewertung ist derzeit deaktiviert. Die Bewertungsfunktion wurde von der Administration vorübergehend ausgeschaltet. Sie können Ihre Immobilie trotzdem
            erfassen und inserieren.
          </Notice>
        </View>
      ) : null}

      <Section>
        <SectionHeading
          eyebrow="Begriffe"
          title="Nicht jeder Preis ist ein Marktwert"
          text="Wir unterscheiden konsequent zwischen vier Arten von Preisangaben – und sagen Ihnen, welche wir verwenden."
        />
        <View style={{ gap: space.md }}>
          {PRICE_KINDS.map((kind) => (
            <FeatureCard
              key={kind.title}
              icon={kind.icon}
              title={kind.title}
              text={kind.text}
              badge={<Badge tone={kind.used ? "green" : "neutral"} label={kind.used ? "Verwendet" : "Noch nicht angebunden"} />}
            />
          ))}
        </View>
      </Section>

      <Section tone="surface">
        <SectionHeading eyebrow="Methode" title="So entsteht die Einschätzung" />
        <View style={{ gap: space.xl }}>
          {METHOD.map((step) => (
            <View key={step.title} style={{ flexDirection: "row", gap: space.lg }}>
              <IconTile icon={step.icon} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[contentStyles.cardTitle, { marginTop: 0 }]}>{step.title}</Text>
                <Text style={[contentStyles.cardText, { fontSize: 15.5, lineHeight: 23 }]}>{step.text}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={[contentStyles.card, { padding: space.xl, gap: space.md }]}>
          <Text style={[contentStyles.cardTitle, { marginTop: 0 }]}>Aktuelle Einstellungen der Vergleichsbewertung</Text>
          {parameters.length ? <CheckList items={parameters} /> : <Text style={contentStyles.cardText}>Die Parameter werden in der Administration festgelegt.</Text>}
          <Text style={{ fontSize: 12.5, lineHeight: 17, color: colors.muted }}>Diese Werte werden von der Administration verwaltet und können angepasst werden.</Text>
        </View>
        <View style={[contentStyles.card, { padding: space.xl, gap: space.md }]}>
          <Text style={[contentStyles.cardTitle, { marginTop: 0 }]}>Was die Bewertung enthält</Text>
          <CheckList
            items={[
              "Preisspanne und möglicher Inseratepreis, sofern die Daten reichen",
              "Datum, Datenquellen sowie Qualität und Aktualität der Daten",
              "Faktoren, die den Wert erhöhen oder senken",
              "Vergleichsobjekte mit Angebotspreis",
              "Nachvollziehbare Angabe zur Sicherheit des Ergebnisses",
              "Frühere Bewertungen bleiben gespeichert und lassen sich vergleichen",
            ]}
          />
        </View>
      </Section>

      <Section>
        <Note tone="warning" title="Eine Bewertung ersetzt kein Gutachten">
          Angebotspreise sind keine bezahlten Preise. Die Einschätzung ist eine Orientierung für Ihren Angebotspreis. Für Erbteilungen, Scheidungen oder Finanzierungen braucht es in der Regel die Schätzung einer Fachperson bzw. der Bank. Eine Schnittstelle für lizenzierte Schweizer Transaktionsdaten ist vorbereitet, aber noch nicht angebunden.
        </Note>
        <TextLink label="Fragen zur Bewertung" onPress={() => open("/faq#bewertung")} />
      </Section>

      <CtaBand
        title="Ihre Immobilie einschätzen lassen"
        text="Erfassen Sie Ihre Immobilie kostenlos. Die Bewertung starten Sie im zweiten Schritt des Verkaufsassistenten."
        primary={{ href: "/verkaufen/start", label: "Kostenlos starten" }}
        secondary={{ href: "/verkaufen", label: "Alle Funktionen" }}
      />
    </ScrollView>
  );
}
