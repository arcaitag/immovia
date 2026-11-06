"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleDot, PenLine, RefreshCcw, RotateCcw, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
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
import { AiUnavailableNotice, QuotaHint, type AvailabilityView } from "@/components/ai/ai-notice";
import { AiConsentDialog, useAiConsent } from "@/components/ai/consent-dialog";
import { JobProgress } from "@/components/ai/job-progress";
import { useJob } from "@/components/ai/use-job";
import {
  applyDescriptionSectionAction,
  requestDescriptionAction,
} from "@/app/dashboard/immobilien/[id]/beschreibung/actions";
import { DESCRIPTION_STYLES, type DescriptionStyle } from "@/lib/constants";
import { DESCRIPTION_SECTIONS, DESCRIPTION_SECTION_KEYS, type DescriptionSectionKey } from "@/lib/ai/prompts/description";
import { normalizeForCompare } from "@/lib/ai/swiss";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type SectionValue = string | string[];

export interface DescriptionVersionView {
  id: string;
  style: DescriptionStyle;
  createdAt: string;
  model: string | null;
  content: Record<DescriptionSectionKey, SectionValue>;
  rephrasedSection: DescriptionSectionKey | null;
}

type Drafts = Record<DescriptionSectionKey, string>;

const STYLE_KEYS = Object.keys(DESCRIPTION_STYLES) as DescriptionStyle[];

function toDraft(value: SectionValue | null | undefined): string {
  if (Array.isArray(value)) return value.join("\n");
  return value ?? "";
}

function toLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

function compareKey(section: DescriptionSectionKey, value: SectionValue | null | undefined): string {
  if (section === "highlights") {
    const items = Array.isArray(value) ? value : toLines(value ?? "");
    return items.map((item) => normalizeForCompare(item)).filter(Boolean).join("\n");
  }
  return normalizeForCompare(Array.isArray(value) ? value.join("\n") : value);
}

function draftsFrom(content: DescriptionVersionView["content"] | null): Drafts {
  return Object.fromEntries(DESCRIPTION_SECTION_KEYS.map((key) => [key, toDraft(content?.[key])])) as Drafts;
}

/**
 * KI-Inseratetexte: Stil wählen, Texte erstellen, je Abschnitt bearbeiten, neu formulieren
 * und ins Inserat übernehmen (mit Rückfrage, bevor ein eigener Text ersetzt wird).
 */
