import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import {
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FloorPlans, ListingDownloads, ReportSheet, ViewingSection } from "@/components/listing-extras";
import { Badge, Button, EmptyState, Field, Loading, Notice, SectionTitle, ToggleRow } from "@/components/ui";
import { createInquiry, listingBySlug, type ListingRow } from "@/lib/api";
import { listingExtras } from "@/lib/api-account";
import { useAuth } from "@/lib/auth";
import { CONFIG } from "@/lib/config";
import { useFavorites } from "@/lib/favorites";
import { formatArea, formatNumber, formatPrice, formatRooms, imageUrl } from "@/lib/format";
import { CONDITIONS, OFFER_TYPES, PROPERTY_TYPES, errorMessage } from "@/lib/labels";
import { colors, radius, space, text } from "@/lib/theme";

const WIDTH = Dimensions.get("window").width;

function facts(listing: ListingRow): [string, string][] {
  const rows: [string, string | null][] = [
    ["Objektart", PROPERTY_TYPES[listing.property_type]],
    ["Zimmer", listing.rooms !== null ? String(listing.rooms).replace(/\.0$/, "") : null],
    ["Wohnfläche", formatArea(listing.living_area)],
    ["Grundstück", formatArea(listing.plot_area)],
    ["Etage", listing.floor !== null ? (listing.floor === 0 ? "Erdgeschoss" : `${listing.floor}. Etage`) : null],
    ["Baujahr", listing.year_built !== null ? String(listing.year_built) : null],
    ["Zustand", listing.condition ? CONDITIONS[listing.condition] : null],
    ["Nebenkosten", listing.additional_costs !== null ? `CHF ${formatNumber(listing.additional_costs)} / Monat` : null],
  ];
  return rows.filter((row): row is [string, string] => Boolean(row[1]));
}

function amenities(listing: ListingRow): string[] {
  return [
    listing.has_balcony && "Balkon",
    listing.has_terrace && "Terrasse",
    listing.has_garden && "Garten",
    listing.has_elevator && "Lift",
    listing.has_garage && "Garage",
    (listing.parking_spaces ?? 0) > 0 && "Parkplatz",
  ].filter((v): v is string => Boolean(v));
}

