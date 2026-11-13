import { Stack } from "expo-router";
import * as React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";

import { SignInPrompt } from "@/components/sign-in-prompt";
import { Button, Field, Loading, Notice } from "@/components/ui";
import { CurrentPasswordError, accountErrorMessage, changePassword, passwordRuleError } from "@/lib/api-account";
import { useAuth } from "@/lib/auth";
import { colors, space, text } from "@/lib/theme";

type Errors = { current?: string; next?: string; confirm?: string };

export default function PasswordScreen() {
  const { userId, session, loading } = useAuth();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [errors, setErrors] = React.useState<Errors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const email = session?.user.email ?? null;

  async function submit() {
    const found: Errors = {};
    if (!current) found.current = "Bitte geben Sie Ihr aktuelles Passwort ein.";
    const rule = passwordRuleError(next);
    if (rule) found.next = rule;
    else if (next === current) found.next = "Das neue Passwort muss sich vom bisherigen unterscheiden.";
    if (next !== confirm) found.confirm = "Die Passwörter stimmen nicht überein.";
    setErrors(found);
    setFormError(null);
    setDone(false);
    if (Object.keys(found).length) return;
    if (!email) {
      setFormError("Für Ihr Konto ist keine E-Mail-Adresse hinterlegt.");
      return;
    }
    setPending(true);
    try {
      await changePassword(email, current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    } catch (error) {
      if (error instanceof CurrentPasswordError) setErrors({ current: error.message });
      else setFormError(accountErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Passwort ändern" }} />
      {loading ? (
        <Loading />
      ) : !userId ? (
        <SignInPrompt icon="key-outline" title="Bitte anmelden" description="Melden Sie sich an, um Ihr Passwort zu ändern." />
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.white }}>
          <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
            {formError ? <Notice tone="error">{formError}</Notice> : null}
            {done ? <Notice tone="success">Ihr Passwort wurde geändert.</Notice> : null}
            <Field
              label="Aktuelles Passwort"
              value={current}
              onChangeText={setCurrent}
              error={errors.current}
              secureTextEntry
              maxLength={72}
              textContentType="password"
              autoComplete="current-password"
            />
            <Field
              label="Neues Passwort"
              value={next}
              onChangeText={setNext}
              error={errors.next}
              secureTextEntry
              maxLength={72}
              textContentType="newPassword"
              autoComplete="new-password"
              hint="Mindestens 10 Zeichen, mit Buchstaben und mindestens einer Zahl."
            />
            <Field
              label="Neues Passwort wiederholen"
              value={confirm}
              onChangeText={setConfirm}
              error={errors.confirm}
              secureTextEntry
              maxLength={72}
              textContentType="newPassword"
              autoComplete="new-password"
              onSubmitEditing={submit}
            />
            <Button title="Passwort ändern" onPress={submit} loading={pending} />
            <Text style={text.small}>Zur Sicherheit prüfen wir zuerst Ihr aktuelles Passwort. Sie bleiben auf diesem Gerät angemeldet.</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </>
  );
}
