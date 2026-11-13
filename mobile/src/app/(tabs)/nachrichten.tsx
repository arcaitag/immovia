import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import * as React from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { SignInPrompt } from "@/components/sign-in-prompt";
import { EmptyState, Loading, Notice } from "@/components/ui";
import { conversations } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDateTime, imageUrl } from "@/lib/format";
import { errorMessage } from "@/lib/labels";
import { colors, radius, space, text } from "@/lib/theme";

export default function ConversationsScreen() {
  const { userId, loading } = useAuth();
  const router = useRouter();
  const query = useQuery({ queryKey: ["conversations", userId], queryFn: conversations, enabled: Boolean(userId), refetchInterval: 20_000 });
  const refetch = query.refetch;
  useFocusEffect(
    React.useCallback(() => {
      if (userId) refetch();
    }, [userId, refetch]),
  );

  if (loading) return <Loading />;
  if (!userId) {
    return <SignInPrompt icon="chatbubbles-outline" title="Ihre Nachrichten" description="Melden Sie sich an, um Anbieter zu kontaktieren und Anfragen zu beantworten." />;
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: space.lg, gap: space.sm }}
      data={query.data ?? []}
      keyExtractor={(c) => c.conversation_id}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.brand} />}
      renderItem={({ item }) => {
        const cover = imageUrl({ display_path: item.cover_path, external_url: item.cover_external_url }, "sm");
        const unread = item.unread_count > 0;
        return (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${item.other_display_name ?? "Kontakt"}, ${item.listing_title ?? "Inserat"}${unread ? `, ${item.unread_count} ungelesen` : ""}`}
            onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.conversation_id, title: item.other_display_name ?? "Nachrichten" } })}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.mint100 }]}
          >
            <View style={styles.thumb}>
              {cover ? <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="home-outline" size={22} color={colors.muted} />}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm }}>
                <Text style={[text.body, { fontWeight: unread ? "800" : "600", flex: 1 }]} numberOfLines={1}>
                  {item.other_display_name ?? "Kontakt"}
                </Text>
                {item.last_message_at ? <Text style={text.small}>{formatDateTime(item.last_message_at)}</Text> : null}
              </View>
              <Text style={text.small} numberOfLines={1}>
                {item.listing_title ?? "Inserat nicht mehr verfügbar"}
              </Text>
              <Text style={[text.small, unread && { color: colors.foreground, fontWeight: "600" }]} numberOfLines={1}>
                {item.last_message_preview ?? ""}
              </Text>
            </View>
            {unread ? (
              <View style={styles.unread}>
                <Text style={{ color: colors.white, fontSize: 12, fontWeight: "700" }}>{item.unread_count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      }}
      ListEmptyComponent={
        query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <Notice tone="error">{errorMessage(query.error)}</Notice>
        ) : (
          <EmptyState icon="chatbubbles-outline" title="Noch keine Nachrichten" description="Wenn Sie einen Anbieter kontaktieren oder eine Anfrage erhalten, erscheint das Gespräch hier." />
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
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: { width: 56, height: 56, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.mutedBg, alignItems: "center", justifyContent: "center" },
  unread: { minWidth: 24, height: 24, paddingHorizontal: 6, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
});
