"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/sonner";
import type { ActionResult } from "@/lib/errors";

type AnyResult = ActionResult<unknown>;

/** Führt eine Server Action aus, zeigt das Ergebnis als Toast und lädt die Seite neu. */
export function useAdminAction() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const run = (fn: () => Promise<AnyResult>, options: { onSuccess?: () => void; onError?: (res: Extract<AnyResult, { ok: false }>) => void } = {}) => {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        if (options.onError) options.onError(res);
        else toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "Gespeichert.");
      options.onSuccess?.();
      router.refresh();
    });
  };
  return { pending, run };
}

interface ReasonConfig {
  label: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
}

/**
 * Bestätigungsdialog für Admin-Aktionen, optional mit Begründung.
 * Bleibt bei Fehlern offen und zeigt die Meldung an.
 */
export function ActionDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  title,
  description,
  reason,
  confirmLabel,
  destructive,
  children,
  onConfirm,
}: {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  reason?: ReasonConfig;
  confirmLabel: string;
  destructive?: boolean;
  children?: React.ReactNode;
  onConfirm: (reason: string) => Promise<AnyResult>;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const { pending, run } = useAdminAction();
  const fieldId = React.useId();

  function setOpen(next: boolean) {
    if (pending) return;
    if (!next) {
      setText("");
      setError(null);
    }
    if (onOpenChange) onOpenChange(next);
    else setInternalOpen(next);
  }

  const tooShort = Boolean(reason?.required) && text.trim().length < 5;

  function submit() {
    setError(null);
    run(() => onConfirm(text.trim()), {
      onSuccess: () => setOpen(false),
      onError: (res) => setError(res.fieldErrors?.reason?.[0] ?? res.error),
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        {error ? <Alert tone="error">{error}</Alert> : null}
        {reason ? (
          <Field
            label={reason.label}
            htmlFor={fieldId}
            required={reason.required}
            optional={!reason.required}
            hint={reason.hint ?? (reason.required ? "Mindestens 5 Zeichen. Wird im Protokoll gespeichert." : undefined)}
          >
            <Textarea
              rows={3}
              maxLength={1000}
              value={text}
              placeholder={reason.placeholder}
              onChange={(event) => setText(event.target.value)}
              disabled={pending}
            />
          </Field>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Abbrechen</AlertDialogCancel>
          <Button variant={destructive ? "destructive" : "default"} onClick={submit} disabled={tooShort} loading={pending}>
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const VERIFICATION_DECISIONS = [
  { value: "verified", label: "Geprüft – Verifizierung bestätigen" },
  { value: "revoked", label: "Widerrufen – nicht mehr gültig" },
  { value: "rejected", label: "Abgelehnt – Prüfung nicht bestanden" },
] as const;
type Decision = (typeof VERIFICATION_DECISIONS)[number]["value"];

/** Dialog zum Setzen einer Verifizierung (admin_set_verification). */
export function VerificationDialog({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  currentlyVerified,
  methodPlaceholder,
  onConfirm,
}: {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  currentlyVerified: boolean;
  methodPlaceholder: string;
  onConfirm: (input: { status: Decision; method: string }) => Promise<AnyResult>;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = open ?? internalOpen;
  const [decision, setDecision] = React.useState<Decision>(currentlyVerified ? "revoked" : "verified");
  const [method, setMethod] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const { pending, run } = useAdminAction();
  const decisionId = React.useId();
  const methodId = React.useId();

  function setOpen(next: boolean) {
    if (pending) return;
    if (!next) {
      setMethod("");
      setError(null);
      setDecision(currentlyVerified ? "revoked" : "verified");
    }
    if (onOpenChange) onOpenChange(next);
    else setInternalOpen(next);
  }

  const needsMethod = decision === "verified" && method.trim().length < 3;

  function submit() {
    setError(null);
    run(() => onConfirm({ status: decision, method: method.trim() }), {
      onSuccess: () => setOpen(false),
      onError: (res) => setError(res.fieldErrors?.method?.[0] ?? res.error),
    });
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setOpen}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field label="Entscheid" htmlFor={decisionId}>
          <NativeSelect value={decision} onChange={(event) => setDecision(event.target.value as Decision)} disabled={pending}>
            {VERIFICATION_DECISIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label="Prüfmethode"
          htmlFor={methodId}
          required={decision === "verified"}
          optional={decision !== "verified"}
          hint="Kurz und sachlich, z. B. «Grundbuchauszug vom 02.11.2026 geprüft». Keine vertraulichen Angaben."
        >
          <Input value={method} maxLength={200} placeholder={methodPlaceholder} onChange={(event) => setMethod(event.target.value)} disabled={pending} />
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Abbrechen</AlertDialogCancel>
          <Button onClick={submit} disabled={needsMethod} loading={pending} variant={decision === "verified" ? "default" : "destructive"}>
            Speichern
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
