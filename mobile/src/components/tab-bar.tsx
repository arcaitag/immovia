import type { BottomTabBarProps } from "expo-router/js-tabs";
import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, palette } from "@/lib/theme";

/**
 * Reiterleiste wie in der Gestaltungsvorlage: dünne Symbole, Beschriftung darunter,
 * der aktive Reiter liegt auf einer hellgrünen, abgerundeten Fläche.
 */
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  return (
    <View role="tablist" testID="tab-bar" style={[styles.bar, { paddingBottom: Math.max(insets.bottom - 8, 6) }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key]!;
        const focused = index === state.index;
        const color = focused ? palette.tabActive : palette.tabInactive;
        const label = options.title ?? route.name;
        const badge = options.tabBarBadge;
        const onPress = () => {
          const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };
        return (
          <Pressable
            key={route.key}
            role="tab"
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={badge ? `${label}, ${badge} neu` : label}
            onPress={onPress}
            onLongPress={() => emitter.emit({ type: "tabLongPress", target: route.key })}
            style={styles.item}
          >
            <View style={[styles.pill, focused && styles.pillActive]}>
              {options.tabBarIcon?.({ focused, color, size: 21 })}
              <Text numberOfLines={1} style={[styles.label, { color }]}>
                {label}
              </Text>
              {badge !== undefined ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{typeof badge === "number" && badge > 99 ? "99+" : String(badge)}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Masse aus der Vorlage: Fläche 54 × 42 pt, 4.5 pt unter der Trennlinie
  bar: { flexDirection: "row", paddingTop: 4.5, paddingHorizontal: 4, backgroundColor: colors.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#e2e2e0" },
  item: { flex: 1, alignItems: "center" },
  pill: { minWidth: 54, height: 42.5, paddingTop: 2.7, paddingHorizontal: 6, borderRadius: 12, alignItems: "center", gap: 0.5 },
  pillActive: { backgroundColor: palette.tabActiveBg },
  label: { fontSize: 10.5, lineHeight: 12.5, fontWeight: "500" },
  badge: {
    position: "absolute",
    top: 2,
    right: 6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 10, fontWeight: "700", color: colors.white },
});
