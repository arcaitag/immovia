import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as React from "react";
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, Chip, Field, Notice, SectionTitle } from "@/components/ui";
import type { ImageRow } from "@/lib/api";
import {
  APPOINTMENT_STATUS,
  REPORT_REASONS,
  accountErrorMessage,
  bookViewing,
  formatSlot,
  reportListing,
  viewingSlots,
  type ListingExtras,
  type ReportReason,
  type ViewingSlot,
} from "@/lib/api-account";
import { imageUrl } from "@/lib/format";
import { colors, radius, space, text } from "@/lib/theme";

function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={styles.sheetHeader}>
      <Text style={text.heading}>{title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Schliessen" hitSlop={10} onPress={onClose}>
        <Ionicons name="close" size={26} color={colors.forest} />
      </Pressable>
    </View>
  );
}

// --- Grundrisse --------------------------------------------------------------

/** Grundrisse als eigene Galerie (Bilder mit is_floor_plan), ganz sichtbar statt zugeschnitten. */
export function FloorPlans({ images, width }: { images: ImageRow[]; width: number }) {
  const [index, setIndex] = React.useState(0);
  if (images.length === 0) return null;
  const itemWidth = width - space.lg * 2;
  return (
    <>
      <SectionTitle>{images.length === 1 ? "Grundriss" : "Grundrisse"}</SectionTitle>
      <View style={[styles.plans, { width: itemWidth }]}>
        <FlatList
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          data={images}
          keyExtractor={(image) => image.id}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / itemWidth))}
          renderItem={({ item, index: i }) => (
            <Image
              source={imageUrl(item, "lg")}
              style={{ width: itemWidth, aspectRatio: 4 / 3 }}
              contentFit="contain"
              transition={150}
              accessibilityLabel={item.caption ?? `Grundriss ${i + 1} von ${images.length}`}
            />
          )}
        />
      </View>
      {images.length > 1 ? (
        <Text style={[text.small, { textAlign: "center" }]}>
          {index + 1} / {images.length} – zum Blättern wischen
        </Text>
      ) : null}
    </>
  );
}

// --- Dokumente und Dossier ---------------------------------------------------

/** Öffentliche Dokumente und Dossier: Die Dateien liegen auf der Website, dort werden sie geöffnet. */
export function ListingDownloads({ extras, url }: { extras: ListingExtras | undefined; url: string }) {
  if (!extras || (!extras.hasPublicDossier && extras.documents.length === 0)) return null;
  const open = () => WebBrowser.openBrowserAsync(url).catch(() => undefined);
  const rows = [
    ...(extras.hasPublicDossier ? [{ id: "dossier", title: "Verkaufsdossier (PDF)", icon: "book-outline" as const }] : []),
    ...extras.documents.map((d) => ({ id: d.id, title: d.title, icon: "document-text-outline" as const })),
  ];
  return (
    <>
      <SectionTitle>Unterlagen</SectionTitle>
      <View style={styles.list}>
        {rows.map((row, i) => (
          <Pressable
            key={row.id}
            accessibilityRole="link"
            accessibilityLabel={row.title}
            accessibilityHint="Öffnet das Inserat auf der Website"
            onPress={open}
            style={({ pressed }) => [styles.listRow, i > 0 && styles.divider, pressed && { backgroundColor: colors.mint100 }]}
          >
            <Ionicons name={row.icon} size={21} color={colors.forest} />
            <Text style={[text.body, { flex: 1 }]}>{row.title}</Text>
            <Ionicons name="open-outline" size={18} color={colors.muted} />
          </Pressable>
        ))}
      </View>
      <Text style={text.small}>Die Unterlagen öffnen Sie auf der Website im Inserat.</Text>
    </>
  );
}

// --- Besichtigung ------------------------------------------------------------

