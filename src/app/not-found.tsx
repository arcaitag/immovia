import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="inhalt" className="container-page flex flex-1 flex-col items-center justify-center py-24 text-center">
        <p className="font-display text-sm font-bold uppercase tracking-widest text-brand">Fehler 404</p>
        <h1 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">Diese Seite gibt es nicht (mehr)</h1>
        <p className="mt-4 max-w-md text-muted-foreground">
          Vielleicht wurde das Inserat inzwischen verkauft oder die Adresse hat sich geändert.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/immobilien">Immobilien suchen</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Zur Startseite</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
