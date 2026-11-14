import * as ImagePicker from "expo-image-picker";
import * as React from "react";
import { ActionSheetIOS, Alert, Platform } from "react-native";

import { photoErrorMessage, uploadPhoto } from "@/lib/api";
import { errorMessage } from "@/lib/labels";

/**
 * Fotos aufnehmen oder aus der Mediathek wählen und hochladen – gemeinsam für den Editor
 * und das Bilderstudio. `remaining` ist die Zahl der noch erlaubten Fotos.
 */
export function usePhotoUpload({ propertyId, remaining, onChanged }: { propertyId: string; remaining: number; onChanged: () => void }) {
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(0);

  async function addPhotos(source: "library" | "camera") {
    const permission = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Zugriff nötig",
        source === "camera" ? "Bitte erlauben Sie den Zugriff auf die Kamera in den Einstellungen." : "Bitte erlauben Sie den Zugriff auf Ihre Fotos in den Einstellungen.",
      );
      return;
    }
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
    setError(null);
    setUploading(result.assets.length);
    let failed: string | null = null;
    for (const asset of result.assets) {
      try {
        await uploadPhoto(propertyId, { uri: asset.uri, mimeType: asset.mimeType, fileName: asset.fileName });
      } catch (uploadError) {
        failed = photoErrorMessage(uploadError) ?? errorMessage(uploadError);
      }
      setUploading((n) => Math.max(0, n - 1));
      onChanged();
    }
    setUploading(0);
    if (failed) setError(failed);
  }

  function choosePhotoSource() {
    if (remaining <= 0) {
      setError("Die Höchstzahl an Fotos ist erreicht.");
      return;
    }
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

  return { choosePhotoSource, uploading, error, setError };
}
