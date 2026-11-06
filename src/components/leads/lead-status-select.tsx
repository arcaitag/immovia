"use client";

import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { LEAD_STATUS, LEAD_STATUS_ORDER, type LeadStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { updateLeadAction } from "@/app/dashboard/interessenten/actions";
import { TONE_DOT } from "@/components/leads/tone";

/** Status eines Interessenten direkt ändern (alle 11 Stufen). */
export function LeadStatusSelect({
  leadId,
  value,
  onChanged,
  className,
  id,
}: {
  leadId: string;
  value: LeadStatus;
  onChanged?: (status: LeadStatus) => void;
  className?: string;
  id?: string;
}) {
  const [status, setStatus] = React.useState<LeadStatus>(value);
  const [pending, startTransition] = React.useTransition();

  function change(next: string) {
    const nextStatus = next as LeadStatus;
    if (nextStatus === status) return;
    const previous = status;
    setStatus(nextStatus);
    startTransition(async () => {
      const res = await updateLeadAction({ leadId, status: nextStatus });
      if (res.ok) {
        toast.success(res.message ?? "Status gespeichert.");
        onChanged?.(nextStatus);
      } else {
        setStatus(previous);
        toast.error(res.error);
      }
    });
  }

  return (
    <Select value={status} onValueChange={change} disabled={pending}>
      <SelectTrigger id={id} aria-label="Status des Interessenten" className={cn("h-10 w-full min-w-[14rem] text-sm sm:w-auto", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LEAD_STATUS_ORDER.map((key) => (
          <SelectItem key={key} value={key}>
            <span className="inline-flex items-center gap-2">
              <span className={cn("size-2 rounded-full", TONE_DOT[LEAD_STATUS[key].tone])} aria-hidden />
              {LEAD_STATUS[key].label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
