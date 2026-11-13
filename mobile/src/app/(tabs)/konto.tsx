import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import * as React from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { SignInPrompt } from "@/components/sign-in-prompt";
import { Button, Loading } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { CONFIG } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { colors, radius, space, text } from "@/lib/theme";

const LINKS: { label: string; path: string; icon: React.ComponentProps<typeof Ionicons>["name"]; hint?: string }[] = [
  { label: "Einstellungen und Einwilligungen", path: "/dashboard/einstellungen", icon: "settings-outline", hint: "Öffnet die Website" },
  { label: "Profil bearbeiten", path: "/dashboard/profil", icon: "person-circle-outline", hint: "Öffnet die Website" },
  { label: "Datenschutz", path: "/datenschutz", icon: "shield-checkmark-outline" },
  { label: "AGB", path: "/agb", icon: "document-text-outline" },
  { label: "Impressum", path: "/impressum", icon: "information-circle-outline" },
];

export default function AccountScreen() {
  const { userId, session, loading, signOut } = useAuth();
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

      <View style={[styles.card, { flexDirection: "column", alignItems: "stretch", padding: 0 }]}>
        {LINKS.filter((link) => userId || !link.path.startsWith("/dashboard")).map((link, index) => (
          <Pressable
            key={link.path}
            accessibilityRole="link"
            accessibilityHint={link.hint}
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
            Konto löschen und Daten herunterladen können Sie unter «Einstellungen und Einwilligungen».
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
  linkRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, minHeight: 56 },
});
