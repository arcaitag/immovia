"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { useAdminAction } from "@/components/admin/action-dialog";
import { updateSettingAction } from "@/app/admin/actions";
import { settingInputSchemas, type SettingKey } from "@/lib/validation/admin";

export type SettingField =
  | { kind: "text"; name: string; label: string; hint?: string; type?: "text" | "email" | "tel"; required?: boolean }
  | { kind: "textarea"; name: string; label: string; hint?: string; rows?: number; required?: boolean }
  | { kind: "number"; name: string; label: string; hint?: string; step?: string; min?: number; max?: number }
  | { kind: "switch"; name: string; label: string; description?: string };

type FormValues = Record<string, string | boolean>;

function toFormValues(values: Record<string, unknown>, fields: SettingField[]): FormValues {
  const result: FormValues = {};
  for (const field of fields) {
    const value = values[field.name];
    if (field.kind === "switch") result[field.name] = value === true;
    else result[field.name] = value === null || value === undefined ? "" : String(value);
  }
  return result;
}

/**
 * Formular für einen Abschnitt von feature_settings. Validiert im Browser mit
 * demselben Zod-Schema wie der Server und speichert über admin_update_setting.
 */
export function SettingsSectionForm({
  settingKey,
  initialValues,
  fields,
  notice,
  columns = 1,
}: {
  settingKey: SettingKey;
  initialValues: Record<string, unknown>;
  fields: SettingField[];
  notice?: React.ReactNode;
  columns?: 1 | 2;
}) {
  const [values, setValues] = React.useState<FormValues>(() => toFormValues(initialValues, fields));
  const [saved, setSaved] = React.useState<FormValues>(values);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const { pending, run } = useAdminAction();
  const baseId = React.useId();
  const dirty = fields.some((field) => values[field.name] !== saved[field.name]);

  function update(name: string, value: string | boolean) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!(name in current)) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  function collectErrors(fieldErrors: Record<string, string[] | undefined> | undefined) {
    const next: Record<string, string> = {};
    for (const [key, messages] of Object.entries(fieldErrors ?? {})) {
      if (messages?.[0]) next[key] = messages[0];
    }
    return next;
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const parsed = settingInputSchemas[settingKey].safeParse(values);
    if (!parsed.success) {
      setErrors(collectErrors(parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>));
      return;
    }
    const snapshot = values;
    run(() => updateSettingAction({ key: settingKey, value: values }), {
      onSuccess: () => {
        setSaved(snapshot);
        setErrors({});
      },
      onError: (res) => {
        const fieldErrors = collectErrors(res.fieldErrors);
        setErrors(fieldErrors);
        if (Object.keys(fieldErrors).length === 0) setFormError(res.error);
      },
    });
  }

  const switches = fields.filter((field) => field.kind === "switch");
  const inputs = fields.filter((field) => field.kind !== "switch");

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      {notice}
      {switches.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {switches.map((field) => {
            const id = `${baseId}-${field.name}`;
            return (
              <li key={field.name} className="flex items-start justify-between gap-4 px-4 py-3.5">
                <div className="grid gap-1">
                  <Label htmlFor={id} className="cursor-pointer">
                    {field.label}
                  </Label>
                  {field.kind === "switch" && field.description ? (
                    <p id={`${id}-hint`} className="text-xs leading-relaxed text-muted-foreground">
                      {field.description}
                    </p>
                  ) : null}
                </div>
                <Switch
                  id={id}
                  aria-describedby={field.kind === "switch" && field.description ? `${id}-hint` : undefined}
                  checked={values[field.name] === true}
                  onCheckedChange={(checked) => update(field.name, checked)}
                  disabled={pending}
                  className="mt-0.5"
                />
              </li>
            );
          })}
        </ul>
      ) : null}
      {inputs.length > 0 ? (
        <div className={columns === 2 ? "grid gap-5 sm:grid-cols-2" : "grid gap-5"}>
          {inputs.map((field) => {
            const id = `${baseId}-${field.name}`;
            const value = String(values[field.name] ?? "");
            if (field.kind === "textarea") {
              return (
                <Field key={field.name} label={field.label} htmlFor={id} hint={field.hint} error={errors[field.name]} required={field.required} className={columns === 2 ? "sm:col-span-2" : undefined}>
                  <Textarea rows={field.rows ?? 3} value={value} onChange={(event) => update(field.name, event.target.value)} disabled={pending} />
                </Field>
              );
            }
            if (field.kind === "number") {
              return (
                <Field key={field.name} label={field.label} htmlFor={id} hint={field.hint} error={errors[field.name]}>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step={field.step ?? "1"}
                    min={field.min}
                    max={field.max}
                    value={value}
                    onChange={(event) => update(field.name, event.target.value)}
                    disabled={pending}
                  />
                </Field>
              );
            }
            if (field.kind === "text") {
              return (
                <Field key={field.name} label={field.label} htmlFor={id} hint={field.hint} error={errors[field.name]} required={field.required}>
                  <Input type={field.type ?? "text"} value={value} onChange={(event) => update(field.name, event.target.value)} disabled={pending} />
                </Field>
              );
            }
            return null;
          })}
        </div>
      ) : null}
      <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
        {dirty ? <span className="text-xs text-muted-foreground">Ungespeicherte Änderungen</span> : null}
        <Button type="submit" loading={pending} disabled={!dirty}>
          Speichern
        </Button>
      </div>
    </form>
  );
}
