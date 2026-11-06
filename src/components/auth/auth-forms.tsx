"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, ChoiceRow } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert } from "@/components/ui/alert";
import { RadioGroup, RadioCard } from "@/components/ui/radio-group";
import {
  forgotPasswordAction,
  loginAction,
  registerAction,
  resendConfirmationAction,
  resetPasswordAction,
} from "@/lib/auth/actions";
import type { ActionResult } from "@/lib/errors";
import { toast } from "@/components/ui/sonner";

function fieldError(state: ActionResult<unknown> | null, name: string): string | undefined {
  if (!state || state.ok) return undefined;
  return state.fieldErrors?.[name]?.[0];
}

function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className="pr-11" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
        aria-label={visible ? "Passwort verbergen" : "Passwort anzeigen"}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState(loginAction, null);
  const [email, setEmail] = React.useState("");
  const unconfirmed = state && !state.ok && state.code === "invalid_state";

  return (
    <form action={action} className="grid gap-5" noValidate>
      <input type="hidden" name="weiter" value={next ?? "/dashboard"} />
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {state && !state.ok && !state.fieldErrors ? (
        <Alert
          tone={unconfirmed ? "warning" : "error"}
          action={
            unconfirmed && email ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  const res = await resendConfirmationAction(email);
                  if (res.ok) toast.success(res.message ?? "Link gesendet");
                  else toast.error(res.error);
                }}
              >
                Link erneut senden
              </Button>
            ) : undefined
          }
        >
          {state.error}
        </Alert>
      ) : null}
      <Field label="E-Mail-Adresse" htmlFor="email" error={fieldError(state, "email")}>
        <Input name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Passwort" htmlFor="password" error={fieldError(state, "password")}>
        <PasswordInput name="password" autoComplete="current-password" required />
      </Field>
      <div className="-mt-2 text-right">
        <Link href="/passwort-vergessen" className="text-sm font-semibold text-primary hover:underline">
          Passwort vergessen?
        </Link>
      </div>
      <Button type="submit" size="lg" loading={pending}>
        Anmelden
      </Button>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(registerAction, null);
  const [accountType, setAccountType] = React.useState("private");

  if (state?.ok) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-mint-100 text-forest">
          <MailCheck className="size-6" aria-hidden />
        </div>
        <h2 className="mt-4 font-display text-xl font-bold">Bitte bestätigen Sie Ihre E-Mail-Adresse</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Wir haben einen Bestätigungslink an <strong className="text-foreground">{state.data.email}</strong> gesendet. Öffnen Sie
          den Link, um Ihr Konto zu aktivieren. Prüfen Sie auch den Spam-Ordner.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-5"
          onClick={async () => {
            const res = await resendConfirmationAction(state.data.email);
            if (res.ok) toast.success(res.message ?? "Link gesendet");
            else toast.error(res.error);
          }}
        >
          Link erneut senden
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-5" noValidate>
      <input type="hidden" name="weiter" value={next ?? "/dashboard"} />
      <input type="hidden" name="accountType" value={accountType} />
      {state && !state.ok && !state.fieldErrors ? <Alert tone="error">{state.error}</Alert> : null}
      <RadioGroup value={accountType} onValueChange={setAccountType} className="grid grid-cols-2 gap-3" aria-label="Kontotyp">
        <RadioCard value="private">Privatperson</RadioCard>
        <RadioCard value="business">Immobilienfirma</RadioCard>
      </RadioGroup>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Vorname" htmlFor="firstName" error={fieldError(state, "firstName")}>
          <Input name="firstName" autoComplete="given-name" required />
        </Field>
        <Field label="Nachname" htmlFor="lastName" error={fieldError(state, "lastName")}>
          <Input name="lastName" autoComplete="family-name" required />
        </Field>
      </div>
      <Field label="E-Mail-Adresse" htmlFor="email" error={fieldError(state, "email")}>
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field
        label="Passwort"
        htmlFor="password"
        hint="Mindestens 10 Zeichen mit Buchstaben und Zahlen."
        error={fieldError(state, "password")}
      >
        <PasswordInput name="password" autoComplete="new-password" required />
      </Field>
      <div className="grid gap-1.5">
        <ChoiceRow
          htmlFor="acceptTerms"
          control={<Checkbox id="acceptTerms" name="acceptTerms" />}
          label={
            <span className="text-sm font-normal leading-relaxed text-muted-foreground">
              Ich habe die{" "}
              <Link href="/agb" target="_blank" className="font-semibold text-primary underline-offset-2 hover:underline">
                AGB
              </Link>{" "}
              und die{" "}
              <Link href="/datenschutz" target="_blank" className="font-semibold text-primary underline-offset-2 hover:underline">
                Datenschutzerklärung
              </Link>{" "}
              gelesen und akzeptiere sie.
            </span>
          }
        />
        {fieldError(state, "acceptTerms") ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {fieldError(state, "acceptTerms")}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="lg" loading={pending}>
        Kostenloses Konto erstellen
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, null);
  if (state?.ok) return <Alert tone="success">{state.message}</Alert>;
  return (
    <form action={action} className="grid gap-5" noValidate>
      {state && !state.ok && !state.fieldErrors ? <Alert tone="error">{state.error}</Alert> : null}
      <Field label="E-Mail-Adresse" htmlFor="email" error={fieldError(state, "email")}>
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Button type="submit" size="lg" loading={pending}>
        Link zum Zurücksetzen senden
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(resetPasswordAction, null);
  return (
    <form action={action} className="grid gap-5" noValidate>
      {state && !state.ok && !state.fieldErrors ? <Alert tone="error">{state.error}</Alert> : null}
      <Field label="Neues Passwort" htmlFor="password" hint="Mindestens 10 Zeichen mit Buchstaben und Zahlen." error={fieldError(state, "password")}>
        <PasswordInput name="password" autoComplete="new-password" required />
      </Field>
      <Field label="Passwort wiederholen" htmlFor="confirm" error={fieldError(state, "confirm")}>
        <PasswordInput name="confirm" autoComplete="new-password" required />
      </Field>
      <Button type="submit" size="lg" loading={pending}>
        Passwort speichern
      </Button>
    </form>
  );
}
