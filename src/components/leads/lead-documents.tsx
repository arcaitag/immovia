"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, FileText, Share2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { DOCUMENT_CATEGORIES, type DocumentCategory } from "@/lib/constants";
import { formatDate, formatFileSize } from "@/lib/format";
import { DocumentShareDialog } from "@/components/documents/document-share-dialog";
import { revokeDocumentAction } from "@/app/dashboard/dokumente/actions";

export interface LeadSharedDocument {
  grantId: string;
  documentId: string;
  title: string;
  category: DocumentCategory;
  sizeBytes: number;
  sharedAt: string;
  expiresAt: string | null;
  isExpired: boolean;
}

/** Freigegebene Dokumente eines Interessenten und «Dokument freigeben». */
export function LeadDocuments({
  propertyId,
  person,
  shared,
  available,
}: {
  propertyId: string;
  person: { userId: string; name: string };
  shared: LeadSharedDocument[];
  available: Array<{ id: string; title: string; category: DocumentCategory }>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function revoke(grantId: string) {
    startTransition(async () => {
      const res = await revokeDocumentAction({ grantId });
      if (res.ok) {
        toast.success(res.message ?? "Freigabe widerrufen.");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="grid gap-4">
      {shared.length === 0 ? (
        <p className="text-sm text-muted-foreground">Für {person.name} sind noch keine Dokumente freigegeben.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {shared.map((doc) => (
            <li key={doc.grantId} className="flex flex-wrap items-center gap-3 p-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-mint-100 text-forest">
                <FileText className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{doc.title}</p>
                <p className="text-xs text-muted-foreground">
                  {DOCUMENT_CATEGORIES[doc.category]} · {formatFileSize(doc.sizeBytes)} · freigegeben am {formatDate(doc.sharedAt)}
                  {doc.expiresAt ? ` · bis ${formatDate(doc.expiresAt)}` : " · unbefristet"}
                </p>
              </div>
              {doc.isExpired ? <Badge tone="amber">Abgelaufen</Badge> : null}
              <div className="flex gap-1">
                <Button asChild variant="ghost" size="icon" aria-label={`${doc.title} herunterladen`}>
                  <a href={`/api/documents/${doc.documentId}/download`}>
                    <Download />
                  </a>
                </Button>
                <Button variant="ghost" size="icon" onClick={() => revoke(doc.grantId)} disabled={pending} aria-label={`Freigabe für ${doc.title} widerrufen`}>
                  <X />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => setOpen(true)} disabled={available.length === 0}>
          <Share2 aria-hidden /> Dokument freigeben
        </Button>
        <Link href={`/dashboard/dokumente?immobilie=${propertyId}`} className="text-sm font-semibold text-primary hover:underline">
          Dokumente verwalten
        </Link>
      </div>
      {available.length === 0 && shared.length === 0 ? (
        <p className="text-xs text-muted-foreground">Laden Sie zuerst Dokumente zu dieser Immobilie im Dokumentencenter hoch.</p>
      ) : null}
      <DocumentShareDialog
        open={open}
        onOpenChange={setOpen}
        documents={available}
        fixedCandidate={{ userId: person.userId, name: person.name, listingTitle: null }}
      />
    </div>
  );
}
