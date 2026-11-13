import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { Badge, Button } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { CONFIG } from "@/lib/config";
import { readingMinutes, type Article } from "@/lib/content/ratgeber";
import { colors, radius, space, text } from "@/lib/theme";

/**
 * Bausteine für die Inhaltsseiten der App (Startseite, Verkaufen, Ratgeber usw.).
 * Entsprechen src/lib/content/components.tsx der Website; Texte und Bilder kommen aus denselben Quellen.
 */

export type IconName = React.ComponentProps<typeof Ionicons>["name"];

export const mint50 = "#f3f8ec";

/** Marketingbild in passender Grösse (Unsplash liefert zugeschnittene Varianten). */
export function photo(src: string, width = 1200): string {
  return `${src}${src.includes("?") ? "&" : "?"}w=${width}&q=70&auto=format&fit=crop`;
}

/**
 * Öffnet einen Pfad der Website am passenden Ort der App. Was es in der App nicht gibt
 * (Firmenkonto, Rechtstexte), öffnet die Website im Browser der App.
 */
export function useSiteLink(): (path: string) => void {
  const router = useRouter();
  const { userId } = useAuth();
  return React.useCallback(
    (path: string) => {
      const clean = path.split("#")[0]!.split("?")[0]!;
      const push = (href: string) => router.push(href as Href);
      if (clean === "/verkaufen/start") return push(userId ? "/objekt/neu" : "/registrieren");
      if (clean.startsWith("/dashboard/firma") || path.includes("dashboard%2Ffirma")) {
        void WebBrowser.openBrowserAsync(`${CONFIG.siteUrl}${path}`).catch(() => undefined);
        return;
      }
      if (clean.startsWith("/dashboard")) return push(userId ? "/inserieren" : "/login");
      if (clean === "/immobilien" || clean === "/kaufen" || clean === "/mieten") return push("/suchen");
      if (clean === "/registrieren") return push("/registrieren");
      if (["/verkaufen", "/bewerten", "/so-funktionierts", "/fuer-makler", "/faq", "/kontakt", "/ratgeber"].includes(clean)) return push(clean);
      if (clean.startsWith("/ratgeber/")) return push(clean);
      void WebBrowser.openBrowserAsync(`${CONFIG.siteUrl}${path}`).catch(() => undefined);
    },
    [router, userId],
  );
}

export function Section({ tone = "white", children, style }: { tone?: "white" | "surface" | "mint"; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const bg = tone === "surface" ? colors.surface : tone === "mint" ? mint50 : colors.white;
  return <View style={[{ backgroundColor: bg, paddingHorizontal: space.lg, paddingVertical: 36, gap: space.lg }, style]}>{children}</View>;
}

export function Eyebrow({ children, color = colors.brand }: { children: string; color?: string }) {
  return <Text style={[styles.eyebrow, { color }]}>{children.toUpperCase()}</Text>;
}

/** Seitenkopf wie PageIntro der Website. */
export function PageIntro({ eyebrow, title, lead, children }: { eyebrow?: string; title: string; lead?: string; children?: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.surface, paddingHorizontal: space.lg, paddingTop: 28, paddingBottom: 32, gap: space.md }}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <Text accessibilityRole="header" style={styles.pageTitle}>
        {title}
      </Text>
      {lead ? <Text style={styles.lead}>{lead}</Text> : null}
      {children ? <View style={{ gap: space.md, marginTop: space.sm }}>{children}</View> : null}
    </View>
  );
}

export function SectionHeading({ eyebrow, title, text: body, light = false }: { eyebrow?: string; title: string; text?: string; light?: boolean }) {
  return (
    <View style={{ gap: space.sm }}>
      {eyebrow ? <Eyebrow color={light ? colors.mint200 : colors.brand}>{eyebrow}</Eyebrow> : null}
      <Text accessibilityRole="header" style={[styles.sectionTitle, light && { color: colors.white }]}>
        {title}
      </Text>
      {body ? <Text style={[styles.sectionText, light && { color: "rgba(255,255,255,0.8)" }]}>{body}</Text> : null}
    </View>
  );
}

