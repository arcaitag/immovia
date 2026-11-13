import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import * as React from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState, Loading, Notice } from "@/components/ui";
import { markConversationRead, messages, sendMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { errorMessage } from "@/lib/labels";
import { colors, radius, space, text } from "@/lib/theme";

export default function ChatScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const { userId } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [draft, setDraft] = React.useState("");
  const key = ["messages", id];
  const query = useQuery({ queryKey: key, queryFn: () => messages(id), enabled: Boolean(userId), refetchInterval: 5_000 });

  // Als gelesen markieren, sobald neue Nachrichten angezeigt werden
  const newest = query.data?.[0]?.id;
  React.useEffect(() => {
    if (!userId || !newest) return;
    markConversationRead(id, userId).then(() => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["unread"] });
    });
  }, [id, userId, newest, queryClient]);

  const send = useMutation({
    mutationFn: (body: string) => sendMessage(id, body),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: key });
    },
  });

  if (!userId) return <EmptyState icon="chatbubbles-outline" title="Bitte anmelden" description="Melden Sie sich an, um Nachrichten zu lesen." />;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90} style={{ flex: 1, backgroundColor: colors.surface }}>
      <Stack.Screen options={{ title: title || "Nachrichten" }} />
      {query.isPending ? (
        <Loading />
      ) : (
        <FlatList
          inverted
          data={query.data ?? []}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: space.lg, gap: space.sm }}
          renderItem={({ item }) => {
            if (item.kind !== "text") {
              return (
                <Text style={[text.small, { textAlign: "center", paddingVertical: 4 }]}>{item.body}</Text>
              );
            }
            const mine = item.sender_id === userId;
            return (
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                <Text style={[text.body, mine && { color: colors.white }, item.deleted_at ? { fontStyle: "italic" } : null]}>
                  {item.deleted_at ? "Nachricht gelöscht" : item.body || (item.attachment_name ? `Anhang: ${item.attachment_name}` : "")}
                </Text>
                <Text style={[styles.time, mine && { color: "rgba(255,255,255,0.8)" }]}>{formatDateTime(item.created_at)}</Text>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={[text.small, { textAlign: "center", transform: [{ scaleY: -1 }] }]}>Noch keine Nachrichten.</Text>}
        />
      )}
      {query.isError ? <Notice tone="error">{errorMessage(query.error)}</Notice> : null}
      {send.isError ? <Notice tone="error">{errorMessage(send.error)}</Notice> : null}
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
        <TextInput
          accessibilityLabel="Nachricht schreiben"
          placeholder="Nachricht schreiben"
          placeholderTextColor="#98a29b"
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={3000}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Senden"
          disabled={!draft.trim() || send.isPending}
          onPress={() => send.mutate(draft.trim())}
          style={[styles.send, (!draft.trim() || send.isPending) && { opacity: 0.45 }]}
        >
          <Ionicons name="send" size={20} color={colors.white} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: "84%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg, gap: 4 },
  mine: { alignSelf: "flex-end", backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 6 },
  time: { fontSize: 11.5, color: colors.muted, alignSelf: "flex-end" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 130,
    borderWidth: 1,
    borderColor: colors.input,
    borderRadius: radius.xl,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    color: colors.foreground,
  },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
});
