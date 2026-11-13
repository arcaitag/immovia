import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";

import { Button, Chip, Field, Notice, SectionTitle } from "@/components/ui";
import { createProperty } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { CANTONS, PROPERTY_TYPES, errorMessage } from "@/lib/labels";
import type { Enums } from "@/lib/supabase";
import { colors, space, text } from "@/lib/theme";

export default function NewPropertyScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [offer, setOffer] = React.useState<Enums<"offer_type">>("sale");
  const [type, setType] = React.useState<Enums<"property_type">>("apartment");
  const [street, setStreet] = React.useState("");
  const [houseNumber, setHouseNumber] = React.useState("");
  const [postalCode, setPostalCode] = React.useState("");
  const [municipality, setMunicipality] = React.useState("");
  const [canton, setCanton] = React.useState<string | null>(null);
  const [issue, setIssue] = React.useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      createProperty(
        {
          offer_type: offer,
          property_type: type,
          street: street.trim() || null,
          house_number: houseNumber.trim() || null,
          postal_code: postalCode.trim(),
          municipality: municipality.trim(),
          canton: canton!,
        },
        { email: session?.user.email ?? null },
      ),
    onSuccess: (propertyId) => {
      queryClient.invalidateQueries({ queryKey: ["my-properties"] });
      router.replace({ pathname: "/objekt/[id]", params: { id: propertyId } });
    },
  });

  function submit() {
    const problem = !/^[1-9]\d{3}$/.test(postalCode.trim())
      ? "Bitte geben Sie eine gültige Postleitzahl ein (4 Ziffern)."
      : municipality.trim().length < 2
        ? "Bitte geben Sie den Ort ein."
        : !canton
          ? "Bitte wählen Sie den Kanton."
          : null;
    setIssue(problem);
    if (!problem) create.mutate();
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
        <Text style={[text.body, { color: colors.muted }]}>
          Zuerst die Grundangaben. Details, Fotos und Texte ergänzen Sie im nächsten Schritt. Die genaue Adresse bleibt privat – öffentlich erscheinen
          nur PLZ und Ort.
        </Text>
        {issue ? <Notice tone="error">{issue}</Notice> : null}
        {create.isError ? <Notice tone="error">{errorMessage(create.error)}</Notice> : null}

        <SectionTitle>Was möchten Sie tun?</SectionTitle>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Chip label="Verkaufen" selected={offer === "sale"} onPress={() => setOffer("sale")} />
          <Chip label="Vermieten" selected={offer === "rent"} onPress={() => setOffer("rent")} />
        </View>

        <SectionTitle>Objektart</SectionTitle>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {(Object.keys(PROPERTY_TYPES) as Enums<"property_type">[]).map((t) => (
            <Chip key={t} label={PROPERTY_TYPES[t]} selected={type === t} onPress={() => setType(t)} />
          ))}
        </View>

        <SectionTitle>Adresse</SectionTitle>
        <View style={{ flexDirection: "row", gap: space.md }}>
          <View style={{ flex: 3 }}>
            <Field label="Strasse" value={street} onChangeText={setStreet} textContentType="streetAddressLine1" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Nr." value={houseNumber} onChangeText={setHouseNumber} />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Field label="PLZ" value={postalCode} onChangeText={setPostalCode} keyboardType="number-pad" maxLength={4} textContentType="postalCode" />
          </View>
          <View style={{ flex: 2 }}>
            <Field label="Ort" value={municipality} onChangeText={setMunicipality} textContentType="addressCity" />
          </View>
        </View>
        <Text style={text.label}>Kanton</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }} accessibilityRole="radiogroup">
          {CANTONS.map(([code, name]) => (
            <Chip key={code} label={code} selected={canton === code} onPress={() => setCanton(code)} />
          ))}
        </View>
        {canton ? <Text style={text.small}>{CANTONS.find(([code]) => code === canton)?.[1]}</Text> : null}

        <Button title="Weiter" onPress={submit} loading={create.isPending} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
