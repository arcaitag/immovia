import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Chip } from "@/components/ui";
import { colors, radius, space, text } from "@/lib/theme";

/** Gemeinsame Bausteine der Editor- und Verwaltungsseiten. */

export const editorStyles = StyleSheet.create({
  card: { gap: space.md, padding: space.lg, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  two: { flexDirection: "row", gap: space.md },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={editorStyles.card}>{children}</View>;
}

/** Zwei Felder nebeneinander; ein einzelnes Kind nimmt die halbe Breite ein. */
export function Row({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children);
  return (
    <View style={editorStyles.two}>
      {items.map((child, index) => (
        <View key={index} style={{ flex: 1 }}>
          {child}
        </View>
      ))}
      {items.length === 1 ? <View style={{ flex: 1 }} /> : null}
    </View>
  );
}

/** Einfachauswahl mit Chips; ein zweiter Tipp auf die Auswahl hebt sie auf, wenn `clearable`. */
export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
  clearable = false,
}: {
  label?: string;
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T | null) => void;
  clearable?: boolean;
}) {
  return (
    <View style={{ gap: space.sm }}>
      {label ? <Text style={text.label}>{label}</Text> : null}
      <View style={editorStyles.wrap} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={value === option.value}
            onPress={() => onChange(value === option.value && clearable ? null : option.value)}
          />
        ))}
      </View>
    </View>
  );
}

/** Zeile, die zu einer anderen Seite führt. */
export function NavRow({
  icon,
  title,
  subtitle,
  badge,
  external = false,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle?: string;
  badge?: string | null;
  external?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={[title, badge, subtitle].filter(Boolean).join(", ")}
      onPress={onPress}
      style={({ pressed }) => [styles.navRow, pressed && { backgroundColor: colors.mint100 }]}
    >
      <View style={styles.navIcon}>
        <Ionicons name={icon} size={20} color={colors.forest} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[text.body, { fontWeight: "600" }]}>{title}</Text>
        {subtitle ? <Text style={text.small}>{subtitle}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.navBadge}>
          <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.forest }}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name={external ? "open-outline" : "chevron-forward"} size={18} color={colors.muted} />
    </Pressable>
  );
}

/** Zähler mit Plus und Minus (z. B. Plätze pro Zeitfenster). */
export function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  const button = (delta: number, icon: "remove" | "add", a11y: string) => {
    const next = value + delta;
    const disabled = next < min || next > max;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${a11y}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => onChange(next)}
        style={({ pressed }) => [styles.stepButton, pressed && { backgroundColor: colors.mint100 }, disabled && { opacity: 0.4 }]}
      >
        <Ionicons name={icon} size={20} color={colors.forest} />
      </Pressable>
    );
  };
  return (
    <View style={{ gap: 6 }}>
      <Text style={text.label}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        {button(-1, "remove", "weniger")}
        <Text accessibilityLabel={`${label}: ${value}`} style={[text.body, { minWidth: 28, textAlign: "center", fontWeight: "700" }]}>
          {value}
        </Text>
        {button(1, "add", "mehr")}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 56, paddingVertical: space.sm, paddingHorizontal: space.sm, borderRadius: radius.md },
  navIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.mint100, alignItems: "center", justifyContent: "center" },
  navBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.full, backgroundColor: colors.mint200 },
  stepButton: { width: 46, height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.input, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
});
