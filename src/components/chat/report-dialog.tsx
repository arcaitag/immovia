"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { REPORT_REASONS, type ReportReason } from "@/lib/constants";
import { MESSAGE_REPORT_REASONS } from "@/lib/validation/message";
import { reportAction } from "@/app/dashboard/nachrichten/actions";

export interface ReportTarget {
  type: "message" | "conversation";
  id: string;
}

export function ReportDialog({ target, onOpenChange }: { target: ReportTarget | null; onOpenChange: (open: boolean) => void }) {
  const [reason, setReason] = React.useState<ReportReason | "">("");
  const [details, setDetails] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function close(open: boolean) {
    if (!open) {
      setReason("");
      setDetails("");
      setError(null);
    }
    onOpenChange(open);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!target) return;
    if (!reason) {
      setError("Bitte wählen Sie einen Grund.");
      return;
    }
    startTransition(async () => {
      const res = await reportAction({ targetType: target.type, targetId: target.id, reason, details: details.trim() || undefined });
      if (res.ok) {
        toast.success(res.message ?? "Meldung gesendet.");
        close(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={target !== null} onOpenChange={close}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-5" noValidate>
          <DialogHeader>
            <DialogTitle>{target?.type === "message" ? "Nachricht melden" : "Konversation melden"}</DialogTitle>
            <DialogDescription>
              Unser Team prüft die Meldung vertraulich. Die andere Person erfährt nicht, dass Sie gemeldet haben.
            </DialogDescription>
          </DialogHeader>
          <Field label="Grund" htmlFor="report-reason" error={error} required>
            <NativeSelect
              id="report-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value as ReportReason);
                setError(null);
              }}
            >
              <option value="" disabled>
                Bitte wählen
              </option>
              {MESSAGE_REPORT_REASONS.map((key) => (
                <option key={key} value={key}>
                  {REPORT_REASONS[key]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Weitere Angaben" htmlFor="report-details" optional hint="Höchstens 2000 Zeichen.">
            <Textarea id="report-details" value={details} maxLength={2000} onChange={(e) => setDetails(e.target.value)} className="min-h-24" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Abbrechen
            </Button>
            <Button type="submit" variant="destructive" loading={pending}>
              Melden
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