export function CheckList({ items }: { items: string[] }) {
  return (
    <View accessibilityRole="list" style={{ gap: space.md }}>
      {items.map((item) => (
        <View key={item} style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
          <View style={styles.check}>
            <Ionicons name="checkmark" size={16} color={colors.forest} />
          </View>
          <Text style={[text.body, { flex: 1, fontSize: 15.5 }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export function IconTile({ icon, size = 44 }: { icon: IconName; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: radius.md, backgroundColor: colors.mint100, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={icon} size={size * 0.5} color={colors.forest} />
    </View>
  );
}

/** Karte mit Symbol, Titel und Text; optional mit Schrittnummer, Kennzeichnung oder Link. */
export function FeatureCard({
  icon,
  title,
  text: body,
  step,
  badge,
  link,
}: {
  icon: IconName;
  title: string;
  text: string;
  step?: string;
  badge?: React.ReactNode;
  link?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md }}>
        <IconTile icon={icon} />
        {badge ?? (step ? <Text style={styles.step}>{step}</Text> : null)}
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardText}>{body}</Text>
      {link ? <TextLink label={link.label} onPress={link.onPress} /> : null}
    </View>
  );
}

/** Nummerierter Schritt in einer Zeile (wie StepList der Website). */
export function StepRow({ icon, index, title, text: body }: { icon: IconName; index: number; title: string; text: string }) {
  return (
    <View style={[styles.card, { flexDirection: "row", gap: space.md }]}>
      <IconTile icon={icon} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.cardTitle}>
          <Text style={{ color: colors.brand }}>{index}.</Text> {title}
        </Text>
        <Text style={styles.cardText}>{body}</Text>
      </View>
    </View>
  );
}

export function TextLink({ label, onPress, icon = "arrow-forward" }: { label: string; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.textLink, pressed && { opacity: 0.6 }]}>
      <Text style={{ fontSize: 15.5, fontWeight: "600", color: colors.primary }}>{label}</Text>
      <Ionicons name={icon} size={17} color={colors.primary} />
    </Pressable>
  );
}

/** Aufklappbare Fragen; es ist jeweils höchstens eine Antwort offen. */
export function Accordion({ items }: { items: { question: string; answer: string }[] }) {
  const [open, setOpen] = React.useState<string | null>(null);
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
      {items.map((item) => {
        const expanded = open === item.question;
        return (
          <View key={item.question} style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => setOpen(expanded ? null : item.question)}
              style={({ pressed }) => [styles.accordionHead, pressed && { opacity: 0.6 }]}
            >
              <Text style={{ flex: 1, fontSize: 16, fontWeight: "600", color: colors.foreground, lineHeight: 22 }}>{item.question}</Text>
              <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} />
            </Pressable>
            {expanded ? <Text style={[styles.cardText, { fontSize: 15.5, lineHeight: 23, paddingBottom: space.lg }]}>{item.answer}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

/** Abschluss einer Seite mit ein bis zwei Aktionen; die Ziele sind Pfade der Website. */
export function CtaBand({ title, text: body, primary, secondary }: { title: string; text?: string; primary: { href: string; label: string }; secondary?: { href: string; label: string } }) {
  const open = useSiteLink();
  return (
    <View style={{ paddingHorizontal: space.lg, paddingVertical: 36, backgroundColor: colors.white }}>
      <View style={styles.cta}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { fontSize: 22 }]}>
          {title}
        </Text>
        {body ? <Text style={styles.sectionText}>{body}</Text> : null}
        <View style={{ gap: space.md, marginTop: space.sm }}>
          <Button title={primary.label} onPress={() => open(primary.href)} />
          {secondary ? <Button title={secondary.label} variant="outline" onPress={() => open(secondary.href)} /> : null}
        </View>
      </View>
    </View>
  );
}

export function Note({ title, children, tone = "info" }: { title?: string; children: string; tone?: "info" | "warning" }) {
  const warning = tone === "warning";
  const fg = warning ? colors.warning : colors.forest;
  return (
    <View accessibilityRole="summary" style={[styles.note, { backgroundColor: warning ? colors.warningBg : mint50, borderColor: warning ? "#f3d9a8" : colors.mint200 }]}>
      <Ionicons name={warning ? "warning-outline" : "information-circle-outline"} size={21} color={fg} />
      <View style={{ flex: 1, gap: 4 }}>
        {title ? <Text style={{ fontSize: 15, fontWeight: "700", color: fg }}>{title}</Text> : null}
        <Text style={{ fontSize: 15, lineHeight: 22, color: fg }}>{children}</Text>
      </View>
    </View>
  );
}

export function ArticleCard({ article }: { article: Article }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${article.title}, ${readingMinutes(article)} Minuten Lesezeit`}
      onPress={() => router.push(`/ratgeber/${article.slug}` as Href)}
      style={({ pressed }) => [styles.card, { padding: 0, overflow: "hidden" }, pressed && { opacity: 0.92 }]}
    >
      <Image source={photo(article.image.src, 900)} style={{ aspectRatio: 16 / 9, backgroundColor: colors.mutedBg }} contentFit="cover" transition={150} />
      <View style={{ padding: space.lg, gap: space.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
          <Badge tone="green" label={article.category} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="time-outline" size={14} color={colors.muted} />
            <Text style={{ fontSize: 12.5, color: colors.muted }}>{readingMinutes(article)} Min. Lesezeit</Text>
          </View>
        </View>
        <Text style={[styles.cardTitle, { marginTop: 0 }]}>{article.title}</Text>
        <Text style={styles.cardText} numberOfLines={3}>
          {article.description}
        </Text>
      </View>
    </Pressable>
  );
}

export const contentStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.sm,
  },
  cardTitle: { fontSize: 17, fontWeight: "700", letterSpacing: -0.2, color: colors.foreground, lineHeight: 23, marginTop: 4 },
  cardText: { fontSize: 14.5, lineHeight: 21, color: colors.muted },
  sectionTitle: { fontSize: 26, fontWeight: "800", letterSpacing: -0.6, lineHeight: 31, color: colors.foreground },
  sectionText: { fontSize: 16.5, lineHeight: 24, color: colors.muted },
  pageTitle: { fontSize: 33, fontWeight: "800", letterSpacing: -1, lineHeight: 37, color: colors.forest },
  lead: { fontSize: 17, lineHeight: 26, color: "rgba(25,40,32,0.75)" },
});

const styles = StyleSheet.create({
  ...contentStyles,
  eyebrow: { fontSize: 13, fontWeight: "700", letterSpacing: 1.5 },
  check: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.mint100, alignItems: "center", justifyContent: "center", marginTop: 1 },
  step: { fontSize: 13.5, fontWeight: "700", color: colors.muted },
  textLink: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  accordionHead: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md },
  cta: { borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: space.xl, gap: space.sm },
  note: { flexDirection: "row", gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
});
