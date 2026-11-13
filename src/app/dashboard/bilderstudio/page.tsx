import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ImageIcon, ImageOff, ScanEye, Sparkles, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { propertyImageUrl } from "@/lib/storage";
import { stepHref } from "@/lib/properties/steps";
import { cn, isUuid } from "@/lib/utils";
import { listPropertyOverviews } from "@/services/properties";

export const metadata: Metadata = { title: "Bilderstudio" };

/** Alle Bilder der eigenen Immobilien, gruppiert nach Objekt (optional gefiltert). */
export default async function ImageStudioOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const user = await requireUser("/dashboard/bilderstudio");
  const supabase = await createClient();
  const overviews = await listPropertyOverviews(supabase, user);
  const filter = typeof query.immobilie === "string" && isUuid(query.immobilie) ? query.immobilie : null;
  const visible = filter ? overviews.filter((o) => o.property.id === filter) : overviews;
  const ids = visible.map((o) => o.property.id);

  const { data: images } = ids.length
    ? await supabase
        .from("property_images")
        .select("id, property_id, display_path, external_url, is_enhanced, is_ai_visualization, is_floor_plan, is_cover, caption, sort_order, status")
        .in("property_id", ids)
        .in("status", ["ready", "review"])
        .order("sort_order", { ascending: true })
        .limit(1000)
    : { data: null };
  const byProperty = new Map<string, NonNullable<typeof images>>();
  for (const image of images ?? []) {
    const list = byProperty.get(image.property_id) ?? [];
    list.push(image);
    byProperty.set(image.property_id, list);
  }
  const withImages = visible.filter((o) => (byProperty.get(o.property.id) ?? []).length > 0);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Bilderstudio"
        description="Helligkeit, Kontrast, Farben und Ausrichtung korrigieren oder mit KI einen Designvorschlag erstellen. Das Original bleibt immer erhalten."
      />

      {overviews.length > 1 ? (
        <nav aria-label="Nach Immobilie filtern" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex gap-2">
            <li className="shrink-0">
              <Link
                href="/dashboard/bilderstudio"
                aria-current={!filter ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors",
                  !filter ? "border-brand bg-mint-100 text-forest" : "border-border bg-card hover:bg-mint-50",
                )}
              >
                Alle
              </Link>
            </li>
            {overviews.map((o) => (
              <li key={o.property.id} className="shrink-0">
                <Link
                  href={`/dashboard/bilderstudio?immobilie=${o.property.id}`}
                  aria-current={filter === o.property.id ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 max-w-64 items-center truncate rounded-full border px-4 text-sm font-semibold transition-colors",
                    filter === o.property.id ? "border-brand bg-mint-100 text-forest" : "border-border bg-card hover:bg-mint-50",
                  )}
                >
                  <span className="truncate">{o.displayName}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {withImages.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="Noch keine Bilder"
          description="Laden Sie im Schritt «Bilder» Fotos Ihrer Immobilie hoch. Danach können Sie sie hier optimieren."
          action={
            visible[0] ? (
              <Button asChild>
                <Link href={stepHref(visible[0].property.id, "bilder")}>Bilder hochladen</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/dashboard/immobilien/neu">Immobilie erfassen</Link>
              </Button>
            )
          }
        />
      ) : (
        withImages.map((o) => {
          const list = byProperty.get(o.property.id) ?? [];
          return (
            <section key={o.property.id} aria-labelledby={`studio-${o.property.id}`} className="grid gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`studio-${o.property.id}`} className="font-display text-lg font-bold">
                  {o.displayName}
                </h2>
                <Link href={stepHref(o.property.id, "bilder")} className="text-sm font-semibold text-primary hover:underline">
                  Bilder verwalten
                </Link>
              </div>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {list.map((image, index) => {
                  const src = propertyImageUrl(image, "sm");
                  return (
                    <li key={image.id}>
                      <Link
                        href={`/dashboard/bilderstudio/${image.id}`}
                        className="group grid gap-2 rounded-2xl border border-border bg-card p-2 transition-colors hover:border-mint-300"
                      >
                        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
                          {src ? (
                            <Image src={src} alt={image.caption?.trim() || `Bild ${index + 1}`} fill sizes="(min-width: 1280px) 20vw, (min-width: 640px) 33vw, 50vw" className="object-cover transition group-hover:scale-[1.02]" />
                          ) : (
                            <ImageOff className="absolute inset-0 m-auto size-6 text-muted-foreground" aria-hidden />
                          )}
                        </div>
                        <span className="flex min-h-6 flex-wrap gap-1 px-1">
                          {image.status === "review" ? (
                            <Badge tone="blue">
                              <ScanEye aria-hidden /> Prüfung offen
                            </Badge>
                          ) : null}
                          {image.is_cover ? <Badge tone="green">Titelbild</Badge> : null}
                          {image.is_enhanced ? (
                            <Badge tone="blue">
                              <Wand2 aria-hidden /> optimiert
                            </Badge>
                          ) : null}
                          {image.is_ai_visualization ? (
                            <Badge tone="amber">
                              <Sparkles aria-hidden /> KI-Visualisierung
                            </Badge>
                          ) : null}
                          {image.is_floor_plan ? <Badge tone="neutral">Grundriss</Badge> : null}
                          {image.external_url ? <Badge tone="outline">Demo</Badge> : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
