import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, Chip, Field, Notice, ToggleRow } from "@/components/ui";
import type { SearchFilters } from "@/lib/api";
import { ALERT_FREQUENCIES, accountErrorMessage, createSavedSearch, criteriaFromFilters, describeCriteria, type AlertFrequency } from "@/lib/api-account";
import { colors, space, text } from "@/lib/theme";

/** Dialog «Suche speichern»: legt aus den aktuellen Filtern einen Suchauftrag an. */
export function SaveSearchSheet({ open, filters, onClose, onShowList }: { open: boolean; filters: SearchFilters; onClose: () => void; onShowList: () => void }) {
  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {/* Inhalt bei jedem Öffnen neu aufbauen: übernimmt die aktuelle Suche */}
      {open ? <SaveSearchForm filters={filters} onClose={onClose} onShowList={onShowList} /> : null}
    </Modal>
  );
}

function SaveSearchForm({ filters, onClose, onShowList }: { filters: SearchFilters; onClose: () => void; onShowList: () => void }) {
  const queryClient = useQueryClient();
  const summary = describeCriteria(criteriaFromFilters(filters));
  const [name, setName] = React.useState(summary.slice(0, 120));
  const [alertEnabled, setAlertEnabled] = React.useState(true);
  const [frequency, setFrequency] = React.useState<AlertFrequency>("instant");

  const save = useMutation({
    mutationFn: () => createSavedSearch({ name, filters, alertEnabled, frequency }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-searches"] }),
  });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.white }}>
      <View style={styles.header}>
        <Text style={text.heading}>Suche speichern</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Schliessen" hitSlop={10} onPress={onClose}>
          <Ionicons name="close" size={26} color={colors.forest} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
        {save.isSuccess ? (
          <>
            <Notice tone="success">
              Suchauftrag gespeichert.{alertEnabled ? " Wir benachrichtigen Sie über neue passende Inserate." : ""}
            </Notice>
            <Button title="Meine Suchaufträge" variant="outline" icon="bookmark-outline" onPress={onShowList} />
            <Button title="Fertig" onPress={onClose} />
          </>
        ) : (
          <>
            {save.isError ? <Notice tone="error">{accountErrorMessage(save.error)}</Notice> : null}
            <Text style={[text.body, { color: colors.muted }]}>{summary}</Text>
            <Field label="Name" value={name} onChangeText={setName} maxLength={120} />
            <ToggleRow
              label="Benachrichtigen"
              hint="Wir informieren Sie über neue passende Inserate – pro Inserat nur einmal."
              value={alertEnabled}
              onValueChange={setAlertEnabled}
            />
            {alertEnabled ? (
              <View style={{ gap: space.sm }}>
                <Text style={text.label}>Häufigkeit</Text>
                <View accessibilityRole="radiogroup" style={styles.wrap}>
                  {(Object.keys(ALERT_FREQUENCIES) as AlertFrequency[]).map((value) => (
                    <Chip key={value} label={ALERT_FREQUENCIES[value].label} selected={frequency === value} onPress={() => setFrequency(value)} />
                  ))}
                </View>
                <Text style={text.small}>{ALERT_FREQUENCIES[frequency].description}.</Text>
              </View>
            ) : null}
            <Button title="Suchauftrag speichern" icon="bookmark" onPress={() => save.mutate()} loading={save.isPending} disabled={!name.trim()} />
            <Text style={text.small}>Die Sortierung wird nicht gespeichert. Ob Sie Benachrichtigungen auch per E-Mail erhalten, legen Sie unter «Konto» in den Einstellungen fest.</Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