/** Freie Besichtigungstermine (get_viewing_slots) und Anfrage (book_viewing). Nur für angemeldete Interessenten buchbar. */
export function ViewingSection({ listingId, userId }: { listingId: string; userId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [booked, setBooked] = React.useState(false);
  const slots = useQuery({ queryKey: ["viewing-slots", listingId, userId], queryFn: () => viewingSlots(listingId), staleTime: 0 });

  const all = slots.data ?? [];
  const existing = all.find((s) => s.my_appointment_id && s.my_status && s.my_status !== "cancelled");
  const bookable = all.filter((s) => s.bookable);
  if (!existing && bookable.length === 0) return null;

  return (
    <>
      <SectionTitle>Besichtigung</SectionTitle>
      {existing ? (
        <Notice tone={booked ? "success" : "info"}>
          {booked ? "Besichtigung angefragt: " : "Ihr Termin: "}
          {formatSlot(existing.starts_at, existing.ends_at)} ({APPOINTMENT_STATUS[existing.my_status ?? "requested"]}). Die Verkäuferseite bestätigt den Termin, Sie
          werden benachrichtigt.
        </Notice>
      ) : (
        <>
          <Text style={[text.body, { color: colors.muted }]}>
            {bookable.length === 1 ? "Es ist 1 Zeitfenster frei." : `Es sind ${bookable.length} Zeitfenster frei.`} Nächster Termin: {formatSlot(bookable[0].starts_at, bookable[0].ends_at)}.
          </Text>
          <Button title="Besichtigung anfragen" variant="outline" icon="calendar-outline" onPress={() => (userId ? setOpen(true) : router.push("/login"))} />
        </>
      )}
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        {open ? (
          <ViewingForm
            listingId={listingId}
            slots={bookable}
            onClose={() => setOpen(false)}
            onBooked={() => {
              setBooked(true);
              setOpen(false);
            }}
          />
        ) : null}
      </Modal>
    </>
  );
}

function ViewingForm({ listingId, slots, onClose, onBooked }: { listingId: string; slots: ViewingSlot[]; onClose: () => void; onBooked: () => void }) {
  const queryClient = useQueryClient();
  const [slotId, setSlotId] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState("");

  const book = useMutation({
    mutationFn: () => bookViewing(slotId!, message),
    onSuccess: onBooked,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["viewing-slots", listingId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.white }}>
      <SheetHeader title="Besichtigung anfragen" onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
        {book.isError ? <Notice tone="error">{accountErrorMessage(book.error)}</Notice> : null}
        <Text style={[text.body, { color: colors.muted }]}>Wählen Sie ein freies Zeitfenster. Die Verkäuferseite bestätigt den Termin, Sie werden benachrichtigt.</Text>
        {slots.length === 0 ? (
          <Notice tone="info">Zurzeit sind keine Zeitfenster frei. Schreiben Sie der Verkäuferseite eine Nachricht, um einen Termin zu vereinbaren.</Notice>
        ) : (
          <View accessibilityRole="radiogroup" accessibilityLabel="Zeitfenster" style={{ gap: space.sm }}>
            {slots.map((slot) => {
              const selected = slot.id === slotId;
              return (
                <Pressable
                  key={slot.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setSlotId(slot.id)}
                  style={[styles.slot, selected && { borderColor: colors.brand, backgroundColor: colors.mint100 }]}
                >
                  <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={22} color={selected ? colors.primary : colors.muted} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[text.body, { fontWeight: "600" }]}>{formatSlot(slot.starts_at, slot.ends_at)}</Text>
                    <Text style={text.small}>
                      {slot.available === 1 ? "1 Platz frei" : `${slot.available} Plätze frei`}
                      {slot.note ? ` · ${slot.note}` : ""}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        <Field label="Nachricht (optional)" value={message} onChangeText={setMessage} multiline maxLength={1000} hint="Höchstens 1000 Zeichen." />
        <Button title="Termin anfragen" icon="calendar-outline" onPress={() => book.mutate()} loading={book.isPending} disabled={!slotId} />
        <Text style={text.small}>Pro Inserat ist ein offener Termin möglich. Zeiten in der Zeitzone Ihres Geräts.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// --- Inserat melden ----------------------------------------------------------

export function ReportSheet({ open, listingId, onClose }: { open: boolean; listingId: string; onClose: () => void }) {
  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {open ? <ReportForm listingId={listingId} onClose={onClose} /> : null}
    </Modal>
  );
}

function ReportForm({ listingId, onClose }: { listingId: string; onClose: () => void }) {
  const [reason, setReason] = React.useState<ReportReason | null>(null);
  const [details, setDetails] = React.useState("");
  const report = useMutation({ mutationFn: () => reportListing(listingId, reason!, details) });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.white }}>
      <SheetHeader title="Inserat melden" onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
        {report.isSuccess ? (
          <>
            <Notice tone="success">Vielen Dank. Ihre Meldung wurde an unser Team übermittelt.</Notice>
            <Button title="Schliessen" onPress={onClose} />
          </>
        ) : (
          <>
            {report.isError ? <Notice tone="error">{accountErrorMessage(report.error)}</Notice> : null}
            <Text style={[text.body, { color: colors.muted }]}>Unser Team prüft Ihre Meldung. Der Anbieter erfährt nicht, wer das Inserat gemeldet hat.</Text>
            <View style={{ gap: space.sm }}>
              <Text style={text.label}>Grund</Text>
              <View accessibilityRole="radiogroup" accessibilityLabel="Grund" style={styles.wrap}>
                {(Object.keys(REPORT_REASONS) as ReportReason[]).map((key) => (
                  <Chip key={key} label={REPORT_REASONS[key]} selected={reason === key} onPress={() => setReason(key)} />
                ))}
              </View>
            </View>
            <Field label="Beschreibung (optional)" value={details} onChangeText={setDetails} multiline maxLength={2000} hint="Was ist Ihnen aufgefallen?" />
            <Button title="Meldung senden" onPress={() => report.mutate()} loading={report.isPending} disabled={!reason} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  plans: { borderRadius: radius.lg, backgroundColor: colors.mutedBg, overflow: "hidden" },
  list: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.white },
  listRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, minHeight: 52, paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  slot: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 60, padding: space.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
