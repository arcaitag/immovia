import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";

import {
  buildListingInput,
  buildPropertyPatch,
  initialListingForm,
  initialPropertyForm,
  publicAddressPreview,
  type ListingForm,
  type PropertyForm,
} from "@/components/editor/form";
import { ListingSection } from "@/components/editor/listing-section";
import { PhotosSection } from "@/components/editor/photos-section";
import { PropertySection } from "@/components/editor/property-section";
import { Card } from "@/components/editor/shared";
import { StatusSection, confirmStatusAction, statusContext } from "@/components/editor/status-section";
import { ToolsSection } from "@/components/editor/tools-section";
import { Badge, Button, EmptyState, Loading, Notice } from "@/components/ui";
import { propertyWorkspace, type PropertyWorkspace } from "@/lib/api";
import {
  changeListingStatus,
  createDraftListing,
  editorExtras,
  isPublicStatus,
  isStatusActionAvailable,
  listingTextsSignature,
  ownerBadges,
  ownerErrorMessage,
  saveListing,
  savePropertyDetails,
  softDeleteProperty,
  statusActionCopy,
  syncDraftStatus,
  type EditorExtras,
  type StatusAction,
} from "@/lib/api-owner";
import { useAuth } from "@/lib/auth";
import { LISTING_STATUS, PROPERTY_TYPES, errorMessage } from "@/lib/labels";
import { colors, space, text } from "@/lib/theme";

type Message = { tone: "success" | "error"; text: string } | null;

const describe = (error: unknown) => ownerErrorMessage(error) ?? errorMessage(error);

export default function PropertyEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const [message, setMessage] = React.useState<Message>(null);
  const query = useQuery({ queryKey: ["workspace", id], queryFn: () => propertyWorkspace(id), enabled: Boolean(userId) });
  const listingId = query.data?.listing.id;
  const extras = useQuery({
    queryKey: ["editor-extras", id, listingId],
    queryFn: () => editorExtras(id, listingId!),
    enabled: Boolean(userId && listingId),
  });

  // Nach der Rückkehr aus einem Werkzeug (z. B. KI-Texte) den aktuellen Stand laden
  const refetch = query.refetch;
  useFocusEffect(
    React.useCallback(() => {
      if (userId) void refetch();
    }, [userId, refetch]),
  );

  if (!userId) return <EmptyState icon="lock-closed-outline" title="Bitte anmelden" description="Melden Sie sich an, um Ihr Inserat zu bearbeiten." />;
  if (query.isPending) return <Loading />;
  if (query.isError) return <View style={{ padding: space.lg }}><Notice tone="error">{errorMessage(query.error)}</Notice></View>;
  if (!query.data) return <EmptyState icon="home-outline" title="Nicht gefunden" description="Diese Immobilie gibt es nicht mehr oder sie gehört zu einem anderen Konto." />;
  if (extras.isPending) return <Loading />;
  if (extras.isError) return <View style={{ padding: space.lg }}><Notice tone="error">{errorMessage(extras.error)}</Notice></View>;

  const { listing } = query.data;
  // Ändern sich Texte oder Preis ausserhalb des Formulars (z. B. durch übernommene KI-Texte), wird es neu aufgebaut
  const formKey = `${listing.id}|${listingTextsSignature(listing)}|${listing.price ?? ""}|${listing.price_on_request}`;
  return <Editor key={formKey} workspace={query.data} extras={extras.data} message={message} setMessage={setMessage} />;
}

