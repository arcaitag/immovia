import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";

import { colors, radius, space, text } from "@/lib/theme";

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "ghost" | "destructive";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || loading;
  const fg = variant === "primary" ? colors.white : variant === "destructive" ? colors.destructive : colors.forest;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && { backgroundColor: pressed ? colors.primaryPressed : colors.primary },
        variant === "outline" && { borderWidth: 1, borderColor: colors.input, backgroundColor: pressed ? colors.mint100 : colors.white },
        variant === "ghost" && { backgroundColor: pressed ? colors.mint100 : "transparent" },
        variant === "destructive" && { borderWidth: 1, borderColor: colors.destructive, backgroundColor: pressed ? colors.destructiveBg : colors.white },
        inactive && { opacity: 0.55 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={19} color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  error,
  ...input
}: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={text.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#98a29b"
        {...input}
        onFocus={(e) => {
          setFocused(true);
          input.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          input.onBlur?.(e);
        }}
        style={[
          styles.input,
          input.multiline && { minHeight: 120, paddingTop: 12, textAlignVertical: "top" },
          focused && { borderColor: colors.brand },
          error ? { borderColor: colors.destructive } : null,
          input.style,
        ]}
      />
      {error ? <Text style={[text.small, { color: colors.destructive }]}>{error}</Text> : hint ? <Text style={text.small}>{hint}</Text> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.mint100, borderColor: colors.brand }]}
    >
      <Text style={[styles.chipText, selected && { color: colors.forest }]}>{label}</Text>
    </Pressable>
  );
}

export function ToggleRow({ label, hint, value, onValueChange }: { label: string; hint?: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={text.body}>{label}</Text>
        {hint ? <Text style={text.small}>{hint}</Text> : null}
      </View>
      <Switch accessibilityLabel={label} value={value} onValueChange={onValueChange} trackColor={{ true: colors.brand, false: colors.input }} />
    </View>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "warning" | "success"; children: React.ReactNode }) {
  const palette = {
    info: [colors.infoBg, colors.info],
    error: [colors.destructiveBg, colors.destructive],
    warning: [colors.warningBg, colors.warning],
    success: [colors.mint100, colors.forest],
  }[tone];
  return (
    <View accessibilityRole={tone === "error" ? "alert" : undefined} style={[styles.notice, { backgroundColor: palette[0] }]}>
      <Text style={[text.body, { fontSize: 15, color: palette[1] }]}>{children}</Text>
    </View>
  );
}

export function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "green" | "amber" | "blue" | "dark" }) {
  const palette = {
    neutral: [colors.mutedBg, colors.foreground],
    green: [colors.mint100, colors.forest],
    amber: [colors.warningBg, colors.warning],
    blue: [colors.infoBg, colors.info],
    dark: ["rgba(25,40,32,0.82)", colors.white],
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette[0] }]}>
      <Text style={{ fontSize: 12.5, fontWeight: "600", color: palette[1] }}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={26} color={colors.forest} />
      </View>
      <Text style={[text.heading, { textAlign: "center" }]}>{title}</Text>
      <Text style={[text.body, { color: colors.muted, textAlign: "center" }]}>{description}</Text>
      {action}
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl }}>
      <ActivityIndicator color={colors.brand} size="large" />
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={[text.heading, { marginTop: space.sm }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  buttonText: { fontSize: 16, fontWeight: "700" },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.input,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.foreground,
    backgroundColor: colors.white,
  },
  chip: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontSize: 14.5, fontWeight: "600", color: colors.foreground },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 48 },
  notice: { borderRadius: radius.md, padding: space.md },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.full, alignSelf: "flex-start" },
  empty: { alignItems: "center", gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.xxl * 1.5 },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.mint100, alignItems: "center", justifyContent: "center" },
});
