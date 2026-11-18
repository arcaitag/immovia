import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import * as React from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { UpdateCard } from "@/components/app-updates";
import { Loading } from "@/components/ui";
import { unreadMessageCount } from "@/lib/api";
import { unreadNotificationCount } from "@/lib/api-account";
import { useAuth } from "@/lib/auth";
import { colors, space } from "@/lib/theme";

/**
 * Menü der App: Konto, Angebote von Immovia und weitere Seiten an einem Ort.
 * Die Hauptseite zeigt nur Suche und Inserate.
 */

type IconName = React.ComponentProps<typeof Ionicons>["name"];

interface Row {
  label: string;
  icon: IconName;
  /** Zweite Zeile, z. B. die E-Mail-Adresse des Kontos */
  detail?: string;
  count?: number;
  href?: string;
  onPress?: () => void;
  destructive?: boolean;
}

const SERVICES: Row[] = [
  { label: "Immobilie verkaufen", icon: "pricetag-outline", href: "/verkaufen" },
  { label: "Immobilie bewerten", icon: "calculator-outline", href: "/bewerten" },
  { label: "So funktioniert Immovia", icon: "compass-outline", href: "/so-funktionierts" },
  { label: "Ratgeber", icon: "book-outline", href: "/ratgeber" },
  { label: "Für Immobilienfirmen", icon: "business-outline", href: "/fuer-makler" },
];

const OPTIONS: Row[] = [
  { label: "Häufige Fragen", icon: "help-circle-outline", href: "/faq" },
  { label: "Kontakt", icon: "mail-outline", href: "/kontakt" },
  { label: "Rechtliches", icon: "document-text-outline", href: "/rechtliches" },
];

export default function MoreScreen() {
  const router = useRouter();
  const { userId, session, loading, signOut } = useAuth();
  const notifications = useQuery({ queryKey: ["notifications-unread", userId], enabled: Boolean(userId), refetchInterval: 60_000, queryFn: unreadNotificationCount });
  // Ungelesene Nachrichten: derselbe Wert wie das Zeichen am Reiter
  const messages = useQuery({ queryKey: ["unread", userId], enabled: Boolean(userId), refetchInterval: 30_000, queryFn: unreadMessageCount }).data ?? 0;

  if (loading) return <Loading />;

  const account: Row[] = userId
    ? [
        { label: "Mein Konto", icon: "person-outline", detail: session?.user.email ?? undefined, href: "/konto" },
        { label: "Nachrichten", icon: "chatbubbles-outline", count: messages, href: "/nachrichten" },
        { label: "Benachrichtigungen", icon: "notifications-outline", count: notifications.data ?? 0, href: "/benachrichtigungen" },
        { label: "KI-Assistent", icon: "sparkles-outline", href: "/assistent" },
        { label: "Einstellungen", icon: "settings-outline", href: "/konto/einstellungen" },
      ]
    : [
        { label: "Anmelden", icon: "person-outline", detail: "Inserieren, merken, Nachrichten", href: "/login" },
        { label: "Konto erstellen", icon: "person-add-outline", href: "/registrieren" },
      ];

  const options: Row[] = userId
    ? [
        ...OPTIONS,
        {
          label: "Abmelden",
          icon: "log-out-outline",
          destructive: true,
          onPress: () =>
            Alert.alert("Abmelden?", "Sie können sich jederzeit wieder anmelden.", [
              { text: "Abbrechen", style: "cancel" },
              { text: "Abmelden", style: "destructive", onPress: () => void signOut() },
            ]),
        },
      ]
    : OPTIONS;

  const open = (row: Row) => (row.onPress ? row.onPress() : row.href ? router.push(row.href as Href) : undefined);

  return (
    <ScrollView style={{ backgroundColor: colors.white }} contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl }}>
      <Section title="Konto" rows={account} onOpen={open} />
      <Section title="Services" rows={SERVICES} onOpen={open} />
      <Section title="Weitere Optionen" rows={options} onOpen={open} />
      <View style={{ marginTop: space.xl }}>
        <UpdateCard />
      </View>
    </ScrollView>
  );
}

function Section({ title, rows, onOpen }: { title: string; rows: Row[]; onOpen: (row: Row) => void }) {
  return (
    <View>
      <Text accessibilityRole="header" style={styles.section}>
        {title}
      </Text>
      {rows.map((row) => (
        <Pressable
          key={row.label}
          accessibilityRole="button"
          accessibilityLabel={row.count ? `${row.label}, ${row.count} ungelesen` : row.label}
          onPress={() => onOpen(row)}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.mint100 }]}
        >
          <Ionicons name={row.icon} size={25} color={row.destructive ? colors.destructive : colors.foreground} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, row.destructive && { color: colors.destructive }]}>{row.label}</Text>
            {row.detail ? (
              <Text numberOfLines={1} style={styles.detail}>
                {row.detail}
              </Text>
            ) : null}
          </View>
          {row.count ? (
            <View style={styles.count}>
              <Text style={{ color: colors.white, fontSize: 12.5, fontWeight: "700" }}>{row.count > 99 ? "99+" : row.count}</Text>
            </View>
          ) : null}
          {row.destructive ? null : <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 17, fontWeight: "700", color: colors.foreground, marginTop: 28, marginBottom: 4 },
  row: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: space.lg, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { fontSize: 18, color: colors.foreground },
  detail: { fontSize: 14.5, color: colors.muted, marginTop: 2 },
  count: { minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
});
