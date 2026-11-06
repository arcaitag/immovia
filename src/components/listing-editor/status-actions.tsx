"use client";

import * as React from "react";
import { Archive, BadgeCheck, CircleCheck, KeyRound, Pause, Play, RotateCcw, Send, Undo2, type LucideIcon } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/sonner";
import type { ListingStatus, OfferType } from "@/lib/constants";
import { changeListingStatusAction } from "@/lib/properties/listing-actions";
import {
  managementActions,
  statusActionCopy,
  statusActionTarget,
  type StatusAction,
  type StatusActionContext,
} from "@/lib/properties/listing-status";

const ICONS: Record<StatusAction, LucideIcon> = {
  publish: Send,
  withdraw_review: Undo2,
  pause: Pause,
  resume: Play,
  reserve: BadgeCheck,
  unreserve: RotateCcw,
  mark_sold: CircleCheck,
  mark_rented: KeyRound,
  relist: RotateCcw,
  archive: Archive,
};

export interface ListingStatusInfo {
  listingId: string;
  status: ListingStatus;
  offerType: OfferType;
  requireReview: boolean;
  approved: boolean;
}

function contextOf(info: ListingStatusInfo): StatusActionContext {
  return { status: info.status, offerType: info.offerType, requireReview: info.requireReview, approved: info.approved };
}

/** Bestätigungsdialog für Statusaktionen (wird von Buttons und Menüs gemeinsam genutzt). */
export function StatusActionDialog({
  info,
  action,
  onClose,
}: {
  info: ListingStatusInfo;
  action: StatusAction | null;
  onClose: () => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const copy = action ? statusActionCopy(action, contextOf(info)) : null;

  function confirm() {
    if (!action) return;
    startTransition(async () => {
      const result = await changeListingStatusAction(info.listingId, action);
      if (result.ok) toast.success(result.data.message);
      else toast.error(result.error);
      onClose();
    });
  }

  return (
    <AlertDialog open={action !== null} onOpenChange={(open) => (!open && !pending ? onClose() : null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy?.confirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>{copy?.confirmText}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            destructive={copy?.destructive}
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              confirm();
            }}
          >
            {pending ? "Wird ausgeführt …" : copy?.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Ein einzelner Status-Button mit Bestätigung (z. B. «Jetzt veröffentlichen»). */
export function StatusActionButton({
  info,
  action,
  disabled,
  size = "md",
  variant = "default",
  className,
}: {
  info: ListingStatusInfo;
  action: StatusAction;
  disabled?: boolean;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
}) {
  const [open, setOpen] = React.useState<StatusAction | null>(null);
  const copy = statusActionCopy(action, contextOf(info));
  const Icon = ICONS[action];
  return (
    <>
      <Button type="button" size={size} variant={variant} className={className} disabled={disabled} onClick={() => setOpen(action)}>
        <Icon aria-hidden /> {copy.label}
      </Button>
      <StatusActionDialog info={info} action={open} onClose={() => setOpen(null)} />
    </>
  );
}

/** Alle im aktuellen Status möglichen Verwaltungsaktionen als Buttons. */
export function ListingStatusActions({
  info,
  only,
  className,
}: {
  info: ListingStatusInfo;
  only?: StatusAction[];
  className?: string;
}) {
  const [pendingAction, setPendingAction] = React.useState<StatusAction | null>(null);
  const ctx = contextOf(info);
  const actions = managementActions(ctx).filter((action) => !only || only.includes(action));
  if (actions.length === 0) return null;
  return (
    <div className={className ?? "flex flex-wrap gap-2"}>
      {actions.map((action) => {
        const copy = statusActionCopy(action, ctx);
        const Icon = ICONS[action];
        const target = statusActionTarget(action, ctx);
        return (
          <Button
            key={action}
            type="button"
            variant={copy.destructive && target === "archived" ? "outline" : action === "resume" ? "default" : "outline"}
            className={copy.destructive && target === "archived" ? "text-destructive hover:bg-destructive-bg" : undefined}
            onClick={() => setPendingAction(action)}
          >
            <Icon aria-hidden /> {copy.label}
          </Button>
        );
      })}
      <StatusActionDialog info={info} action={pendingAction} onClose={() => setPendingAction(null)} />
    </div>
  );
}
