import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";

import { SignInPrompt } from "@/components/sign-in-prompt";
import { Button, Field, Loading, Notice } from "@/components/ui";
import { accountErrorMessage, getProfile, updateProfile, validateProfile, type ProfileErrors, type ProfileFields, type ProfileInput } from "@/lib/api-account";
import { useAuth } from "@/lib/auth";
import { colors, space, text } from "@/lib/theme";

export default function ProfileScreen() {
  const { userId, session, loading } = useAuth();
  const profile = useQuery({ queryKey: ["profile-edit", userId], enabled: Boolean(userId), queryFn: () => getProfile(userId!) });

  return (
    <>
      <Stack.Screen options={{ title: "Profil" }} />
      {loading || (userId && profile.isPending) ? (
        <Loading />
      ) : !userId ? (
        <SignInPrompt icon="person-circle-outline" title="Bitte anmelden" description="Melden Sie sich an, um Ihr Profil zu bearbeiten." />
      ) : profile.isError || !profile.data ? (
        <View style={{ padding: space.lg, gap: space.md }}>
          <Notice tone="error">{profile.isError ? accountErrorMessage(profile.error) : "Ihr Profil wurde nicht gefunden."}</Notice>
          <Button title="Erneut versuchen" variant="outline" onPress={() => profile.refetch()} />
        </View>
      ) : (
        <ProfileForm userId={userId} email={session?.user.email ?? null} profile={profile.data} />
      )}
    </>
  );
}

function ProfileForm({ userId, email, profile }: { userId: string; email: string | null; profile: ProfileFields }) {
  const queryClient = useQueryClient();
  const [values, setValues] = React.useState<ProfileInput>({
    firstName: profile.first_name ?? "",
    lastName: profile.last_name ?? "",
    displayName: profile.display_name ?? "",
    phone: profile.phone ?? "",
  });
  const [errors, setErrors] = React.useState<ProfileErrors>({});
  const set = (key: keyof ProfileInput) => (value: string) => setValues((v) => ({ ...v, [key]: value }));

  const save = useMutation({
    mutationFn: () => updateProfile(userId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      queryClient.invalidateQueries({ queryKey: ["profile-edit", userId] });
    },
  });

  function submit() {
    const next = validateProfile(values);
    setErrors(next);
    if (Object.keys(next).length === 0) save.mutate();
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
        {save.isError ? <Notice tone="error">{accountErrorMessage(save.error)}</Notice> : null}
        {save.isSuccess ? <Notice tone="success">Ihr Profil wurde gespeichert.</Notice> : null}
        <Field label="Vorname" value={values.firstName} onChangeText={set("firstName")} error={errors.firstName} maxLength={80} textContentType="givenName" autoComplete="given-name" />
        <Field label="Nachname" value={values.lastName} onChangeText={set("lastName")} error={errors.lastName} maxLength={80} textContentType="familyName" autoComplete="family-name" />
        <Field
          label="Anzeigename"
          value={values.displayName}
          onChangeText={set("displayName")}
          error={errors.displayName}
          maxLength={80}
          hint="Dieser Name ist für andere sichtbar, z. B. bei Ihren Inseraten und in Nachrichten."
        />
        <Field
          label="Telefon (optional)"
          value={values.phone}
          onChangeText={set("phone")}
          error={errors.phone}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          hint="Z. B. 079 123 45 67"
        />
        <Button title="Speichern" onPress={submit} loading={save.isPending} />
        {email ? <Text style={text.small}>E-Mail-Adresse: {email}. E-Mail-Adresse und Profilbild ändern Sie auf der Website unter «Profil».</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
