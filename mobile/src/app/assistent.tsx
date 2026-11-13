import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as React from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AiConsentSheet } from "@/components/ai-consent-sheet";
import { EmptyState, Loading, Notice } from "@/components/ui";
import { AssistantError, latestAssistantThread, sendAssistantMessage, type AssistantMessage, type AssistantThread } from "@/lib/api-studio";
import { useAuth } from "@/lib/auth";
import { CONFIG } from "@/lib/config";
import { ApiError } from "@/lib/jobs";
import { errorMessage } from "@/lib/labels";
import { colors, radius, space, text } from "@/lib/theme";

// Beispielfragen wie auf der Website (src/lib/ai/prompts/assistant.ts)
const EXAMPLES = [
  "Wie kann ich meine Wohnung besser präsentieren?",
  "Welche Unterlagen benötige ich für den Verkauf?",
  "Kannst du meine Inseratebeschreibung verbessern?",
  "Welche Angaben fehlen noch?",
  "Wie bereite ich eine Besichtigung vor?",
] as const;

const MAX_LENGTH = 4000;

/**
 * KI-Assistent: ein laufendes Gespräch plus «Neues Gespräch».
 * Optionaler Parameter propertyId: Bezug zu einer eigenen Immobilie (gilt für neue Gespräche).
 */
export default function AssistantScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId?: string }>();
  const { userId } = useAuth();
  // Nur beim Öffnen laden; danach führt der Bildschirm den Stand selbst
  const query = useQuery({
    queryKey: ["assistant-thread", userId],
    queryFn: latestAssistantThread,
    enabled: Boolean(userId),
    staleTime: Infinity,
    gcTime: 0,
  });

  if (!userId) {
    return (
      <>
        <Stack.Screen options={{ title: "KI-Assistent" }} />
        <EmptyState icon="lock-closed-outline" title="Bitte anmelden" description="Melden Sie sich an, um den KI-Assistenten zu nutzen." />
      </>
    );
  }
  if (query.isPending) {
    return (
      <>
        <Stack.Screen options={{ title: "KI-Assistent" }} />
        <Loading />
      </>
    );
  }
  // Mit Bezug zu einer Immobilie nur dann das letzte Gespräch fortsetzen, wenn es dazu gehört
  const latest = query.data ?? null;
  const initial = latest && (!propertyId || latest.propertyId === propertyId) ? latest : null;
  return <Chat initial={initial} propertyId={propertyId ?? null} loadError={query.isError ? errorMessage(query.error) : null} />;
}

