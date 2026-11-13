import { Stack } from "expo-router";
import * as React from "react";
import { ScrollView, View } from "react-native";

import { CtaBand, FeatureCard, PageIntro, Section, SectionHeading, StepRow, TextLink, useSiteLink, type IconName } from "@/components/content";
import { Button } from "@/components/ui";
import { colors, space } from "@/lib/theme";

/** «So funktioniert Immovia» – Inhalt wie src/app/(site)/so-funktionierts/page.tsx der Website. */

type Step = { icon: IconName; title: string; text: string };

const SELLER_STEPS: Step[] = [
  { icon: "home-outline", title: "Immobilie erfassen", text: "Der Assistent führt durch alle Angaben und speichert automatisch." },
  { icon: "speedometer-outline", title: "Bewerten", text: "Preisspanne mit offengelegter Datenbasis – oder ein ehrlicher Hinweis, wenn die Daten fehlen." },
  { icon: "document-text-outline", title: "Präsentieren", text: "Bilder optimieren, Texte erstellen, Verkaufsdossier erzeugen." },
  { icon: "rocket-outline", title: "Veröffentlichen", text: "Preis, Kontakt und Adressgenauigkeit festlegen und online stellen." },
  { icon: "chatbubble-outline", title: "Interessenten betreuen", text: "Nachrichten beantworten, Besichtigungen planen, Unterlagen freigeben." },
];

const BUYER_STEPS: Step[] = [
  { icon: "search-outline", title: "Suchen", text: "Nach Ort, Umkreis, Preis, Zimmern, Fläche und Ausstattung filtern – als Liste oder auf der Karte." },
  { icon: "heart-outline", title: "Merken", text: "Interessante Inserate auf die Merkliste setzen und später vergleichen." },
  { icon: "notifications-outline", title: "Suchauftrag", text: "Suche speichern und bei neuen passenden Inseraten benachrichtigt werden – pro Inserat einmal." },
  { icon: "chatbubble-outline", title: "Anfragen", text: "Direkt über die Plattform schreiben; Ihre E-Mail-Adresse bleibt verborgen." },
  { icon: "calendar-outline", title: "Besichtigen", text: "Freie Zeitfenster buchen oder per Nachricht einen Termin vorschlagen." },
];

const PRINCIPLES: Step[] = [
  { icon: "eye-off-outline", title: "Adresse nach Wahl", text: "Inserierende bestimmen, ob die exakte Adresse, nur die Strasse oder nur der Ort sichtbar ist." },
  { icon: "lock-closed-outline", title: "Geschützte Unterlagen", text: "Dokumente sind privat und werden nur gezielt und widerrufbar freigegeben." },
  { icon: "ribbon-outline", title: "Ehrliche Kennzeichnungen", text: "Verifizierungen erscheinen nur nach echter Prüfung. «E-Mail bestätigt» ist kein Eigentumsnachweis." },
  { icon: "flag-outline", title: "Melden und Moderation", text: "Verdächtige Inserate können gemeldet werden; das Immovia-Team prüft jede Meldung." },
  { icon: "server-outline", title: "Daten in der Schweiz", text: "Die Datenbank liegt in der Region Zürich. Details in der Datenschutzerklärung." },
];

function StepList({ steps }: { steps: Step[] }) {
  return (
    <View style={{ gap: space.md }}>
      {steps.map((step, index) => (
        <StepRow key={step.title} icon={step.icon} index={index + 1} title={step.title} text={step.text} />
      ))}
    </View>
  );
}

export default function HowItWorksScreen() {
  const open = useSiteLink();
  return (
    <ScrollView style={{ backgroundColor: colors.white }}>
      <Stack.Screen options={{ title: "So funktioniert Immovia" }} />
      <PageIntro
        eyebrow="So funktioniert Immovia"
        title="Eine Plattform für den ganzen Weg"
        lead="Ob Sie verkaufen, vermieten oder ein neues Zuhause suchen: Alles läuft an einem Ort zusammen – verständlich, sicher und ohne versteckte Kosten."
      >
        <Button title="Kostenlos starten" onPress={() => open("/verkaufen/start")} />
        <Button title="Immobilien suchen" icon="search" variant="outline" onPress={() => open("/immobilien")} />
      </PageIntro>

      <Section>
        <SectionHeading eyebrow="Für Verkäufer und Vermieter" title="Selbst verkaufen und vermieten" />
        <StepList steps={SELLER_STEPS} />
        <TextLink label="Alle Funktionen für Inserierende" onPress={() => open("/verkaufen")} />
      </Section>

      <Section style={{ paddingTop: 0 }}>
        <SectionHeading eyebrow="Für Suchende" title="Finden, merken, besichtigen" />
        <StepList steps={BUYER_STEPS} />
        <TextLink label="Zur Immobiliensuche" onPress={() => open("/immobilien")} />
      </Section>

      <Section tone="surface">
        <SectionHeading eyebrow="Vertrauen" title="Unsere Grundsätze" />
        <View style={{ gap: space.md }}>
          {PRINCIPLES.map((item) => (
            <FeatureCard key={item.title} icon={item.icon} title={item.title} text={item.text} />
          ))}
        </View>
      </Section>

      <CtaBand
        title="Noch Fragen?"
        text="In den häufigen Fragen und im Ratgeber finden Sie ausführliche Antworten."
        primary={{ href: "/faq", label: "Häufige Fragen" }}
        secondary={{ href: "/ratgeber", label: "Ratgeber" }}
      />
    </ScrollView>
  );
}
