"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Upload, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { createClient } from "@/lib/supabase/client";
import { formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_MAX_BYTES,
  detectFileMime,
  documentMetaSchema,
  documentStoragePath,
  FILE_ACCEPT,
  titleFromFileName,
  type FileMime,
} from "@/lib/validation/document";
import { DocumentMetaFields, type DocumentMetaState } from "@/components/documents/document-fields";
import { createDocumentAction } from "@/app/dashboard/dokumente/actions";

const INITIAL: DocumentMetaState = { title: "", category: "other", visibility: "owner", containsPersonalData: false };

/**
 * Upload ins Dokumentencenter: Der Browser lädt die Datei direkt nach
 * documents/{propertyId}/{documentId}.{ext} (Storage-Policy prüft die Berechtigung),
 * danach legt die Server Action den Datensatz an.
 */
export function DocumentUploadDialog({ propertyId, propertyLabel, hasOrganization }: { propertyId: string; propertyLabel: string; hasOrganization: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<{ file: File; mime: FileMime } | null>(null);
  const [meta, setMeta] = React.useState<DocumentMetaState>(INITIAL);
  const [errors, setErrors] = React.useState<Partial<Record<keyof DocumentMetaState | "file", string>>>({});
  const [dragging, setDragging] = React.useState(false);
  const [phase, setPhase] = React.useState<"idle" | "uploading" | "saving">("idle");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const titleTouched = React.useRef(false);

  function reset() {
    setFile(null);
    setMeta(INITIAL);
    setErrors({});
    setPhase("idle");
    titleTouched.current = false;
  }

  function accept(selected: File | undefined | null) {
    if (!selected) return;
    const mime = detectFileMime(selected);
    if (!mime) {
      setErrors((e) => ({ ...e, file: "Erlaubt sind PDF, JPG, PNG und WEBP." }));
      return;
    }
    if (selected.size > DOCUMENT_MAX_BYTES) {
      setErrors((e) => ({ ...e, file: "Dokumente dürfen höchstens 25 MB gross sein." }));
      return;
    }
    if (selected.size === 0) {
      setErrors((e) => ({ ...e, file: "Die Datei ist leer." }));
      return;
    }
    setErrors((e) => ({ ...e, file: undefined }));
    setFile({ file: selected, mime });
    if (!titleTouched.current) setMeta((m) => ({ ...m, title: titleFromFileName(selected.name) }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = documentMetaSchema.safeParse(meta);
    const nextErrors: Partial<Record<keyof DocumentMetaState | "file", string>> = {};
    if (!file) nextErrors.file = "Bitte wählen Sie eine Datei.";
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof DocumentMetaState;
        nextErrors[key] ??= issue.message;
      }
    }
    if (meta.visibility === "organization" && !hasOrganization) nextErrors.visibility = "Diese Immobilie gehört zu keinem Firmenkonto.";
    setErrors(nextErrors);
    if (!file || Object.keys(nextErrors).some((k) => nextErrors[k as keyof typeof nextErrors])) return;

    const documentId = crypto.randomUUID();
    const path = documentStoragePath(propertyId, documentId, file.mime);
    setPhase("uploading");
    const { error } = await createClient().storage.from("documents").upload(path, file.file, { contentType: file.mime, upsert: false });
    if (error) {
      setPhase("idle");
      toast.error("Die Datei konnte nicht hochgeladen werden. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.");
      return;
    }
    setPhase("saving");
    const res = await createDocumentAction({
      id: documentId,
      propertyId,
      fileName: file.file.name,
      mimeType: file.mime,
      sizeBytes: file.file.size,
      title: meta.title,
      category: meta.category,
      visibility: meta.visibility,
      containsPersonalData: meta.containsPersonalData,
    });
    if (res.ok) {
      toast.success(res.message ?? "Dokument hochgeladen.");
      setOpen(false);
      reset();
      router.refresh();
    } else {
      setPhase("idle");
      if (res.fieldErrors) setErrors(Object.fromEntries(Object.entries(res.fieldErrors).map(([k, v]) => [k, v[0]])));
      toast.error(res.error);
    }
  }

  const busy = phase !== "idle";

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Upload aria-hidden /> Dokument hochladen
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (busy) return;
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-w-2xl">
          <form onSubmit={submit} className="grid gap-5" noValidate>
            <DialogHeader>
              <DialogTitle>Dokument hochladen</DialogTitle>
              <DialogDescription>{propertyLabel}. PDF oder Bild (JPG, PNG, WEBP), höchstens 25 MB.</DialogDescription>
            </DialogHeader>

            {file ? (
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-mint-100 text-forest">
                  <FileText className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{file.file.name}</span>
                  <span className="block text-xs text-muted-foreground">{formatFileSize(file.file.size)}</span>
                </span>
                <Button type="button" variant="ghost" size="icon" onClick={() => setFile(null)} disabled={busy} aria-label="Andere Datei wählen">
                  <X />
                </Button>
              </div>
            ) : (
              <div>
                <label
                  htmlFor="document-file"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    accept(e.dataTransfer.files?.[0]);
                  }}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
                    dragging ? "border-brand bg-mint-50" : "border-border bg-surface hover:border-mint-300 hover:bg-mint-50",
                    errors.file && "border-destructive/50",
                  )}
                >
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-mint-100 text-forest">
                    <Upload className="size-6" aria-hidden />
                  </span>
                  <span className="font-semibold">Datei hierher ziehen oder auswählen</span>
                  <span className="text-xs text-muted-foreground">PDF, JPG, PNG oder WEBP bis 25 MB</span>
                </label>
                <input
                  ref={inputRef}
                  id="document-file"
                  type="file"
                  accept={FILE_ACCEPT}
                  className="sr-only"
                  onChange={(e) => {
                    accept(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                {errors.file ? (
                  <p role="alert" className="mt-2 text-xs font-medium text-destructive">
                    {errors.file}
                  </p>
                ) : null}
              </div>
            )}

            <DocumentMetaFields
              idPrefix="upload"
              value={meta}
              onChange={(next) => {
                if (next.title !== meta.title) titleTouched.current = true;
                setMeta(next);
              }}
              errors={errors}
              hasOrganization={hasOrganization}
            />

            {meta.visibility === "public" ? (
              <Alert tone="info">Öffentliche Dokumente können alle Besucher des veröffentlichten Inserats herunterladen.</Alert>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                disabled={busy}
              >
                Abbrechen
              </Button>
              <Button type="submit" loading={busy}>
                {phase === "uploading" ? "Wird hochgeladen …" : phase === "saving" ? "Wird gespeichert …" : "Hochladen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
