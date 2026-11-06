import Link from "next/link";
import { Bell, House, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const MESSAGES: Record<"sold" | "rented" | "unavailable", { title: string; text: string }> = {
  sold: {
    title: "Diese Immobilie wurde verkauft",
    text: "Das Inserat ist abgeschlossen und nicht mehr öffentlich. Ähnliche Angebote finden Sie in der Suche.",
  },
  rented: {
    title: "Diese Immobilie wurde vermietet",
    text: "Das Inserat ist abgeschlossen und nicht mehr öffentlich. Ähnliche Angebote finden Sie in der Suche.",
  },
  unavailable: {
    title: "Dieses Inserat ist nicht mehr verfügbar",
    text: "Die Inserentin bzw. der Inserent hat das Inserat pausiert oder entfernt.",
  },
};

/** Freundliche Seite für Inserate, die verkauft, vermietet oder entfernt wurden. */
export function ListingUnavailable({ status }: { status: "sold" | "rented" | "unavailable" }) {
  const message = MESSAGES[status];
  return (
    <div className="container-page flex min-h-[60dvh] flex-col items-center justify-center py-20 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-mint-100 text-forest">
        <House className="size-7" aria-hidden />
      </span>
      <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{message.title}</h1>
      <p className="mt-4 max-w-lg text-muted-foreground">{message.text}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/immobilien">
            <Search aria-hidden /> Immobilien suchen
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/dashboard/suchauftraege">
            <Bell aria-hidden /> Suchaufträge verwalten
          </Link>
        </Button>
      </div>
    </div>
  );
}
