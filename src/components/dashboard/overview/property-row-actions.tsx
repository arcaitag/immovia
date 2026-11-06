"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, LayoutDashboard, MoreHorizontal, Pencil, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { StatusActionDialog, type ListingStatusInfo } from "@/components/listing-editor/status-actions";
import { deletePropertyAction } from "@/lib/properties/actions";
import { isDraftStatus, isPublicStatus, managementActions, statusActionCopy, type StatusAction } from "@/lib/properties/listing-status";

/** Bestätigter Soft-Delete einer Immobilie (Inserat wird vorher archiviert). */
export function DeletePropertyDialog({
  propertyId,
  name,
  listingPublic,
  open,
  onOpenChange,
  redirectToList = false,
}: {
  propertyId: string;
  name: string;
  listingPublic: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nach dem Löschen zur Liste wechseln (Aufruf von einer Seite der Immobilie). */
  redirectToList?: boolean;
}) {
  const [pending, startTransition] = React.useTransition();
  return (
    <AlertDialog open={open} onOpenChange={(next) => (pending ? null : onOpenChange(next))}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Immobilie löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            «{name}» wird aus Ihrem Dashboard entfernt.
            {listingPublic
              ? " Das veröffentlichte Inserat wird zuerst archiviert und ist danach nicht mehr öffentlich sichtbar."
              : " Ein vorhandenes Inserat wird archiviert."}{" "}
            Dieser Schritt kann nicht rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            destructive
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              startTransition(async () => {
                // Bei redirectToList leitet die Action weiter; ein Ergebnis gibt es dann nur im Fehlerfall.
                const result = await deletePropertyAction(propertyId, redirectToList);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success(result.message ?? "Die Immobilie wurde gelöscht.");
                onOpenChange(false);
              });
            }}
          >
            {pending ? "Wird gelöscht …" : "Endgültig löschen"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Aktionsmenü einer Zeile in «Meine Immobilien». */
export function PropertyRowActions({
  propertyId,
  name,
  listing,
  publicUrl,
}: {
  propertyId: string;
  name: string;
  listing: ListingStatusInfo | null;
  publicUrl: string | null;
}) {
  const [statusAction, setStatusAction] = React.useState<StatusAction | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const actions = listing ? managementActions(listing).filter((action) => action !== "archive") : [];
  const canPublish = listing ? isDraftStatus(listing.status) : false;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Aktionen für ${name}`}>
            <MoreHorizontal className="size-5" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/immobilien/${propertyId}/bearbeiten`}>
              <Pencil /> Bearbeiten
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/immobilien/${propertyId}`}>
              <LayoutDashboard /> Übersicht und Schritte
            </Link>
          </DropdownMenuItem>
          {publicUrl ? (
            <DropdownMenuItem asChild>
              <Link href={publicUrl} target="_blank" rel="noopener">
                <ExternalLink /> Öffentliche Seite
              </Link>
            </DropdownMenuItem>
          ) : null}
          {canPublish ? (
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/immobilien/${propertyId}/veroeffentlichen`}>
                <Send /> Veröffentlichen …
              </Link>
            </DropdownMenuItem>
          ) : null}
          {listing && actions.length ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Status ändern</DropdownMenuLabel>
              {actions.map((action) => (
                <DropdownMenuItem key={action} onSelect={() => setStatusAction(action)}>
                  {statusActionCopy(action, listing).label}
                </DropdownMenuItem>
              ))}
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => setDeleteOpen(true)}>
            <Trash2 /> Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {listing ? <StatusActionDialog info={listing} action={statusAction} onClose={() => setStatusAction(null)} /> : null}
      <DeletePropertyDialog
        propertyId={propertyId}
        name={name}
        listingPublic={listing ? isPublicStatus(listing.status) : false}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
