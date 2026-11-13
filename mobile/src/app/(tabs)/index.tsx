import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter, type Href } from "expo-router";
import * as React from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Accordion, CheckList, FeatureCard, IconTile, Section, TextLink, contentStyles, mint50, photo, useSiteLink, type IconName } from "@/components/content";
import { AppHeader, Logo } from "@/components/app-header";
import { ListingCard } from "@/components/listing-card";
import { FadeUp, RiseWord, Swoosh } from "@/components/motion";
import { Badge, Button, Chip, Loading } from "@/components/ui";
import { EMPTY_FILTERS, type SearchFilters } from "@/lib/api";
import { encodeFiltersParam } from "@/lib/api-account";
import { latestListings } from "@/lib/api-content";
import { HOME_FAQ } from "@/lib/content/faq";
import { useFavorites } from "@/lib/favorites";
import { formatNumber } from "@/lib/format";
import { MARKETING_IMAGES } from "@/lib/marketing-images";
import type { Enums } from "@/lib/supabase";
import { colors, radius, space, text } from "@/lib/theme";

/** Startseite der App – Inhalt und Texte wie die Startseite der Website (src/app/(site)/page.tsx). */

type Offer = Enums<"offer_type">;

// Schnellsuche wie src/lib/search/hero.ts
const PRICE_OPTIONS: Record<Offer, readonly number[]> = {
  sale: [300_000, 500_000, 750_000, 1_000_000, 1_250_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000],
  rent: [1_000, 1_500, 2_000, 2_500, 3_000, 3_500, 4_000, 5_000, 7_500],
};
const ROOM_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];
const TYPE_GROUPS: { value: string; label: string; types: Enums<"property_type">[] }[] = [
  { value: "wohnung", label: "Wohnung", types: ["apartment"] },
  { value: "haus", label: "Haus", types: ["single_family_house", "semi_detached_house", "terraced_house", "multi_family_house"] },
  { value: "grundstueck", label: "Grundstück", types: ["plot"] },
  { value: "gewerbe", label: "Gewerbe und Büro", types: ["commercial", "office"] },
  { value: "neubau", label: "Neubauprojekt", types: ["new_build_project"] },
];

const HERO_WORDS = ["Immobilien.", "Einfach.", "Digital."];

const SELL_POINTS = [
  "Keine Inseratgebühren und keine Provision",
  "Preis, Texte und Kontakt selbst bestimmen",
  "Genaue Adresse nur, wenn Sie es wünschen",
  "Unterlagen gezielt und widerrufbar freigeben",
];

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "home-outline", title: "Immobilie erfassen", text: "Der Assistent fragt nur, was für Ihr Objekt wichtig ist." },
  { icon: "speedometer-outline", title: "Wert einschätzen", text: "Preisspanne mit Datenquellen – oder ein ehrlicher Hinweis, wenn Daten fehlen." },
  { icon: "document-text-outline", title: "Professionell präsentieren", text: "Optimierte Bilder, Textvorschläge und ein Verkaufsdossier." },
  { icon: "chatbubble-outline", title: "Interessenten verwalten", text: "Anfragen, Nachrichten und Besichtigungen an einem Ort." },
];

const DOSSIER_PREVIEWS = [
  { name: "Modern", image: MARKETING_IMAGES.livingRoom.src, dark: false },
  { name: "Premium", image: MARKETING_IMAGES.auth.src, dark: true },
  { name: "Klassisch", image: MARKETING_IMAGES.kitchen.src, dark: false },
];

const VALUATION_FACTORS = [
  ["Lage und Besonnung", "wertsteigernd"],
  ["Baujahr und Zustand", "neutral"],
  ["Vergleichsangebote in der Region", "12 Angebote"],
] as const;

const EXAMPLE_LEADS = [
  { name: "Martin S.", status: "Besichtigung angefragt", text: "Wäre eine Besichtigung am Samstag möglich?" },
  { name: "Laura K.", status: "Dossier gesendet", text: "Vielen Dank für die Unterlagen!" },
  { name: "Daniel M.", status: "Neue Anfrage", text: "Ist die Wohnung noch verfügbar?" },
];

