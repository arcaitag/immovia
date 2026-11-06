import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const alertVariants = cva("relative flex gap-3 rounded-xl border p-4 text-sm [&>svg]:mt-0.5 [&>svg]:size-5 [&>svg]:shrink-0", {
  variants: {
    tone: {
      info: "border-info/15 bg-info-bg text-info",
      success: "border-success/15 bg-success-bg text-success",
      warning: "border-warning/20 bg-warning-bg text-warning",
      error: "border-destructive/15 bg-destructive-bg text-destructive",
      neutral: "border-border bg-muted text-foreground",
    },
  },
  defaultVariants: { tone: "info" },
});

const ICONS = { info: Info, success: CircleCheck, warning: TriangleAlert, error: CircleAlert, neutral: Info } as const;

export function Alert({
  tone = "info",
  title,
  children,
  className,
  action,
}: VariantProps<typeof alertVariants> & {
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  const Icon = ICONS[tone ?? "info"];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn(alertVariants({ tone }), className)}>
      <Icon aria-hidden />
      <div className="flex-1 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="leading-relaxed text-current/90">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
