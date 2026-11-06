"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/sonner";
import { createClient } from "@/lib/supabase/client";
import { deleteAccountAction } from "@/app/dashboard/einstellungen/actions";
import { DELETE_CONFIRMATION_WORD } from "@/lib/validation/account";

export function DeleteAccountDialog({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const matches = confirmation.trim().toUpperCase() === DELETE_CONFIRMATION_WORD;

  function onOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) {
      setConfirmation("");
      setError(null);
    }
  }

  function onDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteAccountAction({ confirmation });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Lokale Sitzung im Browser ebenfalls beenden (Cookies wurden serverseitig entfernt)
      await createClient().auth.signOut({ scope: "local" }).catch(() => undefined);
      toast.success("Ihr Konto wurde gelöscht. Vielen Dank, dass Sie Immovia genutzt haben.", { duration: 8000 });
      setOpen(false);
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={disabled}>
          <Trash aria-hidden /> Konto löschen
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Konto endgültig löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Ihr Profil, Ihre Immobilien, Inserate, Bilder, Dokumente und Dossiers werden unwiderruflich gelöscht. Dieser
            Vorgang kann nicht rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field
          label={
            <span>
              Geben Sie <strong>{DELETE_CONFIRMATION_WORD}</strong> ein, um zu bestätigen
            </span>
          }
          htmlFor="delete-confirmation"
        >
          <Input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            disabled={pending}
          />
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Abbrechen</AlertDialogCancel>
          <Button variant="destructive" onClick={onDelete} disabled={!matches} loading={pending}>
            Konto endgültig löschen
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
