import { Image } from "expo-image";
import * as React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, space } from "@/lib/theme";

/** Logo wie auf der Website (src/components/layout/logo.tsx): Hausmarke und Schriftzug. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Immovia" style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
      <Image source={require("../../assets/images/logo-mark.png")} style={{ width: size, height: size }} contentFit="contain" />
      <Text style={{ fontSize: size * 0.75, fontWeight: "800", letterSpacing: -0.8, color: colors.forest }}>
        Immo<Text style={{ color: colors.brand }}>via</Text>
      </Text>
    </View>
  );
}

/** Kopfzeile der Hauptseite: nur das Logo. Alles Weitere steht im Reiter «Mehr». */
export function AppHeader() {
  return (
    <View style={styles.bar}>
      <Logo />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 52, paddingHorizontal: space.lg, flexDirection: "row", alignItems: "center", backgroundColor: colors.white },
});
