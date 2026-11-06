"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, SearchCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Field, ChoiceRow } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "@/components/ui/sonner";
import {
  getReportTargetAction,
  moderateListingAction,
  setOrganizationStatusAction,
  setUserStatusAction,
  updateReportAction,
} from "@/app/admin/actions";
import { REPORT_REASONS, LISTING_STATUS, type ListingStatus } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import {
  MODERATION_STATUS,
  REPORT_STATUS,
  REPORT_TARGET_TYPES,
  USER_STATUS,
  type ReportStatus,
  type ReportTarget,
} from "@/lib/validation/admin";

interface ReportInfo {
  id: string;
  targetType: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  createdAt: string;
  reporterName: string | null;
  resolutionNote: string | null;
}

type QuickAction = { kind: "block_listing" | "suspend_user" | "suspend_org"; label: string; targetId: string } | null;

function quickActionFor(target: ReportTarget | null, isAdmin: boolean): QuickAction {
  if (!target || !target.exists || !target.id) return null;
  if (target.type === "listing" && target.moderationStatus !== "blocked") {
    return { kind: "block_listing", label: "Inserat zusätzlich sperren", targetId: target.id };
  }
  if (!isAdmin) return null;
  if (target.type === "user" && target.status !== "suspended") {
    return { kind: "suspend_user", label: "Benutzer zusätzlich sperren", targetId: target.id };
  }
  if (target.type === "message" && target.senderId) {
    return { kind: "suspend_user", label: "Absender/in zusätzlich sperren", targetId: target.senderId };
  }
  if (target.type === "organization" && target.status === "active") {
    return { kind: "suspend_org", label: "Firma zusätzlich sperren", targetId: target.id };
  }
  return null;
}

function targetStatusLabel(target: ReportTarget): string | null {
  if (!target.status) return null;
  if (target.type === "listing" && target.status in LISTING_STATUS) return LISTING_STATUS[target.status as ListingStatus].label;
  if (target.type === "user" && (target.status === "active" || target.status === "suspended" || target.status === "deleted")) {
    return USER_STATUS[target.status].label;
  }
  if (target.type === "organization") return target.status === "active" ? "Aktiv" : "Gesperrt";
  return target.status;
}

