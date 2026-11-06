import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { describeCriteria } from "@/lib/search/criteria";
import { criteriaFromJson, isAlertFrequency } from "@/components/saved-searches/criteria-json";
import { SavedSearchCard, type SavedSearchItem } from "@/components/saved-searches/saved-search-card";
import { searchHref } from "@/components/search/url-state";

export const metadata: Metadata = { title: "Suchaufträge" };

export default async function SuchauftraegePage() {
  await requireUser("/dashboard/suchauftraege");
  const supabase = await createClient();
  const { data: searches, error } = await supabase
    .from("saved_searches")
    .select("id, name, criteria, alert_enabled, alert_frequency, last_notified_at, created_at")
    .order("created_at", { ascending: false });

  const rows = searches ?? [];
  const counts = await Promise.all(
    rows.map((s) => supabase.from("saved_search_matches").select("listing_id", { count: "exact", head: true }).eq("saved_search_id", s.id)),
  );
  const items: SavedSearchItem[] = rows.map((s, index) => {
    const criteria = criteriaFromJson(s.criteria);
    return {
      id: s.id,
      name: s.name,
      summary: describeCriteria(criteria),
      href: searchHref({ criteria }),
      alertEnabled: s.alert_enabled,
      frequency: isAlertFrequency(s.alert_frequency) ? s.alert_frequency : "instant",
      matches: counts[index]?.count ?? 0,
      createdAt: s.created_at,
      lastNotifiedAt: s.last_notified_at,
    };
  });

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Suchaufträge"
        description="Gespeicherte Suchen. Bei aktivierter Benachrichtigung informieren wir Sie über neue passende Inserate – pro Inserat nur einmal."
        actions={
          <Button asChild>
            <Link href="/immobilien">
              <Plus aria-hidden /> Neue Suche
            </Link>
          </Button>
        }
      />

      {error ? <Alert tone="error">Die Suchaufträge konnten nicht geladen werden. Bitte laden Sie die Seite neu.</Alert> : null}

      {!error && !items.length ? (
        <EmptyState
          icon={Bell}
          title="Noch keine Suchaufträge"
          description="Starten Sie eine Suche, setzen Sie Ihre Filter und wählen Sie «Suchauftrag speichern». Wir melden uns, sobald ein passendes Inserat veröffentlicht wird."
          action={
            <Button asChild>
              <Link href="/immobilien">Suche starten</Link>
            </Button>
          }
        />
      ) : null}

      {items.length ? (
        <ul role="list" className="grid gap-4">
          {items.map((item) => (
            <li key={item.id}>
              <SavedSearchCard item={item} />
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Sie können bis zu 25 Suchaufträge speichern. Ob Sie Benachrichtigungen auch per E-Mail erhalten, legen Sie in den{" "}
        <Link href="/dashboard/einstellungen" className="font-semibold text-primary hover:underline">
          Einstellungen
        </Link>{" "}
        fest.
      </p>
    </div>
  );
}
