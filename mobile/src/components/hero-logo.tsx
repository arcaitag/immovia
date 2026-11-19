import { Image } from "expo-image";
import * as React from "react";
import { StyleSheet, Text, View } from "react-native";

import { palette } from "@/lib/theme";

/** Logo der Startseite: Hausmarke, Schriftzug und «Immobilien Schweiz» (Gestaltungsvorlage November 2026). */
export function HeroLogo() {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Immovia, Immobilien Schweiz">
      <View style={styles.row}>
        <Image source={require("../../assets/images/logo-mark-hero.png")} style={styles.mark} contentFit="contain" />
        <Text style={styles.name}>Immovia</Text>
      </View>
      <Text style={styles.tagline}>IMMOBILIEN SCHWEIZ</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: { width: 29.6, height: 29.6, marginLeft: -1.5 },
  name: { fontSize: 27.5, lineHeight: 33, fontWeight: "700", letterSpacing: -0.8, color: palette.logoText },
  tagline: { marginTop: 3, fontSize: 8.5, lineHeight: 11, fontWeight: "500", letterSpacing: 2.6, color: palette.tagline },
});
