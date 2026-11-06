import type { Metadata } from "next";
import Link from "next/link";
import { Bell, ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NotificationBulkActions, NotificationList, type NotificationItem } from "@/components/notifications/notification-list";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Benachrichtigungen" };

const PAGE_SIZE = 30;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function countFrom(data: unknown): number {
  if (data && typeof data === "object" && "count" in data) {
    const value = Number((data as { count?: unknown }).count);
    return Number.isFinite(value) && value > 1 ? value : 1;
  }
  return 1;
}

export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser("/dashboard/benachrichtigungen");
  const sp = await searchParams;
  const onlyUnread = first(sp.filter) === "ungelesen";
  const page = Math.max(1, Math.min(1000, Number(first(sp.seite)) || 1));
  const supabase = await createClient();

  let query = supabase
    .from("notifications")
    .select("id, type, title, body, link, data, read_at, created_at", { count: "exact" })
    .order("created_at", { ascending: false });
  if (onlyUnread) query = query.is("read_at", null);
  const from = (page - 1) * PAGE_SIZE;
  const [listRes, unreadRes, readRes] = await Promise.all([
    query.range(from, from + PAGE_SIZE - 1),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    supabase.from("notifications").select("id", { count: "exact", head: true }).not("read_at", "is", null),
  ]);
  const items: NotificationItem[] = (listRes.data ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    readAt: n.read_at,
    createdAt: n.created_at,
    count: countFrom(n.data),
  }));
  const total = listRes.count ?? items.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const unreadCount = unreadRes.count ?? 0;
  const base = onlyUnread ? "/dashboard/benachrichtigungen?filter=ungelesen" : "/dashboard/benachrichtigungen";
  const pageHref = (p: number) => (p <= 1 ? base : `${base}${onlyUnread ? "&" : "?"}seite=${p}`);
  const tab = (active: boolean) =>
    cn(
      "inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition-colors",
      active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Benachrichtigungen"
        description="Neue Anfragen, Nachrichten, Termine und Freigaben. Gelesene Einträge werden nach 180 Tagen automatisch entfernt."
        actions={<NotificationBulkActions unreadCount={unreadCount} hasRead={(readRes.count ?? 0) > 0} />}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter" className="inline-flex h-11 items-center gap-1 rounded-xl bg-muted p-1">
          <Link href="/dashboard/benachrichtigungen" className={tab(!onlyUnread)} aria-current={!onlyUnread ? "page" : undefined}>
            Alle
          </Link>
          <Link href="/dashboard/benachrichtigungen?filter=ungelesen" className={tab(onlyUnread)} aria-current={onlyUnread ? "page" : undefined}>
            Ungelesen
            {unreadCount ? <span className="rounded-full bg-brand px-2 text-[11px] font-bold leading-5 text-white">{unreadCount}</span> : null}
          </Link>
        </nav>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/einstellungen">
            <Settings aria-hidden /> E-Mail-Benachrichtigungen
          </Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={onlyUnread ? "Alles gelesen" : "Keine Benachrichtigungen"}
          description={
            onlyUnread
              ? "Sie haben keine ungelesenen Benachrichtigungen."
              : "Hier erscheinen neue Anfragen, Nachrichten, Besichtigungen und freigegebene Dokumente."
          }
        />
      ) : (
        <NotificationList userId={user.id} items={items} />
      )}

      {pages > 1 ? (
        <nav aria-label="Seiten" className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Seite {page} von {pages}
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className={cn(page <= 1 && "pointer-events-none opacity-50")}>
              <Link href={pageHref(page - 1)} aria-disabled={page <= 1}>
                <ChevronLeft aria-hidden /> Neuere
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className={cn(page >= pages && "pointer-events-none opacity-50")}>
              <Link href={pageHref(page + 1)} aria-disabled={page >= pages}>
                Ältere <ChevronRight aria-hidden />
              </Link>
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
