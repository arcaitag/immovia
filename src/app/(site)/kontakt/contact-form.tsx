"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/sonner";
import { submitContactAction } from "./actions";
import { CONTACT_SUBJECTS, contactFormSchema, type ContactFormValues } from "./schema";

export function ContactForm() {
  const startedAt = React.useRef<number | null>(null);
  const [sent, setSent] = React.useState(false);
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: { name: "", email: "", subject: "", message: "", website: "" },
  });
  const errors = form.formState.errors;

  React.useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  async function send(values: ContactFormValues, elapsedMs: number) {
    const result = await submitContactAction({ ...values, elapsedMs });
    if (!result.ok) {
      for (const name of ["name", "email", "subject", "message"] as const) {
        const message = result.fieldErrors?.[name]?.[0];
        if (message) form.setError(name, { message });
      }
      toast.error(result.error);
      return;
    }
    setSent(true);
    form.reset();
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const elapsedMs = startedAt.current ? Date.now() - startedAt.current : 0;
    void form.handleSubmit((values) => send(values, elapsedMs))(event);
  }

  if (sent) {
    return (
      <div className="grid gap-5">
        <Alert tone="success" title="Vielen Dank für Ihre Nachricht">
          Wir haben Ihre Anfrage erhalten und melden uns so rasch wie möglich per E-Mail.
        </Alert>
        <Button
          variant="outline"
          className="justify-self-start"
          onClick={() => {
            startedAt.current = Date.now();
            setSent(false);
          }}
        >
          Weitere Nachricht senden
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" htmlFor="kontakt-name" required error={errors.name?.message}>
          <Input autoComplete="name" maxLength={120} {...form.register("name")} />
        </Field>
        <Field label="E-Mail-Adresse" htmlFor="kontakt-email" required error={errors.email?.message}>
          <Input type="email" autoComplete="email" maxLength={254} {...form.register("email")} />
        </Field>
      </div>
      <Field label="Thema" htmlFor="kontakt-thema" required error={errors.subject?.message}>
        <NativeSelect {...form.register("subject")}>
          <option value="">Bitte wählen</option>
          {CONTACT_SUBJECTS.map((subject) => (
            <option key={subject} value={subject}>
              {subject}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Nachricht" htmlFor="kontakt-nachricht" required error={errors.message?.message}>
        <Textarea rows={7} maxLength={4000} {...form.register("message")} />
      </Field>

      {/* Spam-Schutz: für Menschen unsichtbar, wird von Bots ausgefüllt */}
      <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="kontakt-website">Website (bitte leer lassen)</label>
        <input id="kontakt-website" type="text" tabIndex={-1} autoComplete="off" {...form.register("website")} />
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Wir verwenden Ihre Angaben nur, um Ihre Anfrage zu beantworten. Mehr dazu in der{" "}
        <Link href="/datenschutz" className="font-semibold text-primary hover:underline">
          Datenschutzerklärung
        </Link>
        .
      </p>
      <Button type="submit" size="lg" className="justify-self-start" loading={form.formState.isSubmitting}>
        <Send aria-hidden /> Nachricht senden
      </Button>
    </form>
  );
}
