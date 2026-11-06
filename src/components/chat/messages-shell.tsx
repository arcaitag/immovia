"use client";

import * as React from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { ConversationList } from "@/components/chat/conversation-list";
import type { ConversationListItem } from "@/components/chat/types";
import { cn } from "@/lib/utils";

/**
 * Layout für /dashboard/nachrichten: Desktop zweispaltig (Liste + Chat),
 * Mobile entweder Liste oder Vollbild-Chat (mit Zurück-Schaltfläche im Chat).
 */
export function MessagesShell({
  userId,
  initialConversations,
  children,
}: {
  userId: string;
  initialConversations: ConversationListItem[];
  children: React.ReactNode;
}) {
  const segment = useSelectedLayoutSegment();
  const activeId = segment && segment !== "__PAGE__" ? segment : null;
  const open = activeId !== null;

  return (
    <div className="flex flex-col gap-6">
      <div className={cn(open && "hidden lg:block")}>
        <PageHeader
          title="Nachrichten"
          description="Alle Gespräche zu Ihren Inseraten und Anfragen an einem Ort. Ihre E-Mail-Adresse bleibt privat."
        />
      </div>
      <div className="lg:grid lg:h-[calc(100dvh-15rem)] lg:min-h-[32rem] lg:grid-cols-[22rem_minmax(0,1fr)] lg:overflow-hidden lg:rounded-2xl lg:border lg:border-border lg:bg-card lg:shadow-card">
        <aside
          aria-label="Konversationen"
          className={cn(
            "overflow-hidden rounded-2xl border border-border bg-card shadow-card lg:flex lg:min-h-0 lg:flex-col lg:rounded-none lg:border-0 lg:border-r lg:shadow-none",
            open && "hidden",
          )}
        >
          <ConversationList userId={userId} activeId={activeId} initialConversations={initialConversations} />
        </aside>
        <section aria-label="Unterhaltung" className={cn("min-h-0 lg:flex lg:flex-col", !open && "hidden lg:flex")}>
          {children}
        </section>
      </div>
    </div>
  );
}
