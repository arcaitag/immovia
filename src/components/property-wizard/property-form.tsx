"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, CircleDashed, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/sonner";
import { AutosaveIndicator } from "@/components/property-wizard/autosave-indicator";
import { usePropertyProgress } from "@/components/property-wizard/progress-context";
import {
  AddressSection,
  AmenitiesSection,
  AreasSection,
  AvailabilitySection,
  BuildingSection,
  ConditionSection,
  ObjectSection,
  ParkingSection,
  SpecialSection,
} from "@/components/property-wizard/property-form-sections";
import { RenovationsEditor, type RenovationItem } from "@/components/property-wizard/renovations-editor";
import { usePropertyAutosave } from "@/components/property-wizard/use-property-autosave";
import { AMENITY_FLAGS, type OfferType, type PropertyType } from "@/lib/constants";
import { computeCompleteness, COMPLETENESS_LABELS, completenessRules, type Completeness } from "@/lib/properties/completeness";
import {
  FIELD_LABELS,
  FORM_SECTIONS,
  fieldsHiddenAfterChange,
  sectionOf,
  visibleSections,
  type ConditionalField,
  type SectionKey,
} from "@/lib/properties/fields";
import { stepHref } from "@/lib/properties/steps";
import { setWizardStepAction } from "@/lib/properties/actions";
import { propertyFormSchema, type PropertyFieldsData, type PropertyFormValues } from "@/lib/validation/property";
import { cn } from "@/lib/utils";

type SectionState = "complete" | "partial" | "missing" | "neutral";

function sectionState(key: SectionKey, completeness: Completeness, values: Pick<PropertyFormValues, "property_type" | "offer_type">): SectionState {
  if (completeness.missingRequired.some((field) => sectionOf(field) === key)) return "missing";
  const rules = completenessRules(values.property_type, values.offer_type);
  const tracked = [...rules.required, ...rules.recommended].filter((field) => sectionOf(field) === key);
  if (tracked.length === 0) return "neutral";
  if (completeness.missingRecommended.some((field) => sectionOf(field) === key)) return "partial";
  return "complete";
}

function conditionalLabel(field: ConditionalField): string {
  if (field in FIELD_LABELS) return FIELD_LABELS[field as keyof typeof FIELD_LABELS];
  return AMENITY_FLAGS.find((flag) => flag.key === field)?.label ?? field;
}

function SectionIcon({ state, number }: { state: SectionState; number: number }) {
  if (state === "complete") {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-white" aria-hidden>
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    );
  }
  if (state === "partial") return <CircleDashed className="size-6 shrink-0 text-brand" aria-hidden />;
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold tabular",
        state === "missing" ? "border-warning text-warning" : "border-border text-muted-foreground",
      )}
      aria-hidden
    >
      {number}
    </span>
  );
}

const SECTION_STATE_TEXT: Record<SectionState, string> = {
  complete: "vollständig",
  partial: "Pflichtangaben vollständig",
  missing: "Pflichtangaben fehlen",
  neutral: "optional",
};

/**
 * Schritt 1: Erfassen. Abschnitte mit Zurück/Weiter, typabhängige Felder,
 * automatisches Zwischenspeichern und live berechnete Vollständigkeit.
 */
