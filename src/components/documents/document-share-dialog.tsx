"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { DOCUMENT_CATEGORIES, type DocumentCategory } from "@/lib/constants";
import { utcToZurichParts } from "@/lib/format";
import { addDaysIso } from "@/lib/viewings/calendar";
import { grantDocumentAction } from "@/app/dashboard/dokumente/actions";

export interface ShareDocumentOption {
  id: string;
  title: string;
  category: DocumentCategory;
}

export interface ShareCandidateOption {
  userId: string;
  name: string;
  listingTitle: string | null;
}

/**
 * Dokument für eine Person freigeben (grant_document_access). Entweder ist das Dokument
 * fest und die Person wird gewählt (Dokumentencenter) oder umgekehrt (Interessenten-Detail).
 * Zur Auswahl stehen nur Personen mit Kontakt zu Inseraten dieser Immobilie.
 */
export function DocumentShareDialog({
  open,
  onOpenChange,
  documents,
  candidates,
  fixedDocument,
  fixedCandidate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents?: ShareDocumentOption[];
  candidates?: ShareCandidateOption[];
  fixedDocument?: ShareDocumentOption;
  fixedCandidate?: ShareCandidateOption;
}) {
  const router = useRouter();
  const [documentId, setDocumentId] = React.useState(fixedDocument?.id ?? "");
  const [granteeId, setGranteeId] = React.useState(fixedCandidate?.userId ?? "");
  const [expiresOn, setExpiresOn] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const tomorrow = addDaysIso(utcToZurichParts(new Date()).date, 1);

  function close(next: boolean) {
    if (!next) {
      setDocumentId(fixedDocument?.id ?? "");
      setGranteeId(fixedCandidate?.userId ?? "");
      setExpiresOn("");
      setErrors({});
    }
    onOpenChange(next);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!documentId) nextErrors.documentId = "Bitte wählen Sie ein Dokument.";
    if (!granteeId) nextErrors.granteeId = "Bitte wählen Sie eine Person.";
    if (expiresOn && expiresOn < tomorrow) nextErrors.expiresOn = "Das Ablaufdatum muss in der Zukunft liegen.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    startTransition(async () => {
      const res = await grantDocumentAction({ documentId, granteeId, expiresOn });
      if (res.ok) {
        toast.success(res.message ?? "Dokument freigegeben.");
        close(false);
        router.refresh();
      } else {
        if (res.fieldErrors) {
          setErrors(Object.fromEntries(Object.entries(res.fieldErrors).map(([k, v]) => [k, v[0] ?? ""])));
        }
        toast.error(res.error);
      }
    });
  }

  const noCandidates = !fixedCandidate && (candidates?.length ?? 0) === 0;
  const noDocuments = !fixedDocument && (documents?.length ?? 0) === 0;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-5" noValidate>
          <DialogHeader>
            <DialogTitle>Dokument freigeben</DialogTitle>
            <DialogDescription>
              Die Person kann das Dokument nach der Anmeldung über einen zeitlich begrenzten Link herunterladen. Sie können die Freigabe
              jederzeit widerrufen.
            </DialogDescription>
          </DialogHeader>

          {fixedDocument ? (
            <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
              <p className="font-semibold">{fixedDocument.title}</p>
              <p className="text-muted-foreground">{DOCUMENT_CATEGORIES[fixedDocument.category]}</p>
            </div>
          ) : noDocuments ? (
            <Alert tone="info">Alle Dokumente dieser Immobilie sind bereits für diese Person freigegeben, oder es gibt noch keine.</Alert>
          ) : (
            <Field label="Dokument" htmlFor="share-document" error={errors.documentId} required>
              <NativeSelect id="share-document" value={documentId} onChange={(e) => setDocumentId(e.target.value)}>
                <option value="">Bitte wählen</option>
                {documents?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} ({DOCUMENT_CATEGORIES[d.category]})
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}

          {fixedCandidate ? (
            <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
              <p className="text-muted-foreground">Freigeben für</p>
              <p className="font-semibold">{fixedCandidate.name}</p>
            </div>
          ) : noCandidates ? (
            <Alert tone="info" title="Noch keine Interessenten">
              Freigaben sind nur für Personen möglich, die Sie zu einem Inserat dieser Immobilie kontaktiert haben.
            </Alert>
          ) : (
            <Field
              label="Person"
              htmlFor="share-grantee"
              error={errors.granteeId}
              required
              hint="Nur Interessenten, die zu einem Inserat dieser Immobilie Kontakt aufgenommen haben."
            >
              <NativeSelect id="share-grantee" value={granteeId} onChange={(e) => setGranteeId(e.target.value)}>
                <option value="">Bitte wählen</option>
                {candidates?.map((c) => (
                  <option key={c.userId} value={c.userId}>
                    {c.name}
                    {c.listingTitle ? ` – ${c.listingTitle}` : ""}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}

          <Field label="Gültig bis" htmlFor="share-expires" optional error={errors.expiresOn} hint="Leer lassen für eine unbefristete Freigabe. Gilt bis 23:59 Uhr.">
            <Input id="share-expires" type="date" min={tomorrow} value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Abbrechen
            </Button>
            <Button type="submit" loading={pending} disabled={noCandidates || noDocuments}>
              Freigeben
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