export default function ListingScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const favorites = useFavorites();
  const [index, setIndex] = React.useState(0);
  const [contactOpen, setContactOpen] = React.useState(false);
  const [reportOpen, setReportOpen] = React.useState(false);
  const query = useQuery({ queryKey: ["listing", slug], queryFn: () => listingBySlug(slug) });
  const loaded = query.data?.listing;
  const extras = useQuery({ queryKey: ["listing-extras", loaded?.id], enabled: Boolean(loaded), queryFn: () => listingExtras(loaded!) });

  if (query.isPending) return <Loading />;
  if (query.isError) {
    return (
      <View style={{ padding: space.lg, gap: space.md }}>
        <Notice tone="error">{errorMessage(query.error)}</Notice>
        <Button title="Erneut versuchen" variant="outline" onPress={() => query.refetch()} />
      </View>
    );
  }
  if (!query.data) {
    return <EmptyState icon="home-outline" title="Nicht mehr verfügbar" description="Dieses Inserat wurde beendet oder ist nicht mehr öffentlich." />;
  }

  const { listing, images, contact, seller } = query.data;
  const photos = images.filter((image) => !image.is_floor_plan && imageUrl(image, "lg"));
  const floorPlans = images.filter((image) => image.is_floor_plan && imageUrl(image, "lg"));
  const features = extras.data?.features ?? [];
  const isOwner = userId === listing.owner_id;
  const favorite = favorites.isFavorite(listing.id);
  const url = `${CONFIG.siteUrl}/immobilien/${listing.slug}`;
  const place = listing.public_address ?? [listing.postal_code, listing.municipality].filter(Boolean).join(" ");
  const headline = [formatRooms(listing.rooms), formatArea(listing.living_area)].filter(Boolean).join(" · ");

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: space.lg }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Inserat teilen" hitSlop={8} onPress={() => Share.share({ message: `${listing.title ?? "Inserat"} – ${url}`, url })}>
                <Ionicons name="share-outline" size={24} color={colors.forest} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={favorite ? "Von der Merkliste entfernen" : "Auf die Merkliste setzen"}
                hitSlop={8}
                onPress={() => favorites.toggle(listing.id)}
              >
                <Ionicons name={favorite ? "heart" : "heart-outline"} size={24} color={favorite ? colors.destructive : colors.forest} />
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}>
        <View style={{ width: WIDTH, aspectRatio: 4 / 3, backgroundColor: colors.mutedBg }}>
          {photos.length ? (
            <FlatList
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              data={photos}
              keyExtractor={(image) => image.id}
              onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / WIDTH))}
              renderItem={({ item, index: i }) => (
                <View style={{ width: WIDTH }}>
                  <Image
                    source={imageUrl(item, "lg")}
                    style={{ flex: 1 }}
                    contentFit="cover"
                    transition={150}
                    accessibilityLabel={item.caption ?? `Bild ${i + 1} von ${photos.length}`}
                  />
                  {item.is_ai_visualization ? (
                    <View style={{ position: "absolute", left: 12, top: 12 }}>
                      <Badge tone="dark" label="KI-Visualisierung" />
                    </View>
                  ) : null}
                </View>
              )}
            />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="image-outline" size={40} color={colors.muted} />
            </View>
          )}
          {photos.length > 1 ? (
            <View style={styles.counter}>
              <Text style={{ color: colors.white, fontSize: 13, fontWeight: "600" }}>
                {index + 1} / {photos.length}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ padding: space.lg, gap: space.md }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Badge tone="green" label={OFFER_TYPES[listing.offer_type].verb} />
            {listing.status === "reserved" ? <Badge tone="amber" label="Reserviert" /> : null}
          </View>
          <Text style={text.title}>{formatPrice(listing)}</Text>
          <Text style={[text.heading, { fontSize: 20 }]}>{listing.title}</Text>
          {headline ? <Text style={[text.body, { color: colors.muted }]}>{headline}</Text> : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="location-outline" size={18} color={colors.muted} />
            <Text style={[text.body, { color: colors.muted, flex: 1 }]}>{[place, listing.canton].filter(Boolean).join(", ")}</Text>
          </View>

          {listing.short_description ? <Text style={[text.body, { fontWeight: "600" }]}>{listing.short_description}</Text> : null}

          <SectionTitle>Eckdaten</SectionTitle>
          <View style={styles.facts}>
            {facts(listing).map(([label, value], i) => (
              <View key={label} style={[styles.factRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <Text style={[text.body, { color: colors.muted }]}>{label}</Text>
                <Text style={[text.body, { fontWeight: "600", flexShrink: 1, textAlign: "right" }]}>{value}</Text>
              </View>
            ))}
          </View>
          {amenities(listing).length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {amenities(listing).map((a) => (
                <Badge key={a} label={a} />
              ))}
            </View>
          ) : null}

          {listing.description ? (
            <>
              <SectionTitle>Beschreibung</SectionTitle>
              <Text style={text.body}>{listing.description}</Text>
            </>
          ) : null}
          {features.length || listing.equipment_description ? (
            <>
              <SectionTitle>Ausstattung</SectionTitle>
              {features.length ? (
                <View accessibilityRole="list" style={styles.features}>
                  {features.map((label) => (
                    <View key={label} style={styles.feature}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.brand} />
                      <Text style={[text.body, { flexShrink: 1 }]}>{label}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {listing.equipment_description ? <Text style={text.body}>{listing.equipment_description}</Text> : null}
            </>
          ) : null}
          {listing.location_description ? (
            <>
              <SectionTitle>Lage</SectionTitle>
              <Text style={text.body}>{listing.location_description}</Text>
            </>
          ) : null}

          <FloorPlans images={floorPlans} width={WIDTH} />
          <ListingDownloads extras={extras.data} url={url} />
          {isOwner ? null : <ViewingSection listingId={listing.id} userId={userId} />}

          <SectionTitle>Anbieter</SectionTitle>
          <View style={styles.seller}>
            <View style={styles.sellerIcon}>
              <Ionicons name="person" size={20} color={colors.forest} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[text.body, { fontWeight: "600" }]}>{contact.name ?? seller?.display_name ?? "Privater Anbieter"}</Text>
              {contact.phone ? (
                <Text style={[text.body, { color: colors.primary }]} onPress={() => Linking.openURL(`tel:${contact.phone!.replace(/[^+\d]/g, "")}`)}>
                  {contact.phone}
                </Text>
              ) : (
                <Text style={text.small}>Kontakt über Immovia-Nachrichten</Text>
              )}
            </View>
          </View>
          {listing.is_demo ? <Notice tone="info">Dies ist ein Beispielinserat zur Veranschaulichung, kein echtes Angebot.</Notice> : null}
          {isOwner ? null : (
            <Button title="Inserat melden" variant="ghost" icon="flag-outline" onPress={() => (userId ? setReportOpen(true) : router.push("/login"))} />
          )}
        </View>
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
        {isOwner ? (
          <Button title="Mein Inserat bearbeiten" icon="create-outline" onPress={() => router.push({ pathname: "/objekt/[id]", params: { id: listing.property_id } })} />
        ) : (
          <Button title="Anbieter kontaktieren" icon="chatbubble-ellipses-outline" onPress={() => (userId ? setContactOpen(true) : router.push("/login"))} />
        )}
      </View>

      <ReportSheet open={reportOpen} listingId={listing.id} onClose={() => setReportOpen(false)} />
      <ContactSheet
        open={contactOpen}
        listing={listing}
        onClose={() => setContactOpen(false)}
        onSent={(conversationId) => {
          setContactOpen(false);
          router.push({ pathname: "/chat/[id]", params: { id: conversationId, title: contact.name ?? "Nachrichten" } });
        }}
      />
    </View>
  );
}

function ContactSheet({ open, listing, onClose, onSent }: { open: boolean; listing: ListingRow; onClose: () => void; onSent: (conversationId: string) => void }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = React.useState(
    `Guten Tag\n\nIch interessiere mich für Ihr Inserat «${listing.title ?? ""}». Ist die Immobilie noch verfügbar?\n\nFreundliche Grüsse`,
  );
  const [phone, setPhone] = React.useState("");
  const [viewing, setViewing] = React.useState(false);

  const send = useMutation({
    mutationFn: () => createInquiry({ listingId: listing.id, message: message.trim(), phone: phone.trim() || null, wantsViewing: viewing }),
    onSuccess: (conversationId) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      onSent(conversationId);
    },
  });

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.white }}>
        <View style={styles.sheetHeader}>
          <Text style={text.heading}>Anbieter kontaktieren</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Schliessen" hitSlop={10} onPress={onClose}>
            <Ionicons name="close" size={26} color={colors.forest} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
          {send.isError ? <Notice tone="error">{errorMessage(send.error)}</Notice> : null}
          <Field label="Ihre Nachricht" value={message} onChangeText={setMessage} multiline maxLength={3000} hint="Mindestens 10 Zeichen." />
          <Field label="Telefon (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" textContentType="telephoneNumber" />
          <ToggleRow label="Ich möchte die Immobilie besichtigen" value={viewing} onValueChange={setViewing} />
          <Text style={text.small}>Der Anbieter sieht Ihren Namen und Ihre Nachricht. Ihre E-Mail-Adresse geben wir nicht weiter.</Text>
          <Button title="Nachricht senden" icon="send" onPress={() => send.mutate()} loading={send.isPending} disabled={message.trim().length < 10} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  counter: { position: "absolute", right: 12, bottom: 12, backgroundColor: "rgba(25,40,32,0.75)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  facts: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: space.lg, backgroundColor: colors.surface },
  factRow: { flexDirection: "row", justifyContent: "space-between", gap: space.md, paddingVertical: 12 },
  features: { flexDirection: "row", flexWrap: "wrap", rowGap: space.sm },
  feature: { width: "50%", flexDirection: "row", alignItems: "center", gap: 6, paddingRight: space.sm },
  seller: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  sellerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.mint100, alignItems: "center", justifyContent: "center" },
  cta: { position: "absolute", left: 0, right: 0, bottom: 0, padding: space.md, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
});
