import Link from "next/link";
import { Download, FileImage, FileText, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DOCUMENT_CATEGORIES } from "@/lib/constants";
import { formatDate, formatFileSize } from "@/lib/format";
import type { SharedDocumentItem } from "@/services/documents";

/** Dokumente, die andere für den Benutzer freigegeben haben (aktive, nicht abgelaufene Freigaben). */
export function SharedDocuments({ items }: { items: SharedDocumentItem[] }) {
  if (!items.length) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="Noch keine geteilten Dokumente"
        description="Verkäuferinnen und Verkäufer können Ihnen Unterlagen wie Grundrisse oder Reglemente freigeben. Sie erscheinen hier und Sie werden benachrichtigt."
      />
    );
  }
  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-border">
        {items.map((item) => {
          const Icon = item.mimeType === "application/pdf" ? FileText : FileImage;
          return (
            <li key={item.grantId} className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap sm:gap-4 sm:p-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-mint-100 text-forest">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {DOCUMENT_CATEGORIES[item.category]} · {formatFileSize(item.sizeBytes)} · freigegeben am {formatDate(item.sharedAt)}
                  {item.sharedBy ? ` von ${item.sharedBy}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.listing?.title ? (
                    item.listing.slug ? (
                      <Link href={`/immobilien/${item.listing.slug}`} className="font-medium text-forest hover:underline">
                        {item.listing.title}
                      </Link>
                    ) : (
                      item.listing.title
                    )
                  ) : null}
                  {item.listing?.title ? " · " : ""}
                  {item.expiresAt ? `Zugriff bis ${formatDate(item.expiresAt)}` : "Zugriff unbefristet"}
                </p>
              </div>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <a href={`/api/documents/${item.documentId}/download`}>
                  <Download aria-hidden /> Herunterladen
                </a>
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
