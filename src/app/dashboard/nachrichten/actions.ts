"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { assertUser } from "@/lib/auth/session";
import { runAction, type ActionResult } from "@/lib/errors";
import { flushEmailOutbox } from "@/lib/email/outbox";
import { reportContent, sendMessage, setConversationArchived, setUserBlocked } from "@/services/messages";
import type { ChatMessage } from "@/components/chat/types";
import type { ReportInput, SendMessageInput } from "@/lib/validation/message";

/** Sendet eine Nachricht (Insert mit Benutzer-Client, RLS prüft Teilnahme und Blockierung). */
export async function sendMessageAction(input: SendMessageInput): Promise<ActionResult<ChatMessage>> {
  return runAction(async () => {
    await assertUser();
    const message = await sendMessage(input);
    after(() => flushEmailOutbox());
    return message;
  });
}

export async function archiveConversationAction(input: { conversationId: string; archived: boolean }): Promise<ActionResult<null>> {
  return runAction(
    async () => {
      const user = await assertUser();
      await setConversationArchived(input, user.id);
      revalidatePath("/dashboard/nachrichten", "layout");
      return null;
    },
    input.archived ? "Konversation archiviert." : "Konversation wiederhergestellt.",
  );
}

export async function blockUserAction(input: { userId: string; blocked: boolean; conversationId?: string }): Promise<ActionResult<null>> {
  return runAction(
    async () => {
      const user = await assertUser();
      await setUserBlocked({ userId: input.userId, blocked: input.blocked }, user.id);
      revalidatePath("/dashboard/nachrichten", "layout");
      return null;
    },
    input.blocked ? "Person blockiert. Sie erhalten keine Nachrichten mehr von ihr." : "Blockierung aufgehoben.",
  );
}

export async function reportAction(input: ReportInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    await assertUser();
    await reportContent(input);
    return null;
  }, "Danke für Ihre Meldung. Unser Team prüft sie vertraulich.");
}
