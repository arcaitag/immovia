"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { applyServerFieldErrors } from "@/components/account/form-helpers";
import { requestEmailChangeAction } from "@/app/dashboard/profil/actions";
import { emailChangeSchema, type EmailChangeInput } from "@/lib/validation/account";

export function EmailChangeForm({ currentEmail, pendingEmail }: { currentEmail: string | null; pendingEmail: string | null }) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EmailChangeInput>({ resolver: zodResolver(emailChangeSchema), defaultValues: { email: "" } });

  const onSubmit = handleSubmit(async () => {
    setFormError(null);
    const res = await requestEmailChangeAction(getValues());
    if (!res.ok) {
      if (!applyServerFieldErrors(setError, res.fieldErrors)) setFormError(res.error);
      return;
    }
    setSentTo(res.data.email);
    reset({ email: "" });
    router.refresh();
  });

  const pending = sentTo ?? pendingEmail;

  return (
    <div className="grid gap-5">
      <dl className="grid gap-1">
        <dt className="text-sm font-semibold">Aktuelle E-Mail-Adresse</dt>
        <dd className="break-all text-[0.9375rem] text-muted-foreground">{currentEmail ?? "–"}</dd>
      </dl>
      {pending ? (
        <Alert tone="info" title={`Änderung auf ${pending} ausstehend`}>
          Wir haben Bestätigungslinks an die neue Adresse und zur Sicherheit auch an Ihre bisherige Adresse gesendet. Die
          Änderung wird wirksam, sobald Sie die Links bestätigt haben. Bis dahin melden Sie sich weiterhin mit der bisherigen
          Adresse an.
        </Alert>
      ) : null}
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        {formError ? <Alert tone="error">{formError}</Alert> : null}
        <Field label="Neue E-Mail-Adresse" htmlFor="newEmail" error={errors.email?.message}>
          <Input id="newEmail" type="email" autoComplete="email" {...register("email")} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" variant="outline" loading={isSubmitting}>
            <MailCheck aria-hidden /> Bestätigungslink senden
          </Button>
        </div>
      </form>
    </div>
  );
}
