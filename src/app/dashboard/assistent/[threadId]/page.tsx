import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { AssistantChat, type ChatMessage } from "@/components/assistant/assistant-chat";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ASSISTANT_EXAMPLE_QUESTIONS } from "@/lib/ai/prompts/assistant";
import { isUuid } from "@/lib/utils";
import { getFeatureAvailability } from "@/services/ai/access";
import { listAssistantProperties } from "@/services/ai/assistant";

export const metadata: Metadata = { title: "KI-Assistent" };

/** Bestehende Unterhaltung (nur eigene, RLS). */
export default async function AssistantThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  if (!isUuid(threadId)) notFound();
  const user = await requireUser(`/dashboard/assistent/${threadId}`);
  const supabase = await createClient();
  const { data: thread } = await supabase.from("assistant_threads").select("id, user_id, title, property_id").eq("id", threadId).maybeSingle();
  if (!thread || thread.user_id !== user.id) notFound();

  const [messagesRes, properties, availability] = await Promise.all([
    supabase.from("assistant_messages").select("id, role, content").eq("thread_id", thread.id).order("created_at", { ascending: true }).limit(200),
    listAssistantProperties(supabase, user),
    getFeatureAvailability({ supabase, userId: user.id, flag: "assistant", quotaFeature: "assistant", requiresAi: true, requiresConsent: true }),
  ]);
  const messages: ChatMessage[] = (messagesRes.data ?? []).map((m) => ({
    id: m.id,
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));
  // Objektbezug nur, wenn das Objekt (noch) verwaltet werden darf
  const initialPropertyId = thread.property_id && properties.some((p) => p.id === thread.property_id) ? thread.property_id : null;

  return (
    <div className="grid gap-6">
      <PageHeader title={thread.title} eyebrow="KI-Assistent" />
      <AssistantChat
        key={thread.id}
        threadId={thread.id}
        initialMessages={messages}
        properties={properties}
        initialPropertyId={initialPropertyId}
        availability={availability}
        examples={ASSISTANT_EXAMPLE_QUESTIONS}
      />
    </div>
  );
}
