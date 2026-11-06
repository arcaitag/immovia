import Link from "next/link";
import { ArrowRight, Check, Info, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Bausteine für Inhaltsseiten (Ratgeber, Landingpages, Rechtstexte).
 * Reine Server Components ohne Datenabfragen.
 */

export function PageIntro({
  eyebrow,
  title,
  lead,
  children,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("max-w-3xl animate-fade-up", className)}>
      {eyebrow ? <p className="text-sm font-bold uppercase tracking-[0.12em] text-brand">{eyebrow}</p> : null}
      <h1 className="mt-3 font-display text-[2.25rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-forest sm:text-5xl">{title}</h1>
      {lead ? <p className="mt-5 text-lg leading-relaxed text-foreground/75">{lead}</p> : null}
      {children ? <div className="mt-7 flex flex-col gap-3 sm:flex-row">{children}</div> : null}
    </header>
  );
}

export function SectionHeading({ eyebrow, title, text, id, className }: { eyebrow?: string; title: string; text?: React.ReactNode; id?: string; className?: string }) {
  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow ? <p className="text-sm font-bold uppercase tracking-[0.12em] text-brand">{eyebrow}</p> : null}
      <h2 id={id} className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-[2.1rem]">
        {title}
      </h2>
      {text ? <p className="mt-4 text-lg text-muted-foreground">{text}</p> : null}
    </div>
  );
}

export function CheckList({ items, className }: { items: React.ReactNode[]; className?: string }) {
  return (
    <ul role="list" className={cn("grid gap-3", className)}>
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-3">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-mint-100 text-forest">
            <Check className="size-4" aria-hidden />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function CtaBand({
  title,
  text,
  primary,
  secondary,
}: {
  title: string;
  text?: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <section className="container-page mt-24">
      <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-border bg-surface p-8 sm:flex-row sm:items-center sm:p-12">
        <div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
          {text ? <p className="mt-2 max-w-xl text-muted-foreground">{text}</p> : null}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href={primary.href}>
              {primary.label} <ArrowRight aria-hidden />
            </Link>
          </Button>
          {secondary ? (
            <Button asChild size="lg" variant="outline">
              <Link href={secondary.href}>{secondary.label}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Deutlicher Hinweis auf Rechtstext-Entwürfe. */
export function DraftNotice({ className }: { className?: string }) {
  return (
    <div role="note" className={cn("flex gap-3 rounded-2xl border-2 border-warning/30 bg-warning-bg p-5 text-warning", className)}>
      <TriangleAlert className="mt-0.5 size-6 shrink-0" aria-hidden />
      <div>
        <p className="font-display text-lg font-bold">Entwurf – vor dem öffentlichen Betrieb rechtlich prüfen lassen</p>
        <p className="mt-1 text-sm leading-relaxed">
          Dieser Text ist ein strukturierter Entwurf und nicht rechtsverbindlich. Markierte Platzhalter wie{" "}
          <Placeholder>Firmenname</Placeholder> müssen ergänzt und alle Angaben von einer Fachperson geprüft werden.
        </p>
      </div>
    </div>
  );
}

/** Sichtbar markierter Platzhalter in Entwürfen. */
export function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <mark className="rounded bg-warning-bg px-1 font-semibold text-warning ring-1 ring-warning/25">
      [{children}]
    </mark>
  );
}

export function Note({ title, children, tone = "info" }: { title?: string; children: React.ReactNode; tone?: "info" | "warning" }) {
  return (
    <aside
      className={cn(
        "my-6 flex gap-3 rounded-2xl border p-5 text-[0.9375rem]",
        tone === "warning" ? "border-warning/20 bg-warning-bg text-warning" : "border-mint-200 bg-mint-50 text-forest",
      )}
    >
      {tone === "warning" ? <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden /> : <Info className="mt-0.5 size-5 shrink-0" aria-hidden />}
      <div className="grid gap-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className="leading-relaxed">{children}</div>
      </div>
    </aside>
  );
}

/** Rechtstext-Abschnitt mit Anker. */
export function LegalSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-24">
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}
