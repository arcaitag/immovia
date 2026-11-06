import Link from "next/link";
import { BellRing, CalendarClock, MessageSquare } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { APPOINTMENT_STATUS } from "@/lib/constants";
import { formatRelative, formatTimeRange } from "@/lib/format";
import { publicStorageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import type { ConversationSummary, UpcomingViewing } from "@/services/listings";

function EmptyLine({ icon: Icon, children }: { icon: typeof BellRing; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2.5 rounded-xl bg-surface px-4 py-5 text-sm text-muted-foreground">
      <Icon className="size-4 shrink-0" aria-hidden /> {children}
    </p>
  );
}

export interface ActivityItem {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

/** Letzte Benachrichtigungen. */
export function ActivityList({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) return <EmptyLine icon={BellRing}>Noch keine Aktivitäten.</EmptyLine>;
  return (
    <ul className="grid gap-1">
      {items.map((item) => {
        const content = (
          <>
            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.read_at ? "bg-border" : "bg-brand")} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{item.title}</span>
              {item.body ? <span className="block truncate text-sm text-muted-foreground">{item.body}</span> : null}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(item.created_at)}</span>
          </>
        );
        return (
          <li key={item.id}>
            {item.link ? (
              <Link href={item.link} className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-mint-50">
                {content}
              </Link>
            ) : (
              <div className="flex items-start gap-3 px-3 py-2.5">{content}</div>
            )}
            {!item.read_at ? <span className="sr-only">(ungelesen)</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Letzte Konversationen (get_my_conversations). */
export function ConversationList({ items }: { items: ConversationSummary[] }) {
  if (items.length === 0) return <EmptyLine icon={MessageSquare}>Noch keine Nachrichten.</EmptyLine>;
  return (
    <ul className="grid gap-1">
      {items.map((conversation) => {
        const unread = conversation.unread_count ?? 0;
        return (
          <li key={conversation.conversation_id}>
            <Link
              href={`/dashboard/nachrichten/${conversation.conversation_id}`}
              className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-mint-50"
            >
              <Avatar src={publicStorageUrl("avatars", conversation.other_avatar_path)} name={conversation.other_display_name} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={cn("truncate text-sm", unread ? "font-bold" : "font-semibold")}>{conversation.other_display_name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(conversation.last_message_at)}</span>
                </span>
                {conversation.listing_title ? (
                  <span className="block truncate text-xs text-muted-foreground">{conversation.listing_title}</span>
                ) : null}
                <span className={cn("block truncate text-sm", unread ? "text-foreground" : "text-muted-foreground")}>
                  {conversation.last_message_preview ?? "–"}
                </span>
              </span>
              {unread ? (
                <span className="mt-1 rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white" aria-label={`${unread} ungelesen`}>
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Nächste Besichtigungen (als Verkäufer und als Interessent). */
export function ViewingList({ items, showListing = true }: { items: UpcomingViewing[]; showListing?: boolean }) {
  if (items.length === 0) return <EmptyLine icon={CalendarClock}>Keine bevorstehenden Besichtigungen.</EmptyLine>;
  return (
    <ul className="grid gap-2">
      {items.map((viewing) => {
        const status = APPOINTMENT_STATUS[viewing.status];
        return (
          <li key={viewing.id}>
            <Link href="/dashboard/besichtigungen" className="flex items-start gap-3 rounded-xl border border-border p-3 hover:bg-mint-50">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint-100 text-forest">
                <CalendarClock className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{formatTimeRange(viewing.startsAt, viewing.endsAt)}</span>
                {showListing && viewing.listingTitle ? (
                  <span className="block truncate text-xs text-muted-foreground">{viewing.listingTitle}</span>
                ) : null}
                <span className="block text-xs text-muted-foreground">
                  {viewing.asGuest ? "Ihr Termin als Interessent" : viewing.guestName ? `Mit ${viewing.guestName}` : "Interessent"}
                </span>
              </span>
              <StatusBadge label={status.label} tone={status.tone} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
