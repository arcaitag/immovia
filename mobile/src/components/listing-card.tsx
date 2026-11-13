import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Badge } from "@/components/ui";
import type { SearchRow } from "@/lib/api";
import { formatArea, formatPrice, formatRooms, imageUrl } from "@/lib/format";
import { PROPERTY_TYPES } from "@/lib/labels";
import { colors, radius, space, text } from "@/lib/theme";

export function ListingCard({
  row,
  favorite,
  onToggleFavorite,
}: {
  row: SearchRow;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  const router = useRouter();
  const cover = imageUrl({ display_path: row.cover_path, external_url: row.cover_external_url }, "md");
  const facts = [formatRooms(row.rooms), formatArea(row.living_area ?? row.plot_area), PROPERTY_TYPES[row.property_type]].filter(Boolean);
  const place = [row.postal_code, row.municipality].filter(Boolean).join(" ");

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${row.title ?? "Inserat"}, ${formatPrice(row)}, ${place}`}
      onPress={() => row.slug && router.push({ pathname: "/inserat/[slug]", params: { slug: row.slug } })}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
    >
      <View style={styles.imageWrap}>
        {cover ? (
          <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
            <Ionicons name="image-outline" size={32} color={colors.muted} />
          </View>
        )}
        <View style={styles.badges}>
          <Badge tone="dark" label={row.offer_type === "rent" ? "Mieten" : "Kaufen"} />
          {row.status === "reserved" ? <Badge tone="amber" label="Reserviert" /> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={favorite ? "Von der Merkliste entfernen" : "Auf die Merkliste setzen"}
          accessibilityState={{ selected: favorite }}
          hitSlop={8}
          onPress={onToggleFavorite}
          style={styles.heart}
        >
          <Ionicons name={favorite ? "heart" : "heart-outline"} size={22} color={favorite ? colors.destructive : colors.forest} />
        </Pressable>
      </View>
      <View style={{ padding: space.md, gap: 4 }}>
        <Text style={styles.price}>{formatPrice(row)}</Text>
        <Text style={[text.body, { fontWeight: "600" }]} numberOfLines={2}>
          {row.title ?? "Inserat"}
        </Text>
        <Text style={text.small} numberOfLines={1}>
          {facts.join(" · ")}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="location-outline" size={15} color={colors.muted} />
          <Text style={text.small} numberOfLines={1}>
            {[place, row.canton].filter(Boolean).join(", ")}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  imageWrap: { aspectRatio: 16 / 10, backgroundColor: colors.mutedBg },
  badges: { position: "absolute", left: 10, top: 10, flexDirection: "row", gap: 6 },
  heart: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center",
  },
  price: { fontSize: 19, fontWeight: "800", letterSpacing: -0.3, color: colors.foreground },
});
