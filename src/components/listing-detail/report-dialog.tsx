"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { useAuthUser } from "@/hooks/use-auth-user";
import { REPORT_REASONS, type ReportReason } from "@/lib/constants";
import { reportListingAction } from "@/components/listing-detail/actions";
import { reportFormSchema, type ReportFormValues } from "@/components/listing-detail/schemas";
import { LoginPrompt } from "@/components/listing-detail/login-prompt";
import type { InquiryTarget } from "@/components/listing-detail/inquiry-dialog";

export function ReportDialog({ open, onOpenChange, target }: { open: boolean; onOpenChange: (open: boolean) => void; target: InquiryTarget }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inserat melden</DialogTitle>
          <DialogDescription>
            Ihre Meldung geht vertraulich an das Immovia-Team. Die Inserentin bzw. der Inserent erfährt nicht, wer gemeldet hat.
          </DialogDescription>
        </DialogHeader>
        {open ? <ReportBody target={target} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ReportBody({ target, onClose }: { target: InquiryTarget; onClose: () => void }) {
  const { data: user, isLoading } = useAuthUser();
  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: { reason: undefined, details: "" },
  });
  const errors = form.formState.errors;

  if (isLoading) return <Spinner className="justify-self-center py-6" label="Konto wird geprüft" />;
  if (!user) {
    return (
      <LoginPrompt
        returnTo={`/immobilien/${target.slug}`}
        anchor="melden"
        reason="Um Missbrauch zu verhindern, können nur angemeldete Personen Inserate melden."
      />
    );
  }

  async function onSubmit(values: ReportFormValues) {
    const result = await reportListingAction({ ...values, listingId: target.listingId });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Meldung übermittelt.");
    onClose();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5" noValidate>
      <Controller
        control={form.control}
        name="reason"
        render={({ field }) => (
          <div className="grid gap-2">
            <p id="meldung-grund" className="text-sm font-semibold">
              Grund <span className="text-destructive" aria-hidden>*</span>
            </p>
            <RadioGroup
              aria-labelledby="meldung-grund"
              aria-invalid={errors.reason ? true : undefined}
              value={field.value ?? ""}
              onValueChange={(v) => field.onChange(v as ReportReason)}
              className="gap-1"
            >
              {(Object.entries(REPORT_REASONS) as [ReportReason, string][]).map(([value, label]) => (
                <div key={value} className="flex min-h-9 items-center gap-3">
                  <RadioGroupItem id={`meldung-${value}`} value={value} />
                  <Label htmlFor={`meldung-${value}`} className="cursor-pointer font-medium">
                    {label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {errors.reason?.message ? (
              <p role="alert" className="text-xs font-medium text-destructive">
                {errors.reason.message}
              </p>
            ) : null}
          </div>
        )}
      />
      <Field label="Beschreibung" htmlFor="meldung-details" optional hint="Was ist Ihnen aufgefallen?" error={errors.details?.message}>
        <Textarea rows={4} maxLength={2000} {...form.register("details")} />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Abbrechen
        </Button>
        <Button type="submit" loading={form.formState.isSubmitting}>
          Meldung senden
        </Button>
      </DialogFooter>
    </form>
  );
}
