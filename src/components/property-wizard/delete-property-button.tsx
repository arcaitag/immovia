"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeletePropertyDialog } from "@/components/dashboard/overview/property-row-actions";

export function DeletePropertyButton({ propertyId, name, listingPublic }: { propertyId: string; name: string; listingPublic: boolean }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button type="button" variant="outline" className="text-destructive hover:bg-destructive-bg" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden /> Immobilie löschen
      </Button>
      <DeletePropertyDialog
        propertyId={propertyId}
        name={name}
        listingPublic={listingPublic}
        open={open}
        onOpenChange={setOpen}
        redirectToList
      />
    </>
  );
}
