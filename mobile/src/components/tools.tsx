import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as React from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { Button, Notice } from "@/components/ui";
import { UNAVAILABLE_TITLES, formatDate, grantTextAiConsent, type Availability } from "@/lib/api-tools";
import { useAuth } from "@/lib/auth";
import { CONFIG } from "@/lib/config";
import { ApiError, jobProgressText, type JobStatus } from "@/lib/jobs";
import { errorMessage } from "@/lib/labels";
import { colors, radius, space, text } from "@/lib/theme";

/**
 * Gemeinsame Bausteine der Bereiche Bewertung, KI-Texte und Verkaufsdossier:
 * Karte, Hinweis «nicht verfügbar», Kontingent, Fortschritt eines Auftrags, Einwilligung zur KI-Verarbeitung.
 */

/** Meldung eines Fehlers: Text des Servers (ApiError) oder Übersetzung eines Supabase-Fehlers. */
export function toolErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return errorMessage(error);
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Klarer Zustand «nicht verfügbar» mit der Erklärung des Servers (statt Platzhalter-Ergebnissen). */
export function AvailabilityNotice({ availability }: { availability: Availability }) {
  if (availability.available || !availability.reason) return null;
  return (
    <Notice tone={availability.reason === "quota_exceeded" ? "warning" : "info"}>
      <Text style={{ fontWeight: "700" }}>{UNAVAILABLE_TITLES[availability.reason]}</Text>
      {availability.message ? `\n${availability.message}` : ""}
    </Notice>
  );
}

/** Kurzer Hinweis zum verbleibenden Kontingent. */
export function QuotaHint({ quota }: { quota?: Availability["quota"] }) {
  if (!quota) return null;
  return (
    <Text style={text.small}>
      Noch {quota.remaining} von {quota.limit} {quota.unit} {quota.period === "day" ? "heute" : "in diesem Monat"} · Zurücksetzung am {formatDate(quota.resetsAt)}
    </Text>
  );
}

/** Fortschritt eines laufenden Hintergrundauftrags. */
export function JobProgressRow({ job, running, label }: { job: JobStatus | undefined; running: boolean; label: string }) {
  if (!running) return null;
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityLiveRegion="polite" style={styles.progress}>
      <ActivityIndicator color={colors.brand} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={text.label}>{label}</Text>
        <Text style={text.small}>{jobProgressText(job)}</Text>
      </View>
    </View>
  );
}

/** Aufzählung mit Gedankenstrich. */
export function BulletList({ items, color }: { items: string[]; color?: string }) {
  return (
    <View style={{ gap: 4 }}>
      {items.map((item) => (
        <Text key={item} style={[text.small, color ? { color } : null]}>
          – {item}
        </Text>
      ))}
    </View>
  );
}

/** Zeile zum Auf- und Zuklappen eines Abschnitts. */
export function Disclosure({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <View style={{ gap: space.sm }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((v) => !v)} style={styles.disclosure}>
        <Text style={[text.label, { flex: 1 }]}>{title}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </Pressable>
      {open ? children : null}
    </View>
  );
}

// --- Einwilligung zur KI-Verarbeitung (Wortlaut wie src/components/ai/consent-dialog.tsx) ---

const TEXT_POINTS: { icon: React.ComponentProps<typeof Ionicons>["name"]; title: string; text: string }[] = [
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

/**
 * Führt eine KI-Aktion aus oder fragt vorher nach der Einwilligung (KI-Texte, ai_processing_consent).
 * - guard(action): ohne Einwilligung erst den Dialog zeigen, danach action ausführen
 * - requestConsent(retry): wenn der Server «Einwilligung fehlt» meldet (z. B. widerrufen)
 * `dialog` muss im Bildschirm gerendert werden. Gespeichert wird erst nach «Zustimmen und fortfahren».
 */
export function useTextAiConsent(initiallyRequired: boolean) {
  const [required, setRequired] = React.useState(initiallyRequired);
  const [open, setOpen] = React.useState(false);
  const pending = React.useRef<(() => void) | null>(null);
  // Zusätzlich als Ref: die nach der Zustimmung wiederholte Aktion stammt aus einem älteren Render
  const requiredRef = React.useRef(initiallyRequired);

  function requestConsent(retry: () => void) {
    pending.current = retry;
    requiredRef.current = true;
    setRequired(true);
    setOpen(true);
  }

  function guard(action: () => void) {
    if (requiredRef.current) requestConsent(action);
    else action();
  }

  function close() {
    pending.current = null;
    setOpen(false);
  }

  function consented() {
    requiredRef.current = false;
    setRequired(false);
    setOpen(false);
    const retry = pending.current;
    pending.current = null;
    retry?.();
  }

  return { guard, requestConsent, required, dialog: <AiConsentModal visible={open} onClose={close} onConsented={consented} /> };
}

function AiConsentModal({ visible, onClose, onConsented }: { visible: boolean; onClose: () => void; onConsented: () => void }) {
  const { userId } = useAuth();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function agree() {
    if (!userId) return;
    setSaving(true);
    setError(null);
    try {
      await grantTextAiConsent(userId);
      onConsented();
    } catch (e) {
      setError(e instanceof Error && !("code" in e) ? e.message : errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={saving ? undefined : onClose}>
      <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg, paddingBottom: space.xxl * 1.5 }}>
        <View style={styles.consentIcon}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.forest} />
        </View>
        <View style={{ gap: space.sm }}>
          <Text accessibilityRole="header" style={text.title}>
            KI-Verarbeitung erlauben?
          </Text>
          <Text style={[text.body, { color: colors.muted }]}>
            Für diese Funktion senden wir Angaben an einen KI-Dienst. Ohne Ihre Einwilligung geschieht das nicht – alle anderen Funktionen bleiben nutzbar.
          </Text>
        </View>
        <View style={{ gap: space.sm }}>
          {TEXT_POINTS.map((point) => (
            <View key={point.title} style={styles.consentPoint}>
              <Ionicons name={point.icon} size={18} color={colors.forest} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={text.label}>{point.title}</Text>
                <Text style={text.small}>{point.text}</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={text.small}>
          Sie können die Einwilligung jederzeit in den Einstellungen Ihres Kontos auf der Website widerrufen. Details in der{" "}
          <Text
            accessibilityRole="link"
            style={{ color: colors.primary, fontWeight: "600" }}
            onPress={() => {
              void WebBrowser.openBrowserAsync(`${CONFIG.siteUrl}/datenschutz`);
            }}
          >
            Datenschutzerklärung
          </Text>
          .
        </Text>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <View style={{ gap: space.sm }}>
          <Button title="Zustimmen und fortfahren" onPress={agree} loading={saving} />
          <Button title="Abbrechen" variant="outline" onPress={onClose} disabled={saving} />
        </View>
      </ScrollView>
    </Modal>
  );
}

export const toolStyles = StyleSheet.create({
  screen: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  listItem: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.white,
    gap: 4,
  },
  listItemActive: { borderColor: colors.brand, backgroundColor: colors.mint100 },
  box: { borderRadius: radius.md, padding: space.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 4 },
});

const styles = StyleSheet.create({
  card: { gap: space.md, padding: space.lg, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  progress: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: space.md,
  },
  disclosure: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: space.sm },
  consentIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.mint100, alignItems: "center", justifyContent: "center" },
  consentPoint: { flexDirection: "row", gap: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: space.md },
});
