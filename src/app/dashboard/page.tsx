import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, HousePlus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { KpiGrid } from "@/components/dashboard/overview/kpi-grid";
import { Onboarding, QuickActions } from "@/components/dashboard/overview/onboarding";
import { PropertyProgressCard } from "@/components/dashboard/overview/property-progress-card";
import { ActivityList, ConversationList, ViewingList } from "@/components/dashboard/overview/activity-lists";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDateLong, TIME_ZONE } from "@/lib/format";
import { listPropertyOverviews } from "@/services/properties";
import { getOwnerOverview, getRecentConversations, getRecentNotifications, getUpcomingViewings } from "@/services/listings";

export const metadata: Metadata = { title: "Übersicht" };

function greeting(now: Date): string {
  const hour = Number(new Intl.DateTimeFormat("de-CH", { timeZone: TIME_ZONE, hour: "numeric", hourCycle: "h23" }).format(now));
  if (hour >= 5 && hour < 11) return "Guten Morgen";
  if (hour >= 11 && hour < 17) return "Guten Tag";
  if (hour >= 17 && hour < 23) return "Guten Abend";
  return "Hallo";
}

function today(): Date {
  return new Date();
}

function SectionTitle({ id, title, href, linkLabel }: { id: string; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 id={id} className="font-display text-xl font-extrabold tracking-tight">
        {title}
      </h2>
      {href ? (
        <Link href={href} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          {linkLabel} <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser("/dashboard");
  const supabase = await createClient();
  const [overview, properties, notifications, conversations, viewings] = await Promise.all([
    getOwnerOverview(supabase),
    listPropertyOverviews(supabase, user, { limit: 6 }),
    getRecentNotifications(supabase, 6),
    getRecentConversations(supabase, { limit: 4 }),
    getUpcomingViewings(supabase, user, { limit: 4 }),
  ]);

  const now = today();
  const name = user.profile.first_name?.trim() || user.profile.display_name;
  const hasProperties = properties.length > 0;
  const totalProperties = overview?.properties ?? properties.length;

  return (
    <div className="grid gap-8">
      {params.passwort === "geaendert" ? (
        <Alert tone="success" title="Passwort geändert">
          Ihr Passwort wurde erfolgreich geändert. Zur Sicherheit haben wir Ihnen eine Bestätigung per E-Mail gesendet.
        </Alert>
      ) : null}

      <PageHeader
        eyebrow={formatDateLong(now)}
        title={`${greeting(now)}, ${name}`}
        description={
          hasProperties
            ? "Hier sehen Sie, wie Ihre Vermarktung läuft und was als Nächstes ansteht."
            : "Willkommen bei Immovia. Hier verwalten Sie Ihre Immobilien, Anfragen und Termine."
        }
        actions={
          hasProperties ? (
            <Button asChild>
              <Link href="/dashboard/immobilien/neu">
                <HousePlus aria-hidden /> Neue Immobilie
              </Link>
            </Button>
          ) : null
        }
      />

      {!hasProperties ? <Onboarding /> : null}

      <QuickActions hasProperties={hasProperties} />

      {overview ? (
        <section aria-label="Kennzahlen">
          <KpiGrid overview={overview} />
        </section>
      ) : (
        <Alert tone="warning">Die Kennzahlen konnten gerade nicht geladen werden. Bitte laden Sie die Seite später neu.</Alert>
      )}

      {hasProperties ? (
        <section aria-labelledby="immobilien-titel" className="grid gap-4">
          <SectionTitle
            id="immobilien-titel"
            title="Ihre Immobilien"
            href="/dashboard/immobilien"
            linkLabel={totalProperties > 3 ? `Alle ${totalProperties} anzeigen` : "Alle anzeigen"}
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {properties.slice(0, 3).map((item) => (
              <PropertyProgressCard key={item.property.id} overview={item} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle>Aktuelle Aktivitäten</CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-3">
            <ActivityList items={notifications} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle>Letzte Nachrichten</CardTitle>
            <Link href="/dashboard/nachrichten" className="text-sm font-semibold text-primary hover:underline">
              Alle
            </Link>
          </CardHeader>
          <CardContent className="px-2 sm:px-3">
            <ConversationList items={conversations} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle>Nächste Besichtigungen</CardTitle>
          <Link href="/dashboard/besichtigungen" className="text-sm font-semibold text-primary hover:underline">
            Kalender
          </Link>
        </CardHeader>
        <CardContent>
          <ViewingList items={viewings} />
        </CardContent>
      </Card>
    </div>
  );
}
