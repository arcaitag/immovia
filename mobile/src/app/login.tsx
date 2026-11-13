import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";

import { Button, Field, Notice } from "@/components/ui";
import { CONFIG } from "@/lib/config";
import { errorMessage } from "@/lib/labels";
import { supabase } from "@/lib/supabase";
import { colors, space, text } from "@/lib/theme";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      setError("Bitte geben Sie E-Mail-Adresse und Passwort ein.");
      return;
    }
    setPending(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setPending(false);
    if (signInError) {
      setError(errorMessage(signInError));
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg }} keyboardShouldPersistTaps="handled">
        <Text style={text.title}>Willkommen zurück</Text>
        <Text style={[text.body, { color: colors.muted }]}>Melden Sie sich mit Ihrem Immovia-Konto an – dasselbe wie auf der Website.</Text>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Field
          label="E-Mail-Adresse"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          autoComplete="email"
        />
        <Field label="Passwort" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" autoComplete="current-password" onSubmitEditing={submit} />
        <Button title="Anmelden" onPress={submit} loading={pending} />
        <Button title="Passwort vergessen?" variant="ghost" onPress={() => WebBrowser.openBrowserAsync(`${CONFIG.siteUrl}/passwort-vergessen`).catch(() => undefined)} />
        <Button title="Neues Konto erstellen" variant="outline" onPress={() => router.replace("/registrieren")} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
