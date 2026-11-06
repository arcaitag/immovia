"use client";

import * as React from "react";
import Image from "next/image";
import { CalendarCheck, Clock, Download, FileText, Flag, RotateCcw, TriangleAlert, X } from "lucide-react";
import { formatFileSize, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/components/chat/types";
import { isImageMime } from "@/components/chat/utils";

function attachmentHref(messageId: string, inline = false): string {
  return `/api/messages/${messageId}/attachment${inline ? "?inline=1" : ""}`;
}

function AttachmentView({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const attachment = message.attachment;
  if (!attachment) return null;
  const ready = !message.pending;
  if (ready && isImageMime(attachment.mime)) {
    return (
      <a
        href={attachmentHref(message.id, true)}
        target="_blank"
        rel="noopener"
        className="relative mb-1 block h-48 w-60 max-w-full overflow-hidden rounded-xl bg-muted sm:h-56 sm:w-72"
        aria-label={`Bild öffnen: ${attachment.name}`}
      >
        <Image src={attachmentHref(message.id, true)} alt={attachment.name} fill sizes="288px" unoptimized className="object-cover" />
      </a>
    );
  }
  const content = (
    <>
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          mine ? "bg-white/15 text-white" : "bg-mint-100 text-forest",
        )}
      >
        <FileText className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{attachment.name}</span>
        <span className={cn("block text-xs", mine ? "text-white/80" : "text-muted-foreground")}>
          {attachment.size ? formatFileSize(attachment.size) : ""}
          {ready ? " · Herunterladen" : " · Wird hochgeladen …"}
        </span>
      </span>
      {ready ? <Download className="size-4 shrink-0 opacity-80" aria-hidden /> : null}
    </>
  );
  const className = cn(
    "mb-1 flex w-64 max-w-full items-center gap-3 rounded-xl border p-2.5 text-left",
    mine ? "border-white/20 bg-white/10" : "border-border bg-surface",
  );
  return ready ? (
    <a href={attachmentHref(message.id)} className={cn(className, "transition-colors hover:border-mint-300")}>
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  );
}

export function SystemMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="flex justify-center px-2 py-1">
      <div className="flex max-w-md items-start gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 text-xs leading-relaxed text-muted-foreground">
        <CalendarCheck className="mt-0.5 size-3.5 shrink-0 text-forest" aria-hidden />
        <p className="whitespace-pre-line">
          {message.body}
          <span className="ml-1.5 whitespace-nowrap opacity-80">{formatTime(message.createdAt)}</span>
        </p>
      </div>
    </div>
  );
}

export function MessageBubble({
  message,
  mine,
  senderName,
  showSender,
  receipt,
  onReport,
  onRetry,
  onDiscard,
}: {
  message: ChatMessage;
  mine: boolean;
  senderName: string | null;
  showSender: boolean;
  receipt?: "read" | "sent" | null;
  onReport?: () => void;
  onRetry?: () => void;
  onDiscard?: () => void;
}) {
  const failed = message.pending === "failed";
  const sending = message.pending === "sending";
  const hideBody = message.attachment && message.body === `Anhang: ${message.attachment.name}`;
  return (
    <div className={cn("group flex flex-col px-1", mine ? "items-end" : "items-start")}>
      {showSender && !mine && senderName ? <p className="mb-1 ml-1 text-xs font-semibold text-muted-foreground">{senderName}</p> : null}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[0.9375rem] leading-relaxed shadow-sm sm:max-w-[75%]",
          mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border border-border bg-card text-foreground",
          failed && "bg-destructive-bg text-foreground ring-1 ring-destructive/30",
          sending && "opacity-80",
        )}
      >
        <AttachmentView message={message} mine={mine && !failed} />
        {hideBody ? null : <p className="whitespace-pre-wrap break-words">{message.body}</p>}
      </div>
      <div className={cn("mt-1 flex items-center gap-2 px-1 text-[11px] text-muted-foreground", mine ? "flex-row-reverse" : "flex-row")}>
        <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
        {sending ? (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" aria-hidden /> Wird gesendet
          </span>
        ) : null}
        {failed ? (
          <span className="inline-flex items-center gap-2 font-semibold text-destructive">
            <TriangleAlert className="size-3" aria-hidden /> Nicht gesendet
            {onRetry ? (
              <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 underline underline-offset-2">
                <RotateCcw className="size-3" aria-hidden /> Erneut senden
              </button>
            ) : null}
            {onDiscard ? (
              <button type="button" onClick={onDiscard} className="inline-flex items-center gap-1 underline underline-offset-2">
                <X className="size-3" aria-hidden /> Verwerfen
              </button>
            ) : null}
          </span>
        ) : null}
        {receipt === "read" ? <span className="font-medium text-primary">Gelesen</span> : receipt === "sent" ? <span>Zugestellt</span> : null}
        {!mine && onReport ? (
          <button
            type="button"
            onClick={onReport}
            className="inline-flex min-h-6 items-center gap-1 rounded px-1 transition-opacity hover:text-destructive focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            aria-label="Nachricht melden"
          >
            <Flag className="size-3" aria-hidden /> Melden
          </button>
        ) : null}
      </div>
    </div>
  );
}
