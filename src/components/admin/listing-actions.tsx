"use client";

import * as React from "react";
import Link from "next/link";
import { Ban, BadgeCheck, Check, Ellipsis, ExternalLink, FileCheck, Flag, Undo2, Unlock, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ActionDialog, VerificationDialog } from "@/components/admin/action-dialog";
import { moderateListingAction, setVerificationAction } from "@/app/admin/actions";
import type { ListingModerationAction, ModerationStatus, VerificationStatus } from "@/lib/validation/admin";
import type { ListingStatus } from "@/lib/constants";

type DialogKind = ListingModerationAction | "ownership" | "documentation_complete" | null;

const MODERATION_DIALOGS: Record<
  ListingModerationAction,
  { title: string; description: string; confirm: string; reason?: { label: string; required: boolean; placeholder?: string }; destructive?: boolean }
> = {
  approve: {
    title: "Inserat freigeben?",
    description: "Das Inserat wird sofort veröffentlicht, sofern alle Pflichtangaben vorhanden sind.",
    confirm: "Freigeben",
  },
  reject: {
    title: "Inserat zurückweisen?",
    description: "Das Inserat geht zurück in Bearbeitung. Die Eigentümerin bzw. der Eigentümer wird mit Ihrer Begründung informiert.",
    confirm: "Zurückweisen",
    reason: { label: "Begründung für die Eigentümer", required: true, placeholder: "z. B. Bitte ergänzen Sie den Grundriss." },
  },
  block: {
    title: "Inserat sperren?",
    description: "Das Inserat ist sofort nicht mehr öffentlich und kann nicht erneut veröffentlicht werden, bis die Sperre aufgehoben wird. Die Eigentümer werden informiert.",
    confirm: "Sperren",
    reason: { label: "Begründung für die Eigentümer", required: true, placeholder: "z. B. Irreführende Preisangabe" },
    destructive: true,
  },
  // Titel und Text hängen vom Zustand ab, siehe unblockDialog()
  unblock: {
    title: "Markierung aufheben?",
    description: "Die Markierung wird entfernt. An der Sichtbarkeit des Inserats ändert sich nichts.",
    confirm: "Aufheben",
    reason: { label: "Notiz", required: false },
  },
  flag: {
    title: "Inserat markieren?",
    description: "Das Inserat bleibt sichtbar, wird aber zur weiteren Beobachtung markiert.",
    confirm: "Markieren",
    reason: { label: "Grund der Markierung", required: true },
  },
};

/**
 * Aufheben setzt nur den Moderationsstatus zurück (admin_moderate_listing): Ein gesperrtes, aber
 * veröffentlichtes Inserat ist danach sofort wieder öffentlich.
 */
function unblockDialog(status: ListingStatus, moderationStatus: ModerationStatus) {
  const base = MODERATION_DIALOGS.unblock;
  if (moderationStatus !== "blocked") return base;
  const goesPublic = status === "published" || status === "reserved";
  return {
    ...base,
    title: "Sperre aufheben?",
    description: goesPublic
      ? "Das Inserat ist danach sofort wieder öffentlich sichtbar."
      : "Das Inserat ist danach nicht mehr gesperrt und kann wieder veröffentlicht werden.",
  };
}

export function ListingActions({
  listingId,
  propertyId,
  ownerId,
  slug,
  status,
  moderationStatus,
  verifications,
  isAdmin,
  title,
}: {
  listingId: string;
  propertyId: string;
  ownerId: string;
  slug: string | null;
  status: ListingStatus;
  moderationStatus: ModerationStatus;
  verifications: Partial<Record<"ownership" | "documentation_complete", VerificationStatus>>;
  isAdmin: boolean;
  title: string;
}) {
  const [dialog, setDialog] = React.useState<DialogKind>(null);
  const isPublic = (status === "published" || status === "reserved") && moderationStatus !== "blocked";
  const close = (open: boolean) => {
    if (!open) setDialog(null);
  };
  const moderation =
    dialog === "unblock"
      ? unblockDialog(status, moderationStatus)
      : dialog && dialog in MODERATION_DIALOGS
        ? MODERATION_DIALOGS[dialog as ListingModerationAction]
        : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Aktionen für «${title}»`}>
            <Ellipsis className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {isPublic && slug ? (
            <DropdownMenuItem asChild>
              <Link href={`/immobilien/${slug}`} target="_blank">
                <ExternalLink /> Öffentliche Seite öffnen
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <Link href={`/admin/benutzer/${ownerId}`}>
              <UserRound /> Eigentümer anzeigen
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Moderation</DropdownMenuLabel>
          {status === "pending_review" ? (
            <>
              <DropdownMenuItem onSelect={() => setDialog("approve")}>
                <Check /> Freigeben
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialog("reject")}>
                <Undo2 /> Zurückweisen
              </DropdownMenuItem>
            </>
          ) : null}
          {moderationStatus === "ok" ? (
            <DropdownMenuItem onSelect={() => setDialog("flag")}>
              <Flag /> Markieren
            </DropdownMenuItem>
          ) : null}
          {moderationStatus !== "blocked" ? (
            <DropdownMenuItem destructive onSelect={() => setDialog("block")}>
              <Ban /> Sperren
            </DropdownMenuItem>
          ) : null}
          {moderationStatus !== "ok" ? (
            <DropdownMenuItem onSelect={() => setDialog("unblock")}>
              <Unlock /> {moderationStatus === "blocked" ? "Sperre aufheben" : "Markierung aufheben"}
            </DropdownMenuItem>
          ) : null}
          {isAdmin ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Verifizierung</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setDialog("ownership")}>
                <BadgeCheck /> Eigentümerberechtigung
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialog("documentation_complete")}>
                <FileCheck /> Objektdokumentation
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {moderation && dialog ? (
        <ActionDialog
          open
          onOpenChange={close}
          title={moderation.title}
          description={
            <>
              <span className="block font-medium text-foreground">{title}</span>
              {moderation.description}
            </>
          }
          reason={moderation.reason}
          confirmLabel={moderation.confirm}
          destructive={moderation.destructive}
          onConfirm={(reason) => moderateListingAction({ listingId, action: dialog, reason })}
        />
      ) : null}

      {dialog === "ownership" || dialog === "documentation_complete" ? (
        <VerificationDialog
          open
          onOpenChange={close}
          title={dialog === "ownership" ? "Eigentümerberechtigung prüfen" : "Objektdokumentation prüfen"}
          description={
            dialog === "ownership"
              ? "Bestätigen Sie nur, wenn ein Nachweis vorliegt, dass die inserierende Person über das Objekt verfügen darf (z. B. Grundbuchauszug, Vollmacht). Der Status kann öffentlich angezeigt werden."
              : "Bestätigen Sie nur, wenn alle für den Verkauf wesentlichen Unterlagen vorliegen und geprüft wurden. Der Status kann öffentlich angezeigt werden."
          }
          currentlyVerified={verifications[dialog] === "verified"}
          methodPlaceholder={dialog === "ownership" ? "z. B. Grundbuchauszug geprüft" : "z. B. Grundrisse, GEAK und Reglement geprüft"}
          onConfirm={({ status: decision, method }) =>
            setVerificationAction({ subjectType: "property", subjectId: propertyId, kind: dialog, status: decision, method })
          }
        />
      ) : null}
    </>
  );
}
