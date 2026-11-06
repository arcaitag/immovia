"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="inhalt" className="container-page flex min-h-[60dvh] flex-col items-center justify-center py-24 text-center">
      <p className="font-display text-sm font-bold uppercase tracking-widest text-brand">Etwas ist schiefgelaufen</p>
      <h1 className="mt-3 font-display text-3xl font-extrabold">Die Seite konnte nicht geladen werden</h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        Bitte versuchen Sie es erneut. Falls das Problem bestehen bleibt, kontaktieren Sie uns.
        {error.digest ? <span className="mt-2 block text-xs">Fehlercode: {error.digest}</span> : null}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Erneut versuchen</Button>
        <Button asChild variant="outline">
          <Link href="/kontakt">Kontakt</Link>
        </Button>
      </div>
    </main>
  );
}
