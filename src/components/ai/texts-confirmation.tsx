"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { confirmListingTextsAction } from "@/app/dashboard/immobilien/[id]/beschreibung/actions";
import { formatDateTime } from "@/lib/format";

/**
 * Bestätigung der Inseratetexte: Pflicht vor der Veröffentlichung. Jede Übernahme oder
 * Änderung eines Textes hebt die Bestätigung wieder auf.
 */
export function TextsConfirmation({
  propertyId,
  confirmedAt,
  canConfirm,
  listingHref,
}: {
  propertyId: string;
  confirmedAt: string | null;
  canConfirm: boolean;
  listingHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function confirm() {
    startTransition(async () => {
      const res = await confirmListingTextsAction(propertyId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "Die Texte sind bestätigt.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint-100 text-forest">
          {confirmedAt ? <CircleCheck className="size-5" aria-hidden /> : <ClipboardCheck className="size-5" aria-hidden />}
        </span>
        <div className="text-sm">
          <p className="font-semibold">{confirmedAt ? "Texte bestätigt" : "Texte noch nicht bestätigt"}</p>
          <p className="text-muted-foreground">
            {confirmedAt
              ? `Bestätigt am ${formatDateTime(confirmedAt)}. Ändern Sie einen Text, müssen Sie ihn erneut bestätigen.`
              : canConfirm
                ? "Bitte bestätigen Sie, dass die Texte im Inserat korrekt sind. Erst dann kann das Inserat veröffentlicht werden."
                : "Übernehmen Sie mindestens Titel und ausführliche Beschreibung ins Inserat, dann können Sie die Texte bestätigen."}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {!confirmedAt && canConfirm ? (
          <Button onClick={confirm} loading={pending}>
            Texte bestätigen
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link href={listingHref}>Inserat bearbeiten</Link>
        </Button>
      </div>
    </div>
  );
}
