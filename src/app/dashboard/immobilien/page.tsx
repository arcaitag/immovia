import type { Metadata } from "next";
import Link from "next/link";
import { HousePlus, SearchX } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Onboarding } from "@/components/dashboard/overview/onboarding";
import { PropertyList } from "@/components/dashboard/overview/property-list";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ListingStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { listPropertyOverviews, type PropertyOverview } from "@/services/properties";
import { getPublishingSettings } from "@/services/listings";

export const metadata: Metadata = { title: "Meine Immobilien" };

const FILTERS: { key: string; label: string; statuses: (ListingStatus | null)[] | null }[] = [
  { key: "alle", label: "Alle", statuses: null },
  { key: "vorbereitung", label: "In Vorbereitung", statuses: ["draft", "in_progress", "ready", null] },
  { key: "pruefung", label: "In Prüfung", statuses: ["pending_review"] },
  { key: "online", label: "Online", statuses: ["published", "reserved"] },
  { key: "pausiert", label: "Pausiert", statuses: ["paused"] },
  { key: "abgeschlossen", label: "Abgeschlossen", statuses: ["sold", "rented"] },
  { key: "archiviert", label: "Archiviert", statuses: ["archived"] },
];

function matches(item: PropertyOverview, statuses: (ListingStatus | null)[] | null): boolean {
  if (!statuses) return true;
  return statuses.includes(item.listing?.status ?? null);
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser("/dashboard/immobilien");
  const supabase = await createClient();
  const [items, settings] = await Promise.all([listPropertyOverviews(supabase, user), getPublishingSettings(supabase)]);

  const activeKey = typeof params.status === "string" && FILTERS.some((f) => f.key === params.status) ? params.status : "alle";
  const active = FILTERS.find((f) => f.key === activeKey) ?? FILTERS[0];
  const filtered = items.filter((item) => matches(item, active?.statuses ?? null));

  return (
    <div className="grid gap-6">
      {params.geloescht === "1" ? <Alert tone="success">Die Immobilie wurde gelöscht.</Alert> : null}
      <PageHeader
        title="Meine Immobilien"
        description="Alle Immobilien, die Sie selbst oder Ihr Firmenkonto erfasst haben – mit Status und nächstem Schritt."
        actions={
          <Button asChild>
            <Link href="/dashboard/immobilien/neu">
              <HousePlus aria-hidden /> Neue Immobilie
            </Link>
          </Button>
        }
      />

      {items.length === 0 ? (
        <Onboarding />
      ) : (
        <>
          <nav aria-label="Nach Status filtern" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <ul className="flex gap-2">
              {FILTERS.map((filter) => {
                const count = items.filter((item) => matches(item, filter.statuses)).length;
                const isActive = filter.key === activeKey;
                if (count === 0 && !isActive && filter.key !== "alle") return null;
                return (
                  <li key={filter.key} className="shrink-0">
                    <Link
                      href={filter.key === "alle" ? "/dashboard/immobilien" : `/dashboard/immobilien?status=${filter.key}`}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
                        isActive ? "border-brand bg-mint-100 text-forest" : "border-border bg-card text-foreground/80 hover:bg-mint-50",
                      )}
                    >
                      {filter.label}
                      <span className="rounded-full bg-white/80 px-1.5 text-xs tabular text-muted-foreground">{count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {filtered.length ? (
            <PropertyList items={filtered} requireReview={settings.requireReview} />
          ) : (
            <EmptyState
              icon={SearchX}
              title="Keine Immobilien mit diesem Status"
              action={
                <Button asChild variant="outline">
                  <Link href="/dashboard/immobilien">Alle anzeigen</Link>
                </Button>
              }
            />
          )}
        </>
      )}
    </div>
  );
}
