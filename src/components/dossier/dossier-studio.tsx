"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ExternalLink, FileText, ImageOff, RefreshCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { AiUnavailableNotice, type AvailabilityView } from "@/components/ai/ai-notice";
import { JobProgress } from "@/components/ai/job-progress";
import { useJob } from "@/components/ai/use-job";
import { createDossierAction } from "@/app/dashboard/immobilien/[id]/dossier/actions";
import {
  DOSSIER_SECTIONS,
  DOSSIER_SECTION_KEYS,
  dossierContactSchema,
  encodeDossierOptions,
  type DossierOptionsInput,
  type DossierSectionKey,
  type DossierTemplateId,
} from "@/lib/pdf/dossier/options";
import { cn } from "@/lib/utils";

export interface DossierImageOption {
  id: string;
  url: string | null;
  caption: string | null;
  isFloorPlan: boolean;
  isAiVisualization: boolean;
  isCover: boolean;
}

export interface DossierDefaults {
  title: string;
  intro: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  showsPhone: boolean;
  isPublished: boolean;
}

export interface DossierInitialOptions {
  templateId: DossierTemplateId;
  sections: Partial<Record<DossierSectionKey, boolean>>;
  excludedImageIds: string[];
  imageOrder: string[];
  title?: string;
  intro?: string;
  contact?: { name?: string; company?: string; phone?: string; email?: string };
}

type Contact = { name: string; company: string; phone: string; email: string };

