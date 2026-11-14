import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as React from "react";
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Card, editorStyles } from "@/components/editor/shared";
import { Badge, Button, Field, Loading, Notice, SectionTitle, ToggleRow } from "@/components/ui";
import { deletePhoto, photoErrorMessage, setCoverPhoto, uploadPhoto, type ImageRow } from "@/lib/api";
import { CAPTION_MAX, reorderPhotos, updatePhotoDetails } from "@/lib/api-owner";
import { imageUrl } from "@/lib/format";
import { errorMessage } from "@/lib/labels";
import { colors, radius, space, text } from "@/lib/theme";

/** Fotos: hochladen, Titelbild, Bildunterschrift, Grundriss, Reihenfolge, löschen. */
export function PhotosSection({
  propertyId,
  images,
  minImages,
  maxImages,
  onChanged,
}: {
  propertyId: string;
  images: ImageRow[];
  minImages: number;
  maxImages: number;
  onChanged: () => void;
}) {
  const [error, onError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(0);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [caption, setCaption] = React.useState("");
  const [working, setWorking] = React.useState(false);

  const selected = images.find((image) => image.id === selectedId) ?? null;
  const selectedIndex = selected ? images.indexOf(selected) : -1;
  const remaining = Math.max(0, maxImages - images.length);

  function select(image: ImageRow) {
    if (selectedId === image.id) {
      setSelectedId(null);
      return;
    }
    setSelectedId(image.id);
    setCaption(image.caption ?? "");
  }

  async function run(task: () => Promise<void>) {
    onError(null);
    setWorking(true);
    try {
      await task();
      onChanged();
    } catch (error) {
      onError(errorMessage(error));
    } finally {
      setWorking(false);
    }
  }

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
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.9,
            allowsMultipleSelection: true,
            selectionLimit: Math.min(10, Math.max(1, remaining)),
            // iPhone-Fotos liegen als HEIC vor; «compatible» lässt iOS sie als JPEG liefern
            preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
          });
    if (result.canceled) return;
    onError(null);
    setUploading(result.assets.length);
    let failed: string | null = null;
    for (const asset of result.assets) {
      try {
        await uploadPhoto(propertyId, { uri: asset.uri, mimeType: asset.mimeType, fileName: asset.fileName });
      } catch (error) {
        failed = photoErrorMessage(error) ?? errorMessage(error);
      }
      setUploading((n) => Math.max(0, n - 1));
      onChanged();
    }
    setUploading(0);
    if (failed) onError(failed);
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

  function move(delta: -1 | 1) {
    if (!selected) return;
    const target = selectedIndex + delta;
    if (target < 0 || target >= images.length) return;
    const ids = images.map((image) => image.id);
    [ids[selectedIndex], ids[target]] = [ids[target]!, ids[selectedIndex]!];
    void run(() => reorderPhotos(images, ids));
  }

  function confirmDelete(image: ImageRow) {
    Alert.alert("Foto löschen?", "Das Foto wird endgültig entfernt.", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Löschen",
        style: "destructive",
        onPress: () =>
          void run(async () => {
            await deletePhoto(propertyId, image.id);
            setSelectedId(null);
            // Wie auf der Website: Das nächste fertige Bild wird Titelbild
            const next = image.is_cover ? images.find((other) => other.id !== image.id && other.status === "ready") : null;
            if (next) await setCoverPhoto(next.id);
          }),
      },
    ]);
  }

  const captionChanged = selected ? caption.trim() !== (selected.caption ?? "") : false;

  return (
    <Card>
      <SectionTitle>Fotos</SectionTitle>
      <Text style={text.small}>
        {minImages > 1 ? `Mindestens ${minImages} Fotos` : "Mindestens ein Foto"}, höchstens {maxImages}. Das Titelbild erscheint in der Suche. Standortdaten werden aus
        den Fotos entfernt. Tippen Sie auf ein Foto, um es zu bearbeiten.
      </Text>
      <View style={styles.grid}>
        {images.map((image, index) => {
          const src = imageUrl(image, "sm");
          const isSelected = image.id === selectedId;
          return (
            <Pressable
              key={image.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Foto ${index + 1}${image.is_cover ? ", Titelbild" : ""}${image.is_floor_plan ? ", Grundriss" : ""}, bearbeiten`}
              onPress={() => select(image)}
              style={[styles.photo, isSelected && styles.photoSelected]}
            >
              {src ? <Image source={src} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              <View style={styles.badgesTop}>
                {image.is_cover ? <Badge tone="dark" label="Titelbild" /> : null}
                {image.is_floor_plan ? <Badge tone="dark" label="Grundriss" /> : null}
              </View>
              {image.status === "review" ? (
                <View style={styles.badgeBottom}>
                  <Badge tone="blue" label="KI: Prüfung offen" />
                </View>
              ) : image.is_ai_visualization ? (
                <View style={styles.badgeBottom}>
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
        {remaining > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Foto hinzufügen"
            disabled={uploading > 0}
            onPress={choosePhotoSource}
            style={[styles.photo, styles.addPhoto, uploading > 0 && { opacity: 0.5 }]}
          >
            <Ionicons name="camera-outline" size={26} color={colors.forest} />
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.forest }}>Hinzufügen</Text>
          </Pressable>
        ) : null}
      </View>

      {selected ? (
        <View style={styles.panel}>
          <Text style={text.label}>
            Foto {selectedIndex + 1} von {images.length}
          </Text>
          <Field
            label="Bildunterschrift"
            value={caption}
            onChangeText={setCaption}
            maxLength={CAPTION_MAX}
            placeholder="z. B. Wohnzimmer mit Balkonzugang"
            returnKeyType="done"
          />
          {captionChanged ? (
            <Button
              title="Bildunterschrift speichern"
              variant="outline"
              loading={working}
              onPress={() => void run(() => updatePhotoDetails(selected.id, { caption: caption.trim() || null }))}
            />
          ) : null}
          <ToggleRow
            label="Grundriss"
            hint="Grundrisse werden im Inserat als solche gekennzeichnet."
            value={selected.is_floor_plan}
            onValueChange={(value) => void run(() => updatePhotoDetails(selected.id, { is_floor_plan: value }))}
          />
          <View style={editorStyles.two}>
            <Button title="Nach vorne" icon="arrow-back" variant="outline" disabled={working || selectedIndex <= 0} onPress={() => move(-1)} style={{ flex: 1 }} />
            <Button
              title="Nach hinten"
              icon="arrow-forward"
              variant="outline"
              disabled={working || selectedIndex >= images.length - 1}
              onPress={() => move(1)}
              style={{ flex: 1 }}
            />
          </View>
          {!selected.is_cover && selected.status === "ready" ? (
            <Button title="Als Titelbild festlegen" icon="star-outline" variant="outline" disabled={working} onPress={() => void run(() => setCoverPhoto(selected.id))} />
          ) : null}
          <Button title="Foto löschen" icon="trash-outline" variant="destructive" disabled={working} onPress={() => confirmDelete(selected)} />
        </View>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  photo: { width: "31.5%", aspectRatio: 1, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.mutedBg },
  photoSelected: { borderWidth: 3, borderColor: colors.brand },
  addPhoto: { alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.brand, backgroundColor: colors.mint100 },
  badgesTop: { position: "absolute", left: 6, top: 6, gap: 4 },
  badgeBottom: { position: "absolute", left: 6, bottom: 6 },
  panel: { gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});
