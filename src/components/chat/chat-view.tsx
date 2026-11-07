"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Ban,
  CalendarCheck,
  CalendarPlus,
  EllipsisVertical,
  ExternalLink,
  Flag,
  House,
  UserCheck,
  Users,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { createClient } from "@/lib/supabase/client";
import { UNREAD_QUERY_KEY } from "@/hooks/use-unread-counts";
import { zurichDateKey } from "@/lib/viewings/calendar";
import { attachmentOnlyBody, attachmentStoragePath, type SendMessageInput } from "@/lib/validation/message";
import { detectFileMime } from "@/lib/validation/document";
import type { Tables } from "@/types/database";
import {
  MESSAGE_COLUMNS,
  MESSAGE_PAGE_SIZE,
  mapMessageRow,
  mergeMessages,
  otherRoleLabel,
  type ChatMessage,
  type ConversationView,
} from "@/components/chat/types";
import { CONVERSATIONS_QUERY_KEY, dayLabel, normalizeTimestamp, readMarker } from "@/components/chat/utils";
import { MessageBubble, SystemMessage } from "@/components/chat/message-bubble";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ReportDialog, type ReportTarget } from "@/components/chat/report-dialog";
import { LeadStatusSelect } from "@/components/leads/lead-status-select";
import { ViewingBookingDialog } from "@/components/viewings/viewing-booking-dialog";
import { archiveConversationAction, blockUserAction, sendMessageAction } from "@/app/dashboard/nachrichten/actions";
import { CHAT_PANEL_CLASS } from "@/components/chat/layout";

type MessageRow = Tables<"messages">;
type ParticipantRow = Tables<"conversation_participants">;

const NEAR_BOTTOM_PX = 140;

function toMs(value: string): number {
  return Date.parse(normalizeTimestamp(value));
}

function laterThan(a: string | null, b: string | null): boolean {
  if (!a) return false;
  if (!b) return true;
  return toMs(a) > toMs(b);
}

/** Gelesen, wenn der Lesestand der anderen Seite mindestens den Zeitpunkt der Nachricht erreicht. */
function seenBy(lastReadAt: string | null, createdAt: string): boolean {
  return lastReadAt !== null && toMs(lastReadAt) >= toMs(createdAt);
}

