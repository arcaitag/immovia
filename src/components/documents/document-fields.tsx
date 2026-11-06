"use client";

import * as React from "react";
import { Globe, Lock, Users } from "lucide-react";
import { ChoiceRow, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import { NativeSelect } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DOCUMENT_CATEGORIES, DOCUMENT_VISIBILITY, type DocumentCategory, type DocumentVisibility } from "@/lib/constants";

export const VISIBILITY_ICONS: Record<DocumentVisibility, typeof Lock> = { owner: Lock, organization: Users, public: Globe };

export interface DocumentMetaState {
  title: string;
  category: DocumentCategory;
  visibility: DocumentVisibility;
  containsPersonalData: boolean;
}

/** Gemeinsame Felder für Upload und Bearbeiten: Titel, Kategorie, Sichtbarkeit, Personendaten. */
export function DocumentMetaFields({
  value,
  onChange,
  errors,
  hasOrganization,
  idPrefix,
}: {
  value: DocumentMetaState;
  onChange: (next: DocumentMetaState) => void;
  errors: Partial<Record<keyof DocumentMetaState, string>>;
  hasOrganization: boolean;
  idPrefix: string;
}) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Titel" htmlFor={`${idPrefix}-title`} error={errors.title} required>
          <Input maxLength={160} value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} />
        </Field>
        <Field label="Kategorie" htmlFor={`${idPrefix}-category`} error={errors.category} required>
          <NativeSelect value={value.category} onChange={(e) => onChange({ ...value, category: e.target.value as DocumentCategory })}>
            {(Object.keys(DOCUMENT_CATEGORIES) as DocumentCategory[]).map((key) => (
              <option key={key} value={key}>
                {DOCUMENT_CATEGORIES[key]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <ChoiceRow
        htmlFor={`${idPrefix}-personal`}
        control={
          <Switch
            id={`${idPrefix}-personal`}
            checked={value.containsPersonalData}
            onCheckedChange={(checked) =>
              onChange({ ...value, containsPersonalData: checked, visibility: checked && value.visibility === "public" ? "owner" : value.visibility })
            }
          />
        }
        label="Enthält Personendaten"
        description="Z. B. Namen, Adressen, Unterschriften oder Kontonummern. Solche Dokumente werden nie öffentlich angezeigt."
      />

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-semibold">Sichtbarkeit</legend>
        <RadioGroup
          value={value.visibility}
          onValueChange={(v) => onChange({ ...value, visibility: v as DocumentVisibility })}
          className="grid gap-2 sm:grid-cols-3"
        >
          {(Object.keys(DOCUMENT_VISIBILITY) as DocumentVisibility[]).map((key) => {
            const Icon = VISIBILITY_ICONS[key];
            const disabled = (key === "public" && value.containsPersonalData) || (key === "organization" && !hasOrganization);
            return (
              <RadioCard
                key={key}
                value={key}
                disabled={disabled}
                className="flex-col items-start gap-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className="size-4" aria-hidden /> {DOCUMENT_VISIBILITY[key].label}
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  {key === "organization" && !hasOrganization ? "Nur für Immobilien eines Firmenkontos." : DOCUMENT_VISIBILITY[key].description}
                </span>
              </RadioCard>
            );
          })}
        </RadioGroup>
        {errors.visibility ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {errors.visibility}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">Einzelnen Interessenten geben Sie Dokumente unabhängig davon über «Freigeben» frei.</p>
      </fieldset>
    </div>
  );
}
