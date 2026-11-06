"use client";

import * as React from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field, ChoiceRow } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { useAuthUser } from "@/hooks/use-auth-user";
import type { OfferType } from "@/lib/constants";
import { createInquiryAction } from "@/components/listing-detail/actions";
import { inquiryFormSchema, type InquiryFormValues } from "@/components/listing-detail/schemas";
import { LoginPrompt, OwnListingNotice } from "@/components/listing-detail/login-prompt";

function draftKey(listingId: string) {
  return `immovia:anfrage:${listingId}`;
}

function readDraft(listingId: string): string | null {
  try {
    return window.sessionStorage.getItem(draftKey(listingId));
  } catch {
    return null;
  }
}

function writeDraft(listingId: string, value: string | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(draftKey(listingId));
    else window.sessionStorage.setItem(draftKey(listingId), value);
  } catch {
    // Speicher nicht verfügbar (z. B. privater Modus) – Entwurf wird nicht gesichert.
  }
}

export function defaultInquiryMessage(title: string): string {
  return `Guten Tag\n\nIch interessiere mich für Ihr Inserat «${title}». Ist das Objekt noch verfügbar? Gerne erfahre ich mehr darüber.\n\nFreundliche Grüsse`;
}

export interface InquiryTarget {
  listingId: string;
  slug: string;
  title: string;
  ownerId: string;
  offerType: OfferType;
  contactName: string | null;
}

export function InquiryDialog({
  open,
  onOpenChange,
  target,
  wantsViewing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: InquiryTarget;
  wantsViewing?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Kontakt aufnehmen</DialogTitle>
          <DialogDescription>
            Ihre Nachricht geht an {target.contactName ? <strong className="font-semibold text-foreground">{target.contactName}</strong> : "die Inserentin bzw. den Inserenten"}.
            Die Antwort finden Sie in Ihren Nachrichten auf Immovia.
          </DialogDescription>
        </DialogHeader>
        {open ? <InquiryBody target={target} wantsViewing={wantsViewing} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function InquiryBody({ target, wantsViewing, onClose }: { target: InquiryTarget; wantsViewing?: boolean; onClose: () => void }) {
  const { data: user, isLoading } = useAuthUser();
  const [conversationId, setConversationId] = React.useState<string | null>(null);

  if (isLoading) return <Spinner className="justify-self-center py-6" label="Konto wird geprüft" />;
  if (!user) {
    return (
      <LoginPrompt
        returnTo={`/immobilien/${target.slug}`}
        anchor="anfrage"
        reason="Damit Ihre Anfrage und die Antworten sicher an einem Ort bleiben, brauchen Sie ein Immovia-Konto."
      />
    );
  }
  if (user.id === target.ownerId) return <OwnListingNotice />;

  if (conversationId) {
    return (
      <div className="grid gap-5">
        <Alert tone="success" title="Anfrage gesendet">
          Ihre Nachricht ist angekommen. Sie werden benachrichtigt, sobald eine Antwort eintrifft.
        </Alert>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Schliessen
          </Button>
          <Button asChild>
            <Link href={`/dashboard/nachrichten/${conversationId}`}>
              <MessageSquare aria-hidden /> Zur Konversation
            </Link>
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return <InquiryForm target={target} wantsViewing={wantsViewing} onSent={setConversationId} onCancel={onClose} />;
}

function InquiryForm({
  target,
  wantsViewing,
  onSent,
  onCancel,
}: {
  target: InquiryTarget;
  wantsViewing?: boolean;
  onSent: (conversationId: string) => void;
  onCancel: () => void;
}) {
  const [initialMessage] = React.useState(() => readDraft(target.listingId) ?? defaultInquiryMessage(target.title));
  const form = useForm<InquiryFormValues>({
    resolver: zodResolver(inquiryFormSchema),
    defaultValues: { message: initialMessage, phone: "", wantsViewing: Boolean(wantsViewing), wantsDossier: false },
  });
  const message = useWatch({ control: form.control, name: "message" });
  const viewingChecked = useWatch({ control: form.control, name: "wantsViewing" });
  const dossierChecked = useWatch({ control: form.control, name: "wantsDossier" });
  const errors = form.formState.errors;

  React.useEffect(() => {
    const timer = window.setTimeout(() => writeDraft(target.listingId, message), 400);
    return () => window.clearTimeout(timer);
  }, [message, target.listingId]);

  async function onSubmit(values: InquiryFormValues) {
    const result = await createInquiryAction({ ...values, listingId: target.listingId });
    if (!result.ok) {
      const fieldErrors = result.fieldErrors ?? {};
      for (const name of ["message", "phone"] as const) {
        const msg = fieldErrors[name]?.[0];
        if (msg) form.setError(name, { message: msg });
      }
      toast.error(result.error);
      return;
    }
    writeDraft(target.listingId, null);
    toast.success(result.message ?? "Ihre Anfrage wurde gesendet.");
    onSent(result.data.conversationId);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5" noValidate>
      <Field label="Ihre Nachricht" htmlFor="anfrage-nachricht" required error={errors.message?.message}>
        <Textarea rows={7} maxLength={3000} {...form.register("message")} />
      </Field>
      <Field
        label="Telefonnummer"
        htmlFor="anfrage-telefon"
        optional
        hint="Nur für Rückfragen zu diesem Inserat."
        error={errors.phone?.message}
      >
        <Input type="tel" autoComplete="tel" inputMode="tel" placeholder="+41 79 123 45 67" {...form.register("phone")} />
      </Field>
      <div className="grid gap-3">
        <ChoiceRow
          htmlFor="anfrage-besichtigung"
          control={
            <Checkbox
              id="anfrage-besichtigung"
              checked={viewingChecked}
              onCheckedChange={(v) => form.setValue("wantsViewing", v === true)}
            />
          }
          label="Ich möchte die Immobilie besichtigen"
        />
        <ChoiceRow
          htmlFor="anfrage-dossier"
          control={
            <Checkbox
              id="anfrage-dossier"
              checked={dossierChecked}
              onCheckedChange={(v) => form.setValue("wantsDossier", v === true)}
            />
          }
          label={target.offerType === "sale" ? "Bitte senden Sie mir die Verkaufsdokumentation" : "Bitte senden Sie mir weitere Unterlagen"}
        />
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Die Inserentin bzw. der Inserent sieht Ihren Anzeigenamen, Ihre Nachricht und – falls angegeben – Ihre Telefonnummer.
        Ihre E-Mail-Adresse wird nicht angezeigt.
      </p>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button type="submit" loading={form.formState.isSubmitting}>
          <CircleCheck aria-hidden /> Anfrage senden
        </Button>
      </DialogFooter>
    </form>
  );
}
