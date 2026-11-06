import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Download, FileText, Globe, HousePlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PropertyThumb } from "@/components/property-wizard/property-thumb";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatFileSize } from "@/lib/format";
import { stepHref } from "@/lib/properties/steps";
import { listPropertyOverviews } from "@/services/properties";

export const metadata: Metadata = { title: "Verkaufsdossiers" };

/** Übersicht: Verkaufsdossiers aller verwaltbaren Immobilien. */
export default async function DossiersOverviewPage() {
  const user = await requireUser("/dashboard/dossiers");
  const supabase = await createClient();
  const overviews = await listPropertyOverviews(supabase, user);
  const ids = overviews.map((o) => o.property.id);

  const { data: dossiers } = ids.length
    ? await supabase
        .from("generated_dossiers")
        .select("id, property_id, version, status, is_public, page_count, file_size, created_at")
        .in("property_id", ids)
        .order("version", { ascending: false })
        .limit(1000)
    : { data: [] };
  const byProperty = new Map<string, NonNullable<typeof dossiers>>();
  for (const d of dossiers ?? []) {
    const list = byProperty.get(d.property_id) ?? [];
    list.push(d);
    byProperty.set(d.property_id, list);
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Verkaufsdossiers"
        description="PDF-Dossiers Ihrer Immobilien mit Bildern, Eckdaten und Beschreibung. Pro Immobilie kann genau eine Version für das Inserat freigegeben werden."
      />
      {overviews.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Noch keine Immobilie erfasst"
          description="Erfassen Sie eine Immobilie mit Bildern und Texten – daraus entsteht das Verkaufsdossier."
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
            const list = byProperty.get(item.property.id) ?? [];
            const ready = list.filter((d) => d.status === "ready");
            const latest = ready[0] ?? null;
            const publicVersion = ready.find((d) => d.is_public) ?? null;
            const href = stepHref(item.property.id, "dossier");
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
                  {latest ? (
                    <>
                      <span className="font-semibold">
                        Version {latest.version} · {formatDate(latest.created_at)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {[latest.page_count ? `${latest.page_count} Seiten` : null, latest.file_size ? formatFileSize(latest.file_size) : null, `${ready.length} Version(en)`]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      {publicVersion ? (
                        <Badge tone="green" className="w-fit">
                          <Globe aria-hidden /> Version {publicVersion.version} freigegeben
                        </Badge>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-muted-foreground">{list.length ? "Noch keine fertige Version" : "Noch kein Dossier"}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 sm:shrink-0">
                  {latest ? (
                    <Button asChild variant="outline" size="sm">
                      <a href={`/api/dossiers/${latest.id}/download`}>
                        <Download aria-hidden /> PDF
                      </a>
                    </Button>
                  ) : null}
                  <Button asChild variant={latest ? "ghost" : "default"} size="sm">
                    <Link href={href}>
                      {latest ? "Bearbeiten" : "Dossier erstellen"} <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
