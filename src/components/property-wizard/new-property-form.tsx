"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Building2, KeyRound, Tag, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import { toast } from "@/components/ui/sonner";
import { AddressFields, type AddressValues } from "@/components/property-wizard/address-fields";
import { PROPERTY_TYPE_HINTS, PROPERTY_TYPE_ICONS } from "@/components/property-wizard/property-type-icon";
import { PROPERTY_TYPE_OPTIONS, type OfferType, type PropertyType } from "@/lib/constants";
import { createPropertyAction } from "@/lib/properties/actions";
import { createPropertySchema, type CreatePropertyData, type CreatePropertyInput } from "@/lib/validation/property";

const OFFER_OPTIONS: { value: OfferType; label: string; text: string; icon: typeof Tag }[] = [
  { value: "sale", label: "Verkaufen", text: "Ich möchte die Immobilie verkaufen.", icon: Tag },
  { value: "rent", label: "Vermieten", text: "Ich möchte die Immobilie vermieten.", icon: KeyRound },
];

const ADDRESS_KEYS = ["street", "house_number", "postal_code", "municipality", "canton", "latitude", "longitude", "egid"] as const;

function ErrorText({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-3 text-xs font-medium text-destructive">
      {message}
    </p>
  );
}

/** Start des Verkaufsassistenten: Objekttyp, Verkauf/Vermietung, Adresse, optional Firmenkonto. */
export function NewPropertyForm({
  organizations,
  goal,
}: {
  organizations: { id: string; name: string }[];
  goal: "" | "bewertung";
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const form = useForm<CreatePropertyInput, unknown, CreatePropertyData>({
    resolver: zodResolver(createPropertySchema),
    defaultValues: {
      offer_type: "sale",
      street: "",
      house_number: "",
      postal_code: "",
      municipality: "",
      canton: "",
      latitude: null,
      longitude: null,
      egid: null,
      organization_id: "",
      goal,
    },
  });
  const errors = form.formState.errors;
  const address = useWatch({ control: form.control, name: ADDRESS_KEYS });
  const addressValues: AddressValues = {
    street: address[0] ?? "",
    house_number: address[1] ?? "",
    postal_code: address[2] ?? "",
    municipality: address[3] ?? "",
    canton: address[4] ?? "",
    latitude: address[5] ?? null,
    longitude: address[6] ?? null,
    egid: address[7] ?? null,
  };

  function updateAddress(patch: Partial<AddressValues>) {
    const options = { shouldDirty: true, shouldValidate: form.formState.isSubmitted };
    if (patch.street !== undefined) form.setValue("street", patch.street, options);
    if (patch.house_number !== undefined) form.setValue("house_number", patch.house_number, options);
    if (patch.postal_code !== undefined) form.setValue("postal_code", patch.postal_code, options);
    if (patch.municipality !== undefined) form.setValue("municipality", patch.municipality, options);
    if (patch.canton !== undefined) form.setValue("canton", patch.canton, options);
    if (patch.latitude !== undefined) form.setValue("latitude", patch.latitude, options);
    if (patch.longitude !== undefined) form.setValue("longitude", patch.longitude, options);
    if (patch.egid !== undefined) form.setValue("egid", patch.egid, options);
  }

  const submit = form.handleSubmit(() => {
    // Rohwerte senden – die Action prüft sie mit demselben Schema erneut.
    const values = form.getValues();
    startTransition(async () => {
      const result = await createPropertyAction(values);
      if (!result.ok) {
        for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages[0]) form.setError(field as keyof CreatePropertyInput, { type: "server", message: messages[0] });
        }
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Die Immobilie wurde angelegt.");
      router.push(result.data.redirectTo);
    });
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <span id="angebot-label">Was haben Sie vor?</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Controller
            control={form.control}
            name="offer_type"
            render={({ field }) => (
              <RadioGroup
                aria-labelledby="angebot-label"
                value={field.value}
                onValueChange={(value) => field.onChange(value as OfferType)}
                className="grid gap-3 sm:grid-cols-2"
              >
                {OFFER_OPTIONS.map((option) => (
                  <RadioCard key={option.value} value={option.value} className="min-h-16 gap-4 px-5">
                    <option.icon className="size-6 shrink-0 text-brand" aria-hidden />
                    <span>
                      <span className="block text-base">{option.label}</span>
                      <span className="block text-sm font-normal text-muted-foreground">{option.text}</span>
                    </span>
                  </RadioCard>
                ))}
              </RadioGroup>
            )}
          />
          <ErrorText id="angebot-fehler" message={errors.offer_type?.message} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <span id="typ-label">Welche Immobilie möchten Sie erfassen?</span>
          </CardTitle>
          <CardDescription>Der Assistent fragt danach nur die Angaben ab, die für diesen Typ wichtig sind.</CardDescription>
        </CardHeader>
        <CardContent>
          <Controller
            control={form.control}
            name="property_type"
            render={({ field }) => (
              <RadioGroup
                aria-labelledby="typ-label"
                aria-describedby={errors.property_type ? "typ-fehler" : undefined}
                value={field.value ?? ""}
                onValueChange={(value) => field.onChange(value as PropertyType)}
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              >
                {PROPERTY_TYPE_OPTIONS.map((option) => {
                  const Icon = PROPERTY_TYPE_ICONS[option.value];
                  return (
                    <RadioCard key={option.value} value={option.value} className="min-h-[4.5rem] gap-3.5">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint-100 text-forest">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block">{option.label}</span>
                        <span className="block text-xs font-normal text-muted-foreground">{PROPERTY_TYPE_HINTS[option.value]}</span>
                      </span>
                    </RadioCard>
                  );
                })}
              </RadioGroup>
            )}
          />
          <ErrorText id="typ-fehler" message={errors.property_type?.message} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wo befindet sich die Immobilie?</CardTitle>
          <CardDescription>
            Die exakte Adresse bleibt privat. Im Inserat legen Sie später fest, wie genau der Standort angezeigt wird.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddressFields
            idPrefix="neu-adresse"
            values={addressValues}
            onChange={updateAddress}
            required
            errors={{
              street: errors.street?.message,
              house_number: errors.house_number?.message,
              postal_code: errors.postal_code?.message,
              municipality: errors.municipality?.message,
              canton: errors.canton?.message,
            }}
          />
        </CardContent>
      </Card>

      {organizations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <span id="konto-label">Für wen erfassen Sie die Immobilie?</span>
            </CardTitle>
            <CardDescription>Immobilien eines Firmenkontos können alle Mitarbeitenden der Firma bearbeiten.</CardDescription>
          </CardHeader>
          <CardContent>
            <Controller
              control={form.control}
              name="organization_id"
              render={({ field }) => (
                <RadioGroup
                  aria-labelledby="konto-label"
                  value={field.value}
                  onValueChange={field.onChange}
                  className="grid gap-3 sm:grid-cols-2"
                >
                  <RadioCard value="">
                    <User className="size-5 text-brand" aria-hidden /> Privat (nur ich)
                  </RadioCard>
                  {organizations.map((org) => (
                    <RadioCard key={org.id} value={org.id}>
                      <Building2 className="size-5 text-brand" aria-hidden /> {org.name}
                    </RadioCard>
                  ))}
                </RadioGroup>
              )}
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Alle weiteren Angaben speichert der Assistent automatisch, während Sie tippen.</p>
        <Button type="submit" size="lg" loading={pending}>
          {goal === "bewertung" ? "Anlegen und bewerten" : "Anlegen und weiter"} <ArrowRight aria-hidden />
        </Button>
      </div>
    </form>
  );
}
