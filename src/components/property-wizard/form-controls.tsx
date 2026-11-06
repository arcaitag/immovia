"use client";

import * as React from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import { Info } from "lucide-react";
import { ChoiceRow, Field } from "@/components/ui/field";
import { Input, InputGroup, Textarea } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import type { PropertyFieldsData, PropertyFormValues } from "@/lib/validation/property";
import { cn } from "@/lib/utils";

export type PropertyForm = UseFormReturn<PropertyFormValues, unknown, PropertyFieldsData>;

type FieldsOfType<T> = {
  [K in keyof PropertyFormValues]-?: PropertyFormValues[K] extends T ? K : never;
}[keyof PropertyFormValues];

export type StringField = FieldsOfType<string>;
export type BooleanField = FieldsOfType<boolean>;

function errorOf(form: PropertyForm, name: keyof PropertyFormValues): string | undefined {
  const error = form.formState.errors[name];
  return error && "message" in error && typeof error.message === "string" ? error.message : undefined;
}

/** Erklärung in einem Popover («Was ist das?»). */
export function InfoTip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-mint-50 hover:text-forest"
          aria-label={`Erklärung: ${title}`}
        >
          <Info className="size-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-sm leading-relaxed">
        <p className="mb-1 font-semibold text-foreground">{title}</p>
        <div className="text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

function LabelWithInfo({ label, info }: { label: string; info?: { title: string; text: React.ReactNode } }) {
  if (!info) return <>{label}</>;
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <InfoTip title={info.title}>{info.text}</InfoTip>
    </span>
  );
}

export function TextField({
  form,
  name,
  label,
  hint,
  info,
  required,
  optional,
  prefix,
  suffix,
  inputMode,
  placeholder,
  maxLength,
  className,
  type,
  disabled,
  onValueChange,
}: {
  form: PropertyForm;
  name: StringField;
  label: string;
  hint?: React.ReactNode;
  info?: { title: string; text: React.ReactNode };
  required?: boolean;
  optional?: boolean;
  prefix?: string;
  suffix?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder?: string;
  maxLength?: number;
  className?: string;
  type?: "text" | "date";
  disabled?: boolean;
  onValueChange?: (value: string) => void;
}) {
  const id = `feld-${name}`;
  const registration = form.register(name, {
    onChange: onValueChange ? (event: React.ChangeEvent<HTMLInputElement>) => onValueChange(event.target.value) : undefined,
  });
  return (
    <Field
      label={<LabelWithInfo label={label} info={info} />}
      htmlFor={id}
      hint={hint}
      error={errorOf(form, name)}
      required={required}
      optional={optional}
      className={className}
    >
      {prefix || suffix ? (
        <InputGroup
          {...registration}
          prefix={prefix}
          suffix={suffix}
          inputMode={inputMode}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          autoComplete="off"
        />
      ) : (
        <Input
          {...registration}
          type={type ?? "text"}
          inputMode={inputMode}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          autoComplete="off"
        />
      )}
    </Field>
  );
}

export function TextAreaField({
  form,
  name,
  label,
  hint,
  maxLength,
  rows = 4,
  placeholder,
}: {
  form: PropertyForm;
  name: StringField;
  label: string;
  hint?: React.ReactNode;
  maxLength: number;
  rows?: number;
  placeholder?: string;
}) {
  const id = `feld-${name}`;
  return (
    <Field label={label} htmlFor={id} hint={hint} error={errorOf(form, name)} optional>
      <Textarea {...form.register(name)} rows={rows} maxLength={maxLength} placeholder={placeholder} />
    </Field>
  );
}

export function SelectField({
  form,
  name,
  label,
  options,
  placeholder = "Bitte wählen",
  hint,
  info,
  required,
  optional,
  className,
  onValueChange,
}: {
  form: PropertyForm;
  name: StringField;
  label: string;
  options: { value: string; label: string }[];
  placeholder?: string | null;
  hint?: React.ReactNode;
  info?: { title: string; text: React.ReactNode };
  required?: boolean;
  optional?: boolean;
  className?: string;
  onValueChange?: (value: string) => void;
}) {
  const id = `feld-${name}`;
  const registration = form.register(name, {
    onChange: onValueChange ? (event: React.ChangeEvent<HTMLSelectElement>) => onValueChange(event.target.value) : undefined,
  });
  return (
    <Field
      label={<LabelWithInfo label={label} info={info} />}
      htmlFor={id}
      hint={hint}
      error={errorOf(form, name)}
      required={required}
      optional={optional}
      className={className}
    >
      <NativeSelect {...registration}>
        {placeholder !== null ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
}

export function SwitchField({
  form,
  name,
  label,
  description,
  className,
  onCheckedChange,
}: {
  form: PropertyForm;
  name: BooleanField;
  label: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  onCheckedChange?: (checked: boolean) => void;
}) {
  const id = `feld-${name}`;
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <ChoiceRow
          htmlFor={id}
          className={cn("rounded-xl border border-border bg-card p-3.5", className)}
          label={label}
          description={description}
          control={
            <Switch
              id={id}
              checked={field.value}
              onCheckedChange={(checked) => {
                field.onChange(checked);
                onCheckedChange?.(checked);
              }}
              onBlur={field.onBlur}
            />
          }
        />
      )}
    />
  );
}
