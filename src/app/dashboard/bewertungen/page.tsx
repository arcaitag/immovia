import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Gauge, HousePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { PropertyThumb } from "@/components/property-wizard/property-thumb";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatChf, formatDate } from "@/lib/format";
import { stepHref } from "@/lib/properties/steps";
import { CONFIDENCE_LABELS, VALUATION_STATUS_LABELS } from "@/lib/valuation/labels";
import { listPropertyOverviews } from "@/services/properties";

export const metadata: Metadata = { title: "Bewertungen" };

/** Übersicht: alle verwaltbaren Immobilien mit ihrer letzten Bewertung. */
export default async function ValuationsOverviewPage() {
  const user = await requireUser("/dashboard/bewertungen");
  const supabase = await createClient();
  const overviews = await listPropertyOverviews(supabase, user);
  const ids = overviews.map((o) => o.property.id);

  const { data: valuations } = ids.length
    ? await supabase
        .from("property_valuations")
        .select("id, property_id, status, estimated_value, value_low, value_high, confidence, created_at")
        .in("property_id", ids)
        .order("created_at", { ascending: false })
        .limit(500)
    : { data: [] };
  const latest = new Map<string, NonNullable<typeof valuations>[number]>();
  const counts = new Map<string, number>();
  for (const v of valuations ?? []) {
    if (!latest.has(v.property_id)) latest.set(v.property_id, v);
    counts.set(v.property_id, (counts.get(v.property_id) ?? 0) + 1);
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Bewertungen"
        description="Die letzte Schätzung je Immobilie. Grundlage sind Angebotspreise vergleichbarer Inserate auf Immovia – keine Transaktionspreise. Ohne ausreichende Vergleichsdaten wird keine Zahl angezeigt."
      />
      {overviews.length === 0 ? (
        <EmptyState
          icon={Gauge}
          title="Noch keine Immobilie erfasst"
          description="Erfassen Sie eine Immobilie mit Fläche und Standort, um eine erste Orientierung zum Wert zu erhalten."
          action={
            <Button asChild>
              <Link href="/dashboard/immobilien/neu">
                <HousePlus aria-hidden /> Immobilie erfassen
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3">
          {overviews.map((item) => {
            const valuation = latest.get(item.property.id) ?? null;
            const rent = item.property.offer_type === "rent";
            const status = valuation ? VALUATION_STATUS_LABELS[valuation.status] : null;
            const confidence = valuation ? CONFIDENCE_LABELS[valuation.confidence] : null;
            const href = stepHref(item.property.id, "bewertung");
            return (
              <li key={item.property.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <PropertyThumb image={item.cover} alt="" className="size-16" />
                  <div className="min-w-0">
                    <Link href={href} className="block truncate font-semibold hover:text-primary hover:underline">
                      {item.displayName}
                    </Link>
                    <p className="truncate text-sm text-muted-foreground">
                      {[item.property.postal_code, item.property.municipality].filter(Boolean).join(" ") || "Ort noch nicht erfasst"}
                    </p>
                  </div>
                </div>
                <div className="grid gap-1 text-sm sm:w-72">
                  {valuation && status ? (
                    <>
                      <span className="flex flex-wrap items-center gap-2">
                        <StatusBadge label={status.label} tone={status.tone} />
                        <span className="text-xs text-muted-foreground">{formatDate(valuation.created_at)}</span>
                      </span>
                      {valuation.estimated_value !== null ? (
                        <span className="tabular">
                          <span className="font-display text-lg font-bold">
                            {formatChf(valuation.estimated_value)}
                            {rent ? " / Mt." : ""}
                          </span>
                          {valuation.value_low !== null && valuation.value_high !== null ? (
                            <span className="block text-xs text-muted-foreground">
                              Spanne {formatChf(valuation.value_low)} – {formatChf(valuation.value_high)} · Vertrauen {confidence?.label.toLowerCase()}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Keine Zahl – zu wenig Vergleichsdaten</span>
                      )}
                      {(counts.get(item.property.id) ?? 0) > 1 ? (
                        <span className="text-xs text-muted-foreground">{counts.get(item.property.id)} Bewertungen gespeichert</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Noch keine Bewertung</span>
                  )}
                </div>
                <Button asChild variant={valuation ? "outline" : "default"} className="sm:shrink-0">
                  <Link href={href}>
                    {valuation ? "Zur Bewertung" : "Bewertung starten"} <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
