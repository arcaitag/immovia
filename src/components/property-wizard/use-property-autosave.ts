"use client";

import * as React from "react";
import { savePropertyFieldsAction } from "@/lib/properties/actions";
import {
  PROPERTY_FORM_FIELDS,
  propertyConsistencyIssues,
  propertyFieldsSchema,
  type PropertyFormField,
  type PropertyFormValues,
} from "@/lib/validation/property";
import type { PropertyForm } from "@/components/property-wizard/form-controls";

export type AutosaveStatus = "idle" | "pending" | "saving" | "saved" | "invalid" | "error";

export interface AutosaveState {
  status: AutosaveStatus;
  savedAt: string | null;
  message: string | null;
}

const DEBOUNCE_MS = 1500;

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b);
  return a === b;
}

/**
 * Automatisches Zwischenspeichern: 1.5 s nach der letzten Änderung werden nur die
 * geänderten und gültigen Felder gespeichert. Ungültige Felder bleiben markiert und
 * werden gespeichert, sobald sie korrigiert sind.
 */
export function usePropertyAutosave({
  form,
  propertyId,
  initialValues,
  onValuesChange,
}: {
  form: PropertyForm;
  propertyId: string;
  initialValues: PropertyFormValues;
  /** Wird bei jeder echten Wertänderung aufgerufen (z. B. für die Live-Vollständigkeit). */
  onValuesChange?: (values: PropertyFormValues) => void;
}) {
  const savedRef = React.useRef<PropertyFormValues>(initialValues);
  const snapshotRef = React.useRef<string>(JSON.stringify(initialValues));
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = React.useRef<Promise<boolean> | null>(null);
  const [state, setState] = React.useState<AutosaveState>({ status: "idle", savedAt: null, message: null });
  const notifyChange = React.useEffectEvent((values: PropertyFormValues) => {
    onValuesChange?.(values);
  });

  const changedFields = React.useCallback((): PropertyFormField[] => {
    const values = form.getValues();
    return PROPERTY_FORM_FIELDS.filter((key) => !sameValue(values[key], savedRef.current[key]));
  }, [form]);

  const runSave = React.useCallback(async (): Promise<boolean> => {
    const values = form.getValues();
    const changed = PROPERTY_FORM_FIELDS.filter((key) => !sameValue(values[key], savedRef.current[key]));
    if (changed.length === 0) {
      setState((s) => (s.status === "pending" || s.status === "saving" ? { ...s, status: s.savedAt ? "saved" : "idle" } : s));
      return true;
    }

    const invalid = new Set<string>();
    const parsed = propertyFieldsSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") invalid.add(key);
      }
    } else {
      for (const issue of propertyConsistencyIssues(parsed.data)) invalid.add(issue.field);
    }
    const toSave = changed.filter((key) => !invalid.has(key));
    const invalidChanged = changed.filter((key) => invalid.has(key));
    if (invalidChanged.length) void form.trigger(invalidChanged);

    if (toSave.length === 0) {
      setState((s) => ({ ...s, status: "invalid", message: "Bitte prüfen Sie die markierten Felder." }));
      return false;
    }

    setState((s) => ({ ...s, status: "saving", message: null }));
    const patch: Partial<Record<PropertyFormField, unknown>> = {};
    for (const key of toSave) patch[key] = values[key];

    const result = await savePropertyFieldsAction(propertyId, patch);
    if (result.ok) {
      const next = { ...savedRef.current };
      for (const key of toSave) (next as Record<string, unknown>)[key] = values[key];
      savedRef.current = next;
      const stillInvalid = invalidChanged.length > 0;
      setState({
        status: stillInvalid ? "invalid" : "saved",
        savedAt: result.data.savedAt,
        message: stillInvalid ? "Bitte prüfen Sie die markierten Felder." : null,
      });
      return !stillInvalid;
    }
    for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
      if (messages[0] && (PROPERTY_FORM_FIELDS as string[]).includes(field)) {
        form.setError(field as PropertyFormField, { type: "server", message: messages[0] });
      }
    }
    setState((s) => ({ ...s, status: "error", message: result.error }));
    return false;
  }, [form, propertyId]);

  /** Speichert sofort (z. B. vor dem Wechsel des Abschnitts oder Schritts). */
  const flush = React.useCallback(async (): Promise<boolean> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (runningRef.current) await runningRef.current;
    const run = runSave();
    runningRef.current = run;
    try {
      return await run;
    } finally {
      if (runningRef.current === run) runningRef.current = null;
    }
  }, [runSave]);

  const schedule = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState((s) => (s.status === "pending" || s.status === "saving" ? s : { ...s, status: "pending" }));
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void flush();
    }, DEBOUNCE_MS);
  }, [flush]);

  React.useEffect(() => {
    const unsubscribe = form.subscribe({
      formState: { values: true },
      callback: ({ values }) => {
        // Nur echte Wertänderungen (nicht Fehler- oder Fokuswechsel) lösen das Speichern aus
        const snapshot = JSON.stringify(values);
        if (snapshot === snapshotRef.current) return;
        snapshotRef.current = snapshot;
        notifyChange(values);
        schedule();
      },
    });
    return () => {
      unsubscribe();
      // Beim Verlassen der Seite noch ausstehende Änderungen speichern
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        void runSave();
      }
    };
  }, [form, schedule, runSave]);

  React.useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (timerRef.current || runningRef.current || changedFields().length > 0) {
        event.preventDefault();
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [changedFields]);

  return { state, flush, retry: flush };
}
