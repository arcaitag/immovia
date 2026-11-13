import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as React from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { SignInPrompt } from "@/components/sign-in-prompt";
import { Button, Loading } from "@/components/ui";
import { unreadNotificationCount } from "@/lib/api-account";
import { useAuth } from "@/lib/auth";
import { CONFIG } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { colors, radius, space, text } from "@/lib/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** Bereiche in der App (nur angemeldet). */
const SCREENS: { label: string; href: Href; icon: IconName }[] = [
  { label: "Benachrichtigungen", href: "/benachrichtigungen", icon: "notifications-outline" },
  { label: "Suchaufträge", href: "/suchauftraege", icon: "bookmark-outline" },
  // Der Bildschirm «/assistent» gehört zu einem anderen Bereich der App
  { label: "KI-Assistent", href: "/assistent" as never, icon: "sparkles-outline" },
  { label: "Profil", href: "/konto/profil", icon: "person-circle-outline" },
  { label: "Passwort ändern", href: "/konto/passwort", icon: "key-outline" },
  { label: "Einstellungen und Einwilligungen", href: "/konto/einstellungen", icon: "settings-outline" },
];

/** Rechtliche Seiten der Website. */
const LINKS: { label: string; path: string; icon: IconName }[] = [
  { label: "Datenschutz", path: "/datenschutz", icon: "shield-checkmark-outline" },
  { label: "AGB", path: "/agb", icon: "document-text-outline" },
  { label: "Impressum", path: "/impressum", icon: "information-circle-outline" },
];

export default function AccountScreen() {
  const { userId, session, loading, signOut } = useAuth();
  const router = useRouter();
  const unread = useQuery({ queryKey: ["notifications-unread", userId], enabled: Boolean(userId), refetchInterval: 60_000, queryFn: unreadNotificationCount });
  const profile = useQuery({
    queryKey: ["profile", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("first_name, last_name, display_name").eq("id", userId!).maybeSingle();
      return data;
    },
  });

  if (loading) return <Loading />;

  const open = (path: string) => WebBrowser.openBrowserAsync(`${CONFIG.siteUrl}${path}`).catch(() => undefined);
  const name = [profile.data?.first_name, profile.data?.last_name].filter(Boolean).join(" ") || profile.data?.display_name || "";

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
      {userId ? (
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: colors.forest }}>{(name || session?.user.email || "?").slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            {name ? <Text style={text.heading}>{name}</Text> : null}
            <Text style={text.small}>{session?.user.email}</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.card, { flexDirection: "column", alignItems: "stretch" }]}>
          <SignInPrompt icon="person-outline" title="Ihr Immovia-Konto" description="Melden Sie sich an, um zu inserieren, Inserate zu merken und Nachrichten zu schreiben." />
        </View>
      )}

      {userId ? (
        <View style={[styles.card, { flexDirection: "column", alignItems: "stretch", padding: 0 }]}>
          {SCREENS.map((screen, index) => {
            const count = screen.href === "/benachrichtigungen" ? (unread.data ?? 0) : 0;
            return (
              <Pressable
                key={screen.label}
                accessibilityRole="button"
                accessibilityLabel={count ? `${screen.label}, ${count} ungelesen` : screen.label}
                onPress={() => router.push(screen.href)}
                style={({ pressed }) => [styles.linkRow, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }, pressed && { backgroundColor: colors.mint100 }]}
              >
                <Ionicons name={screen.icon} size={22} color={colors.forest} />
                <Text style={[text.body, { flex: 1 }]}>{screen.label}</Text>
                {count ? (
                  <View style={styles.count}>
                    <Text style={{ color: colors.white, fontSize: 12.5, fontWeight: "700" }}>{count > 99 ? "99+" : count}</Text>
                  </View>
                ) : null}
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={[styles.card, { flexDirection: "column", alignItems: "stretch", padding: 0 }]}>
        {LINKS.map((link, index) => (
          <Pressable
            key={link.path}
            accessibilityRole="link"
            accessibilityHint="Öffnet die Website"
            onPress={() => open(link.path)}
            style={({ pressed }) => [styles.linkRow, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }, pressed && { backgroundColor: colors.mint100 }]}
          >
            <Ionicons name={link.icon} size={22} color={colors.forest} />
            <Text style={[text.body, { flex: 1 }]}>{link.label}</Text>
            <Ionicons name="open-outline" size={18} color={colors.muted} />
          </Pressable>
        ))}
      </View>

      {userId ? (
        <>
          <Button
            title="Abmelden"
            variant="outline"
            icon="log-out-outline"
            onPress={() =>
              Alert.alert("Abmelden?", "Sie können sich jederzeit wieder anmelden.", [
                { text: "Abbrechen", style: "cancel" },
                { text: "Abmelden", style: "destructive", onPress: () => void signOut() },
              ])
            }
          />
          <Text style={[text.small, { textAlign: "center" }]}>
            Konto löschen und Daten herunterladen können Sie auf der Website; den Link finden Sie unter «Einstellungen und Einwilligungen».
          </Text>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.mint100, alignItems: "center", justifyContent: "center" },
  count: { minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  linkRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, minHeight: 56 },
});
