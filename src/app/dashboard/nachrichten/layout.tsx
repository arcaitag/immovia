import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { listConversations } from "@/services/messages";
import { MessagesShell } from "@/components/chat/messages-shell";
import type { ConversationListItem } from "@/components/chat/types";

export const metadata: Metadata = { title: "Nachrichten" };

export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/dashboard/nachrichten");
  let initialConversations: ConversationListItem[] = [];
  try {
    initialConversations = await listConversations(false);
  } catch (error) {
    console.error("[nachrichten] Konversationen konnten nicht geladen werden", error);
  }
  return (
    <MessagesShell userId={user.id} initialConversations={initialConversations}>
      {children}
    </MessagesShell>
  );
}
