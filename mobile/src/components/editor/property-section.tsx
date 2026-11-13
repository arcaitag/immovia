import * as React from "react";
import { Text, View } from "react-native";

import type { PropertyForm } from "@/components/editor/form";
import { Card, ChoiceChips, Row, editorStyles } from "@/components/editor/shared";
import { Chip, Field, SectionTitle, ToggleRow } from "@/components/ui";
import type { PropertyRow } from "@/lib/api";
import {
  AMENITY_FLAGS,
  ENERGY_LABELS,
  FEATURE_CATALOG,
  FEATURE_GROUPS,
  FEATURE_KEYS,
  HEATING_TYPES,
  isFieldVisible,
  typeGroup,
  type ConditionalField,
  type FeatureKey,
} from "@/lib/api-owner";
import { CONDITIONS } from "@/lib/labels";
import type { Enums } from "@/lib/supabase";
import { space, text } from "@/lib/theme";

const CONDITION_OPTIONS = (Object.keys(CONDITIONS) as Enums<"property_condition">[]).map((value) => ({ value, label: CONDITIONS[value] }));
const HEATING_OPTIONS = (Object.keys(HEATING_TYPES) as Enums<"heating_type">[]).map((value) => ({ value, label: HEATING_TYPES[value] }));
const ENERGY_OPTIONS = ENERGY_LABELS.map((value) => ({ value, label: value }));
const PETS_OPTIONS = [
  { value: "yes", label: "Erlaubt" },
  { value: "no", label: "Nicht erlaubt" },
] as const;

