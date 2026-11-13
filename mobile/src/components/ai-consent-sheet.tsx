import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, Notice } from "@/components/ui";
import { grantAiConsent, type ImageConsentInfo } from "@/lib/api-studio";
import { CONFIG } from "@/lib/config";
import { ApiError } from "@/lib/jobs";
import { errorMessage } from "@/lib/labels";
import { colors, radius, space, text } from "@/lib/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
interface Point {
  icon: IconName;
  title: string;
  text: string;
}

// Wortlaut wie src/components/ai/consent-dialog.tsx der Website
const TEXT_POINTS: Point[] = [
  {
    icon: "document-text-outline",
    title: "Welche Daten",
    text: "Nur, was die Funktion braucht: Angaben zum Objekt (z. B. Objektart, Zimmer, Fläche, Ausstattung, Ort ohne Strasse und Hausnummer), Ihre Inseratstexte bzw. Ihre Eingaben im Assistenten. Kontaktdaten wie E-Mail-Adresse oder Telefonnummer senden wir nicht mit.",
  },
  { icon: "business-outline", title: "An wen", text: "An unseren KI-Anbieter Anthropic (USA), der das Sprachmodell Claude betreibt." },
  {
    icon: "ban-outline",
    title: "Kein Training",
    text: "Gemäss den kommerziellen Nutzungsbedingungen von Anthropic werden die Daten nicht zum Training von KI-Modellen verwendet.",
  },
  { icon: "trash-outline", title: "Löschung", text: "Anthropic löscht die übermittelten Daten standardmässig innert 30 Tagen." },
];

function imagePoints(info: ImageConsentInfo): Point[] {
  return [
    {
      icon: "document-text-outline",
      title: "Welche Daten",
      text: "Nur das ausgewählte Foto der Immobilie, ohne Standortdaten (GPS) und ohne Ihre Kontaktdaten.",
    },
    {
      icon: "business-outline",
      title: "An wen",
      text: `Über das AI Gateway von Vercel (USA) an den Anbieter des Bildmodells: ${info.recipient}.`,
    },
    { icon: "ban-outline", title: "Kein Training", text: "Wir verlangen bei jeder Anfrage, dass das Foto nicht zum Training von KI-Modellen verwendet wird." },
    {
      icon: "trash-outline",
      title: "Löschung",
      text: info.noRetention
        ? "Wir verlangen zudem, dass der Anbieter das Foto nach der Bearbeitung nicht speichert. Das Ergebnis speichern nur wir, als neues Bild in Ihrem Konto."
        : "Die Aufbewahrung beim Anbieter richtet sich nach dessen Bedingungen. Das Ergebnis speichern wir als neues Bild in Ihrem Konto.",
    },
  ];
}

/**
 * Einwilligung vor der ersten KI-Nutzung. Erst «Zustimmen und fortfahren» speichert die
 * Einwilligung (user_preferences) und ruft danach onConsented auf – dort die Aktion wiederholen.
 * kind = "image": eigene Einwilligung für die Bild-KI (Fotos gehen an einen anderen Anbieter).
 */
export function AiConsentSheet({
  visible,
  kind,
  imageInfo,
  onClose,
  onConsented,
}: {
  visible: boolean;
  kind: "text" | "image";
  imageInfo?: ImageConsentInfo;
  onClose: () => void;
  onConsented: () => void;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const isImage = kind === "image";
  const points = isImage ? imagePoints(imageInfo ?? { recipient: "den Bild-KI-Anbieter", noRetention: false }) : TEXT_POINTS;

  async function agree() {
    setPending(true);
    setError(null);
    try {
      await grantAiConsent(kind);
      onConsented();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : errorMessage(e));
    } finally {
      setPending(false);
    }
  }

  const close = () => {
    if (!pending) onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.icon}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.forest} />
        </View>
        <Text accessibilityRole="header" style={text.title}>
          {isImage ? "Foto an die Bild-KI senden?" : "KI-Verarbeitung erlauben?"}
        </Text>
        <Text style={[text.body, { color: colors.muted }]}>
          {isImage
            ? "Für einen Designvorschlag senden wir das Foto an einen Bild-KI-Dienst. Ohne Ihre Einwilligung geschieht das nicht – alle anderen Funktionen bleiben nutzbar."
            : "Für diese Funktion senden wir Angaben an einen KI-Dienst. Ohne Ihre Einwilligung geschieht das nicht – alle anderen Funktionen bleiben nutzbar."}
        </Text>

        {points.map((point) => (
          <View key={point.title} style={styles.point}>
            <Ionicons name={point.icon} size={18} color={colors.forest} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={text.label}>{point.title}</Text>
              <Text style={[text.small, { fontSize: 14.5, lineHeight: 21 }]}>{point.text}</Text>
            </View>
          </View>
        ))}

        <Text style={text.small}>Sie können die Einwilligung jederzeit in den Einstellungen Ihres Kontos widerrufen.</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: space.lg }}>
          <Pressable
            accessibilityRole="link"
            onPress={() => void WebBrowser.openBrowserAsync(`${CONFIG.siteUrl}/datenschutz`)}
            style={styles.link}
          >
            <Text style={styles.linkText}>Datenschutzerklärung</Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            onPress={() => void WebBrowser.openBrowserAsync(`${CONFIG.siteUrl}/dashboard/einstellungen`)}
            style={styles.link}
          >
            <Text style={styles.linkText}>Einstellungen auf der Website</Text>
          </Pressable>
        </View>

        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button title="Zustimmen und fortfahren" onPress={() => void agree()} loading={pending} />
        <Button title="Abbrechen" variant="outline" onPress={close} disabled={pending} />
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.md, backgroundColor: colors.background },
  icon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.mint100, alignItems: "center", justifyContent: "center" },
  point: {
    flexDirection: "row",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  link: { minHeight: 44, justifyContent: "center" },
  linkText: { fontSize: 15, fontWeight: "600", color: colors.primary },
});
