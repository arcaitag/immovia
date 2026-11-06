"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { ensureListingAction } from "@/lib/properties/listing-actions";

/** Legt ein neues Inserat (Entwurf) für die Immobilie an. */
export function EnsureListingButton({ propertyId, label = "Neues Inserat erstellen" }: { propertyId: string; label?: string }) {
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      type="button"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await ensureListingAction(propertyId);
          if (result.ok) toast.success(result.message ?? "Ein neues Inserat wurde angelegt.");
          else toast.error(result.error);
        })
      }
    >
      <Plus aria-hidden /> {label}
    </Button>
  );
}
