import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as React from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { SignInPrompt } from "@/components/sign-in-prompt";
import { Button, Chip, EmptyState, Loading, Notice, ToggleRow } from "@/components/ui";
import {
  ALERT_FREQUENCIES,
  accountErrorMessage,
  deleteSavedSearch,
  describeCriteria,
  encodeFiltersParam,
  filtersFromCriteria,
  savedSearches,
  updateSavedSearch,
  type AlertFrequency,
  type SavedSearch,
} from "@/lib/api-account";
import { useAuth } from "@/lib/auth";
import { colors, radius, space, text } from "@/lib/theme";

export default function SavedSearchesScreen() {
  const { userId, loading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const queryKey = ["saved-searches", userId];
  const list = useQuery({ queryKey, enabled: Boolean(userId), queryFn: savedSearches });

  const update = useMutation({
    mutationFn: ({ id, ...patch }: { id: string; alertEnabled?: boolean; frequency?: AlertFrequency }) => updateSavedSearch(id, patch),
    onMutate: async ({ id, ...patch }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SavedSearch[]>(queryKey);
      queryClient.setQueryData<SavedSearch[]>(queryKey, (rows) => rows?.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      return { previous };
    },
    onError: (_error, _vars, context) => queryClient.setQueryData(queryKey, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
  const remove = useMutation({ mutationFn: deleteSavedSearch, onSettled: () => queryClient.invalidateQueries({ queryKey }) });

  function run(search: SavedSearch) {
    const { filters } = filtersFromCriteria(search.criteria);
    // Zurück zur Suche; «t» sorgt dafür, dass derselbe Suchauftrag erneut angewendet wird
    router.dismissTo({ pathname: "/", params: { suche: encodeFiltersParam(filters), t: String(Date.now()) } });
  }

  function confirmDelete(search: SavedSearch) {
    Alert.alert("Suchauftrag löschen?", `«${search.name}» wird gelöscht. Sie erhalten dazu keine Benachrichtigungen mehr.`, [
      { text: "Abbrechen", style: "cancel" },
      { text: "Löschen", style: "destructive", onPress: () => remove.mutate(search.id) },
    ]);
  }

  return (
    <>
      <Stack.Screen options={{ title: "Suchaufträge" }} />
      {loading || (userId && list.isPending) ? (
        <Loading />
      ) : !userId ? (
        <SignInPrompt icon="bookmark-outline" title="Bitte anmelden" description="Melden Sie sich an, um Suchen zu speichern und über neue Inserate informiert zu werden." />
      ) : list.isError ? (
        <View style={{ padding: space.lg, gap: space.md }}>
          <Notice tone="error">{accountErrorMessage(list.error)}</Notice>
          <Button title="Erneut versuchen" variant="outline" onPress={() => list.refetch()} />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ padding: space.lg, gap: space.lg }}
          data={list.data}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={colors.brand} />}
          ListHeaderComponent={
            update.isError || remove.isError ? <Notice tone="error">{accountErrorMessage(update.error ?? remove.error)}</Notice> : undefined
          }
          ListEmptyComponent={
            <EmptyState
              icon="bookmark-outline"
              title="Noch keine Suchaufträge"
              description="Starten Sie eine Suche, setzen Sie Ihre Filter und wählen Sie «Suche speichern». Wir melden uns, sobald ein passendes Inserat veröffentlicht wird."
              action={<Button title="Suche starten" onPress={() => router.dismissTo("/")} />}
            />
          }
          ListFooterComponent={
            list.data?.length ? (
              <Text style={text.small}>
                Sie können bis zu 25 Suchaufträge speichern. Ob Sie Benachrichtigungen auch per E-Mail erhalten, legen Sie unter «Einstellungen» fest.
              </Text>
            ) : undefined
          }
          renderItem={({ item }) => {
            const { partial } = filtersFromCriteria(item.criteria);
            return (
              <View style={styles.card}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.sm }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={text.heading}>{item.name}</Text>
                    <Text style={text.small}>{describeCriteria(item.criteria)}</Text>
                    <Text style={text.small}>{item.matches === 1 ? "1 Treffer seit dem Speichern" : `${item.matches} Treffer seit dem Speichern`}</Text>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Suchauftrag ${item.name} löschen`} onPress={() => confirmDelete(item)} style={styles.iconButton}>
                    <Ionicons name="trash-outline" size={21} color={colors.destructive} />
                  </Pressable>
                </View>
                {partial ? (
                  <Text style={text.small}>Dieser Suchauftrag enthält Filter der Website, die die App nicht anwendet. Die Suche in der App zeigt deshalb mehr Treffer.</Text>
                ) : null}
                <ToggleRow
                  label="Benachrichtigen"
                  hint="Bei neuen passenden Inseraten, pro Inserat nur einmal."
                  value={item.alertEnabled}
                  onValueChange={(alertEnabled) => update.mutate({ id: item.id, alertEnabled })}
                />
                {item.alertEnabled ? (
                  <View accessibilityRole="radiogroup" accessibilityLabel="Häufigkeit" style={styles.wrap}>
                    {(Object.keys(ALERT_FREQUENCIES) as AlertFrequency[]).map((frequency) => (
                      <Chip
                        key={frequency}
                        label={ALERT_FREQUENCIES[frequency].label}
                        selected={item.frequency === frequency}
                        onPress={() => item.frequency !== frequency && update.mutate({ id: item.id, frequency })}
                      />
                    ))}
                  </View>
                ) : null}
                <Button title="Suche ausführen" variant="outline" icon="search" onPress={() => run(item)} />
              </View>
            );
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md, padding: space.lg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.md },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
