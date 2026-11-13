import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as React from "react";
import { Alert, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { Card, ChoiceChips, Row, Stepper, editorStyles } from "@/components/editor/shared";
import { Badge, Button, EmptyState, Field, Loading, Notice, SectionTitle } from "@/components/ui";
import {
  APPOINTMENT_STATUS,
  SLOT_DURATION_OPTIONS,
  cancelSlot,
  createSlots,
  deleteSlot,
  formatSlotRange,
  managedListing,
  ownerErrorMessage,
  sellerSchedule,
  updateAppointment,
  type AppointmentItem,
  type SellerAppointmentAction,
  type SlotFormInput,
  type SlotItem,
} from "@/lib/api-owner";
import { useAuth } from "@/lib/auth";
import { CONFIG } from "@/lib/config";
import { errorMessage } from "@/lib/labels";
import { colors, radius, space, text } from "@/lib/theme";

type Message = { tone: "success" | "error"; text: string } | null;

const describe = (error: unknown) => ownerErrorMessage(error) ?? errorMessage(error);
const DURATIONS = SLOT_DURATION_OPTIONS.map((option) => ({ value: String(option.value), label: option.label }));
const EMPTY_FORM: SlotFormInput = { date: "", startTime: "", endTime: "", durationMinutes: 0, capacity: 1, note: "" };

/** Ergänzt beim Tippen Punkte bzw. den Doppelpunkt («14112026» → «14.11.2026», «1030» → «10:30»). */
function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join(".");
}
function maskTime(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

function AppointmentCard({
  appointment,
  showTime,
  busy,
  onAction,
}: {
  appointment: AppointmentItem;
  showTime: boolean;
  busy: boolean;
  onAction: (action: SellerAppointmentAction, reason?: string) => void;
}) {
  const router = useRouter();
  const [cancelling, setCancelling] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const status = APPOINTMENT_STATUS[appointment.status];
  const open = appointment.status === "requested" || appointment.status === "reschedule_requested";
  const confirmed = appointment.status === "confirmed";
  const started = appointment.started;

  return (
    <View style={styles.appointment}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[text.body, { fontWeight: "700" }]}>{appointment.guestName ?? "Gelöschtes Konto"}</Text>
          {showTime ? <Text style={text.small}>{formatSlotRange(appointment.startsAt, appointment.endsAt)}</Text> : null}
        </View>
        <Badge label={status.label} tone={status.tone} />
      </View>
      {appointment.guestMessage ? <Text style={[text.body, { fontSize: 15 }]}>«{appointment.guestMessage}»</Text> : null}
      {appointment.cancelReason && !confirmed ? <Text style={text.small}>Begründung: {appointment.cancelReason}</Text> : null}

      {open ? <Button title="Bestätigen" icon="checkmark" disabled={busy} onPress={() => onAction("confirm")} /> : null}
      {confirmed && started ? (
        <View style={editorStyles.two}>
          <Button title="Durchgeführt" icon="checkmark-done-outline" disabled={busy} onPress={() => onAction("complete")} style={{ flex: 1 }} />
          <Button
            title="Nicht erschienen"
            variant="outline"
            disabled={busy}
            onPress={() =>
              Alert.alert("Als nicht erschienen markieren?", "Der Termin wird als nicht wahrgenommen festgehalten.", [
                { text: "Abbrechen", style: "cancel" },
                { text: "Markieren", onPress: () => onAction("no_show") },
              ])
            }
            style={{ flex: 1 }}
          />
        </View>
      ) : null}
      {appointment.conversationId ? (
        <Button
          title="Nachrichten"
          variant="outline"
          icon="chatbubbles-outline"
          onPress={() => router.push({ pathname: "/chat/[id]", params: { id: appointment.conversationId!, title: appointment.guestName ?? "Nachrichten" } })}
        />
      ) : null}
      {open || confirmed ? (
        cancelling ? (
          <View style={{ gap: space.sm }}>
            <Field
              label="Begründung (optional)"
              value={reason}
              onChangeText={setReason}
              maxLength={500}
              multiline
              style={{ minHeight: 70 }}
              hint="Die Person wird über die Absage benachrichtigt."
            />
            <View style={editorStyles.two}>
              <Button title="Zurück" variant="outline" onPress={() => setCancelling(false)} style={{ flex: 1 }} />
              <Button
                title="Termin absagen"
                variant="destructive"
                disabled={busy}
                onPress={() =>
                  Alert.alert("Termin absagen?", "Die Person wird benachrichtigt. Der Platz im Zeitfenster wird wieder frei.", [
                    { text: "Abbrechen", style: "cancel" },
                    { text: "Absagen", style: "destructive", onPress: () => onAction("cancel", reason) },
                  ])
                }
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : (
          <Button title="Absagen" variant="ghost" icon="close-circle-outline" disabled={busy} onPress={() => setCancelling(true)} />
        )
      ) : null}
    </View>
  );
}

export default function ViewingsScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<SlotFormInput>(EMPTY_FORM);
  const [formOpen, setFormOpen] = React.useState(false);
  const [message, setMessage] = React.useState<Message>(null);

  const managed = useQuery({ queryKey: ["managed-listing", propertyId], queryFn: () => managedListing(propertyId), enabled: Boolean(userId) });
  const listing = managed.data?.listing ?? null;
  const schedule = useQuery({ queryKey: ["seller-schedule", listing?.id], queryFn: () => sellerSchedule(listing!.id), enabled: Boolean(listing) });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["seller-schedule", listing?.id] });
    queryClient.invalidateQueries({ queryKey: ["owner-badges"] });
    queryClient.invalidateQueries({ queryKey: ["property-leads", propertyId] });
  };
  const onError = (error: unknown) => {
    setMessage({ tone: "error", text: describe(error) });
    refresh();
  };

  const create = useMutation({
    mutationFn: () => createSlots(listing!.id, form),
    onSuccess: (count) => {
      setMessage({ tone: "success", text: count === 1 ? "Das Zeitfenster wurde angelegt." : `${count} Zeitfenster wurden angelegt.` });
      setForm(EMPTY_FORM);
      setFormOpen(false);
      refresh();
    },
    onError,
  });

  const appointment = useMutation({
    mutationFn: (input: { id: string; action: SellerAppointmentAction; reason?: string }) => updateAppointment(input.id, input.action, input.reason),
    onSuccess: (_data, input) => {
      const texts: Record<SellerAppointmentAction, string> = {
        confirm: "Der Termin ist bestätigt. Die Person wurde benachrichtigt.",
        cancel: "Der Termin wurde abgesagt. Die Person wurde benachrichtigt.",
        complete: "Die Besichtigung ist als durchgeführt markiert.",
        no_show: "Der Termin ist als nicht erschienen markiert.",
      };
      setMessage({ tone: "success", text: texts[input.action] });
      refresh();
    },
    onError,
  });

  const slot = useMutation({
    mutationFn: async (input: { slot: SlotItem }) => (input.slot.booked > 0 ? cancelSlot(input.slot.id) : deleteSlot(input.slot.id).then(() => 0)),
    onSuccess: (cancelled) => {
      setMessage({
        tone: "success",
        text: cancelled > 0 ? `Das Zeitfenster wurde abgesagt (${cancelled === 1 ? "1 Termin" : `${cancelled} Termine`}).` : "Das Zeitfenster wurde gelöscht.",
      });
      refresh();
    },
    onError,
  });

  function confirmRemoveSlot(item: SlotItem) {
    if (item.booked > 0) {
      Alert.alert(
        "Zeitfenster absagen?",
        `${item.booked === 1 ? "Ein Termin wird" : `${item.booked} Termine werden`} abgesagt. Alle Betroffenen werden benachrichtigt.`,
        [
          { text: "Abbrechen", style: "cancel" },
          { text: "Zeitfenster absagen", style: "destructive", onPress: () => slot.mutate({ slot: item }) },
        ],
      );
    } else {
      Alert.alert("Zeitfenster löschen?", formatSlotRange(item.startsAt, item.endsAt), [
        { text: "Abbrechen", style: "cancel" },
        { text: "Löschen", style: "destructive", onPress: () => slot.mutate({ slot: item }) },
      ]);
    }
  }

  const busy = create.isPending || appointment.isPending || slot.isPending;
  const act = (item: AppointmentItem) => (action: SellerAppointmentAction, reason?: string) => appointment.mutate({ id: item.id, action, reason });

  let body: React.ReactNode;
  if (!userId) {
    body = <EmptyState icon="lock-closed-outline" title="Bitte anmelden" description="Melden Sie sich an, um Besichtigungen zu verwalten." />;
  } else if (managed.isPending || (listing && schedule.isPending)) {
    body = <Loading />;
  } else if (managed.isError || schedule.isError) {
    body = <Notice tone="error">{errorMessage(managed.error ?? schedule.error)}</Notice>;
  } else if (!listing || !schedule.data) {
    body = <EmptyState icon="home-outline" title="Nicht gefunden" description="Diese Immobilie gibt es nicht mehr oder sie gehört zu einem anderen Konto." />;
  } else {
    const data = schedule.data;
    const isPublic = listing.status === "published" || listing.status === "reserved";
    body = (
      <>
        {!isPublic ? (
          <Notice tone="info">Das Inserat ist derzeit nicht öffentlich. Interessenten können Zeitfenster erst buchen, wenn es veröffentlicht ist.</Notice>
        ) : null}
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

        {data.requests.length > 0 ? (
          <Card>
            <SectionTitle>Offene Anfragen</SectionTitle>
            {data.requests.map((item) => (
              <AppointmentCard key={item.id} appointment={item} showTime busy={busy} onAction={act(item)} />
            ))}
          </Card>
        ) : null}

        <Card>
          <SectionTitle>Zeitfenster</SectionTitle>
          {data.slots.length === 0 ? (
            <Text style={text.small}>Noch keine kommenden Zeitfenster. Legen Sie eines an, damit Interessenten einen Termin buchen können.</Text>
          ) : null}
          {data.slots.map((item) => {
            const free = item.capacity - item.booked;
            const visible = item.appointments.filter((a) => a.status !== "requested" && a.status !== "reschedule_requested");
            return (
              <View key={item.id} style={styles.slot}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.md }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[text.body, { fontWeight: "700" }]}>{formatSlotRange(item.startsAt, item.endsAt)}</Text>
                    <Text style={text.small}>
                      {item.booked} von {item.capacity} {item.capacity === 1 ? "Platz" : "Plätzen"} belegt
                      {item.note ? ` · ${item.note}` : ""}
                    </Text>
                  </View>
                  {free <= 0 ? <Badge tone="dark" label="Ausgebucht" /> : <Badge tone="green" label={`${free} frei`} />}
                </View>
                {visible.map((a) => (
                  <AppointmentCard key={a.id} appointment={a} showTime={false} busy={busy} onAction={act(a)} />
                ))}
                <Button
                  title={item.booked > 0 ? "Zeitfenster absagen" : "Zeitfenster löschen"}
                  variant="ghost"
                  icon={item.booked > 0 ? "close-circle-outline" : "trash-outline"}
                  disabled={busy}
                  onPress={() => confirmRemoveSlot(item)}
                />
              </View>
            );
          })}

          {formOpen ? (
            <View style={styles.form}>
              <Text style={text.label}>Neues Zeitfenster</Text>
              <Field
                label="Datum"
                value={form.date}
                onChangeText={(value) => setForm((f) => ({ ...f, date: maskDate(value) }))}
                keyboardType="number-pad"
                placeholder="TT.MM.JJJJ"
                maxLength={10}
              />
              <Row>
                <Field label="Von" value={form.startTime} onChangeText={(value) => setForm((f) => ({ ...f, startTime: maskTime(value) }))} keyboardType="number-pad" placeholder="HH:MM" maxLength={5} />
                <Field label="Bis" value={form.endTime} onChangeText={(value) => setForm((f) => ({ ...f, endTime: maskTime(value) }))} keyboardType="number-pad" placeholder="HH:MM" maxLength={5} />
              </Row>
              <ChoiceChips
                label="Dauer pro Termin"
                options={DURATIONS}
                value={String(form.durationMinutes)}
                onChange={(value) => setForm((f) => ({ ...f, durationMinutes: Number(value ?? 0) }))}
              />
              <Text style={text.small}>
                «Ganzer Zeitraum» legt ein Zeitfenster an, z. B. für eine offene Besichtigung. Mit einer Dauer wird der Zeitraum in Einzeltermine aufgeteilt. Zeiten gelten
                in Schweizer Ortszeit.
              </Text>
              <Stepper label="Personen pro Zeitfenster" value={form.capacity} min={1} max={50} onChange={(capacity) => setForm((f) => ({ ...f, capacity }))} />
              <Field
                label="Hinweis (optional)"
                value={form.note}
                onChangeText={(note) => setForm((f) => ({ ...f, note }))}
                maxLength={300}
                placeholder="z. B. Bitte beim Haupteingang klingeln"
              />
              <View style={editorStyles.two}>
                <Button title="Abbrechen" variant="outline" disabled={create.isPending} onPress={() => setFormOpen(false)} style={{ flex: 1 }} />
                <Button title="Anlegen" loading={create.isPending} disabled={busy} onPress={() => create.mutate()} style={{ flex: 1 }} />
              </View>
            </View>
          ) : (
            <Button
              title="Zeitfenster anlegen"
              icon="add"
              disabled={busy}
              onPress={() => {
                setMessage(null);
                setFormOpen(true);
              }}
            />
          )}
        </Card>

        {data.past.length > 0 ? (
          <Card>
            <SectionTitle>Vergangene Termine</SectionTitle>
            <Text style={text.small}>Termine der letzten 30 Tage.</Text>
            {data.past.map((item) => (
              <AppointmentCard key={item.id} appointment={item} showTime busy={busy} onAction={act(item)} />
            ))}
          </Card>
        ) : null}

        <Text style={text.small}>Serien mit Wiederholung, das Verschieben von Terminen und Notizen zu Terminen gibt es auf der Website.</Text>
        <Button
          title="Besichtigungen auf der Website öffnen"
          variant="outline"
          icon="open-outline"
          onPress={() => void WebBrowser.openBrowserAsync(`${CONFIG.siteUrl}/dashboard/besichtigungen`)}
        />
      </>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90} style={{ flex: 1 }}>
      <Stack.Screen options={{ title: "Besichtigungen" }} />
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={schedule.isRefetching} onRefresh={() => void schedule.refetch()} tintColor={colors.brand} />}
      >
        {body}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  slot: { gap: space.sm, padding: space.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  appointment: { gap: space.sm, padding: space.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  form: { gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
});
