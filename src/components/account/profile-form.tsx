"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/sonner";
import { applyServerFieldErrors } from "@/components/account/form-helpers";
import { updateProfileAction } from "@/app/dashboard/profil/actions";
import { profileSchema, type ProfileInput, type ProfileValues } from "@/lib/validation/account";

export function ProfileForm({ defaultValues, email }: { defaultValues: ProfileInput; email: string | null }) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileInput, unknown, ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const res = await updateProfileAction(getValues());
    if (!res.ok) {
      if (!applyServerFieldErrors(setError, res.fieldErrors)) setFormError(res.error);
      return;
    }
    reset({
      firstName: values.firstName ?? "",
      lastName: values.lastName ?? "",
      displayName: values.displayName,
      phone: values.phone ?? "",
    });
    toast.success(res.message ?? "Gespeichert.");
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Vorname" htmlFor="firstName" error={errors.firstName?.message}>
          <Input autoComplete="given-name" {...register("firstName")} />
        </Field>
        <Field label="Nachname" htmlFor="lastName" error={errors.lastName?.message}>
          <Input autoComplete="family-name" {...register("lastName")} />
        </Field>
      </div>
      <Field
        label="Anzeigename"
        htmlFor="displayName"
        required
        hint="Wird öffentlich angezeigt, zum Beispiel bei Ihren Inseraten und in Nachrichten."
        error={errors.displayName?.message}
      >
        <Input autoComplete="nickname" {...register("displayName")} />
      </Field>
      <Field
        label="Telefon"
        htmlFor="phone"
        optional
        hint="Nicht öffentlich. Ob eine Telefonnummer im Inserat erscheint, legen Sie pro Inserat fest."
        error={errors.phone?.message}
      >
        <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="079 123 45 67" {...register("phone")} />
      </Field>
      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Angemeldet als <span className="font-semibold text-foreground">{email ?? "–"}</span>
        </p>
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          Änderungen speichern
        </Button>
      </div>
    </form>
  );
}