/** Klar gekennzeichnete Beispielkarten, solange noch keine Inserate online sind (wie EXAMPLE_LISTINGS der Website). */
const EXAMPLE_LISTINGS = [
  { title: "Helle 4.5-Zimmer-Wohnung mit Balkon", offer: "sale" as Offer, price: 765000, facts: "4.5 Zimmer · 112 m² · Wohnung", place: "3072 Ostermundigen", image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267" },
  { title: "Modernes Einfamilienhaus mit Garten", offer: "sale" as Offer, price: 1290000, facts: "5.5 Zimmer · 168 m² · Einfamilienhaus", place: "3600 Thun", image: "https://images.unsplash.com/photo-1750160868338-c0813f5dfa31" },
  { title: "Moderne 2.5-Zimmer-Stadtwohnung", offer: "rent" as Offer, price: 1980, facts: "2.5 Zimmer · 64 m² · Wohnung", place: "8004 Zürich", image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688" },
];

const FOOTER_LINKS = [
  { label: "Ratgeber", path: "/ratgeber" },
  { label: "So funktioniert Immovia", path: "/so-funktionierts" },
  { label: "Für Immobilienfirmen", path: "/fuer-makler" },
  { label: "Kontakt", path: "/kontakt" },
  { label: "Datenschutz", path: "/datenschutz" },
  { label: "AGB", path: "/agb" },
  { label: "Impressum", path: "/impressum" },
];

export default function HomeScreen() {
  const open = useSiteLink();
  const favorites = useFavorites();
  const latest = useQuery({ queryKey: ["latest-listings"], queryFn: () => latestListings(3) });
  const cards = latest.data ?? [];
  // Noch keine Inserate: klar gekennzeichnete Beispiele statt einer leeren Fläche
  const showExamples = latest.isSuccess && cards.length === 0;
  const [scrolled, setScrolled] = React.useState(false);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.white }}>
      <AppHeader scrolled={scrolled} />
      <ScrollView
        style={{ backgroundColor: colors.white }}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={32}
        onScroll={(event) => {
          const next = event.nativeEvent.contentOffset.y > 8;
          if (next !== scrolled) setScrolled(next);
        }}
        refreshControl={<RefreshControl refreshing={latest.isRefetching} onRefresh={() => void latest.refetch()} tintColor={colors.brand} />}
      >
        {/* Hero mit Suche */}
        <View style={styles.hero}>
          <Image source={photo(MARKETING_IMAGES.hero.src, 1400)} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ left: "62%", top: "70%" }} transition={200} />
          <HeroFade />
          <View style={{ padding: space.lg, paddingTop: 28, paddingBottom: space.xl, gap: space.lg }}>
            {/* Die drei Wörter steigen nacheinander auf, danach zeichnet sich der Strich unter «Digital.» */}
            <View accessible accessibilityRole="header" accessibilityLabel="Immobilien. Einfach. Digital." style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 9 }}>
              {HERO_WORDS.map((word, index) =>
                index === HERO_WORDS.length - 1 ? (
                  <View key={word}>
                    <RiseWord delay={100 + index * 140} style={styles.heroTitle} lineHeight={40}>
                      {word}
                    </RiseWord>
                    <Swoosh delay={850} style={{ width: "92%", marginTop: -3 }} />
                  </View>
                ) : (
                  <RiseWord key={word} delay={100 + index * 140} style={styles.heroTitle} lineHeight={40}>
                    {word}
                  </RiseWord>
                ),
              )}
            </View>
            <FadeUp delay={450}>
              <Text style={styles.heroLead}>Entdecke, bewerte und vermarkte Immobilien.{"\n"}Alles auf einer Plattform.</Text>
            </FadeUp>
            <FadeUp delay={550}>
              <HeroSearch />
            </FadeUp>
          </View>
        </View>

        {/* Aktuelle Immobilienangebote */}
        <Section>
          <View style={{ gap: 2 }}>
            <Text accessibilityRole="header" style={contentStyles.sectionTitle}>
              Aktuelle Immobilienangebote
            </Text>
            <TextLink label="Alle Angebote" onPress={() => open("/immobilien")} />
          </View>
          {latest.isPending ? <Loading /> : null}
          {latest.isError ? <Text style={text.small}>Die Inserate konnten nicht geladen werden. Ziehen Sie nach unten, um es erneut zu versuchen.</Text> : null}
          {showExamples ? (
            <Text style={text.small}>
              Noch sind keine Inserate online. Die Karten zeigen <Text style={{ fontWeight: "700", color: colors.foreground }}>Beispiele</Text>, wie Inserate auf Immovia
              erscheinen.
            </Text>
          ) : null}
          {showExamples
            ? EXAMPLE_LISTINGS.map((example) => <ExampleCard key={example.title} example={example} />)
            : cards.map((row) => <ListingCard key={row.id} row={row} favorite={favorites.isFavorite(row.id)} onToggleFavorite={() => favorites.toggle(row.id)} />)}
          {latest.isSuccess && !showExamples && cards.length < 3 ? (
            <View style={styles.freeSlot}>
              <Text style={contentStyles.cardTitle}>Ihre Immobilie hier?</Text>
              <Text style={contentStyles.cardText}>Kostenlos inserieren – mit Bewertung, Dossier und Anfragen an einem Ort.</Text>
              <Button title="Kostenlos inserieren" onPress={() => open("/verkaufen/start")} style={{ alignSelf: "flex-start", marginTop: space.sm }} />
            </View>
          ) : null}
        </Section>

        {/* Immobilien kostenlos verkaufen */}
        <Section tone="mint">
          <Image source={photo(MARKETING_IMAGES.sell.src)} accessibilityLabel={MARKETING_IMAGES.sell.alt} style={styles.photo} contentFit="cover" transition={150} />
          <Text accessibilityRole="header" style={contentStyles.sectionTitle}>
            Immobilien kostenlos verkaufen
          </Text>
          <Text style={contentStyles.sectionText}>Inserieren Sie Wohnung, Haus oder Grundstück ohne Provision – mit den Werkzeugen, die sonst nur Makler haben.</Text>
          <CheckList items={SELL_POINTS} />
          <View style={{ gap: space.md, marginTop: space.sm }}>
            <Button title="Kostenlos inserieren" onPress={() => open("/verkaufen/start")} />
            <Button title="So verkaufen Sie mit Immovia" variant="outline" onPress={() => open("/verkaufen")} />
          </View>
        </Section>

        {/* So funktioniert Immovia */}
        <Section>
          <View style={{ gap: 2 }}>
            <Text accessibilityRole="header" style={contentStyles.sectionTitle}>
              So funktioniert Immovia
            </Text>
            <TextLink label="Mehr zum Ablauf" onPress={() => open("/so-funktionierts")} />
          </View>
          <View style={{ gap: space.md }}>
            {STEPS.map((step, index) => (
              <FeatureCard key={step.title} icon={step.icon} title={step.title} text={step.text} step={`Schritt ${index + 1}`} />
            ))}
          </View>
        </Section>

        {/* Immobilienbewertung */}
        <Section style={{ paddingTop: 0 }}>
          <Text accessibilityRole="header" style={contentStyles.sectionTitle}>
            Kostenlose Immobilienbewertung
          </Text>
          <Text style={contentStyles.sectionText}>
            Preisspanne, möglicher Inseratepreis und die wichtigsten Wertfaktoren – mit offengelegten Datenquellen. Reichen die Daten nicht, zeigen wir keine erfundene
            Zahl.
          </Text>
          <Button title="Kostenlos bewerten" icon="speedometer-outline" onPress={() => open("/bewerten")} />
          <View accessibilityLabel="Beispielansicht einer Bewertung" style={[contentStyles.card, { borderRadius: radius.xl, padding: space.xl, marginTop: space.sm }]}>
            <View style={styles.rowBetween}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.muted }}>Geschätzter Marktwert</Text>
              <Badge tone="dark" label="Beispiel" />
            </View>
            <Text style={styles.valuation}>CHF 765’000</Text>
            <View style={styles.range}>
              <View style={{ flex: 1, backgroundColor: colors.mint200 }} />
              <View style={{ flex: 1.2, backgroundColor: colors.brand }} />
              <View style={{ flex: 1, backgroundColor: colors.mint200 }} />
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.tiny}>CHF 730’000</Text>
              <Text style={styles.tiny}>CHF 795’000</Text>
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: space.md, paddingTop: space.md, gap: 10 }}>
              {VALUATION_FACTORS.map(([factor, effect]) => (
                <View key={factor} style={styles.rowBetween}>
                  <Text style={{ fontSize: 14.5, color: colors.foreground, flex: 1 }}>{factor}</Text>
                  <Text style={{ fontSize: 14.5, color: colors.muted }}>{effect}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.tiny, { marginTop: space.md }]}>Illustrative Darstellung. Echte Bewertungen nennen Datenbasis, Datum und Unsicherheit.</Text>
          </View>
        </Section>

        {/* Verkaufsdossier und Bildoptimierung */}
        <Section tone="mint">
          <Text accessibilityRole="header" style={contentStyles.sectionTitle}>
            Verkaufsdossier und Bildoptimierung
          </Text>
          <View style={[contentStyles.card, styles.bigCard]}>
            <View style={styles.cardHead}>
              <IconTile icon="document-text-outline" />
              <Text style={styles.bigCardTitle}>Verkaufsdossier als PDF</Text>
            </View>
            <Text style={styles.bigCardText}>Bildergalerie, Eckdaten, Lage und Kontakt in einem Dossier – drei Vorlagen, neue Versionen auf Knopfdruck.</Text>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row", gap: space.md, marginTop: space.sm }}>
              {DOSSIER_PREVIEWS.map((preview) => (
                <View key={preview.name} style={styles.dossier}>
                  <View style={{ aspectRatio: 3 / 4 }}>
                    <Image source={photo(preview.image, 400)} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                    <View style={[styles.dossierBand, { backgroundColor: preview.dark ? "rgba(39,75,50,0.85)" : "rgba(255,255,255,0.9)" }]} />
                  </View>
                  <Text style={{ fontSize: 12.5, fontWeight: "600", color: colors.foreground, paddingHorizontal: 10, paddingVertical: 8 }}>{preview.name}</Text>
                </View>
              ))}
            </View>
            <TextLink label="Dossier-Vorlagen ansehen" onPress={() => open("/verkaufen#dossier")} />
          </View>

          <View style={[contentStyles.card, styles.bigCard]}>
            <View style={styles.cardHead}>
              <IconTile icon="camera-outline" />
              <Text style={styles.bigCardTitle}>Bilder automatisch verbessern</Text>
            </View>
            <Text style={styles.bigCardText}>Helligkeit, Kontrast, Weissabgleich und Schärfe optimieren, Horizont begradigen. Das Original bleibt immer erhalten.</Text>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.beforeAfter}>
              <View style={{ flex: 1, aspectRatio: 4 / 3 }}>
                <Image source={photo(MARKETING_IMAGES.interior.src, 600)} style={StyleSheet.absoluteFill} contentFit="cover" />
                {/* «Vorher»: dunkler und flauer */}
                <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(70,70,66,0.32)" }]} />
                <Text style={styles.photoTag}>Vorher</Text>
              </View>
              <View style={{ flex: 1, aspectRatio: 4 / 3, borderLeftWidth: 2, borderLeftColor: colors.white }}>
                <Image source={photo(MARKETING_IMAGES.interior.src, 600)} style={StyleSheet.absoluteFill} contentFit="cover" />
                <Text style={styles.photoTag}>Nachher</Text>
              </View>
            </View>
            <Text style={[contentStyles.cardText, { marginTop: space.sm }]}>Fotos direkt mit dem Smartphone aufnehmen und hochladen.</Text>
          </View>
        </Section>

        {/* Kommunikation und Interessentenverwaltung */}
        <Section>
          <Text accessibilityRole="header" style={contentStyles.sectionTitle}>
            Kommunikation und Interessentenverwaltung
          </Text>
          <Text style={contentStyles.sectionText}>
            Nachrichten, Interessentenstatus, private Notizen und Besichtigungen – übersichtlich an einem Ort statt im E-Mail-Postfach.
          </Text>
          <View style={{ gap: space.md }}>
            <View style={styles.bullet}>
              <Ionicons name="calendar-outline" size={21} color={colors.brand} />
              <Text style={styles.bulletText}>Besichtigungen mit Zeitfenstern, ohne Doppelbuchungen</Text>
            </View>
            <View style={styles.bullet}>
              <Ionicons name="file-tray-outline" size={21} color={colors.brand} />
              <Text style={styles.bulletText}>Alle Anfragen zu einem Inserat gebündelt</Text>
            </View>
          </View>
          <View accessibilityLabel="Beispielansicht Interessenten" style={[contentStyles.card, { borderRadius: radius.xl, padding: space.sm, gap: 0 }]}>
            <View style={[styles.rowBetween, { paddingHorizontal: space.md, paddingVertical: space.md }]}>
              <Text style={{ fontSize: 14.5, fontWeight: "600", color: colors.foreground }}>Interessenten</Text>
              <Badge tone="dark" label="Beispiel" />
            </View>
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg }}>
              {EXAMPLE_LEADS.map((lead, index) => (
                <View key={lead.name} style={[styles.lead, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <View style={styles.avatar}>
                    <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.forest }}>{lead.name.slice(0, 1)}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm }}>
                      <Text style={{ fontSize: 14.5, fontWeight: "600", color: colors.foreground }}>{lead.name}</Text>
                      <Badge tone={lead.status === "Neue Anfrage" ? "green" : "amber"} label={lead.status} />
                    </View>
                    <Text numberOfLines={1} style={{ fontSize: 14.5, color: colors.muted }}>
                      {lead.text}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </Section>

        {/* Angebote für Firmen */}
        <View style={{ paddingHorizontal: space.lg }}>
          <View style={styles.firms}>
            <Text accessibilityRole="header" style={[contentStyles.sectionTitle, { color: colors.white }]}>
              Angebote für Immobilienfirmen
            </Text>
            <Text style={{ fontSize: 16, lineHeight: 24, color: "rgba(255,255,255,0.8)" }}>
              Mehrere Objekte, Mitarbeitende und Interessenten zentral verwalten – mit Firmenprofil und Rollen für Ihr Team.
            </Text>
            <View style={{ gap: space.md, marginTop: space.sm }}>
              <Pressable accessibilityRole="button" onPress={() => open("/fuer-makler")} style={({ pressed }) => [styles.firmsButton, { backgroundColor: pressed ? colors.mint200 : colors.mint100 }]}>
                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.forest }}>Mehr für Firmen</Text>
              </Pressable>
              <Pressable
                accessibilityRole="link"
                accessibilityHint="Öffnet die Website"
                onPress={() => open(`/registrieren?weiter=${encodeURIComponent("/dashboard/firma")}`)}
                style={({ pressed }) => [styles.firmsButton, { borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", backgroundColor: pressed ? "rgba(255,255,255,0.1)" : "transparent" }]}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.white }}>Firmenkonto erstellen</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Häufige Fragen */}
        <Section>
          <Text accessibilityRole="header" style={contentStyles.sectionTitle}>
            Häufige Fragen
          </Text>
          <Text style={contentStyles.sectionText}>Weitere Antworten finden Sie in den FAQ und im Ratgeber.</Text>
          <Accordion items={HOME_FAQ} />
          <Button title="Alle Fragen" variant="outline" onPress={() => open("/faq")} />
        </Section>

        {/* Fusszeile */}
        <View style={styles.footer}>
          <Logo size={28} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: space.xl }}>
            {FOOTER_LINKS.map((link) => (
              <Pressable key={link.path} accessibilityRole="link" onPress={() => open(link.path)} style={({ pressed }) => [{ minHeight: 44, justifyContent: "center" }, pressed && { opacity: 0.6 }]}>
                <Text style={{ fontSize: 15, color: colors.forest, fontWeight: "500" }}>{link.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Weisser Verlauf über dem Hero-Bild (oben deckend, unten durchsichtig), damit der Text lesbar bleibt. */
function HeroFade() {
  // Viele schmale Streifen ergeben einen weichen Verlauf – ohne zusätzliche Bibliothek
  const bands = Array.from({ length: 48 }, (_, index) => 0.92 - (0.77 * index) / 47);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bands.map((opacity, index) => (
        <View key={index} style={{ flex: 1, backgroundColor: `rgba(255,255,255,${opacity.toFixed(3)})` }} />
      ))}
    </View>
  );
}

function HeroSearch() {
  const router = useRouter();
  const open = useSiteLink();
  const [offer, setOffer] = React.useState<Offer>("sale");
  const [place, setPlace] = React.useState("");
  const [typeGroup, setTypeGroup] = React.useState<string | null>(null);
  const [priceMax, setPriceMax] = React.useState<number | null>(null);
  const [roomsMin, setRoomsMin] = React.useState<number | null>(null);
  // Objektart, Preis und Zimmer erst auf Wunsch einblenden
  const [moreOpen, setMoreOpen] = React.useState(false);

  function chooseOffer(next: Offer) {
    if (next === offer) return;
    setOffer(next);
    // Kaufpreise und Mieten haben unterschiedliche Grenzen
    setPriceMax(null);
  }

  function submit() {
    const filters: SearchFilters = {
      ...EMPTY_FILTERS,
      offer,
      query: place.trim(),
      types: TYPE_GROUPS.find((g) => g.value === typeGroup)?.types ?? [],
      priceMax,
      roomsMin,
    };
    router.push({ pathname: "/suchen", params: { suche: encodeFiltersParam(filters), t: String(Date.now()) } } as Href);
  }

  return (
    <View>
      <View accessibilityRole="tablist" style={styles.offerTabs}>
        {(["sale", "rent"] as const).map((value) => {
          const selected = offer === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => chooseOffer(value)}
              style={[styles.offerTab, selected && { backgroundColor: colors.mint200 }]}
            >
              <Ionicons name={value === "sale" ? "home-outline" : "key-outline"} size={18} color={selected ? colors.forest : colors.foreground} />
              <Text style={{ fontSize: 16, fontWeight: "600", color: selected ? colors.forest : colors.foreground }}>{value === "sale" ? "Kaufen" : "Mieten"}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.searchCard}>
        <View style={styles.searchField}>
          <Ionicons name="location-outline" size={19} color={colors.muted} />
          <TextInput
            accessibilityLabel="Ort, PLZ oder Region"
            placeholder="Ort, PLZ oder Region"
            placeholderTextColor="#7c867f"
            value={place}
            onChangeText={setPlace}
            returnKeyType="search"
            onSubmitEditing={submit}
            autoCorrect={false}
            style={{ flex: 1, fontSize: 16, color: colors.foreground, paddingVertical: 12 }}
          />
        </View>

        {moreOpen ? (
          <View style={{ gap: space.md }}>
            <FilterRow label="Immobilientyp">
              {TYPE_GROUPS.map((group) => (
                <Chip key={group.value} label={group.label} selected={typeGroup === group.value} onPress={() => setTypeGroup(typeGroup === group.value ? null : group.value)} />
              ))}
            </FilterRow>
            <FilterRow label={offer === "sale" ? "Kaufpreis bis" : "Miete pro Monat bis"}>
              {PRICE_OPTIONS[offer].map((price) => (
                <Chip key={price} label={`bis CHF ${formatNumber(price)}`} selected={priceMax === price} onPress={() => setPriceMax(priceMax === price ? null : price)} />
              ))}
            </FilterRow>
            <FilterRow label="Zimmer ab">
              {ROOM_OPTIONS.map((rooms) => (
                <Chip key={rooms} label={`ab ${rooms}`} selected={roomsMin === rooms} onPress={() => setRoomsMin(roomsMin === rooms ? null : rooms)} />
              ))}
            </FilterRow>
          </View>
        ) : null}

        <Button title="Immobilien suchen" icon="search" onPress={submit} />

        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: space.xl }}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: moreOpen }} onPress={() => setMoreOpen((v) => !v)} style={styles.heroAction}>
            <Ionicons name="options-outline" size={18} color={colors.forest} />
            <Text style={styles.heroActionText}>Weitere Filter</Text>
            <Ionicons name={moreOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.forest} />
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => open("/verkaufen")} style={styles.heroAction}>
            <Text style={styles.heroActionText}>Immobilie verkaufen</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.forest} />
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => open("/bewerten")} style={styles.heroAction}>
            <Text style={styles.heroActionText}>Kostenlos bewerten</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.forest} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={text.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.sm, paddingRight: space.sm }}>
        {children}
      </ScrollView>
    </View>
  );
}