/** Objektdaten wie im Schritt «Erfassen» der Website: Flächen, Gebäude, Zustand, Ausstattung, Parkplätze, Verfügbarkeit. */
export function PropertySection({
  property,
  offer,
  form,
  onChange,
}: {
  property: PropertyRow;
  offer: Enums<"offer_type">;
  form: PropertyForm;
  onChange: (patch: Partial<PropertyForm>) => void;
}) {
  const visible = (field: ConditionalField) => isFieldVisible(field, property.property_type, offer);
  const group = typeGroup(property.property_type);
  const roomsLabel = group === "office" || group === "commercial" ? "Räume" : group === "multi_family" ? "Zimmer total" : "Zimmer";
  const floorsLabel = group === "apartment" ? "Stockwerke im Gebäude" : group === "house" ? "Anzahl Etagen" : "Anzahl Stockwerke";
  const isBuilding = group !== "plot";

  const toggleFeature = (key: FeatureKey) =>
    onChange({ features: form.features.includes(key) ? form.features.filter((k) => k !== key) : [...form.features, key] });

  const areaFields = [
    visible("rooms") ? <Field key="rooms" label={roomsLabel} value={form.rooms} onChangeText={(rooms) => onChange({ rooms })} keyboardType="decimal-pad" placeholder="z. B. 3.5" /> : null,
    visible("bathrooms") ? <Field key="bathrooms" label="Badezimmer" value={form.bathrooms} onChangeText={(bathrooms) => onChange({ bathrooms })} keyboardType="number-pad" /> : null,
    visible("living_area") ? (
      <Field key="living" label={group === "multi_family" ? "Wohnfläche total (m²)" : "Wohnfläche (m²)"} value={form.living_area} onChangeText={(living_area) => onChange({ living_area })} keyboardType="decimal-pad" />
    ) : null,
    visible("plot_area") ? <Field key="plot" label="Grundstück (m²)" value={form.plot_area} onChangeText={(plot_area) => onChange({ plot_area })} keyboardType="decimal-pad" /> : null,
  ].filter(Boolean);

  const buildingFields = [
    visible("year_built") ? <Field key="year" label="Baujahr" value={form.year_built} onChangeText={(year_built) => onChange({ year_built })} keyboardType="number-pad" maxLength={4} /> : null,
    visible("floor") ? (
      <Field key="floor" label="Etage" value={form.floor} onChangeText={(floor) => onChange({ floor })} keyboardType="numbers-and-punctuation" placeholder="0 = Erdgeschoss" />
    ) : null,
    visible("floors_total") ? <Field key="floors" label={floorsLabel} value={form.floors_total} onChangeText={(floors_total) => onChange({ floors_total })} keyboardType="number-pad" /> : null,
  ].filter(Boolean);

  const pairs = (fields: React.ReactNode[]) => {
    const rows: React.ReactNode[] = [];
    for (let i = 0; i < fields.length; i += 2) rows.push(<Row key={i}>{fields.slice(i, i + 2)}</Row>);
    return rows;
  };

  return (
    <>
      <Card>
        <SectionTitle>Objektdaten</SectionTitle>
        {pairs(areaFields)}
        {pairs(buildingFields)}
        {visible("condition") ? (
          <ChoiceChips label="Zustand" options={CONDITION_OPTIONS} value={form.condition} onChange={(condition) => onChange({ condition })} clearable />
        ) : null}
        {visible("heating_type") ? (
          <ChoiceChips label="Heizung" options={HEATING_OPTIONS} value={form.heating_type} onChange={(heating_type) => onChange({ heating_type })} clearable />
        ) : null}
        {visible("energy_label") ? (
          <ChoiceChips
            label="GEAK-Klasse"
            options={ENERGY_OPTIONS}
            value={(ENERGY_LABELS as readonly string[]).includes(form.energy_label ?? "") ? (form.energy_label as (typeof ENERGY_LABELS)[number]) : null}
            onChange={(energy_label) => onChange({ energy_label })}
            clearable
          />
        ) : null}
      </Card>

      {isBuilding ? (
        <Card>
          <SectionTitle>Ausstattung</SectionTitle>
          <Text style={text.small}>Wählen Sie alles aus, was tatsächlich vorhanden ist.</Text>
          <View style={editorStyles.wrap}>
            {AMENITY_FLAGS.filter(({ key }) => visible(key)).map(({ key, label }) => (
              <Chip key={key} label={label} selected={form.flags[key]} onPress={() => onChange({ flags: { ...form.flags, [key]: !form.flags[key] } })} />
            ))}
          </View>
          {FEATURE_GROUPS.map((groupName) => (
            <View key={groupName} style={{ gap: space.sm }}>
              <Text style={text.label}>{groupName}</Text>
              <View style={editorStyles.wrap}>
                {FEATURE_KEYS.filter((key) => FEATURE_CATALOG[key].group === groupName).map((key) => (
                  <Chip key={key} label={FEATURE_CATALOG[key].label} selected={form.features.includes(key)} onPress={() => toggleFeature(key)} />
                ))}
              </View>
            </View>
          ))}
          {visible("pets_allowed") ? (
            <ChoiceChips
              label="Haustiere"
              options={PETS_OPTIONS}
              value={form.pets_allowed === null ? null : form.pets_allowed ? "yes" : "no"}
              onChange={(value) => onChange({ pets_allowed: value === null ? null : value === "yes" })}
              clearable
            />
          ) : null}
        </Card>
      ) : null}

      {visible("garage_spaces") ? (
        <Card>
          <SectionTitle>Parkplätze</SectionTitle>
          <Row>
            <Field label="Garagenplätze" value={form.garage_spaces} onChangeText={(garage_spaces) => onChange({ garage_spaces })} keyboardType="number-pad" placeholder="0" />
            <Field
              label="Tiefgaragenplätze"
              value={form.underground_parking_spaces}
              onChangeText={(underground_parking_spaces) => onChange({ underground_parking_spaces })}
              keyboardType="number-pad"
              placeholder="0"
            />
          </Row>
          <Row>
            <Field
              label="Aussenparkplätze"
              value={form.outdoor_parking_spaces}
              onChangeText={(outdoor_parking_spaces) => onChange({ outdoor_parking_spaces })}
              keyboardType="number-pad"
              placeholder="0"
            />
          </Row>
        </Card>
      ) : null}

      <Card>
        <SectionTitle>Verfügbarkeit und Besonderheiten</SectionTitle>
        <ToggleRow label="Verfügbar nach Vereinbarung" value={form.available_by_arrangement} onValueChange={(available_by_arrangement) => onChange({ available_by_arrangement })} />
        {!form.available_by_arrangement ? (
          <Field
            label="Verfügbar ab"
            value={form.available_from}
            onChangeText={(available_from) => onChange({ available_from })}
            keyboardType="numbers-and-punctuation"
            placeholder="TT.MM.JJJJ"
            maxLength={10}
          />
        ) : null}
        {visible("service_charges") ? (
          <Field
            label="Nebenkosten pro Monat (CHF)"
            value={form.service_charges}
            onChangeText={(service_charges) => onChange({ service_charges })}
            keyboardType="decimal-pad"
            hint={offer === "rent" ? "Akonto für Heizung, Warmwasser, Hauswartung usw." : "Bei Stockwerkeigentum die monatliche Akontozahlung an die Gemeinschaft."}
          />
        ) : null}
        <Field
          label="Besonderheiten"
          value={form.special_features}
          onChangeText={(special_features) => onChange({ special_features })}
          multiline
          maxLength={4000}
          hint="Was macht die Immobilie besonders? Nur Tatsachen, keine Werbesprache nötig."
        />
      </Card>
    </>
  );
}
