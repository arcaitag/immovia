import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { editorStyles } from "@/components/editor/shared";
import { Badge, Button, Chip, EmptyState, Loading, Notice } from "@/components/ui";
import {
  LEAD_STATUS,
  LEAD_STATUS_ORDER,
  formatDate,
  managedListing,
  ownerErrorMessage,
  propertyLeads,
  updateLead,
  type LeadItem,
  type LeadStatus,
} from "@/lib/api-owner";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/labels";
import { colors, radius, space, text } from "@/lib/theme";

function Rating({ value, disabled, onChange }: { value: number | null; disabled: boolean; onChange: (value: number | null) => void }) {
  return (
    <View style={{ flexDirection: "row" }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          accessibilityRole="button"
          accessibilityLabel={value === star ? `Bewertung ${star} von 5 entfernen` : `Mit ${star} von 5 Sternen bewerten`}
          accessibilityState={{ selected: value !== null && star <= value }}
          disabled={disabled}
          // Ein Tipp auf die aktuelle Bewertung entfernt sie wieder
          onPress={() => onChange(value === star ? null : star)}
          style={styles.star}
        >
          <Ionicons name={value !== null && star <= value ? "star" : "star-outline"} size={24} color={value !== null && star <= value ? colors.warning : colors.muted} />
        </Pressable>
      ))}
    </View>
  );
}

export default function LeadsScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { userId } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const managed = useQuery({ queryKey: ["managed-listing", propertyId], queryFn: () => managedListing(propertyId), enabled: Boolean(userId) });
  const listingIds = managed.data?.listingIds;
  const leads = useQuery({ queryKey: ["property-leads", propertyId], queryFn: () => propertyLeads(listingIds!), enabled: Boolean(listingIds) });

  const update = useMutation({
    mutationFn: (input: { leadId: string; changes: { status?: LeadStatus; rating?: number | null } }) => updateLead(input.leadId, input.changes),
    onMutate: () => setError(null),
    onSuccess: () => {
      setOpenId(null);
      queryClient.invalidateQueries({ queryKey: ["property-leads", propertyId] });
      queryClient.invalidateQueries({ queryKey: ["owner-badges"] });
    },
    onError: (cause) => setError(ownerErrorMessage(cause) ?? errorMessage(cause)),
  });

  if (!userId) {
    return (
      <>
        <Stack.Screen options={{ title: "Interessenten" }} />
        <EmptyState icon="lock-closed-outline" title="Bitte anmelden" description="Melden Sie sich an, um Ihre Interessenten zu sehen." />
      </>
    );
  }

  const loading = managed.isPending || (Boolean(listingIds) && leads.isPending);
  const failure = managed.error ?? leads.error;

  const renderLead = ({ item }: { item: LeadItem }) => {
    const status = LEAD_STATUS[item.status];
    const open = openId === item.id;
    const busy = update.isPending && update.variables?.leadId === item.id;
    return (
      <View style={editorStyles.card}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.md }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[text.body, { fontWeight: "700" }]}>{item.name}</Text>
            <Text style={text.small}>
              Letzte Aktivität {formatDate(item.lastActivityAt)} · Erste Anfrage {formatDate(item.createdAt)}
            </Text>
          </View>
          <Badge label={status.label} tone={status.tone} />
        </View>
        <Rating value={item.rating} disabled={busy} onChange={(rating) => update.mutate({ leadId: item.id, changes: { rating } })} />
        <View style={editorStyles.two}>
          <Button
            title={open ? "Schliessen" : "Status ändern"}
            variant="outline"
            icon={open ? "chevron-up" : "swap-horizontal-outline"}
            onPress={() => setOpenId(open ? null : item.id)}
            style={{ flex: 1 }}
          />
          {item.conversationId ? (
            <Button
              title="Nachrichten"
              icon="chatbubbles-outline"
              onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.conversationId!, title: item.name } })}
              style={{ flex: 1 }}
            />
          ) : null}
        </View>
        {open ? (
          <View style={styles.statusPanel} accessibilityRole="radiogroup" accessibilityLabel="Status wählen">
            {LEAD_STATUS_ORDER.map((key) => (
              <Chip
                key={key}
                label={LEAD_STATUS[key].label}
                selected={item.status === key}
                onPress={() => {
                  if (key !== item.status && !busy) update.mutate({ leadId: item.id, changes: { status: key } });
                }}
              />
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: "Interessenten" }} />
      <FlatList
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl * 2 }}
        data={leads.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderLead}
        refreshControl={<RefreshControl refreshing={leads.isRefetching} onRefresh={() => void leads.refetch()} tintColor={colors.brand} />}
        ListHeaderComponent={
          error ? (
            <Notice tone="error">{error}</Notice>
          ) : (leads.data?.length ?? 0) > 0 ? (
            <Text style={text.small}>
              Status und Bewertung sind für Interessenten nicht sichtbar. Bestätigte und durchgeführte Besichtigungen setzen den Status automatisch weiter.
            </Text>
          ) : undefined
        }
        ListEmptyComponent={
          loading ? (
            <Loading />
          ) : failure ? (
            <Notice tone="error">{errorMessage(failure)}</Notice>
          ) : managed.data === null ? (
            <EmptyState icon="home-outline" title="Nicht gefunden" description="Diese Immobilie gibt es nicht mehr oder sie gehört zu einem anderen Konto." />
          ) : (
            <EmptyState
              icon="people-outline"
              title="Noch keine Interessenten"
              description="Sobald jemand Ihr Inserat anfragt oder eine Besichtigung bucht, erscheint die Person hier."
            />
          )
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  star: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  statusPanel: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});
