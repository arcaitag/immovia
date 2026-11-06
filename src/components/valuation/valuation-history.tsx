import Link from "next/link";
import { History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatChf, formatDateTime } from "@/lib/format";
import { VALUATION_STATUS_LABELS } from "@/lib/valuation/labels";
import type { ValuationStatus } from "@/lib/valuation/types";
import { cn } from "@/lib/utils";

export interface ValuationHistoryItem {
  id: string;
  status: ValuationStatus;
  estimated_value: number | null;
  created_at: string;
}

/** Frühere Bewertungen eines Objekts (bleiben dauerhaft gespeichert). */
export function ValuationHistory({ items, selectedId, propertyId, rent }: { items: ValuationHistoryItem[]; selectedId: string | null; propertyId: string; rent: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-5 text-muted-foreground" aria-hidden /> Frühere Bewertungen
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2">
          {items.map((item) => {
            const status = VALUATION_STATUS_LABELS[item.status];
            const active = item.id === selectedId;
            return (
              <li key={item.id}>
                <Link
                  href={`/dashboard/immobilien/${propertyId}/bewertung?bewertung=${item.id}`}
                  scroll={false}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-2.5 text-sm transition-colors hover:border-mint-300 hover:bg-mint-50",
                    active && "border-brand bg-mint-50",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="tabular text-muted-foreground">{formatDateTime(item.created_at)}</span>
                    <StatusBadge label={status.label} tone={status.tone} />
                  </span>
                  <span className="font-semibold tabular">
                    {item.estimated_value !== null ? `${formatChf(item.estimated_value)}${rent ? " / Mt." : ""}` : "keine Zahl"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
