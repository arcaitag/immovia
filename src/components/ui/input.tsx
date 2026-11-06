import * as React from "react";
import { cn } from "@/lib/utils";

export const inputBase =
  "flex w-full min-w-0 rounded-xl border border-input bg-card px-3.5 text-[0.9375rem] text-foreground shadow-[0_1px_0_rgb(25_40_32/0.02)] transition-[border-color,box-shadow] placeholder:text-muted-foreground/80 hover:border-mint-300 focus-visible:border-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mint-200/70 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70 aria-invalid:border-destructive aria-invalid:ring-destructive/15";

export function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(inputBase, "h-11 py-2", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(inputBase, "min-h-28 py-2.5 leading-relaxed", className)} {...props} />;
}

/** Eingabefeld mit Präfix/Suffix, z. B. «CHF» oder «m²». */
export function InputGroup({
  prefix,
  suffix,
  className,
  inputClassName,
  ...props
}: React.ComponentProps<"input"> & { prefix?: React.ReactNode; suffix?: React.ReactNode; inputClassName?: string }) {
  return (
    <div className={cn("relative flex items-center", className)}>
      {prefix ? (
        <span className="pointer-events-none absolute left-3.5 text-sm font-medium text-muted-foreground">{prefix}</span>
      ) : null}
      <Input className={cn(prefix ? "pl-12" : undefined, suffix ? "pr-12" : undefined, inputClassName)} {...props} />
      {suffix ? (
        <span className="pointer-events-none absolute right-3.5 text-sm font-medium text-muted-foreground">{suffix}</span>
      ) : null}
    </div>
  );
}
