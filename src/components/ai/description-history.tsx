import Link from "next/link";
import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DESCRIPTION_STYLES, type DescriptionStyle } from "@/lib/constants";
import { DESCRIPTION_SECTIONS, type DescriptionSectionKey } from "@/lib/ai/prompts/description";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface DescriptionHistoryItem {
  id: string;
  style: DescriptionStyle;
  createdAt: string;
  appliedAt: string | null;
  rephrasedSection: DescriptionSectionKey | null;
}

/** Versionsverlauf der KI-Texte (jede Erstellung und Neuformulierung ist eine Version). */
export function DescriptionHistory({ items, selectedId, propertyId }: { items: DescriptionHistoryItem[]; selectedId: string | null; propertyId: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-5 text-muted-foreground" aria-hidden /> Versionen
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2">
          {items.map((item) => {
            const active = item.id === selectedId;
            return (
              <li key={item.id}>
                <Link
                  href={`/dashboard/immobilien/${propertyId}/beschreibung?version=${item.id}`}
                  scroll={false}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-2.5 text-sm transition-colors hover:border-mint-300 hover:bg-mint-50",
                    active && "border-brand bg-mint-50",
                  )}
                >
                  <span className="grid gap-0.5">
                    <span className="font-semibold">
                      {item.rephrasedSection ? `Neu formuliert: ${DESCRIPTION_SECTIONS[item.rephrasedSection].label}` : "Alle Texte"}
                    </span>
                    <span className="tabular text-xs text-muted-foreground">
                      {formatDateTime(item.createdAt)} · {DESCRIPTION_STYLES[item.style].label}
                    </span>
                  </span>
                  {item.appliedAt ? <Badge tone="green">übernommen</Badge> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
