import { MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

/** Desktop: rechte Spalte ohne gewählte Konversation. Mobile zeigt nur die Liste. */
export default function MessagesIndexPage() {
  return (
    <div className="hidden flex-1 items-center justify-center p-8 lg:flex">
      <EmptyState
        icon={MessageSquare}
        title="Wählen Sie eine Konversation"
        description="Links sehen Sie alle Gespräche. Neue Nachrichten erscheinen automatisch, ohne dass Sie die Seite neu laden müssen."
        className="border-0 bg-transparent"
      />
    </div>
  );
}
