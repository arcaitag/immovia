"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, EllipsisVertical, ExternalLink, FileImage, FileText, Pencil, Share2, ShieldAlert, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/sonner";
import { DOCUMENT_CATEGORIES, DOCUMENT_VISIBILITY } from "@/lib/constants";
import { formatDate, formatFileSize } from "@/lib/format";
import { documentUpdateSchema } from "@/lib/validation/document";
import type { DocumentItem, ShareCandidate } from "@/services/documents";
import { DocumentMetaFields, VISIBILITY_ICONS, type DocumentMetaState } from "@/components/documents/document-fields";
import { DocumentShareDialog } from "@/components/documents/document-share-dialog";
import { deleteDocumentAction, revokeDocumentAction, updateDocumentAction } from "@/app/dashboard/dokumente/actions";

type DialogState = { kind: "share" | "edit" | "delete"; document: DocumentItem } | null;

function EditDialog({ document, hasOrganization, onClose }: { document: DocumentItem; hasOrganization: boolean; onClose: () => void }) {
  const router = useRouter();
  const [meta, setMeta] = React.useState<DocumentMetaState>({
    title: document.title,
    category: document.category,
    visibility: document.visibility,
    containsPersonalData: document.containsPersonalData,
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof DocumentMetaState, string>>>({});
  const [pending, startTransition] = React.useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = documentUpdateSchema.safeParse({ documentId: document.id, ...meta });
    if (!parsed.success) {
      const next: Partial<Record<keyof DocumentMetaState, string>> = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof DocumentMetaState] ??= issue.message;
      setErrors(next);
      return;
    }
    startTransition(async () => {
      const res = await updateDocumentAction({ documentId: document.id, ...meta });
      if (res.ok) {
        toast.success(res.message ?? "Gespeichert.");
        onClose();
        router.refresh();
      } else {
        if (res.fieldErrors) setErrors(Object.fromEntries(Object.entries(res.fieldErrors).map(([k, v]) => [k, v[0]])));
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={submit} className="grid gap-5" noValidate>
          <DialogHeader>
            <DialogTitle>Dokument bearbeiten</DialogTitle>
            <DialogDescription>{document.fileName ?? document.title}</DialogDescription>
          </DialogHeader>
          <DocumentMetaFields idPrefix={`edit-${document.id}`} value={meta} onChange={setMeta} errors={errors} hasOrganization={hasOrganization} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit" loading={pending}>
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DocumentList({
  documents,
  candidates,
  hasOrganization,
}: {
  documents: DocumentItem[];
  candidates: ShareCandidate[];
  hasOrganization: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<DialogState>(null);
  const [pending, startTransition] = React.useTransition();

  function revoke(grantId: string, name: string) {
    startTransition(async () => {
      const res = await revokeDocumentAction({ grantId });
      if (res.ok) {
        toast.success(`Freigabe für ${name} widerrufen.`);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function remove(documentId: string) {
    startTransition(async () => {
      const res = await deleteDocumentAction({ documentId });
      if (res.ok) {
        toast.success(res.message ?? "Dokument gelöscht.");
        setDialog(null);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-border">
        {documents.map((doc) => {
          const Icon = doc.mimeType === "application/pdf" ? FileText : FileImage;
          const VisibilityIcon = VISIBILITY_ICONS[doc.visibility];
          return (
            <li key={doc.id} className="flex gap-3 p-4 sm:gap-4 sm:p-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-mint-100 text-forest">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {DOCUMENT_CATEGORIES[doc.category]} · {formatFileSize(doc.sizeBytes)} · {formatDate(doc.createdAt)}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Aktionen für ${doc.title}`} disabled={pending}>
                        <EllipsisVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem asChild>
                        <a href={`/api/documents/${doc.id}/download`}>
                          <Download /> Herunterladen
                        </a>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a href={`/api/documents/${doc.id}/download?inline=1`} target="_blank" rel="noopener">
                          <ExternalLink /> Im Browser öffnen
                        </a>
                      </DropdownMenuItem>
                      {doc.canManage ? (
                        <>
                          <DropdownMenuItem onSelect={() => setDialog({ kind: "share", document: doc })}>
                            <Share2 /> Freigeben
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setDialog({ kind: "edit", document: doc })}>
                            <Pencil /> Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem destructive onSelect={() => setDialog({ kind: "delete", document: doc })}>
                            <Trash2 /> Löschen
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone={doc.visibility === "public" ? "green" : doc.visibility === "organization" ? "blue" : "neutral"}>
                    <VisibilityIcon aria-hidden /> {DOCUMENT_VISIBILITY[doc.visibility].label}
                  </Badge>
                  {doc.containsPersonalData ? (
                    <Badge tone="amber">
                      <ShieldAlert aria-hidden /> Personendaten
                    </Badge>
                  ) : null}
                </div>
                {doc.grants.length ? (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-muted-foreground">Freigegeben für</p>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {doc.grants.map((g) => (
                        <li
                          key={g.id}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-surface py-0.5 pl-3 pr-1 text-xs"
                        >
                          <span className={g.isExpired ? "text-muted-foreground line-through" : "font-medium"}>{g.granteeName}</span>
                          <span className="text-muted-foreground">
                            {g.isExpired ? "· abgelaufen" : g.expiresAt ? `· bis ${formatDate(g.expiresAt)}` : "· unbefristet"}
                          </span>
                          {doc.canManage ? (
                            <button
                              type="button"
                              onClick={() => revoke(g.id, g.granteeName)}
                              disabled={pending}
                              className="ml-0.5 inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive-bg hover:text-destructive"
                              aria-label={`Freigabe für ${g.granteeName} widerrufen`}
                            >
                              <X className="size-3.5" aria-hidden />
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {dialog?.kind === "share" ? (
        <DocumentShareDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          fixedDocument={{ id: dialog.document.id, title: dialog.document.title, category: dialog.document.category }}
          candidates={candidates.map((c) => ({ userId: c.userId, name: c.name, listingTitle: c.listingTitle }))}
        />
      ) : null}
      {dialog?.kind === "edit" ? <EditDialog document={dialog.document} hasOrganization={hasOrganization} onClose={() => setDialog(null)} /> : null}
      <AlertDialog open={dialog?.kind === "delete"} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dokument löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              «{dialog?.document.title}» wird gelöscht. Bestehende Freigaben verlieren sofort den Zugriff. Dies kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              destructive
              onClick={(e) => {
                e.preventDefault();
                if (dialog) remove(dialog.document.id);
              }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
