import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PROPERTY_TYPES, type PropertyType } from "@/lib/constants";
import { formatArea, formatChf, formatDate, formatRooms } from "@/lib/format";
import type { Tables } from "@/types/database";

type Comparable = Tables<"valuation_comparables">;

/**
 * Vergleichsobjekte (nur echte Inserate). Auf Mobile als Karten.
 * Verlinkt wird nur, wenn das Inserat noch öffentlich ist.
 */
export function ComparablesTable({
  comparables,
  areaLabel,
  publicSlugs,
  rent,
}: {
  comparables: Comparable[];
  areaLabel: string;
  publicSlugs: Record<string, string>;
  rent: boolean;
}) {
  const per = rent ? " / Mt." : "";
  const location = (c: Comparable) => [c.postal_code, c.municipality].filter(Boolean).join(" ") || "–";
  const type = (c: Comparable) => (c.property_type ? PROPERTY_TYPES[c.property_type as PropertyType].label : "–");
  const link = (c: Comparable) => (c.listing_id ? publicSlugs[c.listing_id] : undefined);

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        <strong className="font-semibold text-foreground">Angebotspreise, keine Transaktionspreise.</strong> Es handelt sich um Preise, zu denen
        vergleichbare Objekte auf Immovia angeboten werden – nicht um tatsächlich bezahlte Preise.
      </p>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ort</TableHead>
              <TableHead>Objektart</TableHead>
              <TableHead className="text-right">Zimmer</TableHead>
              <TableHead className="text-right">{areaLabel}</TableHead>
              <TableHead className="text-right">Angebotspreis</TableHead>
              <TableHead className="text-right">CHF/m²</TableHead>
              <TableHead>Inseriert</TableHead>
              <TableHead className="text-right">Distanz</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparables.map((c) => {
              const slug = link(c);
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    {slug ? (
                      <Link href={`/immobilien/${slug}`} className="inline-flex items-center gap-1 hover:text-primary hover:underline" target="_blank">
                        {location(c)} <ExternalLink className="size-3.5" aria-hidden />
                        <span className="sr-only">(Inserat in neuem Tab öffnen)</span>
                      </Link>
                    ) : (
                      location(c)
                    )}
                  </TableCell>
                  <TableCell>{type(c)}</TableCell>
                  <TableCell className="text-right tabular">{c.rooms !== null ? formatRooms(c.rooms, false) : "–"}</TableCell>
                  <TableCell className="text-right tabular">{formatArea(c.living_area)}</TableCell>
                  <TableCell className="text-right tabular">
                    {formatChf(c.price)}
                    {per}
                  </TableCell>
                  <TableCell className="text-right tabular">{c.price_per_sqm !== null ? formatChf(Math.round(Number(c.price_per_sqm) * (rent ? 10 : 1)) / (rent ? 10 : 1)) : "–"}</TableCell>
                  <TableCell className="tabular">{formatDate(c.observed_at)}</TableCell>
                  <TableCell className="text-right tabular">{c.distance_km !== null ? `${Number(c.distance_km).toFixed(1)} km` : "–"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <ul className="grid gap-3 md:hidden">
        {comparables.map((c) => {
          const slug = link(c);
          return (
            <li key={c.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{location(c)}</p>
                  <p className="text-sm text-muted-foreground">
                    {type(c)}
                    {c.rooms !== null ? ` · ${formatRooms(c.rooms)}` : ""} · {formatArea(c.living_area)}
                  </p>
                </div>
                <p className="text-right font-display font-bold tabular">
                  {formatChf(c.price)}
                  {per}
                </p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Inseriert am {formatDate(c.observed_at)}
                {c.distance_km !== null ? ` · ${Number(c.distance_km).toFixed(1)} km entfernt` : ""}
                {slug ? (
                  <>
                    {" · "}
                    <Link href={`/immobilien/${slug}`} className="font-medium text-primary hover:underline" target="_blank">
                      Inserat ansehen
                    </Link>
                  </>
                ) : null}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
