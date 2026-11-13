import * as React from "react";
import { Alert, Text } from "react-native";

import { Card } from "@/components/editor/shared";
import { Button, SectionTitle } from "@/components/ui";
import type { ListingRow } from "@/lib/api";
import { managementActions, statusActionCopy, type StatusAction, type StatusActionContext } from "@/lib/api-owner";
import { text } from "@/lib/theme";

const ICONS: Record<StatusAction, React.ComponentProps<typeof Button>["icon"]> = {
  publish: "rocket-outline",
  resume: "play-outline",
  pause: "pause-outline",
  reserve: "bookmark-outline",
  unreserve: "bookmark",
  mark_sold: "checkmark-done-outline",
  mark_rented: "checkmark-done-outline",
  relist: "refresh-outline",
  withdraw_review: "arrow-undo-outline",
  archive: "archive-outline",
};

export function statusContext(listing: ListingRow, requireReview: boolean): StatusActionContext {
  return { status: listing.status, offerType: listing.offer_type, requireReview, approved: Boolean(listing.approved_at) };
}

/** Fragt nach (Texte wie auf der Website) und führt die Aktion erst nach der Bestätigung aus. */
export function confirmStatusAction(action: StatusAction, ctx: StatusActionContext, run: (action: StatusAction) => void) {
  const copy = statusActionCopy(action, ctx);
  Alert.alert(copy.confirmTitle, copy.confirmText, [
    { text: "Abbrechen", style: "cancel" },
    { text: copy.confirmLabel, style: copy.destructive ? "destructive" : "default", onPress: () => run(action) },
  ]);
}

/** Statusaktionen eines bestehenden Inserats – genau die, die die Website im jeweiligen Status anbietet. */
export function StatusSection({
  listing,
  requireReview,
  busy,
  pendingAction,
  onAction,
}: {
  listing: ListingRow;
  requireReview: boolean;
  busy: boolean;
  pendingAction: StatusAction | null;
  onAction: (action: StatusAction) => void;
}) {
  const ctx = statusContext(listing, requireReview);
  const actions = managementActions(ctx);
  if (actions.length === 0) return null;
  return (
    <Card>
      <SectionTitle>Inserat verwalten</SectionTitle>
      {listing.status === "pending_review" ? (
        <Text style={text.small}>Das Inserat wird vor der Veröffentlichung geprüft. Sie erhalten eine Benachrichtigung, sobald es online ist.</Text>
      ) : null}
      {actions.map((action) => {
        const copy = statusActionCopy(action, ctx);
        return (
          <Button
            key={action}
            title={copy.label}
            icon={ICONS[action]}
            variant={copy.destructive ? "destructive" : action === "resume" ? "primary" : "outline"}
            loading={pendingAction === action}
            disabled={busy}
            onPress={() => confirmStatusAction(action, ctx, onAction)}
          />
        );
      })}
    </Card>
  );
}
