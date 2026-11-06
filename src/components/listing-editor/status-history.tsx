import { ArrowRight, History } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { LISTING_STATUS, type ListingStatus } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

export interface StatusHistoryEntry {
  id: string;
  from_status: ListingStatus | null;
  to_status: ListingStatus;
  changed_by: string | null;
  reason: string | null;
  created_at: string;
}

function actor(changedBy: string | null, userId: string): string {
  if (changedBy === null) return "System";
  if (changedBy === userId) return "Sie";
  return "Team oder Moderation";
}

/** Verlauf der Statuswechsel (listing_status_history). */
export function StatusHistory({ entries, userId }: { entries: StatusHistoryEntry[]; userId: string }) {
  if (entries.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <History className="size-4" aria-hidden /> Noch keine Statuswechsel.
      </p>
    );
  }
  return (
    <ol className="grid gap-3">
      {entries.map((entry) => (
        <li key={entry.id} className="grid gap-1.5 rounded-xl border border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            {entry.from_status ? (
              <>
                <StatusBadge label={LISTING_STATUS[entry.from_status].label} tone={LISTING_STATUS[entry.from_status].tone} />
                <ArrowRight className="size-4 text-muted-foreground" aria-label="zu" />
              </>
            ) : null}
            <StatusBadge label={LISTING_STATUS[entry.to_status].label} tone={LISTING_STATUS[entry.to_status].tone} />
          </div>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(entry.created_at)} · {actor(entry.changed_by, userId)}
          </p>
          {entry.reason ? <p className="text-sm">{entry.reason}</p> : null}
        </li>
      ))}
    </ol>
  );
}
