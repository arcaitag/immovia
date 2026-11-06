import { ThreadList } from "@/components/assistant/thread-list";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/** Assistent: Verlauf der eigenen Unterhaltungen (RLS: nur eigene) neben dem Chat. */
export default async function AssistantLayout({ children }: { children: React.ReactNode }) {
  await requireUser("/dashboard/assistent");
  const supabase = await createClient();
  const { data: threads } = await supabase
    .from("assistant_threads")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <ThreadList threads={(threads ?? []).map((t) => ({ id: t.id, title: t.title, updatedAt: t.updated_at }))} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
