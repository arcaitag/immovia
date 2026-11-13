import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { ActionSheetIOS, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Badge, Button, Chip, EmptyState, Field, Loading, Notice, SectionTitle, ToggleRow } from "@/components/ui";
import {
  deletePhoto,
  photoErrorMessage,
  propertyWorkspace,
  saveListingContent,
  setCoverPhoto,
  setListingStatus,
  updateProperty,
  uploadPhoto,
  type ImageRow,
  type PropertyWorkspace,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { imageUrl, parseNumber } from "@/lib/format";
import { CONDITIONS, LISTING_STATUS, PROPERTY_TYPES, errorMessage } from "@/lib/labels";
import type { Enums } from "@/lib/supabase";
import { colors, radius, space, text } from "@/lib/theme";

const AMENITIES = [
  ["has_balcony", "Balkon"],
  ["has_terrace", "Terrasse"],
  ["has_garden", "Garten"],
  ["has_elevator", "Lift"],
  ["has_garage", "Garage"],
  ["has_cellar", "Keller"],
] as const;
type AmenityKey = (typeof AMENITIES)[number][0];

const str = (value: number | null) => (value === null ? "" : String(value));

export default function PropertyEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const query = useQuery({ queryKey: ["workspace", id], queryFn: () => propertyWorkspace(id), enabled: Boolean(userId) });

  if (!userId) return <EmptyState icon="lock-closed-outline" title="Bitte anmelden" description="Melden Sie sich an, um Ihr Inserat zu bearbeiten." />;
  if (query.isPending) return <Loading />;
  if (query.isError) return <View style={{ padding: space.lg }}><Notice tone="error">{errorMessage(query.error)}</Notice></View>;
  if (!query.data) return <EmptyState icon="home-outline" title="Nicht gefunden" description="Diese Immobilie gibt es nicht mehr oder sie gehört zu einem anderen Konto." />;
  return <Editor key={query.data.listing.id} workspace={query.data} />;
}

