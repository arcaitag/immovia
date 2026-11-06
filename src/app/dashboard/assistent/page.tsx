import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ASSISTANT_EXAMPLE_QUESTIONS } from "@/lib/ai/prompts/assistant";
import { getFeatureAvailability } from "@/services/ai/access";
import { listAssistantProperties } from "@/services/ai/assistant";

export const metadata: Metadata = { title: "KI-Assistent" };

/** Neue Unterhaltung mit dem KI-Assistenten (optional mit Bezug zu einer eigenen Immobilie). */
export default async function AssistantPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const user = await requireUser("/dashboard/assistent");
  const supabase = await createClient();
  const [properties, availability] = await Promise.all([
    listAssistantProperties(supabase, user),
    getFeatureAvailability({ supabase, userId: user.id, flag: "assistant", quotaFeature: "assistant", requiresAi: true, requiresConsent: true }),
  ]);
  const requested = typeof query.immobilie === "string" ? query.immobilie : null;
  const initialPropertyId = properties.some((p) => p.id === requested) ? requested : null;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="KI-Assistent"
        description="Hilfe rund um Verkauf und Vermietung: Präsentation, Unterlagen, Texte und Besichtigungen. Er nutzt nur Ihre eigenen Angaben und gibt keine verbindliche Rechts-, Steuer- oder Finanzberatung."
      />
      <AssistantChat
        threadId={null}
        initialMessages={[]}
        properties={properties}
        initialPropertyId={initialPropertyId}
        availability={availability}
        examples={ASSISTANT_EXAMPLE_QUESTIONS}
      />
    </div>
  );
}
