import { useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { Card, NavRow } from "@/components/editor/shared";
import { SectionTitle } from "@/components/ui";

/** Verknüpfungen zu Verwaltung (Statistik, Interessenten, Besichtigungen, Dokumente) und zu den KI-Werkzeugen. */
export function ToolsSection({ propertyId, badges }: { propertyId: string; badges?: { newLeads: number; openRequests: number } | null }) {
  const router = useRouter();
  const params = { propertyId };
  const count = (n: number | undefined, one: string, many: string) => (n ? (n === 1 ? `1 ${one}` : `${n} ${many}`) : null);
  return (
    <Card>
      <SectionTitle>Werkzeuge</SectionTitle>
      <View>
        <NavRow
          icon="bar-chart-outline"
          title="Statistik"
          subtitle="Aufrufe, Merkliste und Anfragen"
          onPress={() => router.push({ pathname: "/verwaltung/[propertyId]/statistik", params })}
        />
        <NavRow
          icon="people-outline"
          title="Interessenten"
          subtitle="Anfragen bewerten und Status führen"
          badge={count(badges?.newLeads, "neu", "neu")}
          onPress={() => router.push({ pathname: "/verwaltung/[propertyId]/interessenten", params })}
        />
        <NavRow
          icon="calendar-outline"
          title="Besichtigungen"
          subtitle="Zeitfenster und Termine"
          badge={count(badges?.openRequests, "Anfrage", "Anfragen")}
          onPress={() => router.push({ pathname: "/verwaltung/[propertyId]/besichtigungen", params })}
        />
        <NavRow
          icon="document-text-outline"
          title="Dokumente"
          subtitle="Sichtbarkeit und Freigabe im Inserat"
          onPress={() => router.push({ pathname: "/verwaltung/[propertyId]/dokumente", params })}
        />
        <NavRow
          icon="calculator-outline"
          title="Bewertung"
          subtitle="Marktwert schätzen lassen"
          onPress={() => router.push({ pathname: "/bewertung/[propertyId]", params } as never)}
        />
        <NavRow
          icon="sparkles-outline"
          title="KI-Texte"
          subtitle="Titel und Beschreibung vorschlagen lassen"
          onPress={() => router.push({ pathname: "/texte/[propertyId]", params } as never)}
        />
        <NavRow
          icon="book-outline"
          title="Verkaufsdossier"
          subtitle="PDF-Dossier erstellen"
          onPress={() => router.push({ pathname: "/dossier/[propertyId]", params } as never)}
        />
        <NavRow
          icon="color-wand-outline"
          title="Bilderstudio"
          subtitle="Fotos verbessern und einrichten"
          onPress={() => router.push({ pathname: "/bilderstudio/[propertyId]", params } as never)}
        />
      </View>
    </Card>
  );
}
