import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { SignInPrompt } from "@/components/sign-in-prompt";
import { Button, Loading, Notice, SectionTitle, ToggleRow } from "@/components/ui";
import {
  CONSENTS,
  NOTIFICATION_SETTINGS,
  accountErrorMessage,
  getAccountSettings,
  updateConsent,
  updateNotificationSetting,
  type AccountSettings,
  type ConsentKey,
  type NotificationKey,
} from "@/lib/api-account";
import { useAuth } from "@/lib/auth";
import { CONFIG } from "@/lib/config";
import { colors, radius, space, text } from "@/lib/theme";

type Change = { table: "consents"; key: ConsentKey; value: boolean } | { table: "notifications"; key: NotificationKey; value: boolean };

export default function SettingsScreen() {
  const { userId, loading } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["account-settings", userId];
  const settings = useQuery({ queryKey, enabled: Boolean(userId), queryFn: () => getAccountSettings(userId!) });

  // Jeder Schalter speichert sofort; bei einem Fehler springt er zurück.
  const change = useMutation({
    mutationFn: (c: Change) => (c.table === "consents" ? updateConsent(userId!, c.key, c.value) : updateNotificationSetting(userId!, c.key, c.value)),
    onMutate: async (c) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<AccountSettings>(queryKey);
      if (previous) {
        queryClient.setQueryData<AccountSettings>(queryKey, {
          consents: c.table === "consents" && previous.consents ? { ...previous.consents, [c.key]: c.value } : previous.consents,
          notifications: c.table === "notifications" && previous.notifications ? { ...previous.notifications, [c.key]: c.value } : previous.notifications,
        });
      }
      return { previous };
    },
    onError: (_error, _c, context) => queryClient.setQueryData(queryKey, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const openSite = () => WebBrowser.openBrowserAsync(`${CONFIG.siteUrl}/dashboard/einstellungen`).catch(() => undefined);
  const data = settings.data;

  return (
    <>
      <Stack.Screen options={{ title: "Einstellungen" }} />
      {loading || (userId && settings.isPending) ? (
        <Loading />
      ) : !userId ? (
        <SignInPrompt icon="settings-outline" title="Bitte anmelden" description="Melden Sie sich an, um Ihre Einstellungen zu ändern." />
      ) : settings.isError || !data ? (
        <View style={{ padding: space.lg, gap: space.md }}>
          <Notice tone="error">{accountErrorMessage(settings.error)}</Notice>
          <Button title="Erneut versuchen" variant="outline" onPress={() => settings.refetch()} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
          {change.isError ? <Notice tone="error">{accountErrorMessage(change.error)}</Notice> : null}

          <SectionTitle>Einwilligungen</SectionTitle>
          {data.consents ? (
            <View style={styles.card}>
              {CONSENTS.map((item, index) => (
                <View key={item.key} style={[styles.row, index > 0 && styles.divider]}>
                  <ToggleRow
                    label={item.label}
                    hint={item.description}
                    value={data.consents![item.key]}
                    onValueChange={(value) => change.mutate({ table: "consents", key: item.key, value })}
                  />
                </View>
              ))}
            </View>
          ) : (
            <Notice tone="warning">Ihre Einwilligungen wurden nicht gefunden. Bitte öffnen Sie die Einstellungen auf der Website.</Notice>
          )}
          <Text style={text.small}>Änderungen werden sofort gespeichert. Mehr dazu in der Datenschutzerklärung (unter «Konto»).</Text>

          <SectionTitle>E-Mail-Benachrichtigungen</SectionTitle>
          {data.notifications ? (
            <View style={styles.card}>
              {NOTIFICATION_SETTINGS.map((item, index) => (
                <View key={item.key} style={[styles.row, index > 0 && styles.divider]}>
                  <ToggleRow
                    label={item.label}
                    hint={item.description}
                    value={data.notifications![item.key]}
                    onValueChange={(value) => change.mutate({ table: "notifications", key: item.key, value })}
                  />
                </View>
              ))}
            </View>
          ) : (
            <Notice tone="warning">Ihre Benachrichtigungseinstellungen wurden nicht gefunden. Bitte öffnen Sie die Einstellungen auf der Website.</Notice>
          )}
          <Text style={text.small}>Benachrichtigungen im Konto und sicherheitsrelevante E-Mails (z. B. Passwortänderung) erhalten Sie immer.</Text>

          <SectionTitle>Daten und Konto</SectionTitle>
          <Text style={[text.body, { color: colors.muted }]}>
            Ihre Daten herunterladen und Ihr Konto löschen können Sie auf der Website. Dort melden Sie sich mit demselben Konto an.
          </Text>
          <Button title="Auf der Website öffnen" variant="outline" icon="open-outline" onPress={openSite} />
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, paddingHorizontal: space.lg },
  row: { paddingVertical: space.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
});
