"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, RotateCcw, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { applyServerFieldErrors } from "@/components/account/form-helpers";
import { inviteMemberAction, resendInvitationAction, revokeInvitationAction } from "@/app/dashboard/firma/actions";
import { ASSIGNABLE_ORG_ROLES, ORG_ROLES, inviteMemberSchema, type InviteMemberInput, type OrgRole } from "@/lib/validation/organization";
import { formatDate } from "@/lib/format";
import type { ActionResult } from "@/lib/errors";

export function InviteMemberForm({ organizationId, emailConfigured }: { organizationId: string; emailConfigured: boolean }) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { organizationId, email: "", role: "member" },
  });

  const onSubmit = handleSubmit(async () => {
    setFormError(null);
    const res = await inviteMemberAction(getValues());
    if (!res.ok) {
      if (!applyServerFieldErrors(setError, res.fieldErrors)) setFormError(res.error);
      return;
    }
    toast.success(
      emailConfigured
        ? `Einladung an ${res.data.email} gesendet.`
        : `Einladung für ${res.data.email} erstellt. Sie wird versendet, sobald der E-Mail-Versand eingerichtet ist.`,
    );
    reset({ organizationId, email: "", role: getValues("role") });
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      {!emailConfigured ? (
        <Alert tone="warning" title="E-Mail-Versand nicht eingerichtet">
          Einladungen werden gespeichert, aber erst zugestellt, wenn der E-Mail-Versand konfiguriert ist.
        </Alert>
      ) : null}
      <input type="hidden" {...register("organizationId")} />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_13rem_auto] sm:items-start">
        <Field label="E-Mail-Adresse" htmlFor="invite-email" error={errors.email?.message}>
          <Input type="email" autoComplete="off" placeholder="name@firma.ch" {...register("email")} />
        </Field>
        <Field label="Rolle" htmlFor="invite-role" error={errors.role?.message}>
          <NativeSelect {...register("role")}>
            {ASSIGNABLE_ORG_ROLES.map((role) => (
              <option key={role} value={role}>
                {ORG_ROLES[role].label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Button type="submit" loading={isSubmitting} className="sm:mt-[1.375rem]">
          <Send aria-hidden /> Einladen
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Die eingeladene Person erhält einen persönlichen Link, der 7 Tage gültig ist. Sie muss sich mit genau dieser
        E-Mail-Adresse anmelden oder registrieren.
      </p>
    </form>
  );
}

export interface InvitationItem {
  id: string;
  email: string;
  role: OrgRole;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
}

export function InvitationsList({ invitations }: { invitations: InvitationItem[] }) {
  if (invitations.length === 0) {
    return <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">Keine offenen Einladungen.</p>;
  }
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {invitations.map((invitation) => (
        <InvitationRow key={invitation.id} invitation={invitation} />
      ))}
    </ul>
  );
}

function InvitationRow({ invitation }: { invitation: InvitationItem }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function run(action: () => Promise<ActionResult<null>>) {
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "Erledigt.");
      router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" aria-busy={pending || undefined}>
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-mint-100 text-forest">
          <Mail className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{invitation.email}</p>
          <p className="text-xs text-muted-foreground">
            {ORG_ROLES[invitation.role].label} · eingeladen am {formatDate(invitation.createdAt)} ·{" "}
            {invitation.expired ? "abgelaufen" : `gültig bis ${formatDate(invitation.expiresAt)}`}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {invitation.expired ? <Badge tone="amber">Abgelaufen</Badge> : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => run(() => resendInvitationAction({ invitationId: invitation.id }))}
        >
          <RotateCcw aria-hidden /> Erneut senden
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          className="text-destructive hover:bg-destructive-bg"
          onClick={() => run(() => revokeInvitationAction({ invitationId: invitation.id }))}
        >
          <X aria-hidden /> Widerrufen
        </Button>
      </div>
    </li>
  );
}
