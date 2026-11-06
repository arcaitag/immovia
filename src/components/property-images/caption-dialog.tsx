"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";

const MAX = 300;

/** Bildunterschrift bearbeiten. */
export function CaptionDialog({
  initial,
  open,
  onOpenChange,
  onSave,
  pending,
}: {
  initial: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (caption: string) => void;
  pending: boolean;
}) {
  const [value, setValue] = React.useState(initial);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(value);
          }}
        >
          <DialogHeader>
            <DialogTitle>Bildunterschrift</DialogTitle>
            <DialogDescription>Kurz und sachlich, z. B. «Wohnzimmer mit Zugang zum Balkon».</DialogDescription>
          </DialogHeader>
          <Field label="Text" htmlFor="bildunterschrift" hint={`${value.length} von ${MAX} Zeichen`}>
            <Textarea value={value} onChange={(e) => setValue(e.target.value.slice(0, MAX))} rows={3} maxLength={MAX} autoFocus />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" loading={pending}>
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
