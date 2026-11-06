"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { formatRelative } from "@/lib/format";
import { UNREAD_QUERY_KEY, useUnreadCounts } from "@/hooks/use-unread-counts";
import { cn } from "@/lib/utils";
import { notificationIcon } from "@/components/notifications/notification-icon";

const LATEST_KEY = ["notifications", "latest"] as const;

export function NotificationBell({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { data: counts } = useUnreadCounts();
  const [open, setOpen] = React.useState(false);
  const { data: items, isPending, refetch } = useQuery({
    queryKey: LATEST_KEY,
    enabled: open,
    staleTime: 0,
    queryFn: async () => {
      const { data } = await createClient()
        .from("notifications")
        .select("id, type, title, body, link, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: UNREAD_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  async function markAllRead() {
    await createClient().from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
    await Promise.all([refetch(), queryClient.invalidateQueries({ queryKey: UNREAD_QUERY_KEY })]);
  }

  function openItem(id: string, readAt: string | null) {
    setOpen(false);
    if (readAt) return;
    void createClient()
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: UNREAD_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      });
  }

  const unread = counts?.notifications ?? 0;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Benachrichtigungen${unread ? ` (${unread} ungelesen)` : ""}`}>
          <Bell className="size-5" />
          {unread > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold leading-4 text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-display font-bold">Benachrichtigungen</p>
          {unread > 0 ? (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="inline-flex min-h-8 items-center gap-1 rounded-lg px-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <CheckCheck className="size-3.5" aria-hidden /> Alle gelesen
            </button>
          ) : null}
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {isPending ? (
            Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="flex gap-3 px-4 py-3" aria-hidden>
                <Skeleton className="size-8 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </li>
            ))
          ) : (items ?? []).length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">Keine Benachrichtigungen</li>
          ) : (
            (items ?? []).map((n) => {
              const Icon = notificationIcon(n.type);
              return (
                <li key={n.id}>
                  <Link
                    href={n.link ?? "/dashboard/benachrichtigungen"}
                    onClick={() => openItem(n.id, n.read_at)}
                    className={cn("flex gap-3 px-4 py-3 transition-colors hover:bg-mint-50", !n.read_at && "bg-mint-50/60")}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg",
                        n.read_at ? "bg-muted text-muted-foreground" : "bg-mint-200 text-forest",
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm", n.read_at ? "font-medium" : "font-semibold")}>
                        {!n.read_at ? <span className="sr-only">Ungelesen: </span> : null}
                        {n.title}
                      </span>
                      {n.body ? <span className="mt-0.5 block truncate text-xs text-muted-foreground">{n.body}</span> : null}
                      <span className="mt-1 block text-[11px] text-muted-foreground">{formatRelative(n.created_at)}</span>
                    </span>
                    {!n.read_at ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-hidden /> : null}
                  </Link>
                </li>
              );
            })
          )}
        </ul>
        <div className="border-t border-border p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/dashboard/benachrichtigungen" onClick={() => setOpen(false)}>
              Alle anzeigen
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