function Editor({ workspace }: { workspace: PropertyWorkspace }) {
  const { property, listing, images } = workspace;
  const router = useRouter();
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["workspace", property.id] });
    queryClient.invalidateQueries({ queryKey: ["my-properties"] });
  };

  // --- Objektdaten ---
  const [rooms, setRooms] = React.useState(str(property.rooms));
  const [livingArea, setLivingArea] = React.useState(str(property.living_area));
  const [plotArea, setPlotArea] = React.useState(str(property.plot_area));
  const [yearBuilt, setYearBuilt] = React.useState(str(property.year_built));
  const [floor, setFloor] = React.useState(str(property.floor));
  const [condition, setCondition] = React.useState<Enums<"property_condition"> | null>(property.condition);
  const [amenities, setAmenities] = React.useState<Record<AmenityKey, boolean>>(
    () => Object.fromEntries(AMENITIES.map(([key]) => [key, property[key]])) as Record<AmenityKey, boolean>,
  );

  // --- Inserat ---
  const [title, setTitle] = React.useState(listing.title ?? "");
  const [shortDescription, setShortDescription] = React.useState(listing.short_description ?? "");
  const [description, setDescription] = React.useState(listing.description ?? "");
  const [price, setPrice] = React.useState(str(listing.price));
  const [priceOnRequest, setPriceOnRequest] = React.useState(listing.price_on_request);
  const [additionalCosts, setAdditionalCosts] = React.useState(str(listing.additional_costs));
  const [confirmed, setConfirmed] = React.useState(Boolean(listing.texts_confirmed_at));

  const [message, setMessage] = React.useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [uploading, setUploading] = React.useState(0);

  async function saveAll(): Promise<void> {
    const roomsValue = parseNumber(rooms);
    if (roomsValue !== null && (roomsValue < 0.5 || roomsValue > 50 || (roomsValue * 2) % 1 !== 0)) {
      throw new Error("local:Zimmer bitte in halben Schritten angeben, z. B. 3.5.");
    }
    const yearValue = parseNumber(yearBuilt);
    if (yearValue !== null && (yearValue < 1300 || yearValue > new Date().getFullYear() + 5)) throw new Error("local:Bitte prüfen Sie das Baujahr.");
    const priceValue = parseNumber(price);
    if (priceValue !== null && priceValue <= 0) throw new Error("local:Der Preis muss grösser als 0 sein.");
    if (title.trim().length > 140) throw new Error("local:Der Titel darf höchstens 140 Zeichen lang sein.");

    await updateProperty(property.id, {
      rooms: roomsValue,
      living_area: parseNumber(livingArea),
      plot_area: parseNumber(plotArea),
      year_built: yearValue,
      floor: parseNumber(floor),
      condition,
      ...amenities,
    });
    await saveListingContent(listing, {
      title: title.trim() || null,
      short_description: shortDescription.trim() || null,
      description: description.trim() || null,
      price: priceValue,
      price_on_request: priceOnRequest,
      additional_costs: parseNumber(additionalCosts),
      texts_confirmed: confirmed,
    });
  }

  const describe = (error: unknown) => {
    const raw = error instanceof Error ? error.message : "";
    return raw.startsWith("local:") ? raw.slice(6) : errorMessage(error);
  };

  const save = useMutation({
    mutationFn: saveAll,
    onSuccess: () => {
      setMessage({ tone: "success", text: "Gespeichert." });
      refresh();
    },
    onError: (error) => setMessage({ tone: "error", text: describe(error) }),
  });

  const status = useMutation({
    mutationFn: async (target: Enums<"listing_status">) => {
      if (target === "published") await saveAll();
      await setListingStatus(listing.id, target);
      return target;
    },
    onSuccess: (target) => {
      setMessage({
        tone: "success",
        text: target === "published" ? "Ihr Inserat ist veröffentlicht und ab sofort in der Suche sichtbar." : "Das Inserat ist pausiert und nicht mehr öffentlich sichtbar.",
      });
      refresh();
      queryClient.invalidateQueries({ queryKey: ["search"] });
    },
    onError: (error) => {
      setMessage({ tone: "error", text: describe(error) });
      refresh();
    },
  });

  async function addPhotos(source: "library" | "camera") {
    const permission = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Zugriff nötig",
        source === "camera" ? "Bitte erlauben Sie den Zugriff auf die Kamera in den Einstellungen." : "Bitte erlauben Sie den Zugriff auf Ihre Fotos in den Einstellungen.",
      );
      return;
    }
    // quality < 1: iOS liefert JPEG statt HEIC
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9, allowsMultipleSelection: true, selectionLimit: 10 });
    if (result.canceled) return;
    setMessage(null);
    setUploading(result.assets.length);
    let failed: string | null = null;
    for (const asset of result.assets) {
      try {
        await uploadPhoto(property.id, { uri: asset.uri, mimeType: asset.mimeType });
      } catch (error) {
        failed = photoErrorMessage(error) ?? errorMessage(error);
      }
      setUploading((n) => Math.max(0, n - 1));
      refresh();
    }
    setUploading(0);
    if (failed) setMessage({ tone: "error", text: failed });
  }

  function choosePhotoSource() {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ options: ["Abbrechen", "Foto aufnehmen", "Aus Fotos wählen"], cancelButtonIndex: 0 }, (i) => {
        if (i === 1) void addPhotos("camera");
        if (i === 2) void addPhotos("library");
      });
    } else {
      Alert.alert("Foto hinzufügen", undefined, [
        { text: "Foto aufnehmen", onPress: () => void addPhotos("camera") },
        { text: "Aus Fotos wählen", onPress: () => void addPhotos("library") },
        { text: "Abbrechen", style: "cancel" },
      ]);
    }
  }

  function photoActions(image: ImageRow) {
    Alert.alert("Foto", undefined, [
      ...(image.is_cover || image.status !== "ready"
        ? []
        : [{ text: "Als Titelbild festlegen", onPress: () => void setCoverPhoto(image.id).then(refresh).catch((e) => setMessage({ tone: "error", text: errorMessage(e) })) }]),
      {
        text: "Löschen",
        style: "destructive" as const,
        onPress: () =>
          Alert.alert("Foto löschen?", "Das Foto wird endgültig entfernt.", [
            { text: "Abbrechen", style: "cancel" },
            { text: "Löschen", style: "destructive", onPress: () => void deletePhoto(property.id, image.id).then(refresh).catch((e) => setMessage({ tone: "error", text: errorMessage(e) })) },
          ]),
      },
      { text: "Abbrechen", style: "cancel" as const },
    ]);
  }

  const statusInfo = LISTING_STATUS[listing.status];
  const isPublic = listing.status === "published" || listing.status === "reserved";
  const canPublish = ["draft", "in_progress", "ready", "paused"].includes(listing.status);
  const busy = save.isPending || status.isPending;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 }} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md }}>
            <Badge label={statusInfo.label} tone={statusInfo.tone} />
            {isPublic && listing.slug ? (
              <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 15 }} onPress={() => router.push({ pathname: "/inserat/[slug]", params: { slug: listing.slug! } })}>
                Inserat ansehen
              </Text>
            ) : null}
          </View>
          <Text style={text.heading}>
            {PROPERTY_TYPES[property.property_type]} {listing.offer_type === "rent" ? "zu vermieten" : "zu verkaufen"}
          </Text>
          <Text style={text.small}>
            {[[property.street, property.house_number].filter(Boolean).join(" "), [property.postal_code, property.municipality].filter(Boolean).join(" ")]
              .filter(Boolean)
              .join(", ")}{" "}
            · Öffentlich erscheinen nur PLZ und Ort.
          </Text>
        </View>

        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

        <View style={styles.card}>
          <SectionTitle>Fotos</SectionTitle>
          <Text style={text.small}>Mindestens ein Foto. Das Titelbild erscheint in der Suche. Standortdaten werden aus den Fotos entfernt.</Text>
          <View style={styles.grid}>
            {images.map((image) => {
              const src = imageUrl(image, "sm");
              return (
                <Pressable key={image.id} accessibilityRole="button" accessibilityLabel={image.is_cover ? "Titelbild, Optionen" : "Foto, Optionen"} onPress={() => photoActions(image)} style={styles.photo}>
                  {src ? <Image source={src} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                  {image.is_cover ? (
                    <View style={{ position: "absolute", left: 6, top: 6 }}>
                      <Badge tone="dark" label="Titelbild" />
                    </View>
                  ) : null}
                  {image.status === "review" ? (
                    <View style={{ position: "absolute", left: 6, bottom: 6 }}>
                      <Badge tone="blue" label="KI: Prüfung offen" />
                    </View>
                  ) : image.is_ai_visualization ? (
                    <View style={{ position: "absolute", left: 6, bottom: 6 }}>
                      <Badge tone="amber" label="KI" />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
            {Array.from({ length: uploading }).map((_, i) => (
              <View key={`up-${i}`} style={[styles.photo, { alignItems: "center", justifyContent: "center" }]}>
                <Loading />
              </View>
            ))}
            <Pressable accessibilityRole="button" accessibilityLabel="Foto hinzufügen" disabled={uploading > 0} onPress={choosePhotoSource} style={[styles.photo, styles.addPhoto, uploading > 0 && { opacity: 0.5 }]}>
              <Ionicons name="camera-outline" size={26} color={colors.forest} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.forest }}>Hinzufügen</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <SectionTitle>Objektdaten</SectionTitle>
          <View style={styles.two}>
            <View style={{ flex: 1 }}>
              <Field label="Zimmer" value={rooms} onChangeText={setRooms} keyboardType="decimal-pad" placeholder="z. B. 3.5" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Wohnfläche (m²)" value={livingArea} onChangeText={setLivingArea} keyboardType="number-pad" />
            </View>
          </View>
          <View style={styles.two}>
            <View style={{ flex: 1 }}>
              <Field label="Baujahr" value={yearBuilt} onChangeText={setYearBuilt} keyboardType="number-pad" maxLength={4} />
            </View>
            <View style={{ flex: 1 }}>
              {property.property_type === "apartment" || property.property_type === "office" ? (
                <Field label="Etage" value={floor} onChangeText={setFloor} keyboardType="numbers-and-punctuation" placeholder="0 = Erdgeschoss" />
              ) : (
                <Field label="Grundstück (m²)" value={plotArea} onChangeText={setPlotArea} keyboardType="number-pad" />
              )}
            </View>
          </View>
          <Text style={text.label}>Zustand</Text>
          <View style={styles.wrap}>
            {(Object.keys(CONDITIONS) as Enums<"property_condition">[]).map((c) => (
              <Chip key={c} label={CONDITIONS[c]} selected={condition === c} onPress={() => setCondition(condition === c ? null : c)} />
            ))}
          </View>
          <Text style={text.label}>Ausstattung</Text>
          <View style={styles.wrap}>
            {AMENITIES.map(([key, label]) => (
              <Chip key={key} label={label} selected={amenities[key]} onPress={() => setAmenities((a) => ({ ...a, [key]: !a[key] }))} />
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <SectionTitle>Preis</SectionTitle>
          <ToggleRow label="Preis auf Anfrage" value={priceOnRequest} onValueChange={setPriceOnRequest} />
          {!priceOnRequest ? (
            <Field label={listing.offer_type === "rent" ? "Miete pro Monat (CHF)" : "Kaufpreis (CHF)"} value={price} onChangeText={setPrice} keyboardType="number-pad" />
          ) : null}
          {listing.offer_type === "rent" ? (
            <Field label="Nebenkosten pro Monat (CHF)" value={additionalCosts} onChangeText={setAdditionalCosts} keyboardType="number-pad" />
          ) : null}
        </View>

        <View style={styles.card}>
          <SectionTitle>Texte</SectionTitle>
          <Field label="Titel" value={title} onChangeText={setTitle} maxLength={140} placeholder="z. B. Helle 3.5-Zimmer-Wohnung mit Balkon" />
          <Field label="Kurzbeschreibung" value={shortDescription} onChangeText={setShortDescription} maxLength={300} multiline style={{ minHeight: 80 }} />
          <Field label="Beschreibung" value={description} onChangeText={setDescription} multiline maxLength={6000} hint="Beschreiben Sie Räume, Zustand und Besonderheiten." />
          <ToggleRow
            label="Ich bestätige, dass die Angaben stimmen"
            hint="Nötig für die Veröffentlichung. Nach Textänderungen bitte neu bestätigen."
            value={confirmed}
            onValueChange={setConfirmed}
          />
        </View>

        <Button title="Speichern" variant={canPublish ? "outline" : "primary"} onPress={() => save.mutate()} loading={save.isPending} disabled={busy} />
        {canPublish ? (
          <Button
            title={listing.status === "paused" ? "Wieder veröffentlichen" : "Speichern und veröffentlichen"}
            icon="rocket-outline"
            onPress={() =>
              Alert.alert("Inserat veröffentlichen?", "Das Inserat ist danach für alle in der Suche sichtbar.", [
                { text: "Abbrechen", style: "cancel" },
                { text: "Veröffentlichen", onPress: () => status.mutate("published") },
              ])
            }
            loading={status.isPending}
            disabled={busy}
          />
        ) : null}
        {listing.status === "published" ? (
          <Button title="Inserat pausieren" variant="outline" icon="pause-outline" onPress={() => status.mutate("paused")} loading={status.isPending} disabled={busy} />
        ) : null}
        <Text style={[text.small, { textAlign: "center" }]}>
          Bewertung, Verkaufsdossier, KI-Texte, Bilderstudio und Besichtigungen finden Sie auf der Website im Dashboard.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md, padding: space.lg, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  photo: { width: "31.5%", aspectRatio: 1, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.mutedBg },
  addPhoto: { alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.brand, backgroundColor: colors.mint100 },
  two: { flexDirection: "row", gap: space.md },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