export function DescriptionStudio({
  propertyId,
  availability,
  version,
  listingTexts,
}: {
  propertyId: string;
  availability: AvailabilityView;
  version: DescriptionVersionView | null;
  listingTexts: Record<DescriptionSectionKey, SectionValue | null>;
}) {
  const router = useRouter();
  const consent = useAiConsent(Boolean(availability.consentRequired));
  const [style, setStyle] = React.useState<DescriptionStyle>(version?.style ?? "modern");
  const [drafts, setDrafts] = React.useState<Drafts>(() => draftsFrom(version?.content ?? null));
  const [aiTexts, setAiTexts] = React.useState<Drafts>(() => draftsFrom(version?.content ?? null));
  // Version, aus der ein Abschnitt stammt (neu formulierte Abschnitte sind eigene Versionen)
  const [sources, setSources] = React.useState<Partial<Record<DescriptionSectionKey, string>>>({});
  const [generateJobId, setGenerateJobId] = React.useState<string | null>(null);
  const [rephrase, setRephrase] = React.useState<{ section: DescriptionSectionKey; jobId: string } | null>(null);
  const [applying, setApplying] = React.useState<DescriptionSectionKey | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = React.useState<{ section: DescriptionSectionKey; current: SectionValue } | null>(null);
  const [starting, startTransition] = React.useTransition();

  const generateJob = useJob(generateJobId, {
    onSuccess: (job) => {
      const result = job.result as { descriptionId?: string } | null;
      setGenerateJobId(null);
      toast.success("Die Texte sind erstellt. Bitte prüfen Sie jeden Abschnitt vor der Übernahme.");
      if (result?.descriptionId) {
        router.replace(`/dashboard/immobilien/${propertyId}/beschreibung?version=${result.descriptionId}`, { scroll: false });
      }
      router.refresh();
    },
    onError: (job) => {
      setGenerateJobId(null);
      if (job.consentRequired) consent.requestConsent(generate);
      else toast.error(job.error ?? "Die Texte konnten nicht erstellt werden.");
    },
  });

  const rephraseJob = useJob(rephrase?.jobId ?? null, {
    onSuccess: (job) => {
      const result = job.result as { descriptionId?: string; section?: DescriptionSectionKey; value?: SectionValue | null } | null;
      const section = result?.section ?? rephrase?.section;
      if (section && result?.value !== undefined && result.value !== null) {
        const text = toDraft(result.value);
        setDrafts((current) => ({ ...current, [section]: text }));
        setAiTexts((current) => ({ ...current, [section]: text }));
        if (result.descriptionId) setSources((current) => ({ ...current, [section]: result.descriptionId }));
        toast.success(`«${DESCRIPTION_SECTIONS[section].label}» wurde neu formuliert.`);
      }
      setRephrase(null);
      router.refresh();
    },
    onError: (job) => {
      const section = rephrase?.section;
      setRephrase(null);
      if (job.consentRequired && section) consent.requestConsent(() => startRephrase(section));
      else toast.error(job.error ?? "Der Abschnitt konnte nicht neu formuliert werden.");
    },
  });

  const busy = starting || generateJob.running || rephraseJob.running;
  const aiBlocked = !availability.available;

  function generate() {
    consent.guard(() => {
      startTransition(async () => {
        const res = await requestDescriptionAction({ propertyId, style, mode: "full" });
        if (!res.ok) {
          if (res.consentRequired) consent.requestConsent(generate);
          else toast.error(res.error);
          return;
        }
        setGenerateJobId(res.data.jobId);
      });
    });
  }

  function startRephrase(section: DescriptionSectionKey) {
    if (!version) return;
    consent.guard(() => {
      startTransition(async () => {
        const draft = drafts[section];
        const res = await requestDescriptionAction({
          propertyId,
          style,
          mode: "rephrase",
          section,
          baseVersionId: sources[section] ?? version.id,
          ...(section === "highlights" ? { currentItems: toLines(draft).slice(0, 12) } : { currentText: draft.slice(0, 12000) }),
        });
        if (!res.ok) {
          if (res.consentRequired) consent.requestConsent(() => startRephrase(section));
          else toast.error(res.error);
          return;
        }
        setRephrase({ section, jobId: res.data.jobId });
      });
    });
  }

  async function apply(section: DescriptionSectionKey, overwrite = false) {
    if (!version) return;
    setApplying(section);
    try {
      const draft = drafts[section];
      const res = await applyDescriptionSectionAction({
        propertyId,
        descriptionId: sources[section] ?? version.id,
        section,
        value: section === "highlights" ? toLines(draft) : draft,
        confirmOverwrite: overwrite,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data.needsConfirmation) {
        setConfirmOverwrite({ section, current: res.data.currentValue ?? "" });
        return;
      }
      toast.success(`«${DESCRIPTION_SECTIONS[section].label}» ist im Inserat.`);
      router.refresh();
    } finally {
      setApplying(null);
    }
  }

  return (
    <div className="grid gap-6">
      <section aria-labelledby="ai-style-title" className="grid gap-4 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-mint-100 text-forest">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <div>
              <h3 id="ai-style-title" className="font-display text-lg font-bold">
                {version ? "Neue Texte erstellen" : "Texte mit KI erstellen"}
              </h3>
              <p className="text-sm text-muted-foreground">
                Die KI schreibt ausschliesslich aus Ihren erfassten Angaben – ohne erfundene Ausstattung, Renovationen oder Lagevorteile. Sie
                entscheiden für jeden Abschnitt, ob er ins Inserat kommt.
              </p>
            </div>
          </div>
          <Button onClick={generate} loading={starting && !rephrase} disabled={busy || aiBlocked} className="shrink-0">
            <Sparkles aria-hidden /> {version ? "Neu erstellen" : "Texte erstellen"}
          </Button>
        </div>

        <RadioGroup
          value={style}
          onValueChange={(value) => setStyle(value as DescriptionStyle)}
          aria-label="Schreibstil"
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"
        >
          {STYLE_KEYS.map((key) => (
            <RadioCard key={key} value={key} className="min-h-0 flex-col items-start gap-0.5 py-3" disabled={busy}>
              <span>{DESCRIPTION_STYLES[key].label}</span>
              <span className="text-xs font-normal text-muted-foreground">{DESCRIPTION_STYLES[key].description}</span>
            </RadioCard>
          ))}
        </RadioGroup>

        <AiUnavailableNotice availability={availability} />
        {availability.available ? <QuotaHint quota={availability.quota} /> : null}
        <JobProgress job={generateJob.job} running={generateJob.running} label="Die Texte werden erstellt (dauert meist unter einer Minute)" />
      </section>

      {version ? (
        <section aria-labelledby="ai-texts-title" className="grid gap-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 id="ai-texts-title" className="font-display text-lg font-bold">
                Texte prüfen und übernehmen
              </h3>
              <p className="text-sm text-muted-foreground">
                Stil «{DESCRIPTION_STYLES[version.style].label}», erstellt am {formatDateTime(version.createdAt)}
                {version.model ? ` mit KI (${version.model})` : " mit KI"}. KI-Texte können Fehler enthalten – bitte prüfen Sie jeden Abschnitt.
              </p>
            </div>
          </div>

          {DESCRIPTION_SECTION_KEYS.map((section) => {
            const meta = DESCRIPTION_SECTIONS[section];
            const draft = drafts[section];
            const listingValue = listingTexts[section];
            const listingKey = compareKey(section, listingValue);
            const draftKey = compareKey(section, draft);
            const inListing = Boolean(listingKey) && listingKey === draftKey;
            const differs = Boolean(listingKey) && listingKey !== draftKey;
            const length = section === "highlights" ? toLines(draft).length : draft.length;
            const tooLong = length > meta.max;
            const isRephrasing = rephrase?.section === section;
            const changedFromAi = draft !== aiTexts[section];
            const fieldId = `ai-${section}`;
            return (
              <div key={section} className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor={fieldId} className="text-[0.9375rem] font-semibold">
                    {meta.label}
                  </Label>
                  {inListing ? (
                    <Badge tone="green">
                      <CircleCheck aria-hidden /> Im Inserat
                    </Badge>
                  ) : differs ? (
                    <Badge tone="amber">
                      <CircleDot aria-hidden /> Inserat hat einen anderen Text
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Im Inserat noch leer</Badge>
                  )}
                </div>
                {!aiTexts[section].trim() && !draft.trim() ? (
                  <p className="text-sm text-muted-foreground">
                    {section === "location"
                      ? "Die KI hat keinen Lagetext erstellt, weil ausser dem Ort keine Lageangaben erfasst sind. Sie können selbst einen Text schreiben."
                      : "Für diesen Abschnitt liegen zu wenige Angaben vor. Sie können selbst einen Text schreiben."}
                  </p>
                ) : null}
                <Textarea
                  id={fieldId}
                  value={draft}
                  rows={meta.rows}
                  onChange={(event) => setDrafts((current) => ({ ...current, [section]: event.target.value }))}
                  aria-describedby={`${fieldId}-hint`}
                  aria-invalid={tooLong || undefined}
                  disabled={isRephrasing}
                  className="leading-relaxed"
                />
                <p id={`${fieldId}-hint`} className={cn("text-xs", tooLong ? "font-medium text-destructive" : "text-muted-foreground")}>
                  {meta.hint} {section === "highlights" ? `${length} von höchstens 12 Einträgen.` : `${length} / ${meta.max} Zeichen.`}
                </p>
                {differs && listingValue ? (
                  <details className="rounded-xl bg-surface px-3 py-2 text-sm">
                    <summary className="cursor-pointer font-medium text-muted-foreground">Aktuellen Text im Inserat anzeigen</summary>
                    <p className="mt-2 whitespace-pre-line text-foreground">{toDraft(listingValue)}</p>
                  </details>
                ) : null}
                {isRephrasing ? <JobProgress job={rephraseJob.job} running={rephraseJob.running} label="Abschnitt wird neu formuliert" /> : null}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => apply(section)} loading={applying === section} disabled={tooLong || busy || applying !== null || inListing}>
                    <Upload aria-hidden /> Ins Inserat übernehmen
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => startRephrase(section)} disabled={busy || aiBlocked || applying !== null}>
                    <RefreshCcw aria-hidden /> Text neu formulieren
                  </Button>
                  {changedFromAi ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDrafts((current) => ({ ...current, [section]: aiTexts[section] }))}
                      disabled={busy}
                    >
                      <RotateCcw aria-hidden /> KI-Text wiederherstellen
                    </Button>
                  ) : null}
                  {changedFromAi ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <PenLine className="size-3.5" aria-hidden /> von Ihnen bearbeitet
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      <AlertDialog open={confirmOverwrite !== null} onOpenChange={(open) => (!open ? setConfirmOverwrite(null) : undefined)}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Bestehenden Text ersetzen?</AlertDialogTitle>
            <AlertDialogDescription>
              Im Inserat steht bei «{confirmOverwrite ? DESCRIPTION_SECTIONS[confirmOverwrite.section].label : ""}» ein Text, der nicht von der KI
              stammt oder nachträglich bearbeitet wurde. Er wird durch den neuen Text ersetzt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmOverwrite ? (
            <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-surface p-3 text-sm whitespace-pre-line">
              {toDraft(confirmOverwrite.current) || "–"}
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const pending = confirmOverwrite;
                setConfirmOverwrite(null);
                if (pending) void apply(pending.section, true);
              }}
            >
              Ersetzen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AiConsentDialog {...consent.dialogProps} />
    </div>
  );
}
