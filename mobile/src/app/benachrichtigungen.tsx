import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as React from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { SignInPrompt } from "@/components/sign-in-prompt";
import { Button, EmptyState, Loading, Notice } from "@/components/ui";
import {
  accountErrorMessage,
  markAllNotificationsRead,
  markNotificationRead,
  notificationTarget,
  notifications,
  type NotificationRow,
} from "@/lib/api-account";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { colors, radius, space, text } from "@/lib/theme";

export default function NotificationsScreen() {
  const { userId, loading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["notifications", userId], enabled: Boolean(userId), queryFn: notifications });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    queryClient.invalidateQueries({ queryKey: ["notifications-unread", userId] });
  };
  const markOne = useMutation({ mutationFn: markNotificationRead, onSettled: refresh });
  const markAll = useMutation({ mutationFn: markAllNotificationsRead, onSettled: refresh });

  const rows = list.data ?? [];
  const unread = rows.filter((n) => !n.read_at).length;

  function open(item: NotificationRow) {
    if (!item.read_at) markOne.mutate(item.id);
    const target = notificationTarget(item.link);
    if (target?.kind === "chat") router.push({ pathname: "/chat/[id]", params: { id: target.id } });
    else if (target?.kind === "listing") router.push({ pathname: "/inserat/[slug]", params: { slug: target.slug } });
  }

  return (
    <>
      <Stack.Screen options={{ title: "Benachrichtigungen" }} />
      {loading || (userId && list.isPending) ? (
        <Loading />
      ) : !userId ? (
        <SignInPrompt icon="notifications-outline" title="Bitte anmelden" description="Melden Sie sich an, um Ihre Benachrichtigungen zu sehen." />
      ) : list.isError ? (
        <View style={{ padding: space.lg, gap: space.md }}>
          <Notice tone="error">{accountErrorMessage(list.error)}</Notice>
          <Button title="Erneut versuchen" variant="outline" onPress={() => list.refetch()} />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ padding: space.lg, gap: space.sm }}
          data={rows}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={colors.brand} />}
          ListHeaderComponent={
            rows.length ? (
              <View style={{ gap: space.sm, marginBottom: space.sm }}>
                {markAll.isError || markOne.isError ? <Notice tone="error">{accountErrorMessage(markAll.error ?? markOne.error)}</Notice> : null}
                <View style={styles.headerRow}>
                  <Text accessibilityRole="summary" style={[text.small, { flex: 1 }]}>
                    {unread === 0 ? "Alles gelesen" : unread === 1 ? "1 ungelesene Benachrichtigung" : `${unread} ungelesene Benachrichtigungen`}
                  </Text>
                  {unread > 0 ? <Button title="Alle gelesen" variant="ghost" icon="checkmark-done" onPress={() => markAll.mutate()} loading={markAll.isPending} /> : null}
                </View>
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title="Keine Benachrichtigungen"
              description="Hier erscheinen neue Anfragen, Nachrichten, Besichtigungen und freigegebene Dokumente."
            />
          }
          renderItem={({ item }) => {
            const target = notificationTarget(item.link);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.read_at ? "" : "Ungelesen: "}${item.title}`}
                accessibilityHint={target ? "Öffnet den Eintrag" : item.read_at ? undefined : "Markiert als gelesen"}
                onPress={() => open(item)}
                style={({ pressed }) => [styles.item, !item.read_at && styles.unread, pressed && { backgroundColor: colors.mint100 }]}
              >
                <View style={[styles.dot, item.read_at ? { backgroundColor: "transparent" } : null]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[text.body, { fontWeight: item.read_at ? "400" : "700" }]}>{item.title}</Text>
                  {item.body ? <Text style={text.small}>{item.body}</Text> : null}
                  <Text style={[text.small, { fontSize: 12.5 }]}>{formatDateTime(item.created_at)}</Text>
                </View>
                {target ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null}
              </Pressable>
            );
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 50 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 60,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  unread: { borderColor: colors.mint200, backgroundColor: "#f6faf1" },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.brand },
});