export function PropertyForm({
  propertyId,
  initialValues,
  initialSection,
  renovations,
}: {
  propertyId: string;
  initialValues: PropertyFormValues;
  initialSection: SectionKey | null;
  renovations: RenovationItem[];
}) {
  const router = useRouter();
  const progress = usePropertyProgress();
  const [navigating, startNavigation] = React.useTransition();
  const headingRef = React.useRef<HTMLHeadingElement | null>(null);
  const form = useForm<PropertyFormValues, unknown, PropertyFieldsData>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: initialValues,
    mode: "onTouched",
  });
  const [type, offer] = useWatch({ control: form.control, name: ["property_type", "offer_type"] });
  const [completeness, setCompleteness] = React.useState<Completeness>(() => computeCompleteness(initialValues));

  const { state: saveState, flush } = usePropertyAutosave({
    form,
    propertyId,
    initialValues,
    onValuesChange: (values) => {
      const next = computeCompleteness(values);
      setCompleteness((previous) =>
        previous.percent === next.percent &&
        previous.missingRequired.join() === next.missingRequired.join() &&
        previous.missingRecommended.join() === next.missingRecommended.join()
          ? previous
          : next,
      );
      progress?.setCompleteness(next);
    },
  });

  const sections = visibleSections(type);
  const first = sections[0] ?? FORM_SECTIONS[0];
  const [sectionKey, setSectionKey] = React.useState<SectionKey>(
    initialSection && sections.some((s) => s.key === initialSection) ? initialSection : first.key,
  );
  const current = sections.find((s) => s.key === sectionKey) ?? first;
  const index = sections.indexOf(current);
  const isLast = index === sections.length - 1;

  function goTo(key: SectionKey) {
    setSectionKey(key);
    const url = new URL(window.location.href);
    url.searchParams.set("abschnitt", key);
    window.history.replaceState(null, "", url.toString());
    requestAnimationFrame(() => {
      const heading = headingRef.current;
      if (!heading) return;
      if (heading.getBoundingClientRect().top < 80) heading.scrollIntoView({ block: "start", behavior: "smooth" });
      heading.focus({ preventScroll: true });
    });
    void flush();
  }

  function clearFields(fields: ConditionalField[]) {
    const values = form.getValues();
    const cleared: string[] = [];
    for (const field of fields) {
      const value = values[field];
      if (typeof value === "boolean") {
        if (value) {
          form.setValue(field, false, { shouldDirty: true });
          cleared.push(conditionalLabel(field));
        }
      } else if (typeof value === "string" && value.trim() !== "") {
        form.setValue(field, "", { shouldDirty: true });
        cleared.push(conditionalLabel(field));
      }
    }
    if (cleared.length) toast.info(`Nicht mehr passende Angaben entfernt: ${cleared.join(", ")}.`);
  }

  function changeType(next: PropertyType) {
    // property_type wurde bereits über das Auswahlfeld gesetzt; type stammt aus dem letzten Render
    if (next === type) return;
    clearFields(fieldsHiddenAfterChange({ type, offer }, { type: next, offer }));
    if (next === "new_build_project" && !form.getValues("condition")) {
      form.setValue("condition", "new_build", { shouldDirty: true });
    }
  }

  function changeOffer(next: OfferType) {
    if (next === offer) return;
    form.setValue("offer_type", next, { shouldDirty: true });
    clearFields(fieldsHiddenAfterChange({ type, offer }, { type, offer: next }));
  }

  function leave(target: string, step: number, message?: string) {
    startNavigation(async () => {
      const saved = await flush();
      if (!saved) {
        toast.error("Bitte prüfen Sie die markierten Felder. Ungültige Angaben werden nicht gespeichert.");
        return;
      }
      await setWizardStepAction(propertyId, step);
      if (message) toast.success(message);
      router.push(target);
    });
  }

  const sectionProps = { form, type, offer };
  let content: React.ReactNode;
  switch (current.key) {
    case "adresse":
      content = <AddressSection {...sectionProps} />;
      break;
    case "objekt":
      content = <ObjectSection {...sectionProps} onTypeChange={changeType} onOfferChange={changeOffer} />;
      break;
    case "flaechen":
      content = <AreasSection {...sectionProps} />;
      break;
    case "gebaeude":
      content = <BuildingSection {...sectionProps} />;
      break;
    case "zustand":
      content = <ConditionSection {...sectionProps} />;
      break;
    case "ausstattung":
      content = <AmenitiesSection {...sectionProps} />;
      break;
    case "parkplaetze":
      content = <ParkingSection {...sectionProps} />;
      break;
    case "verfuegbarkeit":
      content = <AvailabilitySection {...sectionProps} />;
      break;
    case "besonderheiten":
      content = <SpecialSection {...sectionProps} />;
      break;
    case "renovationen":
      content = <RenovationsEditor propertyId={propertyId} initial={renovations} />;
      break;
  }

  const missingHere = completeness.missingRequired.filter((field) => sectionOf(field) === current.key);

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void flush();
      }}
      className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start"
    >
      <aside className="hidden lg:sticky lg:top-24 lg:grid lg:gap-4">
        <nav aria-label="Abschnitte der Erfassung" className="rounded-2xl border border-border bg-card p-2 shadow-card">
          <ol className="grid gap-0.5">
            {sections.map((section, i) => {
              const state = sectionState(section.key, completeness, { property_type: type, offer_type: offer });
              const active = section.key === current.key;
              return (
                <li key={section.key}>
                  <button
                    type="button"
                    onClick={() => goTo(section.key)}
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors",
                      active ? "bg-mint-100 font-semibold text-forest" : "text-foreground/80 hover:bg-mint-50",
                    )}
                  >
                    <SectionIcon state={state} number={i + 1} />
                    <span className="min-w-0 flex-1 truncate">{section.label}</span>
                    <span className="sr-only">({SECTION_STATE_TEXT[state]})</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <AutosaveIndicator state={saveState} onRetry={() => void flush()} />
        </div>
      </aside>

      <div className="grid min-w-0 gap-4">
        <nav aria-label="Abschnitte der Erfassung" className="-mx-4 overflow-x-auto px-4 pb-1 lg:hidden">
          <ol className="flex gap-2">
            {sections.map((section, i) => {
              const state = sectionState(section.key, completeness, { property_type: type, offer_type: offer });
              const active = section.key === current.key;
              return (
                <li key={section.key} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => goTo(section.key)}
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-medium",
                      active ? "border-brand bg-mint-100 text-forest" : "border-border bg-card text-foreground/80",
                    )}
                  >
                    <SectionIcon state={state} number={i + 1} />
                    {section.label}
                    <span className="sr-only">({SECTION_STATE_TEXT[state]})</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <Card>
          <CardHeader className="gap-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-primary">
                Abschnitt {index + 1} von {sections.length}
              </span>
              <AutosaveIndicator state={saveState} onRetry={() => void flush()} className="lg:hidden" />
            </div>
            <Progress value={((index + 1) / sections.length) * 100} aria-label={`Abschnitt ${index + 1} von ${sections.length}`} />
            <h3 ref={headingRef} tabIndex={-1} className="pt-2 font-display text-xl font-bold outline-none">
              {current.label}
            </h3>
            <p className="text-sm text-muted-foreground">{current.description}</p>
            {missingHere.length ? (
              <p className="text-sm text-warning">
                Noch offen: {missingHere.map((field) => COMPLETENESS_LABELS[field]).join(", ")}
              </p>
            ) : null}
          </CardHeader>
          <CardContent>{content}</CardContent>
          <CardFooter className="flex-col-reverse items-stretch sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const previous = sections[index - 1];
                if (previous) goTo(previous.key);
              }}
              disabled={index === 0}
            >
              <ArrowLeft aria-hidden /> Zurück
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="ghost"
                disabled={navigating}
                onClick={() => leave("/dashboard/immobilien", 1, "Alles gespeichert. Sie können jederzeit hier weitermachen.")}
              >
                <Clock aria-hidden /> Später fortsetzen
              </Button>
              {isLast ? (
                <Button type="button" loading={navigating} onClick={() => leave(stepHref(propertyId, "bewertung"), 2)}>
                  Weiter zur Bewertung <ArrowRight aria-hidden />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => {
                    const next = sections[index + 1];
                    if (next) goTo(next.key);
                  }}
                >
                  Weiter <ArrowRight aria-hidden />
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
      </div>
    </form>
  );
}
