"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Globe, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
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
import {
  deleteDossierVersionAction,
  setDossierPublicAction,
  setListingDossierPublicAction,
} from "@/app/dashboard/immobilien/[id]/dossier/actions";
import { formatDateTime, formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface DossierVersionItem {
  id: string;
  version: number;
  status: "generating" | "ready" | "failed";
  templateLabel: string;
  createdAt: string;
  fileSize: number | null;
  pageCount: number | null;
  isPublic: boolean;
  error: string | null;
}

/**
 * Gespeicherte Versionen: herunterladen, genau eine Version für das Inserat freigeben,
 * Versionen löschen und das Angebot auf der Inseratseite ein- oder ausschalten.
 */
export function DossierVersions({
  propertyId,
  versions,
  listing,
}: {
  propertyId: string;
  versions: DossierVersionItem[];
  listing: { exists: boolean; dossierPublic: boolean; isPublished: boolean };
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [toDelete, setToDelete] = React.useState<DossierVersionItem | null>(null);
  const hasReady = versions.some((v) => v.status === "ready");

  async function run(key: string, action: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setBusy(key);
    try {
      const res = await action();
      if (!res.ok) toast.error(res.error ?? "Die Aktion ist fehlgeschlagen.");
      else {
        if (res.message) toast.success(res.message);
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="dossier-versions-title" className="grid gap-4">
      <div className="flex flex-col gap-1">
        <h3 id="dossier-versions-title" className="font-display text-lg font-bold">
          Gespeicherte Versionen
        </h3>
        <p className="text-sm text-muted-foreground">Jede Erstellung ist eine eigene Version. Interessenten erhalten nur die freigegebene Version.</p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-1 text-sm">
          <Label htmlFor="dossier-listing-public" className="font-semibold">
            Dossier im Inserat zum Download anbieten
          </Label>
          <p className="text-muted-foreground">
            {!listing.exists
              ? "Es gibt noch kein Inserat. Legen Sie es im Schritt «Inserat» an."
              : !hasReady
                ? "Erstellen Sie zuerst eine Version."
                : listing.isPublished
                  ? "Interessenten können die freigegebene Version auf der Inseratseite herunterladen."
                  : "Sichtbar, sobald das Inserat veröffentlicht ist."}
          </p>
        </div>
        <Switch
          id="dossier-listing-public"
          checked={listing.dossierPublic}
          disabled={!listing.exists || (!hasReady && !listing.dossierPublic) || busy !== null}
          onCheckedChange={(checked) => run("listing", () => setListingDossierPublicAction(propertyId, checked))}
        />
      </div>

      {versions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted-foreground">
          Noch keine Version erstellt.
        </p>
      ) : (
        <ul className="grid gap-2">
          {versions.map((v) => (
            <li
              key={v.id}
              className={cn(
                "flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between",
                v.isPublic && "border-brand",
              )}
            >
              <div className="grid gap-1 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">Version {v.version}</span>
                  {v.status === "generating" ? (
                    <Badge tone="blue">
                      <Loader2 className="animate-spin" aria-hidden /> Wird erstellt
                    </Badge>
                  ) : v.status === "failed" ? (
                    <Badge tone="red">Fehlgeschlagen</Badge>
                  ) : null}
                  {v.isPublic ? (
                    <Badge tone="green">
                      <Globe aria-hidden /> Für das Inserat freigegeben
                    </Badge>
                  ) : null}
                </span>
                <span className="tabular text-muted-foreground">
                  {formatDateTime(v.createdAt)} · Vorlage {v.templateLabel}
                  {v.pageCount ? ` · ${v.pageCount} Seiten` : ""}
                  {v.fileSize ? ` · ${formatFileSize(v.fileSize)}` : ""}
                </span>
                {v.status === "failed" && v.error ? <span className="text-xs text-destructive">{v.error}</span> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {v.status === "ready" ? (
                  <>
                    <Button asChild size="sm" variant="outline">
                      <a href={`/api/dossiers/${v.id}/download`}>
                        <Download aria-hidden /> Herunterladen
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant={v.isPublic ? "ghost" : "outline"}
                      loading={busy === `public-${v.id}`}
                      disabled={busy !== null}
                      onClick={() => run(`public-${v.id}`, () => setDossierPublicAction(v.id, !v.isPublic))}
                    >
                      {v.isPublic ? "Freigabe aufheben" : "Für Inserat freigeben"}
                    </Button>
                  </>
                ) : null}
                {v.status !== "generating" ? (
                  <Button size="sm" variant="ghost" onClick={() => setToDelete(v)} disabled={busy !== null} aria-label={`Version ${v.version} löschen`}>
                    <Trash2 aria-hidden />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => (!open ? setToDelete(null) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Version {toDelete?.version} löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.isPublic
                ? "Diese Version ist für das Inserat freigegeben. Nach dem Löschen bieten Sie kein Dossier mehr zum Download an, bis Sie eine andere Version freigeben."
                : "Die PDF-Datei wird endgültig gelöscht."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              destructive
              onClick={() => {
                const target = toDelete;
                setToDelete(null);
                if (target) void run(`delete-${target.id}`, () => deleteDossierVersionAction(target.id));
              }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
