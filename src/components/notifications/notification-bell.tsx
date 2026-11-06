"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createClient } from "@/lib/supabase/client";
import { formatRelative } from "@/lib/format";
import { UNREAD_QUERY_KEY, useUnreadCounts } from "@/hooks/use-unread-counts";
import { cn } from "@/lib/utils";

export function NotificationBell({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { data: counts } = useUnreadCounts();
  const [open, setOpen] = React.useState(false);
  const { data: items, refetch } = useQuery({
    queryKey: ["notifications", "latest"],
    enabled: open,
    queryFn: async () => {
      const { data } = await createClient()
        .from("notifications")
        .select("id, title, body, link, read_at, created_at")
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
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-display font-bold">Benachrichtigungen</p>
          {unread > 0 ? (
            <button type="button" onClick={() => void markAllRead()} className="text-xs font-semibold text-primary hover:underline">
              Alle als gelesen markieren
            </button>
          ) : null}
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {(items ?? []).length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">Keine Benachrichtigungen</li>
          ) : (
            (items ?? []).map((n) => (
              <li key={n.id}>
                <Link
                  href={n.link ?? "/dashboard/benachrichtigungen"}
                  onClick={() => setOpen(false)}
                  className={cn("flex gap-3 px-4 py-3 transition-colors hover:bg-mint-50", !n.read_at && "bg-mint-50/60")}
                >
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-brand")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{n.title}</span>
                    {n.body ? <span className="mt-0.5 block truncate text-xs text-muted-foreground">{n.body}</span> : null}
                    <span className="mt-1 block text-[11px] text-muted-foreground">{formatRelative(n.created_at)}</span>
                  </span>
                </Link>
              </li>
            ))
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
