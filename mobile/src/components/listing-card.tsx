import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { GALLERY_MAX, type GalleryImage, type SearchRow } from "@/lib/api";
import { formatArea, formatPrice, formatRooms, imageUrl } from "@/lib/format";
import { PROPERTY_TYPES } from "@/lib/labels";
import { colors, palette } from "@/lib/theme";

/** Seitenverhältnis des Bildes, wie in der Gestaltungsvorlage. */
const IMAGE_RATIO = 2.7;

type Fact = { key: string; label: string; icon: "rooms" | "expand-outline" | "business-outline" };

/**
 * Inseratkarte der Suche und der Merkliste. Mit `gallery` lassen sich die Fotos wischen
 * (Punkte zeigen die Position); ohne erscheint nur das Titelbild.
 */
export function ListingCard({
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
  // Titelbild der Suche zuerst, dann die übrigen Fotos. Ob das Titelbild eine KI-Visualisierung ist,
  // steht in den Galeriedaten (ohne diese bleibt es ungekennzeichnet, bis sie geladen sind).
  const others = (gallery ?? []).filter((image) => image.url !== cover);
  const images: GalleryImage[] = [
    ...(cover ? [{ url: cover, ai: Boolean(gallery?.some((image) => image.url === cover && image.ai)) }] : []),
    ...others,
  ].slice(0, GALLERY_MAX);
  const [width, setWidth] = React.useState(0);
  const [index, setIndex] = React.useState(0);

  const place = [row.postal_code, row.municipality].filter(Boolean).join(" ");
  const facts: Fact[] = [
    { key: "rooms", label: formatRooms(row.rooms) ?? "", icon: "rooms" as const },
    { key: "area", label: formatArea(row.living_area ?? row.plot_area) ?? "", icon: "expand-outline" as const },
    { key: "type", label: PROPERTY_TYPES[row.property_type] ?? "", icon: "business-outline" as const },
  ].filter((fact) => fact.label);
  const open = () => row.slug && router.push({ pathname: "/inserat/[slug]", params: { slug: row.slug } });

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${row.title ?? "Inserat"}, ${formatPrice(row)}, ${place}${images[0]?.ai ? ", Titelbild: KI-Visualisierung" : ""}`}
      onPress={open}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.94 }]}
    >
      <View style={styles.imageWrap} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {images.length > 1 && width > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            accessibilityLabel={`${images.length} Fotos, wischen zum Blättern`}
            scrollEventThrottle={16}
            onScroll={(event) => {
              const next = Math.round(event.nativeEvent.contentOffset.x / width);
              setIndex(Math.min(Math.max(next, 0), images.length - 1));
            }}
            style={StyleSheet.absoluteFill}
          >
            {images.map((image, i) => (
              <View key={`${i}-${image.url}`} style={{ width, height: "100%" }}>
                <Image source={image.url} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                {image.ai ? <AiTag /> : null}
              </View>
            ))}
          </ScrollView>
        ) : images[0] ? (
          <>
            <Image source={images[0].url} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
            {images[0].ai ? <AiTag /> : null}
          </>
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.noImage]}>
            <Ionicons name="image-outline" size={28} color={colors.muted} />
          </View>
        )}

        <View pointerEvents="none" style={styles.badges}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{row.offer_type === "rent" ? "Mieten" : "Kaufen"}</Text>
          </View>
          {row.status === "reserved" ? (
            <View style={[styles.badge, { backgroundColor: "rgba(154,75,6,0.9)" }]}>
              <Text style={styles.badgeText}>Reserviert</Text>
            </View>
          ) : null}
        </View>

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

        {images.length > 1 ? (
          <View pointerEvents="none" style={styles.dots}>
            {images.map((image, i) => (
              <View key={`${i}-${image.url}`} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.pricePill}>
          <Text style={styles.price}>{formatPrice(row)}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {row.title ?? "Inserat"}
        </Text>
        {facts.length ? (
          <View style={styles.facts}>
            {facts.map((fact, i) => (
              <React.Fragment key={fact.key}>
                {i > 0 ? <Text style={styles.separator}>·</Text> : null}
                <View style={styles.fact}>
                  {fact.icon === "rooms" ? (
                    <Image source={require("../../assets/images/icon-rooms.png")} style={styles.roomsIcon} contentFit="contain" />
                  ) : (
                    <Ionicons name={fact.icon} size={fact.icon === "business-outline" ? 12.5 : 11.5} color={palette.cardMeta} />
                  )}
                  <Text style={styles.meta}>{fact.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        ) : null}
        <View style={styles.divider} />
        <View style={styles.placeRow}>
          <Ionicons name="location-outline" size={13.5} color={palette.placeIcon} style={styles.placeIcon} />
          <Text style={styles.meta} numberOfLines={1}>
            {[place, row.canton].filter(Boolean).join(", ")}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/** Kennzeichnung KI-bearbeiteter Bilder, wie in der Detailansicht und auf der Website. */
function AiTag() {
  return (
    <View pointerEvents="none" style={styles.aiTag}>
      <Ionicons name="sparkles" size={9.5} color={colors.white} />
      <Text style={styles.aiTagText}>KI-Visualisierung</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    // boxShadow statt shadow*: gleiche Unschärfe auf iOS, Android und im Web
    boxShadow: "0 4px 14px rgba(30,46,25,0.07)",
  },
  imageWrap: { margin: 5, marginBottom: 0, aspectRatio: IMAGE_RATIO, borderRadius: 12, overflow: "hidden", backgroundColor: "#eef1ea" },
  noImage: { alignItems: "center", justifyContent: "center" },
  badges: { position: "absolute", left: 8, top: 8, flexDirection: "row", gap: 6 },
  badge: { height: 18.7, paddingHorizontal: 10, borderRadius: 9.4, backgroundColor: palette.badge, justifyContent: "center" },
  badgeText: { fontSize: 10, fontWeight: "600", color: colors.white },
  heart: {
    position: "absolute",
    right: 6.5,
    top: 7,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  aiTag: {
    position: "absolute",
    left: 8,
    bottom: 7,
    height: 18.7,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    borderRadius: 9.4,
    backgroundColor: "rgba(22,30,19,0.72)",
  },
  aiTagText: { fontSize: 9.5, fontWeight: "600", color: colors.white },
  dots: { position: "absolute", left: 0, right: 0, bottom: 8, flexDirection: "row", justifyContent: "center", gap: 5 },
  dot: { width: 5.5, height: 5.5, borderRadius: 2.75, backgroundColor: "rgba(255,255,255,0.55)" },
  dotActive: { backgroundColor: colors.white },
  body: { paddingHorizontal: 17, paddingTop: 9, paddingBottom: 5.9 },
  pricePill: { alignSelf: "flex-start", marginLeft: -5, height: 20.5, paddingHorizontal: 9, borderRadius: 10.25, backgroundColor: palette.priceBg, justifyContent: "center" },
  price: { fontSize: 12.5, fontWeight: "700", letterSpacing: -0.1, color: palette.price },
  title: { marginTop: 3, fontSize: 11.5, lineHeight: 14.6, fontWeight: "600", color: palette.cardTitle },
  facts: { marginTop: 6, flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  fact: { flexDirection: "row", alignItems: "center", gap: 7 },
  roomsIcon: { width: 9, height: 9 },
  separator: { marginHorizontal: 9, fontSize: 10, color: palette.cardMeta },
  meta: { fontSize: 10, lineHeight: 13, color: palette.cardMeta },
  divider: { height: 1, marginTop: 6.8, marginHorizontal: -4, backgroundColor: palette.divider },
  placeRow: { marginTop: 4.9, flexDirection: "row", alignItems: "center", gap: 5 },
  // Symbol hat im Zeichenfeld Luft: bündig mit den Symbolen darüber ausrichten
  placeIcon: { marginLeft: -3.5 },
});
