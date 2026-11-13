import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";

import { Button, Field, Notice, ToggleRow } from "@/components/ui";
import { CONFIG } from "@/lib/config";
import { errorMessage } from "@/lib/labels";
import { supabase } from "@/lib/supabase";
import { colors, space, text } from "@/lib/theme";

/** Passwortregel wie auf der Website: mindestens 10 Zeichen, Buchstaben und Ziffer. */
function passwordIssue(password: string): string | null {
  if (password.length < 10) return "Mindestens 10 Zeichen.";
  if (!/[A-Za-zÄÖÜäöü]/.test(password) || !/\d/.test(password)) return "Mindestens ein Buchstabe und eine Ziffer.";
  return null;
}

export default function RegisterScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [terms, setTerms] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [sentTo, setSentTo] = React.useState<string | null>(null);

  async function submit() {
    const issue = !firstName.trim() || !lastName.trim()
      ? "Bitte geben Sie Vor- und Nachnamen ein."
      : !/^\S+@\S+\.\S+$/.test(email.trim())
        ? "Bitte geben Sie eine gültige E-Mail-Adresse ein."
        : passwordIssue(password)
          ? `Passwort: ${passwordIssue(password)}`
          : !terms
            ? "Bitte akzeptieren Sie die AGB und die Datenschutzerklärung."
            : null;
    if (issue) {
      setError(issue);
      return;
    }
    setPending(true);
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${CONFIG.siteUrl}/auth/callback?next=/dashboard`,
        data: { first_name: firstName.trim(), last_name: lastName.trim(), account_type: "private" },
      },
    });
    setPending(false);
    if (signUpError) {
      setError(errorMessage(signUpError));
      return;
    }
    if (data.session) {
      if (router.canGoBack()) router.back();
      else router.replace("/");
      return;
    }
    setSentTo(email.trim());
  }

  if (sentTo) {
    return (
      <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg, backgroundColor: colors.white, flexGrow: 1 }}>
        <Text style={text.title}>Fast geschafft</Text>
        <Notice tone="success">
          Wir haben einen Bestätigungslink an {sentTo} gesendet. Öffnen Sie ihn und melden Sie sich danach hier an.
        </Notice>
        <Button title="Zur Anmeldung" onPress={() => router.replace("/login")} />
      </ScrollView>
    );
  }

  const open = (path: string) => WebBrowser.openBrowserAsync(`${CONFIG.siteUrl}${path}`).catch(() => undefined);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg }} keyboardShouldPersistTaps="handled">
        <Text style={text.title}>Konto erstellen</Text>
        <Text style={[text.body, { color: colors.muted }]}>Kostenlos für Privatpersonen. Firmenkonten eröffnen Sie auf der Website.</Text>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Field label="Vorname" value={firstName} onChangeText={setFirstName} textContentType="givenName" autoComplete="given-name" />
        <Field label="Nachname" value={lastName} onChangeText={setLastName} textContentType="familyName" autoComplete="family-name" />
        <Field label="E-Mail-Adresse" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" />
        <Field
          label="Passwort"
          hint="Mindestens 10 Zeichen, mit Buchstaben und Ziffer."
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
          autoComplete="new-password"
        />
        <ToggleRow label="Ich akzeptiere die AGB und die Datenschutzerklärung" value={terms} onValueChange={setTerms} />
        <Text style={text.small}>
          <Text style={{ color: colors.primary, fontWeight: "600" }} onPress={() => open("/agb")}>
            AGB lesen
          </Text>
          {"  ·  "}
          <Text style={{ color: colors.primary, fontWeight: "600" }} onPress={() => open("/datenschutz")}>
            Datenschutzerklärung lesen
          </Text>
        </Text>
        <Button title="Konto erstellen" onPress={submit} loading={pending} />
        <Button title="Ich habe bereits ein Konto" variant="ghost" onPress={() => router.replace("/login")} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