function Chat({ initial, propertyId, loadError }: { initial: AssistantThread | null; propertyId: string | null; loadError: string | null }) {
  const insets = useSafeAreaInsets();
  const [threadId, setThreadId] = React.useState<string | null>(initial?.threadId ?? null);
  const [messages, setMessages] = React.useState<AssistantMessage[]>(initial?.messages ?? []);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(loadError);
  const [consentFor, setConsentFor] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const counterRef = React.useRef(0);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  async function send(raw: string) {
    const message = raw.trim();
    if (!message || sending) return;
    counterRef.current += 1;
    const stamp = counterRef.current;
    const questionId = `local-user-${stamp}`;
    const answerId = `local-answer-${stamp}`;
    const controller = new AbortController();
    abortRef.current = controller;
    setNotice(null);
    setDraft("");
    setSending(true);
    setMessages((current) => [...current, { id: questionId, role: "user", content: message }, { id: answerId, role: "assistant", content: "", pending: true }]);
    const updateAnswer = (patch: Partial<AssistantMessage>) => setMessages((current) => current.map((m) => (m.id === answerId ? { ...m, ...patch } : m)));

    try {
      const reply = await sendAssistantMessage(
        { threadId, propertyId: threadId ? undefined : propertyId, message },
        { signal: controller.signal, onDelta: (content) => updateAnswer({ content }) },
      );
      if (reply.threadId) setThreadId(reply.threadId);
      updateAnswer({ content: reply.text, pending: false });
    } catch (error) {
      if (controller.signal.aborted) return;
      const failure = error instanceof ApiError ? error.message : errorMessage(error);
      if (error instanceof AssistantError && error.accepted) {
        // Frage ist gespeichert, nur die Antwort fehlt
        if (error.threadId) setThreadId(error.threadId);
        if (error.consentRequired) setConsentFor(message);
        updateAnswer({ content: failure, pending: false, error: true });
      } else {
        // Vom Server nicht angenommen: Eingabe zurückgeben
        setMessages((current) => current.filter((m) => m.id !== questionId && m.id !== answerId));
        setDraft(message);
        if (error instanceof ApiError && error.consentRequired) setConsentFor(message);
        else setNotice(failure);
      }
    } finally {
      if (!controller.signal.aborted) setSending(false);
    }
  }

  function newThread() {
    abortRef.current?.abort();
    abortRef.current = null;
    setSending(false);
    setThreadId(null);
    setMessages([]);
    setNotice(null);
  }

  const canSend = Boolean(draft.trim()) && !sending;
  const reversed = [...messages].reverse();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90} style={{ flex: 1, backgroundColor: colors.surface }}>
      <Stack.Screen
        options={{
          title: "KI-Assistent",
          headerRight: () =>
            messages.length > 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Neues Gespräch" onPress={newThread} hitSlop={8} style={styles.headerButton}>
                <Ionicons name="create-outline" size={22} color={colors.forest} />
              </Pressable>
            ) : null,
        }}
      />
      {messages.length === 0 ? (
        <FlatList
          data={EXAMPLES}
          keyExtractor={(item) => item}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: space.lg, gap: space.sm }}
          ListHeaderComponent={
            <View style={{ gap: space.sm, marginBottom: space.sm }}>
              <Text style={text.heading}>Wie kann ich helfen?</Text>
              <Text style={[text.body, { color: colors.muted }]}>
                Hilfe rund um Verkauf und Vermietung: Präsentation, Unterlagen, Texte und Besichtigungen. Der Assistent nutzt nur Ihre eigenen Angaben und
                gibt keine verbindliche Rechts-, Steuer- oder Finanzberatung.
              </Text>
              {propertyId ? (
                <Text style={text.small}>
                  Der Assistent kennt die erfassten Angaben dieser Immobilie, den Inseratsstatus und was noch fehlt – ohne Adresse und Kontaktdaten.
                </Text>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" onPress={() => void send(item)} disabled={sending} style={({ pressed }) => [styles.example, pressed && { backgroundColor: colors.mint100 }]}>
              <Text style={[text.body, { flex: 1, fontSize: 15 }]}>{item}</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.forest} />
            </Pressable>
          )}
          ListFooterComponent={
            <Pressable
              accessibilityRole="link"
              onPress={() => void WebBrowser.openBrowserAsync(`${CONFIG.siteUrl}/dashboard/assistent`)}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text style={{ fontSize: 14.5, fontWeight: "600", color: colors.primary }}>Frühere Gespräche auf der Website ansehen</Text>
            </Pressable>
          }
        />
      ) : (
        <FlatList
          inverted
          data={reversed}
          keyExtractor={(m) => m.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: space.lg, gap: space.sm }}
          renderItem={({ item }) => <Bubble message={item} />}
        />
      )}

      {notice ? (
        <View style={{ paddingHorizontal: space.md, paddingBottom: space.sm }}>
          <Notice tone="error">{notice}</Notice>
        </View>
      ) : null}
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm }}>
          <TextInput
            accessibilityLabel="Ihre Frage an den Assistenten"
            placeholder="Ihre Frage an den Assistenten …"
            placeholderTextColor="#98a29b"
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={MAX_LENGTH}
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Senden"
            accessibilityState={{ disabled: !canSend, busy: sending }}
            disabled={!canSend}
            onPress={() => void send(draft)}
            style={[styles.send, !canSend && { opacity: 0.45 }]}
          >
            {sending ? <ActivityIndicator color={colors.white} /> : <Ionicons name="send" size={20} color={colors.white} />}
          </Pressable>
        </View>
        <Text style={[text.small, { fontSize: 12 }]}>Der Assistent kann sich irren und ersetzt keine Rechts-, Steuer- oder Finanzberatung.</Text>
      </View>

      <AiConsentSheet
        visible={consentFor !== null}
        kind="text"
        onClose={() => setConsentFor(null)}
        onConsented={() => {
          const message = consentFor;
          setConsentFor(null);
          if (message) void send(message);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function Bubble({ message }: { message: AssistantMessage }) {
  if (message.role === "user") {
    return (
      <View style={[styles.bubble, styles.mine]}>
        <Text selectable style={[text.body, { color: colors.white }]}>
          {message.content}
        </Text>
      </View>
    );
  }
  if (message.error) {
    return (
      <View accessibilityRole="alert" style={[styles.bubble, styles.theirs, { borderColor: colors.destructive, backgroundColor: colors.destructiveBg }]}>
        <Text style={[text.body, { color: colors.destructive }]}>{message.content}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.bubble, styles.theirs]}>
      {message.content ? <MarkdownText content={message.content} /> : null}
      {message.pending ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <ActivityIndicator size="small" color={colors.brand} />
          <Text style={text.small}>{message.content ? "Antwort wird geschrieben …" : "Antwort wird erstellt …"}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Einfache Darstellung der Markdown-Antworten: Überschriften, Aufzählungen und Fettdruck. */
function MarkdownText({ content }: { content: string }) {
  const lines = content.replace(/\r/g, "").split("\n");
  return (
    <View style={{ gap: 4 }}>
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <View key={index} style={{ height: 4 }} />;
        const heading = /^#{1,6}\s+(.*)$/.exec(trimmed);
        if (heading) {
          return (
            <Text key={index} selectable accessibilityRole="header" style={[text.body, { fontWeight: "700" }]}>
              {inline(heading[1])}
            </Text>
          );
        }
        const bullet = /^([-*•]|\d+[.)])\s+(.*)$/.exec(trimmed);
        if (bullet) {
          return (
            <View key={index} style={{ flexDirection: "row", gap: 8 }}>
              <Text style={text.body}>{/^\d/.test(bullet[1]) ? bullet[1] : "•"}</Text>
              <Text selectable style={[text.body, { flex: 1 }]}>
                {inline(bullet[2])}
              </Text>
            </View>
          );
        }
        return (
          <Text key={index} selectable style={text.body}>
            {inline(trimmed)}
          </Text>
        );
      })}
    </View>
  );
}

/** **fett** hervorheben; übrige Auszeichnung (`code`, *kursiv*) als Text ohne Zeichen. */
function inline(value: string): React.ReactNode[] {
  return value.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <Text key={index} style={{ fontWeight: "700" }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return part.replace(/`([^`]+)`/g, "$1").replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:!?]|$)/g, "$1$2");
  });
}

const styles = StyleSheet.create({
  headerButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  example: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  bubble: { maxWidth: "90%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg, gap: 6 },
  mine: { alignSelf: "flex-end", backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 6 },
  composer: {
    gap: 6,
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
