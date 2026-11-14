import * as Updates from "expo-updates";
import * as React from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui";
import { colors, radius, space, text } from "@/lib/theme";

/**
 * Updates der App (EAS Update). Ohne diese Datei lädt die App ein Update beim Öffnen im Hintergrund
 * und zeigt es erst beim übernächsten Start. Hier wird es beim Start sofort angewendet; kommt die
 * App später aus dem Hintergrund zurück, erscheint ein Hinweis mit «Jetzt laden».
 */

/** Sucht nach einem Update und lädt es. Gibt true zurück, wenn eine neue Version bereitliegt. */
async function downloadUpdate(): Promise<boolean> {
  if (!Updates.isEnabled) return false;
  const check = await Updates.checkForUpdateAsync();
  if (!check.isAvailable) return false;
  const fetched = await Updates.fetchUpdateAsync();
  // Nur als neu zählen, was sich von der laufenden Version unterscheidet (sonst droht eine Ladeschleife)
  return fetched.isNew && fetched.manifest?.id !== Updates.updateId;
}

/** Im Wurzel-Layout einbinden: prüft beim Start und bei jeder Rückkehr in die App. */
export function AutoUpdate() {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (!Updates.isEnabled) return;
    let active = true;
    // Beim Start: Update holen und gleich anwenden – die App ist noch nicht in Benutzung
    downloadUpdate()
      .then((isNew) => (isNew && active ? Updates.reloadAsync() : undefined))
      .catch(() => undefined);
    // Später: nur hinweisen, damit keine Eingabe verloren geht
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      downloadUpdate()
        .then((isNew) => {
          if (isNew && active) setReady(true);
        })
        .catch(() => undefined);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  if (!ready) return null;
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { justifyContent: "flex-end", paddingBottom: insets.bottom + 64, paddingHorizontal: space.lg }]}>
      <View accessibilityRole="alert" style={styles.banner}>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: colors.white }}>Neue Version bereit</Text>
        <Pressable accessibilityRole="button" onPress={() => void Updates.reloadAsync().catch(() => undefined)} style={styles.bannerButton}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: colors.forest }}>Jetzt laden</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Später" onPress={() => setReady(false)} hitSlop={8} style={{ padding: 6 }}>
          <Text style={{ fontSize: 15, color: "rgba(255,255,255,0.8)" }}>Später</Text>
        </Pressable>
      </View>
    </View>
  );
}

function formatStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())} Uhr`;
}

/** Karte im Konto: zeigt den Stand der App und sucht auf Knopfdruck nach einem Update. */
export function UpdateCard() {
  const [status, setStatus] = React.useState<"idle" | "busy" | "current" | "error">("idle");
  const [detail, setDetail] = React.useState<string | null>(null);

  async function check() {
    setStatus("busy");
    setDetail(null);
    try {
      const isNew = await downloadUpdate();
      if (isNew) {
        await Updates.reloadAsync();
        return;
      }
      setStatus("current");
    } catch (error) {
      setStatus("error");
      setDetail(error instanceof Error ? error.message : null);
    }
  }

  const stand = Updates.createdAt ? formatStamp(Updates.createdAt) : null;
  return (
    <View style={styles.card}>
      <Text style={text.heading}>App-Version</Text>
      {Updates.isEnabled ? (
        <>
          <Text style={text.small}>
            {stand ? `Stand: ${stand}` : "Stand unbekannt"}
            {Updates.isEmbeddedLaunch ? " (installierte Grundversion, noch kein Update geladen)" : ""}
          </Text>
          <Button title="Nach Update suchen" icon="refresh" variant="outline" loading={status === "busy"} onPress={() => void check()} />
          {status === "current" ? <Text style={text.small}>Die App ist auf dem neuesten Stand.</Text> : null}
          {status === "error" ? (
            <Text style={[text.small, { color: colors.destructive }]}>Die Suche nach einem Update ist fehlgeschlagen.{detail ? ` (${detail})` : ""}</Text>
          ) : null}
        </>
      ) : (
        <Text style={text.small}>Updates sind hier nicht aktiv (Entwicklungsmodus oder Expo Go). Änderungen erscheinen beim Neuladen.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.forest,
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingLeft: space.lg,
    paddingRight: space.md,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  bannerButton: { minHeight: 40, justifyContent: "center", paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.mint100 },
  card: { gap: space.md, padding: space.lg, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
});