function Editor({
  workspace,
  extras,
  message,
  setMessage,
}: {
  workspace: PropertyWorkspace;
  extras: EditorExtras;
  message: Message;
  setMessage: (message: Message) => void;
}) {
  const { property, listing, images } = workspace;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const archived = listing.status === "archived";

  const [propertyForm, setPropertyForm] = React.useState<PropertyForm>(() => initialPropertyForm(property, extras.features));
  const [listingForm, setListingForm] = React.useState<ListingForm>(() => initialListingForm(listing, extras.contact));

  const badges = useQuery({ queryKey: ["owner-badges", listing.id], queryFn: () => ownerBadges([listing.id]) });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["workspace", property.id] });
    queryClient.invalidateQueries({ queryKey: ["editor-extras", property.id] });
    queryClient.invalidateQueries({ queryKey: ["my-properties"] });
  };

  async function saveAll(): Promise<void> {
    // Zuerst alles prüfen, erst dann schreiben
    const patch = buildPropertyPatch(propertyForm, property, listing.offer_type);
    const input = buildListingInput(listingForm, listing);
    await savePropertyDetails(property, patch, propertyForm.features);
    await saveListing(listing, input);
    await syncDraftStatus(listing.id, property.id);
  }

  const save = useMutation({
    mutationFn: saveAll,
    onSuccess: () => {
      setMessage({ tone: "success", text: "Gespeichert." });
      refresh();
    },
    onError: (error) => {
      setMessage({ tone: "error", text: describe(error) });
      refresh();
    },
  });

  const status = useMutation({
    mutationFn: async (action: StatusAction) => {
      // Vor dem Veröffentlichen den aktuellen Stand des Formulars sichern
      if (action === "publish" || action === "resume") await saveAll();
      return changeListingStatus(listing.id, action);
    },
    onSuccess: (result) => {
      setMessage({ tone: "success", text: result.copy.success });
      refresh();
      queryClient.invalidateQueries({ queryKey: ["search"] });
    },
    onError: (error) => {
      setMessage({ tone: "error", text: describe(error) });
      refresh();
    },
  });

  const newListing = useMutation({
    mutationFn: () => createDraftListing(property.id, session?.user.email ?? null),
    onSuccess: () => {
      setMessage({ tone: "success", text: "Ein neues Inserat wurde angelegt." });
      refresh();
    },
    onError: (error) => setMessage({ tone: "error", text: describe(error) }),
  });

  const remove = useMutation({
    mutationFn: () => softDeleteProperty(property.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-properties"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
      router.back();
    },
    onError: (error) => setMessage({ tone: "error", text: describe(error) }),
  });

  function confirmDelete() {
    Alert.alert(
      "Immobilie löschen?",
      isPublicStatus(listing.status)
        ? "Die Immobilie wird mit Inserat, Fotos und Texten entfernt. Das Inserat ist danach nicht mehr öffentlich sichtbar. Das lässt sich nicht rückgängig machen."
        : "Die Immobilie wird mit Inserat, Fotos und Texten entfernt. Das lässt sich nicht rückgängig machen.",
      [
        { text: "Abbrechen", style: "cancel" },
        { text: "Löschen", style: "destructive", onPress: () => remove.mutate() },
      ],
    );
  }

  const statusInfo = LISTING_STATUS[listing.status];
  const ctx = statusContext(listing, extras.publishing.requireReview);
  const canPublish = isStatusActionAvailable("publish", ctx);
  const publishCopy = statusActionCopy("publish", ctx);
  const busy = save.isPending || status.isPending || newListing.isPending || remove.isPending;
  const address = [[property.street, property.house_number].filter(Boolean).join(" "), [property.postal_code, property.municipality].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const publicAddress = publicAddressPreview(property, listingForm.location_precision);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 }} keyboardShouldPersistTaps="handled">
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md }}>
            <Badge label={statusInfo.label} tone={statusInfo.tone} />
            {isPublicStatus(listing.status) && listing.slug ? (
              <Text
                accessibilityRole="link"
                style={{ color: colors.primary, fontWeight: "600", fontSize: 15, paddingVertical: 12 }}
                onPress={() => router.push({ pathname: "/inserat/[slug]", params: { slug: listing.slug! } })}
              >
                Inserat ansehen
              </Text>
            ) : null}
          </View>
          <Text style={text.heading}>
            {PROPERTY_TYPES[property.property_type]} {listing.offer_type === "rent" ? "zu vermieten" : "zu verkaufen"}
          </Text>
          <Text style={text.small}>
            {address ? `${address} · ` : ""}Im Inserat erscheint: {publicAddress || "noch keine Adresse erfasst"}.
          </Text>
        </Card>

        {archived ? (
          <Card>
            <Text style={text.body}>
              Dieses Inserat ist archiviert und kann nicht mehr bearbeitet oder aktiviert werden. Für die Immobilie können Sie ein neues Inserat erstellen; Objektdaten und
              Fotos bleiben erhalten.
            </Text>
            <Button title="Neues Inserat erstellen" icon="add" onPress={() => newListing.mutate()} loading={newListing.isPending} disabled={busy} />
          </Card>
        ) : null}

        <ToolsSection propertyId={property.id} badges={badges.data?.[listing.id] ?? null} />

        {!archived ? (
          <>
            <PhotosSection
              propertyId={property.id}
              images={images}
              minImages={extras.publishing.minImages}
              maxImages={extras.publishing.maxImages}
              onChanged={refresh}
            />
            <PropertySection property={property} offer={listing.offer_type} form={propertyForm} onChange={(patch) => setPropertyForm((form) => ({ ...form, ...patch }))} />
            <ListingSection property={property} listing={listing} form={listingForm} onChange={(patch) => setListingForm((form) => ({ ...form, ...patch }))} />
          </>
        ) : null}

        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

        {!archived ? (
          <>
            <Button title="Speichern" variant={canPublish ? "outline" : "primary"} onPress={() => save.mutate()} loading={save.isPending} disabled={busy} />
            {canPublish ? (
              <Button
                title={publishCopy.confirmLabel === "Einreichen" ? "Speichern und zur Prüfung einreichen" : "Speichern und veröffentlichen"}
                icon="rocket-outline"
                onPress={() => confirmStatusAction("publish", ctx, (action) => status.mutate(action))}
                loading={status.isPending && status.variables === "publish"}
                disabled={busy}
              />
            ) : null}
            <StatusSection
              listing={listing}
              requireReview={extras.publishing.requireReview}
              busy={busy}
              pendingAction={status.isPending ? (status.variables ?? null) : null}
              onAction={(action) => status.mutate(action)}
            />
          </>
        ) : null}

        <Button title="Immobilie löschen" variant="destructive" icon="trash-outline" onPress={confirmDelete} loading={remove.isPending} disabled={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
