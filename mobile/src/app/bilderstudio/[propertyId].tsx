import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { Badge, Button, EmptyState, Loading, Notice } from "@/components/ui";
import { studioImages, type StudioImage } from "@/lib/api-studio";
import { useAuth } from "@/lib/auth";
import { imageUrl } from "@/lib/format";
import { errorMessage } from "@/lib/labels";
import { colors, radius, space, text } from "@/lib/theme";

/** Bilderstudio: alle Bilder eines Objekts, inkl. Designvorschlägen, die auf die Prüfung warten. */
export default function ImageStudioScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { userId } = useAuth();
  const router = useRouter();
  const query = useQuery({ queryKey: ["studio-images", propertyId], queryFn: () => studioImages(propertyId), enabled: Boolean(userId) });

  const title = <Stack.Screen options={{ title: "Bilderstudio" }} />;
  if (!userId) {
    return (
      <>
        {title}
        <EmptyState icon="lock-closed-outline" title="Bitte anmelden" description="Melden Sie sich an, um Ihre Bilder zu bearbeiten." />
      </>
    );
  }
  if (query.isPending) {
    return (
      <>
        {title}
        <Loading />
      </>
    );
  }
  if (query.isError) {
    return (
      <View style={{ padding: space.lg }}>
        {title}
        <Notice tone="error">{errorMessage(query.error)}</Notice>
      </View>
    );
  }

  const images = query.data;
  const openReviews = images.filter((image) => image.status === "review").length;

  return (
    <>
      {title}
      <FlatList
        data={images}
        keyExtractor={(image) => image.id}
        numColumns={2}
        columnWrapperStyle={{ gap: space.md }}
        contentContainerStyle={{ padding: space.lg, gap: space.md }}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.brand} />}
        ListHeaderComponent={
          images.length > 0 ? (
            <View style={{ gap: space.md }}>
              <Text style={[text.body, { color: colors.muted }]}>
                Fotos automatisch optimieren oder mit KI einen Designvorschlag erstellen. Das Original bleibt immer erhalten.
              </Text>
              {openReviews > 0 ? (
                <Notice tone="info">
                  {openReviews === 1
                    ? "Ein Designvorschlag wartet auf Ihre Prüfung. Er ist noch nicht öffentlich."
                    : `${openReviews} Designvorschläge warten auf Ihre Prüfung. Sie sind noch nicht öffentlich.`}
                </Notice>
              ) : null}
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          <EmptyState
            icon="images-outline"
            title="Noch keine Bilder"
            description="Laden Sie zuerst Fotos Ihrer Immobilie hoch. Danach können Sie sie hier optimieren."
            action={<Button title="Fotos hochladen" icon="add" onPress={() => router.push({ pathname: "/objekt/[id]", params: { id: propertyId } })} />}
          />
        }
        renderItem={({ item, index }) => <Tile image={item} index={index} onPress={() => router.push({ pathname: "/bild/[imageId]", params: { imageId: item.id } })} />}
      />
    </>
  );
}

function Tile({ image, index, onPress }: { image: StudioImage; index: number; onPress: () => void }) {
  const uri = imageUrl(image, "sm");
  const label = image.caption?.trim() || `Bild ${index + 1}`;
  const review = image.status === "review";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={review ? `${label}, Designvorschlag prüfen` : `${label} bearbeiten`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, review && { borderColor: colors.info }, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.thumb}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <Ionicons name="image-outline" size={26} color={colors.muted} />
        )}
      </View>
      <View style={styles.badges}>
        {review ? <Badge label="Prüfung offen" tone="blue" /> : null}
        {image.is_cover ? <Badge label="Titelbild" tone="green" /> : null}
        {image.is_enhanced ? <Badge label="optimiert" tone="blue" /> : null}
        {image.is_ai_visualization ? <Badge label="KI-Visualisierung" tone="amber" /> : null}
        {image.is_floor_plan ? <Badge label="Grundriss" /> : null}
        {image.external_url ? <Badge label="Demo" /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    maxWidth: "48.5%",
    padding: space.sm,
    gap: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  thumb: { aspectRatio: 4 / 3, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.mutedBg, alignItems: "center", justifyContent: "center" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 4, minHeight: 26 },
});