export function ReportReview({ report, isAdmin }: { report: ReportInfo; isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [target, setTarget] = React.useState<ReportTarget | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loading, startLoading] = React.useTransition();
  const [saving, startSaving] = React.useTransition();
  const [status, setStatus] = React.useState<ReportStatus>(report.status === "open" || report.status === "in_review" ? "resolved" : report.status);
  const [note, setNote] = React.useState("");
  const [applyQuick, setApplyQuick] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const ids = { status: React.useId(), note: React.useId(), quick: React.useId() };

  function onOpenChange(next: boolean) {
    if (saving) return;
    setOpen(next);
    if (next && !target) {
      setLoadError(null);
      startLoading(async () => {
        const res = await getReportTargetAction(report.id);
        if (res.ok) setTarget(res.data);
        else setLoadError(res.error);
      });
    }
    if (!next) {
      setError(null);
      setApplyQuick(false);
    }
  }

  const quick = quickActionFor(target, isAdmin);

  function save() {
    setError(null);
    const trimmed = note.trim();
    if (applyQuick && quick && trimmed.length < 5) {
      setError("Bitte begründen Sie die zusätzliche Massnahme in der Notiz (mind. 5 Zeichen).");
      return;
    }
    startSaving(async () => {
      if (applyQuick && quick) {
        const reason = `Meldung: ${trimmed}`.slice(0, 500);
        const quickRes =
          quick.kind === "block_listing"
            ? await moderateListingAction({ listingId: quick.targetId, action: "block", reason })
            : quick.kind === "suspend_user"
              ? await setUserStatusAction({ userId: quick.targetId, status: "suspended", reason })
              : await setOrganizationStatusAction({ organizationId: quick.targetId, status: "suspended", reason });
        if (!quickRes.ok) {
          setError(quickRes.error);
          return;
        }
      }
      const res = await updateReportAction({ reportId: report.id, status, note: trimmed });
      if (!res.ok) {
        setError(res.fieldErrors?.note?.[0] ?? res.error);
        return;
      }
      toast.success(applyQuick && quick ? "Massnahme umgesetzt und Meldung aktualisiert." : (res.message ?? "Gespeichert."));
      setOpen(false);
      setNote("");
      setApplyQuick(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <SearchCheck aria-hidden /> Prüfen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Meldung prüfen</DialogTitle>
          <DialogDescription>
            {(REPORT_REASONS as Record<string, string>)[report.reason] ?? report.reason} ·{" "}
            {REPORT_TARGET_TYPES[report.targetType] ?? report.targetType} · {formatDateTime(report.createdAt)}
            {report.reporterName ? ` · gemeldet von ${report.reporterName}` : ""}
          </DialogDescription>
        </DialogHeader>

        {report.details ? (
          <blockquote className="whitespace-pre-line rounded-xl border-l-4 border-mint-300 bg-mint-50 px-4 py-3 text-sm leading-relaxed">
            {report.details}
          </blockquote>
        ) : null}

        <section aria-label="Gemeldeter Inhalt" className="rounded-xl border border-border p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gemeldeter Inhalt</p>
          {loading ? (
            <div className="grid gap-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : loadError ? (
            <Alert tone="error">{loadError}</Alert>
          ) : target && !target.exists ? (
            <p className="text-sm text-muted-foreground">Der gemeldete Inhalt existiert nicht mehr.</p>
          ) : target && target.type === "conversation" ? (
            <p className="text-sm text-muted-foreground">Ganze Konversationen werden aus Datenschutzgründen nicht angezeigt.</p>
          ) : target ? (
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {target.title ? <p className="font-semibold">{target.title}</p> : null}
                {targetStatusLabel(target) ? <StatusBadge label={targetStatusLabel(target) ?? ""} tone="neutral" /> : null}
                {target.moderationStatus && target.moderationStatus !== "ok" ? (
                  <StatusBadge label={MODERATION_STATUS[target.moderationStatus].label} tone={MODERATION_STATUS[target.moderationStatus].tone} />
                ) : null}
              </div>
              {target.text ? (
                <p className="max-h-48 overflow-y-auto whitespace-pre-line rounded-lg bg-muted px-3 py-2 text-sm leading-relaxed">{target.text}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {target.type === "listing" && target.slug && target.moderationStatus !== "blocked" ? (
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/immobilien/${target.slug}`} target="_blank">
                      <ExternalLink aria-hidden /> Öffentliche Seite
                    </Link>
                  </Button>
                ) : null}
                {target.type === "listing" && target.ownerId ? (
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/admin/benutzer/${target.ownerId}`}>Eigentümer anzeigen</Link>
                  </Button>
                ) : null}
                {target.type === "user" && target.id ? (
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/admin/benutzer/${target.id}`}>Benutzer anzeigen</Link>
                  </Button>
                ) : null}
                {target.type === "message" && target.senderId ? (
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/admin/benutzer/${target.senderId}`}>Absender/in anzeigen</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        {report.resolutionNote ? (
          <p className="text-xs text-muted-foreground">Bisherige Notiz: {report.resolutionNote}</p>
        ) : null}

        {error ? <Alert tone="error">{error}</Alert> : null}

        <div className="grid gap-4 sm:grid-cols-[14rem_minmax(0,1fr)]">
          <Field label="Status" htmlFor={ids.status}>
            <NativeSelect value={status} onChange={(event) => setStatus(event.target.value as ReportStatus)} disabled={saving}>
              {(Object.keys(REPORT_STATUS) as ReportStatus[]).map((s) => (
                <option key={s} value={s}>
                  {REPORT_STATUS[s].label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Notiz" htmlFor={ids.note} optional hint="Intern, wird im Protokoll gespeichert.">
            <Textarea rows={3} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} disabled={saving} />
          </Field>
        </div>
        {quick ? (
          <ChoiceRow
            htmlFor={ids.quick}
            control={<Checkbox id={ids.quick} checked={applyQuick} onCheckedChange={(v) => setApplyQuick(v === true)} disabled={saving} />}
            label={quick.label}
            description="Die Notiz wird als Begründung verwendet und den Betroffenen mitgeteilt, wo vorgesehen."
          />
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={save} loading={saving} variant={applyQuick && quick ? "destructive" : "default"}>
            {applyQuick && quick ? "Massnahme umsetzen und speichern" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
