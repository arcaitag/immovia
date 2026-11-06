import Link from "next/link";
import { MessageSquareOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function ConversationNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <EmptyState
        icon={MessageSquareOff}
        title="Konversation nicht gefunden"
        description="Diese Konversation existiert nicht oder Sie haben keinen Zugriff darauf."
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard/nachrichten">Alle Nachrichten</Link>
          </Button>
        }
        className="w-full max-w-lg"
      />
    </div>
  );
}
