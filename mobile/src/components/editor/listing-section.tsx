import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { publicAddressPreview, type ListingForm } from "@/components/editor/form";
import { Card } from "@/components/editor/shared";
import { Field, SectionTitle, ToggleRow } from "@/components/ui";
import type { ListingRow, PropertyRow } from "@/lib/api";
import { LISTING_TEXT_LIMITS, LOCATION_PRECISION } from "@/lib/api-owner";
import type { Enums } from "@/lib/supabase";
import { colors, radius, space, text } from "@/lib/theme";

const PRECISIONS = Object.keys(LOCATION_PRECISION) as Enums<"location_precision">[];

/** Inserat wie im Schritt «Inserat» der Website: Preis, Texte, Standortanzeige, Kontakt, Bestätigung. */
export function ListingSection({
  property,
  listing,
  form,
  onChange,
}: {
  property: PropertyRow;
  listing: ListingRow;
  form: ListingForm;
  onChange: (patch: Partial<ListingForm>) => void;
}) {
  const preview = publicAddressPreview(property, form.location_precision);
  return (
    <>
      <Card>
        <SectionTitle>Preis</SectionTitle>
        <ToggleRow label="Preis auf Anfrage" value={form.price_on_request} onValueChange={(price_on_request) => onChange({ price_on_request })} />
        {!form.price_on_request ? (
          <Field
            label={listing.offer_type === "rent" ? "Miete pro Monat (CHF)" : "Kaufpreis (CHF)"}
            value={form.price}
            onChangeText={(price) => onChange({ price })}
            keyboardType="number-pad"
          />
        ) : null}
        {listing.offer_type === "rent" ? (
          <Field
            label="Nebenkosten pro Monat (CHF)"
            value={form.additional_costs}
            onChangeText={(additional_costs) => onChange({ additional_costs })}
            keyboardType="number-pad"
          />
        ) : null}
      </Card>

      <Card>
        <SectionTitle>Texte</SectionTitle>
        <Field
          label="Titel"
          value={form.title}
          onChangeText={(title) => onChange({ title })}
          maxLength={LISTING_TEXT_LIMITS.title}
          placeholder="z. B. Helle 3.5-Zimmer-Wohnung mit Balkon"
        />
        <Field
          label="Kurzbeschreibung"
          value={form.short_description}
          onChangeText={(short_description) => onChange({ short_description })}
          maxLength={LISTING_TEXT_LIMITS.short_description}
          multiline
          style={{ minHeight: 80 }}
        />
        <Field
          label="Beschreibung"
          value={form.description}
          onChangeText={(description) => onChange({ description })}
          multiline
          maxLength={LISTING_TEXT_LIMITS.description}
          hint="Beschreiben Sie Räume, Zustand und Besonderheiten."
        />
        <Field
          label="Ausstattung"
          value={form.equipment_description}
          onChangeText={(equipment_description) => onChange({ equipment_description })}
          multiline
          maxLength={LISTING_TEXT_LIMITS.equipment_description}
          style={{ minHeight: 90 }}
          hint="Optional: Küche, Bad, Böden, Technik."
        />
        <Field
          label="Lage"
          value={form.location_description}
          onChangeText={(location_description) => onChange({ location_description })}
          multiline
          maxLength={LISTING_TEXT_LIMITS.location_description}
          style={{ minHeight: 90 }}
          hint="Optional: Umgebung, Verkehrsanbindung, Einkaufen, Schulen."
        />
      </Card>

      <Card>
        <SectionTitle>Standortanzeige</SectionTitle>
        <Text style={text.small}>Wie genau sollen Interessenten sehen, wo die Immobilie liegt?</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Standortanzeige" style={{ gap: space.sm }}>
          {PRECISIONS.map((key) => {
            const selected = form.location_precision === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${LOCATION_PRECISION[key].label}. ${LOCATION_PRECISION[key].description}`}
                onPress={() => onChange({ location_precision: key })}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <View style={[styles.radio, selected && { borderColor: colors.brand }]}>{selected ? <View style={styles.radioDot} /> : null}</View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[text.body, { fontWeight: "600" }]}>{LOCATION_PRECISION[key].label}</Text>
                  <Text style={text.small}>{LOCATION_PRECISION[key].description}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <Text style={text.small}>
          Im Inserat erscheint: <Text style={{ color: colors.foreground, fontWeight: "700" }}>{preview || "noch keine Adresse erfasst"}</Text>
        </Text>
      </Card>

      <Card>
        <SectionTitle>Kontakt</SectionTitle>
        <Text style={text.small}>
          Interessenten schreiben Ihnen über das Nachrichtensystem von Immovia. Die Telefonnummer erscheint nur, wenn Sie die Anzeige aktivieren.
        </Text>
        <Field label="Name" value={form.contact_name} onChangeText={(contact_name) => onChange({ contact_name })} maxLength={120} autoComplete="name" textContentType="name" />
        <Field
          label="E-Mail"
          value={form.contact_email}
          onChangeText={(contact_email) => onChange({ contact_email })}
          maxLength={254}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          hint="Wird nicht veröffentlicht – weder im Inserat noch im Verkaufsdossier."
        />
        <Field
          label="Telefon"
          value={form.contact_phone}
          onChangeText={(contact_phone) => onChange({ contact_phone })}
          maxLength={24}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder="+41 79 123 45 67"
        />
        <ToggleRow label="Telefonnummer im Inserat anzeigen" value={form.show_contact_phone} onValueChange={(show_contact_phone) => onChange({ show_contact_phone })} />
      </Card>

      <Card>
        <SectionTitle>Bestätigung</SectionTitle>
        <ToggleRow
          label="Ich habe die Texte geprüft und sie entsprechen den Tatsachen."
          hint="Nötig für die Veröffentlichung. Nach Textänderungen bitte neu bestätigen."
          value={form.texts_confirmed}
          onValueChange={(texts_confirmed) => onChange({ texts_confirmed })}
        />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 56, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  optionSelected: { borderColor: colors.brand, backgroundColor: colors.mint100 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.input, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
});