function ExampleCard({ example }: { example: (typeof EXAMPLE_LISTINGS)[number] }) {
  const price = example.offer === "rent" ? `CHF ${formatNumber(example.price)} / Monat` : `CHF ${formatNumber(example.price)}`;
  return (
    <View accessibilityLabel={`Beispiel: ${example.title}, ${price}, ${example.place}`} style={styles.example}>
      <View style={{ aspectRatio: 16 / 10, backgroundColor: colors.mutedBg }}>
        <Image source={photo(example.image, 900)} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        <View style={{ position: "absolute", left: 10, top: 10, flexDirection: "row", gap: 6 }}>
          <Badge tone="dark" label={example.offer === "rent" ? "Mieten" : "Kaufen"} />
          <Badge tone="amber" label="Beispiel" />
        </View>
      </View>
      <View style={{ padding: space.md, gap: 4 }}>
        <Text style={{ fontSize: 19, fontWeight: "800", letterSpacing: -0.3, color: colors.foreground }}>{price}</Text>
        <Text style={[text.body, { fontWeight: "600" }]}>{example.title}</Text>
        <Text style={text.small}>{example.facts}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="location-outline" size={15} color={colors.muted} />
          <Text style={text.small}>{example.place}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { overflow: "hidden", backgroundColor: colors.mint100 },
  heroTitle: { fontSize: 36, fontWeight: "800", letterSpacing: -1.2, lineHeight: 40, color: colors.foreground },
  heroLead: { fontSize: 18, lineHeight: 26, color: "rgba(25,40,32,0.82)" },
  offerTabs: { flexDirection: "row", alignSelf: "flex-start", gap: 4, backgroundColor: colors.white, paddingHorizontal: 8, paddingTop: 8, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  offerTab: { height: 48, paddingHorizontal: 20, borderRadius: radius.md, flexDirection: "row", alignItems: "center", gap: 8 },
  searchCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderTopLeftRadius: 0,
    padding: space.md,
    gap: space.md,
    shadowColor: "#192820",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  searchField: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.input, backgroundColor: colors.white },
  heroAction: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6 },
  heroActionText: { fontSize: 15, fontWeight: "600", color: colors.forest },
  freeSlot: { borderRadius: radius.lg, borderWidth: 1, borderStyle: "dashed", borderColor: "#b9d9a0", backgroundColor: mint50, padding: space.xl, gap: 4 },
  example: { backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  photo: { aspectRatio: 4 / 3, borderRadius: 24, backgroundColor: colors.mutedBg },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  valuation: { fontSize: 36, fontWeight: "800", letterSpacing: -1, color: colors.forest, marginTop: 2 },
  range: { height: 8, borderRadius: 4, overflow: "hidden", flexDirection: "row", marginTop: space.md, marginBottom: 6 },
  tiny: { fontSize: 12.5, lineHeight: 17, color: colors.muted },
  bigCard: { borderRadius: 24, padding: space.xl, borderWidth: 0 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  bigCardTitle: { flex: 1, fontSize: 20, fontWeight: "700", letterSpacing: -0.3, color: colors.foreground },
  bigCardText: { fontSize: 16, lineHeight: 23, color: colors.muted, marginTop: 4 },
  dossier: { flex: 1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: "hidden" },
  dossierBand: { position: "absolute", left: 0, right: 0, bottom: 0, height: "33%" },
  beforeAfter: { flexDirection: "row", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden", marginTop: space.sm },
  photoTag: { position: "absolute", left: 8, top: 8, fontSize: 11, fontWeight: "600", color: colors.foreground, backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: "hidden" },
  bullet: { flexDirection: "row", alignItems: "center", gap: space.md },
  bulletText: { flex: 1, fontSize: 15.5, lineHeight: 22, color: colors.foreground },
  lead: { flexDirection: "row", alignItems: "flex-start", gap: space.md, padding: space.lg },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.mint200, alignItems: "center", justifyContent: "center" },
  firms: { borderRadius: 24, backgroundColor: colors.forest, paddingHorizontal: 28, paddingVertical: 40, gap: space.md, overflow: "hidden" },
  firmsButton: { minHeight: 50, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", paddingHorizontal: space.lg },
  footer: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: space.lg, paddingBottom: space.xxl, gap: space.md },
});
