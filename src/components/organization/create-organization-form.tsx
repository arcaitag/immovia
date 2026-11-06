"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/sonner";
import { applyServerFieldErrors } from "@/components/account/form-helpers";
import { createOrganizationAction } from "@/app/dashboard/firma/actions";
import {
  createOrganizationSchema,
  type CreateOrganizationInput,
  type CreateOrganizationValues,
} from "@/lib/validation/organization";

export function CreateOrganizationForm({ defaultEmail }: { defaultEmail: string | null }) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrganizationInput, unknown, CreateOrganizationValues>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: { name: "", email: defaultEmail ?? "", phone: "" },
  });

  const onSubmit = handleSubmit(async () => {
    setFormError(null);
    const res = await createOrganizationAction(getValues());
    if (!res.ok) {
      if (!applyServerFieldErrors(setError, res.fieldErrors)) setFormError(res.error);
      return;
    }
    toast.success(res.message ?? "Firmenkonto erstellt.");
    router.replace(`/dashboard/firma?firma=${res.data.organizationId}`);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      <Field label="Firmenname" htmlFor="org-name" required error={errors.name?.message}>
        <Input autoComplete="organization" placeholder="z. B. Muster Immobilien AG" {...register("name")} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="E-Mail der Firma" htmlFor="org-email" optional error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register("email")} />
        </Field>
        <Field label="Telefon der Firma" htmlFor="org-phone" optional error={errors.phone?.message}>
          <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="031 123 45 67" {...register("phone")} />
        </Field>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Sie werden Inhaber/in des Firmenkontos. Adresse, Logo, Beschreibung und UID ergänzen Sie im nächsten Schritt.
      </p>
      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={isSubmitting}>
          <Building2 aria-hidden /> Firmenkonto erstellen
        </Button>
      </div>
    </form>
  );
}
