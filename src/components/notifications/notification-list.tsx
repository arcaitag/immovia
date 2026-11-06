"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Circle, CircleCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime, formatRelative } from "@/lib/format";
import { UNREAD_QUERY_KEY } from "@/hooks/use-unread-counts";
import { cn } from "@/lib/utils";
import { notificationIcon } from "@/components/notifications/notification-icon";
import { deleteNotificationsAction, markNotificationsAction } from "@/app/dashboard/benachrichtigungen/actions";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
  count: number;
}

export function NotificationList({ userId, items }: { userId: string; items: NotificationItem[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, startTransition] = React.useTransition();

  // Neue Benachrichtigungen erscheinen ohne Neuladen
  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-page:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => router.refresh())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, router]);

  function refreshCounts() {
    void queryClient.invalidateQueries({ queryKey: UNREAD_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  function setRead(id: string, read: boolean) {
    startTransition(async () => {
      const res = await markNotificationsAction({ ids: [id], read });
      if (res.ok) {
        refreshCounts();
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteNotificationsAction({ ids: [id] });
      if (res.ok) {
        refreshCounts();
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function open(item: NotificationItem) {
    if (!item.readAt) {
      void markNotificationsAction({ ids: [item.id], read: true }).then(refreshCounts);
    }
  }

  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-border" aria-busy={pending}>
        {items.map((item) => {
          const Icon = notificationIcon(item.type);
          const unread = !item.readAt;
          return (
            <li key={item.id} className={cn("relative flex gap-3 p-4 transition-colors sm:gap-4 sm:px-5", unread ? "bg-mint-50/70" : "hover:bg-mint-50/50")}>
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", unread ? "bg-mint-200 text-forest" : "bg-muted text-muted-foreground")}>
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={item.link ?? "/dashboard/benachrichtigungen"}
                  onClick={() => open(item)}
                  className={cn("block text-[0.9375rem] after:absolute after:inset-0 after:content-['']", unread ? "font-bold" : "font-semibold")}
                >
                  {unread ? <span className="sr-only">Ungelesen: </span> : null}
                  {item.title}
                  {item.count > 1 ? <span className="ml-1.5 text-xs font-medium text-muted-foreground">({item.count})</span> : null}
                </Link>
                {item.body ? <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{item.body}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground" title={formatDateTime(item.createdAt)} suppressHydrationWarning>
                  {formatRelative(item.createdAt)}
                </p>
              </div>
              <div className="relative z-10 flex shrink-0 items-start gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setRead(item.id, unread)}
                  disabled={pending}
                  aria-label={unread ? "Als gelesen markieren" : "Als ungelesen markieren"}
                >
                  {unread ? <CircleCheck /> : <Circle />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(item.id)} disabled={pending} aria-label="Benachrichtigung löschen">
                  <Trash2 />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function NotificationBulkActions({ unreadCount, hasRead }: { unreadCount: number; hasRead: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, startTransition] = React.useTransition();

  function run(kind: "read" | "delete") {
    startTransition(async () => {
      const res = kind === "read" ? await markNotificationsAction({ all: true, read: true }) : await deleteNotificationsAction({ allRead: true });
      if (res.ok) {
        toast.success(kind === "read" ? "Alle als gelesen markiert." : (res.message ?? "Gelöscht."));
        void queryClient.invalidateQueries({ queryKey: UNREAD_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <>
      {unreadCount > 0 ? (
        <Button variant="outline" onClick={() => run("read")} loading={pending}>
          Alle als gelesen markieren
        </Button>
      ) : null}
      {hasRead ? (
        <Button variant="ghost" onClick={() => run("delete")} disabled={pending}>
          <Trash2 aria-hidden /> Gelesene löschen
        </Button>
      ) : null}
    </>
  );
}
