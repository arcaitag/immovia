"use client";

import * as React from "react";
import Link from "next/link";
import { Ban, BadgeCheck, Ellipsis, ExternalLink, Unlock, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ActionDialog, VerificationDialog } from "@/components/admin/action-dialog";
import { setOrganizationStatusAction, setVerificationAction } from "@/app/admin/actions";
import type { VerificationStatus } from "@/lib/validation/admin";

export function OrganizationActions({
  organizationId,
  name,
  slug,
  status,
  isPublic,
  ownerId,
  verification,
  isAdmin,
}: {
  organizationId: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  isPublic: boolean;
  ownerId: string | null;
  verification: VerificationStatus | null;
  isAdmin: boolean;
}) {
  const [dialog, setDialog] = React.useState<"status" | "verify" | null>(null);
  const close = (open: boolean) => {
    if (!open) setDialog(null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Aktionen für «${name}»`}>
            <Ellipsis className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {isPublic && status === "active" ? (
            <DropdownMenuItem asChild>
              <Link href={`/firmen/${slug}`} target="_blank">
                <ExternalLink /> Öffentliche Firmenseite
              </Link>
            </DropdownMenuItem>
          ) : null}
          {ownerId ? (
            <DropdownMenuItem asChild>
              <Link href={`/admin/benutzer/${ownerId}`}>
                <UserRound /> Inhaber/in anzeigen
              </Link>
            </DropdownMenuItem>
          ) : null}
          {isAdmin ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setDialog("verify")}>
                <BadgeCheck /> Verifizierung
              </DropdownMenuItem>
              {status === "active" ? (
                <DropdownMenuItem destructive onSelect={() => setDialog("status")}>
                  <Ban /> Firma sperren
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => setDialog("status")}>
                  <Unlock /> Firma aktivieren
                </DropdownMenuItem>
              )}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === "status" ? (
        <ActionDialog
          open
          onOpenChange={close}
          title={status === "active" ? `«${name}» sperren?` : `«${name}» wieder aktivieren?`}
          description={
            status === "active"
              ? "Die Firmenseite wird ausgeblendet und die Mitglieder verlieren den gemeinsamen Zugriff auf Firmenprofil und Firmenimmobilien. Persönliche Konten bleiben aktiv."
              : "Firmenseite und gemeinsamer Zugriff der Mitglieder werden wiederhergestellt."
          }
          reason={status === "active" ? { label: "Begründung", required: true } : { label: "Notiz", required: false }}
          confirmLabel={status === "active" ? "Sperren" : "Aktivieren"}
          destructive={status === "active"}
          onConfirm={(reason) =>
            setOrganizationStatusAction({ organizationId, status: status === "active" ? "suspended" : "active", reason })
          }
        />
      ) : null}

      {dialog === "verify" ? (
        <VerificationDialog
          open
          onOpenChange={close}
          title={`Firma «${name}» verifizieren`}
          description="Bestätigen Sie nur, wenn Sie die Firma geprüft haben (z. B. Handelsregister und UID). Der Status ist für die Mitglieder sichtbar."
          currentlyVerified={verification === "verified"}
          methodPlaceholder="z. B. Handelsregisterauszug und UID-Register geprüft"
          onConfirm={({ status: decision, method }) =>
            setVerificationAction({ subjectType: "organization", subjectId: organizationId, kind: "organization", status: decision, method })
          }
        />
      ) : null}
    </>
  );
}
