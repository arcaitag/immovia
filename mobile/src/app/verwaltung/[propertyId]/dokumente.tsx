import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as React from "react";
import { Alert, RefreshControl, ScrollView, Text, View } from "react-native";

import { Card, ChoiceChips, editorStyles } from "@/components/editor/shared";
import { Badge, Button, EmptyState, Loading, Notice } from "@/components/ui";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_VISIBILITY,
  deleteDocument,
  documentUrl,
  formatDate,
  formatFileSize,
  managedListing,
  ownerErrorMessage,
  propertyDocuments,
  setDocumentVisibility,
  type DocumentItem,
  type DocumentVisibility,
} from "@/lib/api-owner";
import { useAuth } from "@/lib/auth";
import { CONFIG } from "@/lib/config";
import { errorMessage } from "@/lib/labels";
import { colors, space, text } from "@/lib/theme";

type Message = { tone: "success" | "error"; text: string } | null;

const describe = (error: unknown) => ownerErrorMessage(error) ?? errorMessage(error);
const fileKind = (mime: string) => (mime === "application/pdf" ? "PDF" : mime.startsWith("image/") ? "Bild" : "Datei");

export default function DocumentsScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = React.useState<Message>(null);

  const managed = useQuery({ queryKey: ["managed-listing", propertyId], queryFn: () => managedListing(propertyId), enabled: Boolean(userId) });
  const documents = useQuery({ queryKey: ["property-documents", propertyId], queryFn: () => propertyDocuments(propertyId), enabled: Boolean(managed.data) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["property-documents", propertyId] });

  const visibilityOptions = (Object.keys(DOCUMENT_VISIBILITY) as DocumentVisibility[])
    // «Mein Team» gibt es nur für Immobilien eines Firmenkontos
    .filter((key) => key !== "organization" || Boolean(managed.data?.organizationId))
    .map((value) => ({ value, label: DOCUMENT_VISIBILITY[value].label }));

  const visibility = useMutation({
    mutationFn: (input: { id: string; visibility: DocumentVisibility }) => setDocumentVisibility(input.id, input.visibility),
    onSuccess: (_data, input) => {
      setMessage({ tone: "success", text: `Sichtbarkeit geändert: ${DOCUMENT_VISIBILITY[input.visibility].label}.` });
      refresh();
    },
    onError: (error) => {
      setMessage({ tone: "error", text: describe(error) });
      refresh();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => {
      setMessage({ tone: "success", text: "Das Dokument wurde gelöscht." });
      refresh();
    },
    onError: (error) => {
      setMessage({ tone: "error", text: describe(error) });
      refresh();
    },
  });

  const open = useMutation({
    mutationFn: async (id: string) => {
      await WebBrowser.openBrowserAsync(await documentUrl(id));
    },
    onError: (error) => setMessage({ tone: "error", text: describe(error) }),
  });

  function changeVisibility(doc: DocumentItem, next: DocumentVisibility) {
    if (next === doc.visibility) return;
    if (next !== "public") {
      visibility.mutate({ id: doc.id, visibility: next });
      return;
    }
    if (doc.contains_personal_data) {
      Alert.alert("Enthält Personendaten", "Dieses Dokument ist als «enthält Personendaten» markiert. Solche Dokumente werden nie öffentlich angezeigt.");
      return;
    }
    Alert.alert("Öffentlich im Inserat zeigen?", "Alle Besucher des veröffentlichten Inserats können das Dokument herunterladen.", [
      { text: "Abbrechen", style: "cancel" },
      { text: "Öffentlich zeigen", onPress: () => visibility.mutate({ id: doc.id, visibility: "public" }) },
    ]);
  }

  function confirmDelete(doc: DocumentItem) {
    Alert.alert("Dokument löschen?", `«${doc.title}» wird endgültig entfernt. Bestehende Freigaben an Interessenten enden damit.`, [
      { text: "Abbrechen", style: "cancel" },
      { text: "Löschen", style: "destructive", onPress: () => remove.mutate(doc.id) },
    ]);
  }

  const busy = visibility.isPending || remove.isPending;
  const website = () => void WebBrowser.openBrowserAsync(`${CONFIG.siteUrl}/dashboard/dokumente?immobilie=${propertyId}`);

  let body: React.ReactNode;
  if (!userId) {
    body = <EmptyState icon="lock-closed-outline" title="Bitte anmelden" description="Melden Sie sich an, um Ihre Dokumente zu sehen." />;
  } else if (managed.isPending || (managed.data && documents.isPending)) {
    body = <Loading />;
  } else if (managed.isError || documents.isError) {
    body = <Notice tone="error">{errorMessage(managed.error ?? documents.error)}</Notice>;
  } else if (!managed.data) {
    body = <EmptyState icon="home-outline" title="Nicht gefunden" description="Diese Immobilie gibt es nicht mehr oder sie gehört zu einem anderen Konto." />;
  } else {
    const items = documents.data ?? [];
    body = (
      <>
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        {items.length === 0 ? (
          <EmptyState
            icon="document-text-outline"
            title="Noch keine Dokumente"
            description="Grundrisse, Grundbuchauszug oder Nebenkostenabrechnung laden Sie auf der Website hoch. Danach können Sie hier die Sichtbarkeit steuern."
          />
        ) : null}
        {items.map((doc) => (
          <Card key={doc.id}>
            <View style={{ gap: 4 }}>
              <Text style={[text.body, { fontWeight: "700" }]}>{doc.title}</Text>
              <Text style={text.small}>
                {DOCUMENT_CATEGORIES[doc.category]} · {fileKind(doc.mime_type)} · {formatFileSize(doc.size_bytes)} · {formatDate(doc.created_at)}
              </Text>
              {doc.contains_personal_data ? <Badge tone="amber" label="Enthält Personendaten" /> : null}
            </View>
            <ChoiceChips label="Sichtbarkeit" options={visibilityOptions} value={doc.visibility} onChange={(value) => (value && !busy ? changeVisibility(doc, value) : undefined)} />
            <Text style={text.small}>{DOCUMENT_VISIBILITY[doc.visibility].description}</Text>
            <View style={editorStyles.two}>
              <Button
                title="Ansehen"
                variant="outline"
                icon="eye-outline"
                loading={open.isPending && open.variables === doc.id}
                disabled={open.isPending}
                onPress={() => open.mutate(doc.id)}
                style={{ flex: 1 }}
              />
              <Button
                title="Löschen"
                variant="destructive"
                icon="trash-outline"
                loading={remove.isPending && remove.variables === doc.id}
                disabled={busy}
                onPress={() => confirmDelete(doc)}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        ))}
        <Card>
          <Text style={text.body}>
            Neue Dokumente laden Sie auf der Website hoch. Dort ändern Sie auch Titel und Kategorie und geben Dokumente gezielt an einzelne Interessenten frei.
          </Text>
          <Button title="Dokumente auf der Website öffnen" variant="outline" icon="open-outline" onPress={website} />
        </Card>
      </>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 }}
      refreshControl={<RefreshControl refreshing={documents.isRefetching} onRefresh={() => void documents.refetch()} tintColor={colors.brand} />}
    >
      <Stack.Screen options={{ title: "Dokumente" }} />
      {body}
    </ScrollView>
  );
}
