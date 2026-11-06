"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/sonner";
import { PasswordInput } from "@/components/account/password-input";
import { applyServerFieldErrors } from "@/components/account/form-helpers";
import { changePasswordAction } from "@/app/dashboard/profil/actions";
import { passwordChangeSchema, type PasswordChangeInput } from "@/lib/validation/account";

const EMPTY: PasswordChangeInput = { currentPassword: "", newPassword: "", confirm: "" };

export function PasswordChangeForm() {
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordChangeInput>({ resolver: zodResolver(passwordChangeSchema), defaultValues: EMPTY });

  const onSubmit = handleSubmit(async () => {
    setFormError(null);
    const res = await changePasswordAction(getValues());
    if (!res.ok) {
      if (!applyServerFieldErrors(setError, res.fieldErrors)) setFormError(res.error);
      return;
    }
    reset(EMPTY);
    toast.success(res.message ?? "Passwort geändert.");
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      <Field label="Aktuelles Passwort" htmlFor="currentPassword" error={errors.currentPassword?.message}>
        <PasswordInput id="currentPassword" autoComplete="current-password" {...register("currentPassword")} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Neues Passwort"
          htmlFor="newPassword"
          hint="Mindestens 10 Zeichen mit Buchstaben und Zahlen."
          error={errors.newPassword?.message}
        >
          <PasswordInput id="newPassword" autoComplete="new-password" {...register("newPassword")} />
        </Field>
        <Field label="Neues Passwort wiederholen" htmlFor="confirmPassword" error={errors.confirm?.message}>
          <PasswordInput id="confirmPassword" autoComplete="new-password" {...register("confirm")} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="outline" loading={isSubmitting}>
          <KeyRound aria-hidden /> Passwort ändern
        </Button>
      </div>
    </form>
  );
}
