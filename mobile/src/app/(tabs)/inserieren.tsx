import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import * as React from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { SignInPrompt } from "@/components/sign-in-prompt";
import { Badge, Button, EmptyState, Loading, Notice } from "@/components/ui";
import { myProperties, type MyProperty } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatPrice, formatRooms, imageUrl } from "@/lib/format";
import { LISTING_STATUS, PROPERTY_TYPES, errorMessage } from "@/lib/labels";
import { colors, radius, space, text } from "@/lib/theme";

function displayName(item: MyProperty): string {
  if (item.listing?.title?.trim()) return item.listing.title.trim();
  const type = PROPERTY_TYPES[item.property.property_type];
  const base = item.property.rooms !== null ? `${formatRooms(item.property.rooms)}, ${type}` : type;
  return item.property.municipality ? `${base} in ${item.property.municipality}` : base;
}

export default function MyPropertiesScreen() {
  const { userId, loading } = useAuth();
  const router = useRouter();
  const query = useQuery({ queryKey: ["my-properties", userId], queryFn: () => myProperties(userId!), enabled: Boolean(userId) });
  const refetch = query.refetch;
  useFocusEffect(
    React.useCallback(() => {
      if (userId) refetch();
    }, [userId, refetch]),
  );

  if (loading) return <Loading />;
  if (!userId) {
    return <SignInPrompt icon="add-circle-outline" title="Kostenlos inserieren" description="Melden Sie sich an, um Ihre Immobilie in wenigen Minuten zu erfassen und zu veröffentlichen." />;
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: space.lg, gap: space.md }}
      data={query.data ?? []}
      keyExtractor={(item) => item.property.id}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.brand} />}
      ListHeaderComponent={
        (query.data?.length ?? 0) > 0 ? <Button title="Neue Immobilie erfassen" icon="add" onPress={() => router.push("/objekt/neu")} /> : undefined
      }
      renderItem={({ item }) => {
        const cover = imageUrl(item.cover, "sm");
        const status = item.listing ? LISTING_STATUS[item.listing.status] : null;
        return (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${displayName(item)}${status ? `, ${status.label}` : ""}`}
            onPress={() => router.push({ pathname: "/objekt/[id]", params: { id: item.property.id } })}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.mint100 }]}
          >
            <View style={styles.thumb}>
              {cover ? <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="image-outline" size={26} color={colors.muted} />}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              {status ? <Badge label={status.label} tone={status.tone} /> : null}
              <Text style={[text.body, { fontWeight: "700" }]} numberOfLines={2}>
                {displayName(item)}
              </Text>
              <Text style={text.small} numberOfLines={1}>
                {item.listing && (item.listing.price !== null || item.listing.price_on_request) ? formatPrice(item.listing) : "Noch kein Preis"} ·{" "}
                {item.imageCount === 1 ? "1 Foto" : `${item.imageCount} Fotos`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        );
      }}
      ListEmptyComponent={
        query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <Notice tone="error">{errorMessage(query.error)}</Notice>
        ) : (
          <EmptyState
            icon="home-outline"
            title="Noch keine Immobilie"
            description="Erfassen Sie Ihre Immobilie, laden Sie Fotos hoch und veröffentlichen Sie das Inserat – kostenlos und ohne Makler."
            action={<Button title="Immobilie erfassen" icon="add" onPress={() => router.push("/objekt/neu")} style={{ alignSelf: "stretch" }} />}
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: { width: 84, height: 84, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.mutedBg, alignItems: "center", justifyContent: "center" },
});
