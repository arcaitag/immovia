import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { CONFIG } from "@/lib/config";
import { colors, space, text } from "@/lib/theme";

/** Rechtstexte: werden von der Website geöffnet, damit es nur eine gültige Fassung gibt. */
const LINKS = [
  { label: "Datenschutz", path: "/datenschutz" },
  { label: "AGB", path: "/agb" },
  { label: "Impressum", path: "/impressum" },
];

export default function LegalScreen() {
  return (
    <ScrollView style={{ backgroundColor: colors.white }} contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl }}>
      <Stack.Screen options={{ title: "Rechtliches" }} />
      {LINKS.map((link) => (
        <Pressable
          key={link.path}
          accessibilityRole="link"
          accessibilityHint="Öffnet die Website"
          onPress={() => void WebBrowser.openBrowserAsync(`${CONFIG.siteUrl}${link.path}`).catch(() => undefined)}
          style={({ pressed }) => [
            { minHeight: 64, flexDirection: "row", alignItems: "center", gap: space.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
            pressed && { backgroundColor: colors.mint100 },
          ]}
        >
          <Text style={{ flex: 1, fontSize: 18, color: colors.foreground }}>{link.label}</Text>
          <Ionicons name="open-outline" size={18} color={colors.muted} />
        </Pressable>
      ))}
      <View style={{ marginTop: space.lg }}>
        <Text style={text.small}>Die Texte öffnen sich von der Website von Immovia.</Text>
      </View>
    </ScrollView>
  );
}
