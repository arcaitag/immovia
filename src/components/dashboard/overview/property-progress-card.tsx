import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { PropertyThumb } from "@/components/property-wizard/property-thumb";
import { LISTING_STATUS } from "@/lib/constants";
import { stepHref } from "@/lib/properties/steps";
import type { PropertyOverview } from "@/services/properties";

const NEXT_ACTION: Record<string, string> = {
  erfassen: "Eckdaten ergänzen",
  bewertung: "Immobilie bewerten",
  bilder: "Bilder hochladen",
  beschreibung: "Beschreibung erstellen",
  dossier: "Dossier erstellen",
  inserat: "Preis und Texte festlegen",
  veroeffentlichung: "Inserat veröffentlichen",
  verwaltung: "Interessenten verwalten",
};

/** Karte «Ihre Immobilien» mit Vermarktungsfortschritt und nächstem Schritt. */
export function PropertyProgressCard({ overview }: { overview: PropertyOverview }) {
  const { property, listing, cover, progress, next, displayName, address } = overview;
  const status = listing ? LISTING_STATUS[listing.status] : null;
  const href = next ? stepHref(property.id, next.key) : `/dashboard/immobilien/${property.id}`;
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <Link href={`/dashboard/immobilien/${property.id}`} className="flex gap-4 p-4 hover:bg-mint-50/50 sm:p-5">
        <PropertyThumb image={cover} alt="" className="size-20" sizes="80px" />
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="truncate font-display font-bold">{displayName}</h3>
          <p className="flex items-start gap-1 text-xs text-muted-foreground">
            <MapPin className="mt-px size-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-2">{address}</span>
          </p>
          <div className="pt-1">
            {status ? <StatusBadge label={status.label} tone={status.tone} /> : <Badge>Kein Inserat</Badge>}
          </div>
        </div>
      </Link>
      <div className="mt-auto grid gap-3 border-t border-border px-4 py-4 sm:px-5">
        <div className="grid gap-1.5">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-medium text-muted-foreground">Vermarktung</span>
            <span className="font-semibold tabular">
              {progress.done} von {progress.total} Schritten
            </span>
          </div>
          <Progress value={progress.percent} aria-label={`Vermarktung ${progress.percent} Prozent`} />
        </div>
        {next ? (
          <Link href={href} className="inline-flex min-h-11 items-center justify-between gap-2 rounded-xl bg-mint-50 px-3.5 text-sm font-semibold text-forest hover:bg-mint-100">
            <span>
              <span className="block text-xs font-medium text-muted-foreground">Nächster Schritt</span>
              {NEXT_ACTION[next.key] ?? next.title}
            </span>
            <ArrowRight className="size-4 shrink-0" aria-hidden />
          </Link>
        ) : (
          <p className="text-sm font-medium text-primary">Abgeschlossen</p>
        )}
      </div>
    </article>
  );
}
