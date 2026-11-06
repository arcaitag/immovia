"use client";

import Link from "next/link";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { loginHref } from "@/components/search/use-location-hash";

/** Hinweis im Dialog, wenn für eine Aktion ein Konto nötig ist. Nach dem Login geht es zurück zum Inserat. */
export function LoginPrompt({ returnTo, anchor, reason }: { returnTo: string; anchor: string; reason: string }) {
  return (
    <div className="grid gap-5">
      <div className="flex items-start gap-3 rounded-xl bg-surface p-4 text-sm">
        <LogIn className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
        <p>
          {reason} Die Registrierung ist kostenlos. Danach kehren Sie automatisch zu diesem Inserat zurück.
        </p>
      </div>
      <DialogFooter>
        <Button asChild variant="outline">
          <Link href={loginHref(returnTo, anchor, "/registrieren")}>Kostenlos registrieren</Link>
        </Button>
        <Button asChild>
          <Link href={loginHref(returnTo, anchor)}>Anmelden</Link>
        </Button>
      </DialogFooter>
    </div>
  );
}

export function OwnListingNotice() {
  return (
    <div className="grid gap-4">
      <p className="rounded-xl bg-surface p-4 text-sm">
        Das ist Ihr eigenes Inserat. Anfragen und Besichtigungen von Interessenten verwalten Sie im Dashboard.
      </p>
      <DialogFooter>
        <Button asChild>
          <Link href="/dashboard/immobilien">Zum Dashboard</Link>
        </Button>
      </DialogFooter>
    </div>
  );
}
