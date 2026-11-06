import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

/**
 * Formularfeld mit Label, Hilfetext und Fehlermeldung.
 * Barrierefrei: Fehler und Hinweise werden über aria-describedby verknüpft.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  optional,
  className,
  children,
}: {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: React.ReactElement<{ "aria-invalid"?: boolean; "aria-describedby"?: string; id?: string }>;
}) {
  const hintId = htmlFor ? `${htmlFor}-hint` : undefined;
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  const control = React.isValidElement(children)
    ? React.cloneElement(children, {
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
        id: children.props.id ?? htmlFor,
      })
    : children;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label ? (
        <Label htmlFor={htmlFor} className="flex items-center gap-1.5">
          {label}
          {required ? <span className="text-destructive" aria-hidden>*</span> : null}
          {optional ? <span className="text-xs font-normal text-muted-foreground">(optional)</span> : null}
        </Label>
      ) : null}
      {control}
      {hint && !error ? (
        <p id={hintId} className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Reihe aus Checkbox/Switch mit Beschriftung. */
export function ChoiceRow({
  control,
  label,
  description,
  htmlFor,
  className,
}: {
  control: React.ReactNode;
  label: React.ReactNode;
  description?: React.ReactNode;
  htmlFor: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <div className="pt-0.5">{control}</div>
      <div className="grid gap-1">
        <Label htmlFor={htmlFor} className="cursor-pointer font-medium">
          {label}
        </Label>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );
}