export function ChatView({ view, userId }: { view: ConversationView; userId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [messages, setMessages] = React.useState<ChatMessage[]>(view.messages);
  const [hasMore, setHasMore] = React.useState(view.hasMore);
  const [loadingOlder, setLoadingOlder] = React.useState(false);
  const [otherLastReadAt, setOtherLastReadAt] = React.useState(view.otherLastReadAt);
  const [reportTarget, setReportTarget] = React.useState<ReportTarget | null>(null);
  const [bookingOpen, setBookingOpen] = React.useState(false);
  const [confirmBlock, setConfirmBlock] = React.useState(false);
  const [busy, startTransition] = React.useTransition();

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const nearBottomRef = React.useRef(true);
  const restoreRef = React.useRef<number | null>(null);
  const lastReadRef = React.useRef<string | null>(view.myLastReadAt);
  const newestRawRef = React.useRef<string | null>(null);
  const retryRef = React.useRef(new Map<string, SendMessageInput>());

  // Neueste bestätigte Nachricht merken (für das Nachholen nach dem Verbinden)
  React.useEffect(() => {
    const confirmed = messages.filter((m) => !m.pending);
    newestRawRef.current = confirmed.at(-1)?.rawCreatedAt ?? null;
  }, [messages]);

  // Realtime: neue Nachrichten dieser Konversation und Lesestand der anderen Seite (RLS gilt)
  React.useEffect(() => {
    const supabase = createClient();
    const catchUp = async () => {
      let query = supabase.from("messages").select(MESSAGE_COLUMNS).eq("conversation_id", view.id).is("deleted_at", null);
      if (newestRawRef.current) query = query.gt("created_at", newestRawRef.current);
      const { data } = await query.order("created_at", { ascending: true }).limit(100);
      if (data?.length) setMessages((prev) => mergeMessages(prev, data.map(mapMessageRow)));
    };
    const channel = supabase
      .channel(`conversation:${view.id}`)
      .on<MessageRow>(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${view.id}` },
        (payload) => {
          if (payload.new.deleted_at) return;
          setMessages((prev) => mergeMessages(prev, [mapMessageRow(payload.new)]));
        },
      )
      .on<ParticipantRow>(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversation_participants", filter: `conversation_id=eq.${view.id}` },
        (payload) => {
          if (payload.new.user_id !== userId) {
            setOtherLastReadAt((prev) => (laterThan(payload.new.last_read_at, prev) ? payload.new.last_read_at : prev));
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void catchUp();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [view.id, userId]);

  // Gelesen markieren: beim Öffnen, bei neuen Nachrichten und wenn der Tab wieder sichtbar wird
  React.useEffect(() => {
    if (!view.isParticipant) return;
    let latest: string | null = null;
    for (const m of messages) {
      if (!m.pending && m.senderId !== userId && laterThan(m.rawCreatedAt, latest)) latest = m.rawCreatedAt;
    }
    if (!latest) return;
    const target = readMarker(latest);
    const mark = () => {
      if (document.visibilityState !== "visible" || !laterThan(target, lastReadRef.current)) return;
      lastReadRef.current = target;
      void createClient()
        .from("conversation_participants")
        .update({ last_read_at: target })
        .eq("conversation_id", view.id)
        .eq("user_id", userId)
        .then(() => {
          void queryClient.invalidateQueries({ queryKey: UNREAD_QUERY_KEY });
          void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
        });
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [messages, view.id, view.isParticipant, userId, queryClient]);

  // Scrollposition: unten bleiben bzw. nach dem Nachladen älterer Nachrichten halten
  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (restoreRef.current !== null) {
      el.scrollTop = el.scrollHeight - restoreRef.current;
      restoreRef.current = null;
    } else if (nearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Nachladende Bilder verändern die Höhe: unten bleiben, wenn man unten war
  React.useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (nearBottomRef.current && restoreRef.current === null) el.scrollTop = el.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  }

  async function loadOlder() {
    const oldest = messages.find((m) => !m.pending);
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    const { data, error } = await createClient()
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("conversation_id", view.id)
      .is("deleted_at", null)
      .lt("created_at", oldest.rawCreatedAt)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_PAGE_SIZE + 1);
    setLoadingOlder(false);
    if (error) {
      toast.error("Ältere Nachrichten konnten nicht geladen werden.");
      return;
    }
    const rows = data ?? [];
    setHasMore(rows.length > MESSAGE_PAGE_SIZE);
    const el = scrollRef.current;
    restoreRef.current = el ? el.scrollHeight - el.scrollTop : null;
    setMessages((prev) => mergeMessages(rows.slice(0, MESSAGE_PAGE_SIZE).map(mapMessageRow), prev));
  }

  async function deliver(payload: SendMessageInput) {
    const res = await sendMessageAction(payload);
    if (res.ok) {
      retryRef.current.delete(payload.id);
      setMessages((prev) => mergeMessages(prev.filter((m) => m.id !== payload.id), [res.data]));
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
    } else {
      setMessages((prev) => prev.map((m) => (m.id === payload.id ? { ...m, pending: "failed", retryable: true } : m)));
      toast.error(res.error);
    }
  }

  async function send(text: string, file: File | null) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const mime = file ? detectFileMime(file) : null;
    nearBottomRef.current = true;
    setMessages((prev) =>
      mergeMessages(prev, [
        {
          id,
          conversationId: view.id,
          senderId: userId,
          kind: "text",
          body: text.trim() || (file ? attachmentOnlyBody(file.name) : ""),
          attachment: file && mime ? { name: file.name, mime, size: file.size } : null,
          createdAt: now,
          rawCreatedAt: now,
          pending: "sending",
        },
      ]),
    );

    let attachment: SendMessageInput["attachment"] = null;
    if (file && mime) {
      const path = attachmentStoragePath(view.id, crypto.randomUUID(), mime);
      const { error } = await createClient().storage.from("message-attachments").upload(path, file, { contentType: mime, upsert: false });
      if (error) {
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, pending: "failed" } : m)));
        toast.error("Der Anhang konnte nicht hochgeladen werden. Bitte versuchen Sie es erneut.");
        return;
      }
      attachment = { path, name: file.name, mime, size: file.size };
    }
    const payload: SendMessageInput = { id, conversationId: view.id, body: text, attachment };
    retryRef.current.set(id, payload);
    await deliver(payload);
  }

  function retry(id: string) {
    const payload = retryRef.current.get(id);
    if (!payload) return;
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, pending: "sending" } : m)));
    void deliver(payload);
  }

  function discard(id: string) {
    retryRef.current.delete(id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }

  function toggleArchive() {
    startTransition(async () => {
      const res = await archiveConversationAction({ conversationId: view.id, archived: !view.isArchived });
      if (res.ok) {
        toast.success(res.message ?? "Gespeichert.");
        void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function setBlocked(blocked: boolean) {
    if (!view.other) return;
    const otherId = view.other.id;
    startTransition(async () => {
      const res = await blockUserAction({ userId: otherId, blocked, conversationId: view.id });
      if (res.ok) {
        toast.success(res.message ?? "Gespeichert.");
        setConfirmBlock(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  const otherName = view.other?.name ?? "Unbekannt";
  const otherSenders = new Set(messages.filter((m) => m.senderId && m.senderId !== userId && m.kind === "text").map((m) => m.senderId));
  const showSenders = otherSenders.size > 1;
  let lastMineIndex = -1;
  messages.forEach((m, index) => {
    if (m.senderId === userId && m.kind === "text" && !m.pending) lastMineIndex = index;
  });
  const now = new Date();
  const listingHref = view.listing?.isPublic && view.listing.slug ? `/immobilien/${view.listing.slug}` : null;

  return (
    <div className={CHAT_PANEL_CLASS}>
      <header className="flex items-center gap-3 border-b border-border px-2 py-2.5 sm:px-4">
        <Button asChild variant="ghost" size="icon" className="size-11 lg:hidden">
          <Link href="/dashboard/nachrichten" aria-label="Zurück zu allen Konversationen">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <Avatar src={view.other?.avatarUrl} name={otherName} className="size-10" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-bold leading-tight">{otherName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {otherRoleLabel(view.myRole)}
            {view.listing ? (
              <>
                {" · "}
                {listingHref ? (
                  <Link href={listingHref} className="font-medium text-forest hover:underline">
                    {view.title}
                  </Link>
                ) : (
                  <span>{view.title}</span>
                )}
              </>
            ) : null}
            {view.isArchived ? " · Archiviert" : null}
          </p>
        </div>
        {!view.isSellerSide && view.listing?.isPublic ? (
          <Button variant="outline" size="sm" className="hidden h-10 sm:inline-flex" onClick={() => setBookingOpen(true)}>
            <CalendarPlus aria-hidden /> Besichtigung anfragen
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-11" aria-label="Weitere Aktionen" disabled={busy}>
              <EllipsisVertical className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {view.isSellerSide && view.lead ? (
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/interessenten/${view.lead.id}`}>
                  <Users /> Interessent und Notizen
                </Link>
              </DropdownMenuItem>
            ) : null}
            {view.isSellerSide && view.listing ? (
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/besichtigungen?inserat=${view.listing.id}`}>
                  <CalendarCheck /> Besichtigungen verwalten
                </Link>
              </DropdownMenuItem>
            ) : null}
            {!view.isSellerSide && view.listing?.isPublic ? (
              <DropdownMenuItem onSelect={() => setBookingOpen(true)} className="sm:hidden">
                <CalendarPlus /> Besichtigung anfragen
              </DropdownMenuItem>
            ) : null}
            {!view.isSellerSide ? (
              <DropdownMenuItem asChild>
                <Link href="/dashboard/besichtigungen?ansicht=termine">
                  <CalendarCheck /> Meine Termine
                </Link>
              </DropdownMenuItem>
            ) : null}
            {listingHref ? (
              <DropdownMenuItem asChild>
                <Link href={listingHref}>
                  <ExternalLink /> Inserat ansehen
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            {view.isParticipant ? (
              <DropdownMenuItem onSelect={toggleArchive}>
                {view.isArchived ? <ArchiveRestore /> : <Archive />}
                {view.isArchived ? "Wiederherstellen" : "Archivieren"}
              </DropdownMenuItem>
            ) : null}
            {view.other ? (
              view.blockedByMe ? (
                <DropdownMenuItem onSelect={() => setBlocked(false)}>
                  <UserCheck /> Blockierung aufheben
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem destructive onSelect={() => setConfirmBlock(true)}>
                  <Ban /> {otherName} blockieren
                </DropdownMenuItem>
              )
            ) : null}
            <DropdownMenuItem destructive onSelect={() => setReportTarget({ type: "conversation", id: view.id })}>
              <Flag /> Konversation melden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {view.isSellerSide && view.lead ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-surface px-3 py-2 sm:px-4">
          <label htmlFor="chat-lead-status" className="text-xs font-semibold text-muted-foreground">
            Status
          </label>
          <LeadStatusSelect
            id="chat-lead-status"
            leadId={view.lead.id}
            value={view.lead.status}
            className="h-9 w-auto flex-1 sm:flex-none"
            onChanged={() => void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY })}
          />
          <Link href={`/dashboard/interessenten/${view.lead.id}`} className="ml-auto text-sm font-semibold text-primary hover:underline">
            Details und Notizen
          </Link>
        </div>
      ) : null}

      {!view.isSellerSide && view.listing ? (
        <div className="flex items-center gap-3 border-b border-border bg-surface px-3 py-2 sm:px-4">
          <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-mint-100">
            {view.listing.imageUrl ? (
              <Image src={view.listing.imageUrl} alt="" fill sizes="40px" className="object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-forest">
                <House className="size-4" aria-hidden />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{view.listing.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {view.listing.isPublic ? (view.listing.publicAddress ?? "") : "Dieses Inserat ist derzeit nicht öffentlich."}
            </p>
          </div>
          {view.listing.isPublic ? (
            <Button size="sm" className="h-9 sm:hidden" onClick={() => setBookingOpen(true)}>
              <CalendarPlus aria-hidden /> Termin
            </Button>
          ) : null}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        onScroll={onScroll}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label={`Unterhaltung mit ${otherName}`}
        className="min-h-0 flex-1 overflow-y-auto bg-surface px-3 py-4 sm:px-5"
      >
        <div ref={contentRef} className="mx-auto flex max-w-3xl flex-col gap-3">
          <div className="flex justify-center pb-1">
            {hasMore ? (
              <Button variant="outline" size="sm" onClick={() => void loadOlder()} loading={loadingOlder}>
                Ältere Nachrichten laden
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Beginn der Unterhaltung</p>
            )}
          </div>
          {messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Noch keine Nachrichten. Schreiben Sie die erste.</p>
          ) : null}
          {messages.map((message, index) => {
            const day = zurichDateKey(message.createdAt);
            const previous = messages[index - 1];
            const newDay = !previous || zurichDateKey(previous.createdAt) !== day;
            const mine = message.senderId === userId;
            const senderName = message.senderId ? (view.people[message.senderId]?.name ?? (mine ? "Sie" : "Verkäuferteam")) : null;
            return (
              <React.Fragment key={message.id}>
                {newDay ? (
                  <div className="flex items-center gap-3 py-2" role="separator">
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-xs font-semibold text-muted-foreground" suppressHydrationWarning>
                      {dayLabel(day, now)}
                    </span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                ) : null}
                {message.kind === "system" ? (
                  <SystemMessage message={message} />
                ) : (
                  <MessageBubble
                    message={message}
                    mine={mine}
                    senderName={senderName}
                    showSender={showSenders && (!previous || previous.senderId !== message.senderId || newDay)}
                    receipt={
                      index === lastMineIndex && view.other
                        ? seenBy(otherLastReadAt, message.rawCreatedAt)
                          ? "read"
                          : "sent"
                        : null
                    }
                    onReport={!mine && !message.pending ? () => setReportTarget({ type: "message", id: message.id }) : undefined}
                    onRetry={message.pending === "failed" && message.retryable ? () => retry(message.id) : undefined}
                    onDiscard={message.pending === "failed" ? () => discard(message.id) : undefined}
                  />
                )}
              </React.Fragment>
            );
          })}
          {busy ? <Spinner className="mx-auto" label="Wird gespeichert" /> : null}
        </div>
      </div>

      {view.blockedByMe ? (
        <div className="border-t border-border bg-card p-3 sm:p-4">
          <Alert
            tone="neutral"
            title={`Sie haben ${otherName} blockiert.`}
            action={
              <Button size="sm" variant="outline" onClick={() => setBlocked(false)} loading={busy}>
                Aufheben
              </Button>
            }
          >
            Solange die Blockierung besteht, können Sie keine Nachrichten austauschen.
          </Alert>
        </div>
      ) : !view.canPost ? (
        <div className="border-t border-border bg-card p-3 sm:p-4">
          <Alert tone="neutral">In dieser Konversation können Sie derzeit keine Nachrichten senden.</Alert>
        </div>
      ) : (
        <ChatComposer onSend={(text, file) => void send(text, file)} />
      )}

      <ReportDialog target={reportTarget} onOpenChange={(open) => !open && setReportTarget(null)} />
      {view.listing && !view.isSellerSide ? (
        <ViewingBookingDialog listingId={view.listing.id} listingTitle={view.listing.title} open={bookingOpen} onOpenChange={setBookingOpen} />
      ) : null}
      <AlertDialog open={confirmBlock} onOpenChange={setConfirmBlock}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{otherName} blockieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Sie erhalten keine Nachrichten und Anfragen mehr von dieser Person, und sie kann Ihnen nicht mehr schreiben. Sie können die
              Blockierung jederzeit aufheben.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              destructive
              onClick={(event) => {
                event.preventDefault();
                setBlocked(true);
              }}
            >
              Blockieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
