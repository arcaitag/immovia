"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, House, Inbox, Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { LEAD_STATUS } from "@/lib/constants";
import { UNREAD_QUERY_KEY } from "@/hooks/use-unread-counts";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import { mapConversationRows, otherRoleLabel, type ConversationListItem } from "@/components/chat/types";
import { CONVERSATIONS_QUERY_KEY, formatConversationTime } from "@/components/chat/utils";

function useConversations(archived: boolean, initialData?: ConversationListItem[]) {
  return useQuery({
    queryKey: [...CONVERSATIONS_QUERY_KEY, archived],
    initialData,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await createClient().rpc("get_my_conversations", { p_archived: archived });
      if (error) throw new Error(error.message);
      return mapConversationRows(data);
    },
  });
}

/** Hält Liste und Zähler aktuell: neue Nachrichten (RLS-gefiltert) und eigene Lesestände. */
function useConversationRealtime(userId: string) {
  const queryClient = useQueryClient();
  React.useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: UNREAD_QUERY_KEY });
      }, 300);
    };
    const channel = supabase
      .channel(`inbox:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversation_participants", filter: `user_id=eq.${userId}` }, refresh)
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function ConversationList({
  userId,
  activeId,
  initialConversations,
}: {
  userId: string;
  activeId: string | null;
  initialConversations: ConversationListItem[];
}) {
  const [tab, setTab] = React.useState<"aktiv" | "archiv">("aktiv");
  const [search, setSearch] = React.useState("");
  const debounced = useDebouncedValue(search, 150);
  const active = useConversations(false, initialConversations);
  const archived = useConversations(true);
  useConversationRealtime(userId);

  const query = tab === "aktiv" ? active : archived;
  const items = React.useMemo(() => {
    const term = normalize(debounced.trim());
    const list = query.data ?? [];
    if (!term) return list;
    return list.filter((c) => normalize(`${c.otherName} ${c.listingTitle}`).includes(term));
  }, [query.data, debounced]);

  const archivedCount = archived.data?.length ?? 0;
  const now = new Date();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 border-b border-border p-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "aktiv" | "archiv")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="aktiv">Aktiv</TabsTrigger>
            <TabsTrigger value="archiv">
              Archiviert{archivedCount ? <span className="text-xs text-muted-foreground">({archivedCount})</span> : null}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name oder Inserat suchen"
            aria-label="Konversationen durchsuchen"
            className="pl-10"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {query.isPending ? (
          <ul className="space-y-1 p-3" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="flex gap-3 p-2">
                <Skeleton className="size-12 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </li>
            ))}
          </ul>
        ) : query.isError ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Die Konversationen konnten nicht geladen werden.</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-mint-100 text-forest">
              {tab === "aktiv" ? <Inbox className="size-5" aria-hidden /> : <Archive className="size-5" aria-hidden />}
            </span>
            <p className="font-display font-bold">
              {search ? "Keine Treffer" : tab === "aktiv" ? "Noch keine Nachrichten" : "Keine archivierten Konversationen"}
            </p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              {search
                ? "Versuchen Sie einen anderen Namen oder Inseratetitel."
                : tab === "aktiv"
                  ? "Anfragen zu Ihren Inseraten und Ihre eigenen Anfragen erscheinen hier."
                  : "Archivierte Konversationen kehren automatisch zurück, sobald eine neue Nachricht eintrifft."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((c) => (
              <li key={c.id}>
                <ConversationRow item={c} active={c.id === activeId} now={now} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ConversationRow({ item, active, now }: { item: ConversationListItem; active: boolean; now: Date }) {
  const unread = item.unreadCount > 0;
  return (
    <Link
      href={`/dashboard/nachrichten/${item.id}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex gap-3 px-4 py-3.5 transition-colors hover:bg-mint-50 focus-visible:bg-mint-50 focus-visible:outline-none",
        active && "bg-mint-100 hover:bg-mint-100",
      )}
    >
      <div className="relative shrink-0">
        <div className="relative size-12 overflow-hidden rounded-xl bg-mint-100">
          {item.imageUrl ? (
            <Image src={item.imageUrl} alt="" fill sizes="48px" className="object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-forest">
              <House className="size-5" aria-hidden />
            </span>
          )}
        </div>
        <Avatar src={item.otherAvatarUrl} name={item.otherName} className="absolute -bottom-1.5 -right-1.5 size-6 text-[10px] ring-2 ring-white" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn("truncate text-[0.9375rem]", unread ? "font-bold" : "font-semibold")}>{item.otherName}</p>
          <time
            dateTime={item.lastMessageAt ?? undefined}
            suppressHydrationWarning
            className={cn("shrink-0 text-xs", unread ? "font-semibold text-primary" : "text-muted-foreground")}
          >
            {formatConversationTime(item.lastMessageAt, now)}
          </time>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          <span className="font-medium">{otherRoleLabel(item.myRole)}</span> · {item.listingTitle}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <p className={cn("min-w-0 flex-1 truncate text-sm", unread ? "font-semibold text-foreground" : "text-muted-foreground")}>
            {item.lastMessagePreview ?? "Noch keine Nachrichten"}
          </p>
          {unread ? (
            <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold leading-4 text-white">
              <span className="sr-only">Ungelesen: </span>
              {item.unreadCount > 99 ? "99+" : item.unreadCount}
            </span>
          ) : null}
        </div>
        {item.leadStatus ? (
          <StatusBadge label={LEAD_STATUS[item.leadStatus].label} tone={LEAD_STATUS[item.leadStatus].tone} className="mt-2" />
        ) : null}
      </div>
    </Link>
  );
}
