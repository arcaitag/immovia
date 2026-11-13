import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter, type Href } from "expo-router";
import * as React from "react";
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui";
import { EMPTY_FILTERS } from "@/lib/api";
import { encodeFiltersParam } from "@/lib/api-account";
import { useAuth } from "@/lib/auth";
import { colors, radius, space } from "@/lib/theme";

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

/** Hauptnavigation der Website (MAIN_NAV und Ratgeber im mobilen Menü). */
const NAV: { label: string; target: "search" | "sale" | "rent" | Href }[] = [
  { label: "Immobilien suchen", target: "search" },
  { label: "Kaufen", target: "sale" },
  { label: "Mieten", target: "rent" },
  { label: "Immobilie verkaufen", target: "/verkaufen" as Href },
  { label: "Immobilie bewerten", target: "/bewerten" as Href },
  { label: "Ratgeber", target: "/ratgeber" as Href },
];

/** Suche mit vorgewähltem Angebot (Kaufen oder Mieten); «t» sorgt dafür, dass die Auswahl erneut angewendet wird. */
function offerSearchHref(offer: "sale" | "rent"): Href {
  return { pathname: "/suchen", params: { suche: encodeFiltersParam({ ...EMPTY_FILTERS, offer }), t: String(Date.now()) } } as Href;
}

/**
 * Kopfzeile mit Logo, Konto und Menü – entspricht der Kopfzeile der Website auf dem Handy.
 * `scrolled` zeigt wie auf der Website einen Schatten, sobald die Seite nicht mehr ganz oben steht.
 */
export function AppHeader({ scrolled = false }: { scrolled?: boolean }) {
  const router = useRouter();
  const { userId, session } = useAuth();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const initial = (session?.user.email ?? "?").slice(0, 1).toUpperCase();

  return (
    <View style={[styles.bar, scrolled && styles.barScrolled]}>
      <Pressable accessibilityRole="link" accessibilityLabel="Immovia – zur Startseite" onPress={() => router.navigate("/")} hitSlop={6}>
        <Logo />
      </Pressable>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {userId ? (
          <>
            <Pressable accessibilityRole="button" accessibilityLabel="Merkliste" onPress={() => router.push("/merkliste" as Href)} style={styles.iconButton}>
              <Ionicons name="heart-outline" size={24} color={colors.forest} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Konto" onPress={() => router.navigate("/konto" as Href)} style={styles.iconButton}>
              <View style={styles.avatar}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: colors.forest }}>{initial}</Text>
              </View>
            </Pressable>
          </>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Anmelden" onPress={() => router.push("/login")} style={styles.iconButton}>
            <Ionicons name="person-outline" size={23} color={colors.forest} />
          </Pressable>
        )}
        <Pressable accessibilityRole="button" accessibilityLabel="Menü öffnen" onPress={() => setMenuOpen(true)} style={[styles.iconButton, { marginRight: -8 }]}>
          <Ionicons name="menu" size={28} color={colors.forest} />
        </Pressable>
      </View>
      <Modal visible={menuOpen} transparent animationType="none" onRequestClose={() => setMenuOpen(false)} statusBarTranslucent>
        {menuOpen ? <MenuPanel onClose={() => setMenuOpen(false)} /> : null}
      </Modal>
    </View>
  );
}

function MenuPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { userId } = useAuth();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(width * 0.86, 360);
  // Das Menü fährt wie auf der Website von rechts herein
  const [slide] = React.useState(() => new Animated.Value(0));
  React.useEffect(() => {
    const animation = Animated.timing(slide, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web" });
    animation.start();
    return () => animation.stop();
  }, [slide]);

  function go(target: (typeof NAV)[number]["target"]) {
    onClose();
    if (target === "search") return router.navigate("/suchen" as Href);
    if (target === "sale" || target === "rent") {
      return router.navigate(offerSearchHref(target));
    }
    router.push(target);
  }

  function leave(href: string, how: "push" | "navigate" = "push") {
    onClose();
    if (how === "navigate") router.navigate(href as Href);
    else router.push(href as Href);
  }

  return (
    <View style={{ flex: 1, flexDirection: "row", justifyContent: "flex-end" }}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(25,40,32,0.45)", opacity: slide }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Menü schliessen" onPress={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[styles.panel, { width: panelWidth, transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [panelWidth, 0] }) }] }]}
      >
        <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
          <View style={styles.panelHead}>
            <Text accessibilityRole="header" style={{ fontSize: 19, fontWeight: "700", color: colors.foreground }}>
              Menü
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Menü schliessen" onPress={onClose} style={[styles.iconButton, { marginRight: -8 }]}>
              <Ionicons name="close" size={26} color={colors.forest} />
            </Pressable>
          </View>
          <View accessibilityRole="menu" style={{ padding: space.md }}>
            {NAV.map((item) => (
              <Pressable key={item.label} accessibilityRole="menuitem" onPress={() => go(item.target)} style={({ pressed }) => [styles.navItem, pressed && { backgroundColor: colors.mint100 }]}>
                <Text style={{ fontSize: 16.5, fontWeight: "600", color: colors.foreground }}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.panelFoot}>
            {userId ? (
              <Button title="Zum Dashboard" icon="grid-outline" variant="outline" onPress={() => leave("/inserieren", "navigate")} />
            ) : (
              <Button title="Anmelden" icon="person-outline" variant="outline" onPress={() => leave("/login")} />
            )}
            <Button title="Kostenlos inserieren" icon="add" onPress={() => leave(userId ? "/objekt/neu" : "/registrieren")} />
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 56,
    paddingHorizontal: space.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
    zIndex: 2,
  },
  barScrolled: { borderBottomColor: colors.border, shadowColor: "#192820", shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.mint200, alignItems: "center", justifyContent: "center" },
  panel: { backgroundColor: colors.white, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: -6, height: 0 }, elevation: 12 },
  panelHead: { height: 60, paddingHorizontal: space.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.border },
  navItem: { minHeight: 52, justifyContent: "center", paddingHorizontal: space.lg, borderRadius: radius.md },
  panelFoot: { marginTop: "auto", padding: space.lg, gap: space.sm, borderTopWidth: 1, borderTopColor: colors.border },
});
