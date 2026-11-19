import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { GalleryImage, SearchRow } from "@/lib/api";
import { formatArea, formatPrice, imageUrl } from "@/lib/format";
import { PROPERTY_TYPES } from "@/lib/labels";
import { colors, palette } from "@/lib/theme";

/** Breite einer Karte in der Reihe und Abstand dazwischen (Gestaltungsvorlage, 393 pt breit). */
export const TILE_WIDTH = 172;
export const TILE_GAP = 12;

const rooms = (value: number) => String(value).replace(/\.0$/, "");

/** Kurzbezeichnung wie «4.5-Zimmer-Wohnung» oder «Einfamilienhaus» (aus Zimmerzahl und Objektart). */
export function shortTitle(row: SearchRow): string {
  if (row.property_type === "apartment" && row.rooms !== null) return `${rooms(row.rooms)}-Zimmer-Wohnung`;
  return PROPERTY_TYPES[row.property_type] ?? "Immobilie";
}

/**
 * Kompakte Inseratkarte für die waagrechte Reihe der Startseite: Titelbild, Preis, Kurzbezeichnung,
 * Zimmer und Fläche, Ort. Die Fotos lassen sich hier nicht wischen (das würde mit dem Blättern der
 * Reihe kollidieren); die ganze Galerie zeigt die Liste «Alle anzeigen» und das Inserat selbst.
 */
export function ListingTile({
  row,
  favorite,
  onToggleFavorite,
  gallery,
}: {
  row: SearchRow;
  favorite: boolean;
  onToggleFavorite: () => void;
  gallery?: GalleryImage[];
}) {
  const router = useRouter();
  const cover = imageUrl({ display_path: row.cover_path, external_url: row.cover_external_url }, "md");
  const coverAi = Boolean(cover && gallery?.some((image) => image.url === cover && image.ai));
  const area = formatArea(row.living_area ?? row.plot_area);
  const place = [row.municipality ?? row.postal_code, row.canton].filter(Boolean).join(", ");
  const open = () => row.slug && router.push({ pathname: "/inserat/[slug]", params: { slug: row.slug } });

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${row.title ?? shortTitle(row)}, ${formatPrice(row)}, ${place}${coverAi ? ", Titelbild: KI-Visualisierung" : ""}`}
      onPress={open}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.94 }]}
    >
      <View style={styles.imageWrap}>
        {cover ? (
          <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.noImage]}>
            <Ionicons name="image-outline" size={26} color={colors.muted} />
          </View>
        )}
        {row.status === "reserved" ? (
          <View pointerEvents="none" style={styles.reserved}>
            <Text style={styles.reservedText}>Reserviert</Text>
          </View>
        ) : null}
        {coverAi ? (
          <View pointerEvents="none" style={styles.aiTag}>
            <Ionicons name="sparkles" size={9} color={colors.white} />
            <Text style={styles.aiTagText}>KI-Visualisierung</Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={favorite ? "Von der Merkliste entfernen" : "Auf die Merkliste setzen"}
          accessibilityState={{ selected: favorite }}
          hitSlop={8}
          onPress={onToggleFavorite}
          style={styles.heart}
        >
          <Ionicons name={favorite ? "heart" : "heart-outline"} size={16} color={palette.heart} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text style={styles.price} numberOfLines={1}>
          {formatPrice(row)}
        </Text>
        <Text style={styles.title} numberOfLines={1}>
          {shortTitle(row)}
        </Text>
        {row.rooms !== null || area ? (
          <View style={styles.facts}>
            {row.rooms !== null ? (
              <View style={styles.fact}>
                <Ionicons name="bed-outline" size={15} color={palette.tileIcon} />
                <Text style={styles.factText}>{rooms(row.rooms)}</Text>
              </View>
            ) : null}
            {row.rooms !== null && area ? <View style={styles.separator} /> : null}
            {area ? (
              <View style={styles.fact}>
                <Ionicons name="expand-outline" size={13} color={palette.tileIcon} />
                <Text style={styles.factText}>{area}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {place ? (
          <View style={styles.placeRow}>
            <Ionicons name="location-outline" size={14} color={palette.placeIcon} style={styles.placeIcon} />
            <Text style={styles.placeText} numberOfLines={1}>
              {place}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: TILE_WIDTH,
    borderRadius: 16,
    backgroundColor: colors.white,
    boxShadow: "0 3px 12px rgba(25,35,20,0.08)",
  },
  imageWrap: { height: 165, borderRadius: 15, overflow: "hidden", backgroundColor: "#eef1ea" },
  noImage: { alignItems: "center", justifyContent: "center" },
  heart: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 27,
    height: 27,
    borderRadius: 13.5,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  reserved: {
    position: "absolute",
    left: 8,
    top: 9,
    height: 18.7,
    paddingHorizontal: 9,
    borderRadius: 9.4,
    backgroundColor: "rgba(154,75,6,0.9)",
    justifyContent: "center",
  },
  reservedText: { fontSize: 10, fontWeight: "600", color: colors.white },
  aiTag: {
    position: "absolute",
    left: 7,
    bottom: 7,
    height: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 3.5,
    paddingHorizontal: 7,
    borderRadius: 9,
    backgroundColor: "rgba(22,30,19,0.72)",
  },
  aiTagText: { fontSize: 9, fontWeight: "600", color: colors.white },
  body: { paddingHorizontal: 15, paddingTop: 6, paddingBottom: 12 },
  price: { fontSize: 15, lineHeight: 18, fontWeight: "700", letterSpacing: -0.1, color: palette.price },
  title: { marginTop: 2, fontSize: 13, lineHeight: 16, color: palette.tileTitle },
  facts: { marginTop: 6, height: 18, flexDirection: "row", alignItems: "center" },
  fact: { flexDirection: "row", alignItems: "center", gap: 8 },
  factText: { fontSize: 12, color: palette.tileText },
  separator: { width: 1, height: 12, marginHorizontal: 13, backgroundColor: "#d3d6cf" },
  placeRow: { marginTop: 5, flexDirection: "row", alignItems: "center", gap: 6 },
  // Symbol hat im Zeichenfeld Luft: bündig mit den Symbolen darüber ausrichten
  placeIcon: { marginLeft: -2 },
  placeText: { flex: 1, fontSize: 12, color: palette.tileMuted },
});