function sortImages(images: DossierImageOption[], order: string[]): string[] {
  const position = new Map(order.map((id, index) => [id, index]));
  return [...images]
    .sort((a, b) => (position.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (position.get(b.id) ?? Number.MAX_SAFE_INTEGER))
    .map((img) => img.id);
}

/**
 * Verkaufsdossier zusammenstellen: Vorlage, Abschnitte, Bilder (Auswahl und Reihenfolge),
 * Titel, Einleitung und Kontakt. Sofortvorschau als PDF, «Dossier erstellen» speichert eine
 * neue Version als Hintergrundauftrag.
 */
export function DossierStudio({
  propertyId,
  templates,
  images,
  defaults,
  initial,
  availability,
}: {
  propertyId: string;
  templates: { id: DossierTemplateId; label: string; description: string }[];
  images: DossierImageOption[];
  defaults: DossierDefaults;
  initial: DossierInitialOptions | null;
  availability: AvailabilityView;
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = React.useState<DossierTemplateId>(initial?.templateId ?? templates[0]?.id ?? "modern");
  const [sections, setSections] = React.useState<Record<DossierSectionKey, boolean>>(
    () => Object.fromEntries(DOSSIER_SECTION_KEYS.map((key) => [key, initial?.sections[key] !== false])) as Record<DossierSectionKey, boolean>,
  );
  const [order, setOrder] = React.useState<string[]>(() => sortImages(images, initial?.imageOrder ?? []));
  const [excluded, setExcluded] = React.useState<Set<string>>(() => new Set(initial?.excludedImageIds ?? []));
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [intro, setIntro] = React.useState(initial?.intro ?? "");
  const [contact, setContact] = React.useState<Contact>({
    name: initial?.contact?.name ?? "",
    company: initial?.contact?.company ?? "",
    phone: initial?.contact?.phone ?? "",
    email: initial?.contact?.email ?? "",
  });
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [starting, startTransition] = React.useTransition();

  const imageById = React.useMemo(() => new Map(images.map((img) => [img.id, img])), [images]);
  const contactCheck = dossierContactSchema.safeParse(contact);
  const contactErrors = contactCheck.success ? {} : Object.fromEntries(contactCheck.error.issues.map((i) => [String(i.path[0]), i.message]));
  const overrideContact = Object.values(contact).some((value) => value.trim());

  const options: DossierOptionsInput = React.useMemo(
    () => ({
      templateId,
      sections: Object.fromEntries(DOSSIER_SECTION_KEYS.filter((key) => !sections[key]).map((key) => [key, false])),
      excludedImageIds: order.filter((id) => excluded.has(id)),
      imageOrder: order,
      title: title.trim() || undefined,
      intro: intro.trim() || undefined,
      contact: overrideContact
        ? { name: contact.name.trim(), company: contact.company.trim(), phone: contact.phone.trim(), email: contact.email.trim() }
        : undefined,
    }),
    [templateId, sections, order, excluded, title, intro, contact, overrideContact],
  );
  const encoded = React.useMemo(() => encodeDossierOptions(options), [options]);

  // Vorschau: per fetch geladen und als Blob-URL angezeigt (die Seite darf nicht direkt eingebettet
  // werden, X-Frame-Options: DENY). Aktualisiert wird beim Vorlagenwechsel und auf Knopfdruck.
  const [previewEncoded, setPreviewEncoded] = React.useState(encoded);
  const [preview, setPreview] = React.useState<{ url: string | null; loading: boolean; error: string | null; skipped: number }>({
    url: null,
    loading: true,
    error: null,
    skipped: 0,
  });
  const previewApiUrl = `/api/dossiers/preview?propertyId=${propertyId}&options=${previewEncoded}`;

  React.useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    setPreview((current) => ({ ...current, loading: true, error: null }));
    fetch(previewApiUrl, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Die Vorschau konnte nicht erstellt werden.");
        }
        const skipped = Number(response.headers.get("X-Skipped-Images") ?? "0") || 0;
        objectUrl = URL.createObjectURL(await response.blob());
        setPreview({ url: objectUrl, loading: false, error: null, skipped });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setPreview((current) => ({ ...current, loading: false, error: error instanceof Error ? error.message : "Die Vorschau konnte nicht erstellt werden." }));
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [previewApiUrl]);

  const job = useJob(jobId, {
    onSuccess: (finished) => {
      const result = finished.result as { version?: number; skippedImages?: number } | null;
      setJobId(null);
      toast.success(result?.version ? `Version ${result.version} des Dossiers ist erstellt.` : "Das Dossier ist erstellt.");
      if (result?.skippedImages) toast.warning(`${result.skippedImages} Bild(er) konnten nicht geladen werden und fehlen im Dossier.`);
      router.refresh();
    },
    onError: (failed) => {
      setJobId(null);
      toast.error(failed.error ?? "Das Dossier konnte nicht erstellt werden.");
      router.refresh();
    },
  });

  function chooseTemplate(value: DossierTemplateId) {
    setTemplateId(value);
    // Vorlagenwechsel sofort in der Vorschau zeigen
    setPreviewEncoded(encodeDossierOptions({ ...options, templateId: value }));
  }

  function move(id: string, delta: -1 | 1) {
    setOrder((current) => {
      const index = current.indexOf(id);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target] as string, next[index] as string];
      return next;
    });
  }

  function toggleImage(id: string, include: boolean) {
    setExcluded((current) => {
      const next = new Set(current);
      if (include) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function create() {
    if (!contactCheck.success) {
      toast.error("Bitte prüfen Sie die Kontaktangaben.");
      return;
    }
    startTransition(async () => {
      const res = await createDossierAction(propertyId, options);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setJobId(res.data.jobId);
    });
  }

  const previewOutdated = previewEncoded !== encoded;
  const includedCount = order.filter((id) => !excluded.has(id)).length;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="grid content-start gap-6">
        <fieldset className="grid gap-3">
          <legend className="mb-2 font-display text-base font-bold">Vorlage</legend>
          <RadioGroup value={templateId} onValueChange={(value) => chooseTemplate(value as DossierTemplateId)} aria-label="Vorlage" className="grid gap-2">
            {templates.map((template) => (
              <RadioCard key={template.id} value={template.id} className="min-h-0 flex-col items-start gap-0.5 py-3">
                <span>{template.label}</span>
                <span className="text-xs font-normal text-muted-foreground">{template.description}</span>
              </RadioCard>
            ))}
          </RadioGroup>
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="mb-2 font-display text-base font-bold">Inhalte</legend>
          <ul className="grid gap-2">
            {DOSSIER_SECTION_KEYS.map((key) => {
              const id = `dossier-section-${key}`;
              const disabled = key === "qrCode" && !defaults.isPublished;
              return (
                <li key={key} className="flex items-start gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
                  <Checkbox
                    id={id}
                    checked={sections[key] && !disabled}
                    disabled={disabled}
                    onCheckedChange={(checked) => setSections((current) => ({ ...current, [key]: checked === true }))}
                    className="mt-0.5"
                  />
                  <Label htmlFor={id} className="grid cursor-pointer gap-0.5 font-normal">
                    <span className="font-semibold">{DOSSIER_SECTIONS[key].label}</span>
                    <span className="text-xs text-muted-foreground">
                      {disabled ? "Erst verfügbar, wenn das Inserat veröffentlicht ist." : DOSSIER_SECTIONS[key].description}
                    </span>
                  </Label>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">Abschnitte ohne erfasste Angaben erscheinen nicht im Dossier – es wird nichts ergänzt.</p>
        </fieldset>

        <fieldset className="grid gap-4">
          <legend className="mb-2 font-display text-base font-bold">Titel und Einleitung</legend>
          <Field label="Titel" htmlFor="dossier-title" hint={defaults.title ? `Leer lassen für den Inseratetitel: «${defaults.title}»` : "Leer lassen für einen Titel aus Objektart und Ort."}>
            <Input id="dossier-title" value={title} maxLength={140} onChange={(event) => setTitle(event.target.value)} placeholder={defaults.title || undefined} />
          </Field>
          <Field label="Einleitung" htmlFor="dossier-intro" hint="Leer lassen für die Kurzbeschreibung aus dem Inserat.">
            <Textarea id="dossier-intro" value={intro} maxLength={1200} rows={4} onChange={(event) => setIntro(event.target.value)} placeholder={defaults.intro || undefined} />
          </Field>
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="mb-2 font-display text-base font-bold">Bilder ({includedCount} von {order.length})</legend>
          {order.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Bilder vorhanden. Das Dossier wird ohne Fotos erstellt.</p>
          ) : (
            <ol className="grid gap-2">
              {order.map((id, index) => {
                const image = imageById.get(id);
                if (!image) return null;
                const included = !excluded.has(id);
                const checkboxId = `dossier-image-${id}`;
                return (
                  <li key={id} className={cn("flex items-center gap-3 rounded-xl border border-border bg-card p-2", !included && "opacity-60")}>
                    <Checkbox id={checkboxId} checked={included} onCheckedChange={(checked) => toggleImage(id, checked === true)} aria-label="Im Dossier verwenden" />
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {image.url ? (
                        <Image src={image.url} alt="" fill sizes="56px" className="object-cover" />
                      ) : (
                        <ImageOff className="m-auto mt-4 size-5 text-muted-foreground" aria-hidden />
                      )}
                    </div>
                    <label htmlFor={checkboxId} className="grid min-w-0 flex-1 cursor-pointer gap-1 text-sm">
                      <span className="truncate font-medium">{image.caption?.trim() || `Bild ${index + 1}`}</span>
                      <span className="flex flex-wrap gap-1">
                        {image.isCover ? <Badge tone="green">Titelbild</Badge> : null}
                        {image.isFloorPlan ? <Badge tone="blue">Grundriss</Badge> : null}
                        {image.isAiVisualization ? (
                          <Badge tone="amber">
                            <Sparkles aria-hidden /> KI-Visualisierung
                          </Badge>
                        ) : null}
                      </span>
                    </label>
                    <div className="flex shrink-0 gap-1">
                      <Button size="icon-sm" variant="ghost" onClick={() => move(id, -1)} disabled={index === 0} aria-label="Nach oben verschieben">
                        <ArrowUp aria-hidden />
                      </Button>
                      <Button size="icon-sm" variant="ghost" onClick={() => move(id, 1)} disabled={index === order.length - 1} aria-label="Nach unten verschieben">
                        <ArrowDown aria-hidden />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="text-xs text-muted-foreground">
            Das erste Foto (bzw. das Titelbild) erscheint auf dem Deckblatt. KI-Visualisierungen sind im Dossier sichtbar gekennzeichnet.
          </p>
        </fieldset>

        <fieldset className="grid gap-4">
          <legend className="mb-2 font-display text-base font-bold">Ansprechpartner</legend>
          <p className="-mt-2 text-sm text-muted-foreground">
            Leer lassen für den Kontakt aus dem Inserat
            {defaults.contactName ? ` (${[defaults.contactName, defaults.showsPhone ? defaults.contactPhone : null, defaults.contactEmail].filter(Boolean).join(", ")})` : ""}.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="dossier-contact-name">
              <Input id="dossier-contact-name" value={contact.name} maxLength={120} onChange={(event) => setContact((c) => ({ ...c, name: event.target.value }))} />
            </Field>
            <Field label="Firma" htmlFor="dossier-contact-company" optional>
              <Input id="dossier-contact-company" value={contact.company} maxLength={120} onChange={(event) => setContact((c) => ({ ...c, company: event.target.value }))} />
            </Field>
            <Field label="Telefon" htmlFor="dossier-contact-phone" error={contactErrors.phone}>
              <Input id="dossier-contact-phone" type="tel" value={contact.phone} maxLength={30} onChange={(event) => setContact((c) => ({ ...c, phone: event.target.value }))} />
            </Field>
            <Field label="E-Mail" htmlFor="dossier-contact-email" error={contactErrors.email}>
              <Input id="dossier-contact-email" type="email" value={contact.email} maxLength={200} onChange={(event) => setContact((c) => ({ ...c, email: event.target.value }))} />
            </Field>
          </div>
        </fieldset>

        <div className="grid gap-3 rounded-2xl border border-border bg-surface p-4">
          <Button onClick={create} loading={starting || job.running} disabled={!availability.available || !contactCheck.success} size="lg">
            <FileText aria-hidden /> Dossier erstellen
          </Button>
          <p className="text-xs text-muted-foreground">Speichert eine neue Version als PDF. Frühere Versionen bleiben erhalten.</p>
          <AiUnavailableNotice availability={availability} />
          <JobProgress job={job.job} running={job.running} label="Das Dossier wird erstellt (Bilder werden in Druckqualität eingebettet)" />
        </div>
      </div>

      <section aria-labelledby="dossier-preview-title" className="grid content-start gap-3 xl:sticky xl:top-24">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="dossier-preview-title" className="font-display text-base font-bold">
            Vorschau
          </h3>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={previewOutdated ? "default" : "outline"} onClick={() => setPreviewEncoded(encoded)} disabled={preview.loading && !previewOutdated}>
              <RefreshCcw aria-hidden /> Vorschau aktualisieren
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={`/api/dossiers/preview?propertyId=${propertyId}&options=${encoded}`} target="_blank" rel="noopener">
                <ExternalLink aria-hidden /> In neuem Tab öffnen
              </a>
            </Button>
          </div>
        </div>
        {previewOutdated ? <p className="text-xs font-medium text-warning">Ihre Änderungen sind noch nicht in der Vorschau.</p> : null}
        {preview.skipped > 0 ? (
          <p className="text-xs text-muted-foreground">{preview.skipped} Bild(er) konnten nicht geladen werden und fehlen in der Vorschau.</p>
        ) : null}
        <div className="relative aspect-[1/1.414] w-full overflow-hidden rounded-2xl border border-border bg-muted">
          {preview.url ? <iframe src={preview.url} title="Vorschau des Verkaufsdossiers (PDF)" className="size-full" /> : null}
          {preview.loading ? (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-card/70 text-sm text-muted-foreground">
              <Spinner label="Vorschau wird erstellt" /> <span aria-hidden>Vorschau wird erstellt …</span>
            </div>
          ) : null}
          {preview.error && !preview.loading ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-destructive" role="alert">
              {preview.error}
            </div>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Die Vorschau ist mit «Vorschau – nicht zur Weitergabe» gekennzeichnet und enthält weniger Bilder in reduzierter Qualität.
        </p>
      </section>
    </div>
  );
}
