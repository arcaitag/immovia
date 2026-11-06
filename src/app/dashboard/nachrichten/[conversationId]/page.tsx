import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getConversationView } from "@/services/messages";
import { ChatView } from "@/components/chat/chat-view";
import { isUuid } from "@/lib/utils";

export default async function ConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  if (!isUuid(conversationId)) notFound();
  const user = await requireUser(`/dashboard/nachrichten/${conversationId}`);
  // RLS: nur Teilnehmende (bzw. Team der Firma) sehen die Konversation
  const view = await getConversationView(conversationId, user.id);
  if (!view) notFound();
  return <ChatView key={view.id} view={view} userId={user.id} />;
}
