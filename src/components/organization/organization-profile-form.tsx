"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/sonner";
import { applyServerFieldErrors } from "@/components/account/form-helpers";
import { updateOrganizationAction } from "@/app/dashboard/firma/actions";
import { CANTONS } from "@/lib/constants";
import {
  organizationProfileSchema,
  type OrganizationProfileInput,
  type OrganizationProfileValues,
} from "@/lib/validation/organization";

export function OrganizationProfileForm({ defaultValues }: { defaultValues: OrganizationProfileInput }) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    getValues,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<OrganizationProfileInput, unknown, OrganizationProfileValues>({
    resolver: zodResolver(organizationProfileSchema),
    defaultValues,
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const res = await updateOrganizationAction(getValues());
    if (!res.ok) {
      if (!applyServerFieldErrors(setError, res.fieldErrors)) setFormError(res.error);
      return;
    }
    reset({
      organizationId: values.organizationId,
      name: values.name,
      description: values.description ?? "",
      street: values.street ?? "",
      postalCode: values.postalCode ?? "",
      city: values.city ?? "",
      canton: values.canton ?? "",
      phone: values.phone ?? "",
      email: values.email ?? "",
      website: values.website ?? "",
      uidNumber: values.uidNumber ?? "",
      isPublic: values.isPublic,
    });
    toast.success(res.message ?? "Gespeichert.");
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      <input type="hidden" {...register("organizationId")} />
      <Field label="Firmenname" htmlFor="org-name" required error={errors.name?.message}>
        <Input autoComplete="organization" {...register("name")} />
      </Field>
      <Field
        label="Beschreibung"
        htmlFor="org-description"
        optional
        hint="Erscheint auf Ihrer öffentlichen Firmenseite. Höchstens 4000 Zeichen."
        error={errors.description?.message}
      >
        <Textarea rows={5} {...register("description")} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <Field label="Strasse und Nr." htmlFor="org-street" optional error={errors.street?.message}>
          <Input autoComplete="street-address" {...register("street")} />
        </Field>
        <Field label="PLZ" htmlFor="org-postal" optional error={errors.postalCode?.message}>
          <Input inputMode="numeric" autoComplete="postal-code" maxLength={4} {...register("postalCode")} />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Ort" htmlFor="org-city" optional error={errors.city?.message}>
          <Input autoComplete="address-level2" {...register("city")} />
        </Field>
        <Field label="Kanton" htmlFor="org-canton" optional error={errors.canton?.message}>
          <NativeSelect {...register("canton")}>
            <option value="">Kein Kanton</option>
            {CANTONS.map((canton) => (
              <option key={canton.code} value={canton.code}>
                {canton.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Telefon" htmlFor="org-phone" optional error={errors.phone?.message}>
          <Input type="tel" inputMode="tel" autoComplete="tel" {...register("phone")} />
        </Field>
        <Field label="E-Mail" htmlFor="org-email" optional error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register("email")} />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Website" htmlFor="org-website" optional error={errors.website?.message}>
          <Input type="url" inputMode="url" placeholder="www.firma.ch" {...register("website")} />
        </Field>
        <Field
          label="UID"
          htmlFor="org-uid"
          optional
          hint="Unternehmens-Identifikationsnummer, z. B. CHE-123.456.789"
          error={errors.uidNumber?.message}
        >
          <Input placeholder="CHE-123.456.789" {...register("uidNumber")} />
        </Field>
      </div>
      <Controller
        control={control}
        name="isPublic"
        render={({ field }) => (
          <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-surface p-4">
            <div className="grid gap-1">
              <Label htmlFor="org-public" className="cursor-pointer">
                Öffentliche Firmenseite
              </Label>
              <p id="org-public-hint" className="text-xs leading-relaxed text-muted-foreground">
                Name, Logo, Beschreibung, Kontaktangaben und aktive Inserate der Firma sind öffentlich sichtbar.
              </p>
            </div>
            <Switch
              id="org-public"
              aria-describedby="org-public-hint"
              checked={field.value}
              onCheckedChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              className="mt-0.5"
            />
          </div>
        )}
      />
      <div className="flex justify-end border-t border-border pt-5">
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          Firmenprofil speichern
        </Button>
      </div>
    </form>
  );
}
