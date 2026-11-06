import Link from "next/link";
import { UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function LeadNotFound() {
  return (
    <EmptyState
      icon={UserX}
      title="Interessent nicht gefunden"
      description="Dieser Eintrag existiert nicht oder gehört nicht zu Ihren Inseraten."
      action={
        <Button asChild variant="outline">
          <Link href="/dashboard/interessenten">Alle Interessenten</Link>
        </Button>
      }
    />
  );
}
