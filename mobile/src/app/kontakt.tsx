import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as Linking from "expo-linking";
import * as React from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { IconTile, PageIntro, contentStyles, useSiteLink } from "@/components/content";
import { Button, Chip, Field, Notice } from "@/components/ui";
import { CONTACT_SUBJECTS, getPlatformContact, submitContact, validateContact } from "@/lib/api-content";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/labels";
import { colors, radius, space, text } from "@/lib/theme";

/** «Kontakt» – Inhalt und Formular wie src/app/(site)/kontakt der Website (gleiche Datenbankfunktion). */
export default function ContactScreen() {
  const open = useSiteLink();
  const { session } = useAuth();
  const contact = useQuery({ queryKey: ["content", "platform-contact"], queryFn: getPlatformContact, staleTime: 3_600_000 });
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState<string | null>(null);
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [problem, setProblem] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  // Angemeldet: E-Mail-Adresse des Kontos vorschlagen, bis etwas anderes eingegeben wird
  const emailValue = email ?? session?.user.email ?? "";

  const send = useMutation({
    mutationFn: submitContact,
    onSuccess: () => {
      setSent(true);
      setName("");
      setSubject("");
      setMessage("");
    },
  });

  function submit() {
    const input = { name, email: emailValue, subject, message };
    const invalid = validateContact(input);
    setProblem(invalid);
    if (!invalid) send.mutate(input);
  }

  const c = contact.data;
  const hasContact = Boolean(c?.email || c?.phone || c?.address);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <ScrollView style={{ backgroundColor: colors.white }} keyboardShouldPersistTaps="handled">
        <Stack.Screen options={{ title: "Kontakt" }} />
        <PageIntro
          eyebrow="Kontakt"
          title="Wir helfen Ihnen gerne weiter"
          lead="Schreiben Sie uns über das Formular. Für Fragen zu einem bestimmten Inserat wenden Sie sich am schnellsten direkt über «Kontakt aufnehmen» im Inserat an die Inserentin oder den Inserenten."
        />

        <View style={{ padding: space.lg, paddingTop: space.xl, gap: space.lg }}>
          <View style={[contentStyles.card, { borderRadius: 24, padding: space.xl, gap: space.lg }]}>
            <View style={{ gap: 4 }}>
              <Text accessibilityRole="header" style={[contentStyles.sectionTitle, { fontSize: 23 }]}>
                Nachricht senden
              </Text>
              <Text style={text.small}>Alle Felder sind Pflichtfelder.</Text>
            </View>
            {sent ? (
              <>
                <Notice tone="success">Vielen Dank für Ihre Nachricht. Wir haben Ihre Anfrage erhalten und melden uns so rasch wie möglich per E-Mail.</Notice>
                <Button title="Weitere Nachricht senden" variant="outline" onPress={() => setSent(false)} />
              </>
            ) : (
              <>
                <Field label="Name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" maxLength={120} />
                <Field
                  label="E-Mail-Adresse"
                  value={emailValue}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  maxLength={254}
                />
                <View style={{ gap: 6 }}>
                  <Text style={text.label}>Thema</Text>
                  <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                    {CONTACT_SUBJECTS.map((item) => (
                      <Chip key={item} label={item} selected={subject === item} onPress={() => setSubject(item)} />
                    ))}
                  </View>
                </View>
                <Field label="Nachricht" value={message} onChangeText={setMessage} multiline maxLength={4000} />
                {problem ? <Notice tone="error">{problem}</Notice> : null}
                {send.isError ? <Notice tone="error">{errorMessage(send.error)}</Notice> : null}
                <Text style={{ fontSize: 12.5, lineHeight: 18, color: colors.muted }}>
                  Wir verwenden Ihre Angaben nur, um Ihre Anfrage zu beantworten. Mehr dazu in der{" "}
                  <Text accessibilityRole="link" onPress={() => open("/datenschutz")} style={{ fontWeight: "600", color: colors.primary }}>
                    Datenschutzerklärung
                  </Text>
                  .
                </Text>
                <Button title="Nachricht senden" icon="send-outline" loading={send.isPending} onPress={submit} />
              </>
            )}
          </View>

          {hasContact ? (
            <View style={[contentStyles.card, { padding: space.xl, gap: space.md }]}>
              <Text style={[contentStyles.cardTitle, { marginTop: 0 }]}>Direkter Kontakt</Text>
              {c?.email ? (
                <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`mailto:${c.email}`).catch(() => undefined)} style={styles.contactRow}>
                  <Ionicons name="mail-outline" size={18} color={colors.brand} />
                  <Text style={styles.contactText}>{c.email}</Text>
                </Pressable>
              ) : null}
              {c?.phone ? (
                <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`tel:${c.phone!.replace(/[^\d+]/g, "")}`).catch(() => undefined)} style={styles.contactRow}>
                  <Ionicons name="call-outline" size={18} color={colors.brand} />
                  <Text style={styles.contactText}>{c.phone}</Text>
                </Pressable>
              ) : null}
              {c?.address ? (
                <View style={[styles.contactRow, { alignItems: "flex-start" }]}>
                  <Ionicons name="location-outline" size={18} color={colors.brand} />
                  <Text style={[styles.contactText, { fontWeight: "400" }]}>{c.address}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <LinkCard icon="help-circle-outline" title="Häufige Fragen" text="Schnelle Antworten zu Kosten, Inseraten, Bewertung und Datenschutz." onPress={() => open("/faq")} />
          <LinkCard icon="book-outline" title="Ratgeber" text="Anleitungen zum Verkaufen und Vermieten in der Schweiz." onPress={() => open("/ratgeber")} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function LinkCard({ icon, title, text: body, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; title: string; text: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={({ pressed }) => [contentStyles.card, styles.linkCard, pressed && { backgroundColor: colors.mint100 }]}>
      <IconTile icon={icon} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 16.5, fontWeight: "700", color: colors.foreground }}>{title}</Text>
        <Text style={contentStyles.cardText}>{body}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contactRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: space.md },
  contactText: { flex: 1, fontSize: 15, fontWeight: "500", color: colors.foreground, lineHeight: 21 },
  linkCard: { flexDirection: "row", alignItems: "flex-start", gap: space.lg, padding: space.xl, borderRadius: radius.lg },
});
