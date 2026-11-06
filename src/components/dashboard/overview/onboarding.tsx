import Link from "next/link";
import { ArrowRight, CalendarCheck, Camera, FileText, Gauge, HousePlus, MessageSquare, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = [
  { icon: HousePlus, title: "Immobilie erfassen", text: "Der Assistent fragt nur, was für Ihren Objekttyp wichtig ist, und speichert automatisch." },
  { icon: Gauge, title: "Wert einschätzen", text: "Die Bewertung zeigt offen, auf welchen Daten sie beruht." },
  { icon: Camera, title: "Fotos und Texte", text: "Bilder hochladen und optimieren, Texte selbst schreiben oder mit KI erstellen." },
  { icon: FileText, title: "Veröffentlichen", text: "Kostenlos inserieren und auf Wunsch ein PDF-Dossier anbieten." },
  { icon: MessageSquare, title: "Interessenten verwalten", text: "Anfragen, Nachrichten und Besichtigungen an einem Ort." },
];

/** Geführter Einstieg für Benutzer ohne Immobilien. */
export function Onboarding() {
  return (
    <section aria-labelledby="einstieg-titel" className="overflow-hidden rounded-3xl border border-mint-200 bg-mint-50">
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:p-10">
        <div className="flex flex-col justify-center gap-5">
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-brand">Ihr Start bei Immovia</p>
          <h2 id="einstieg-titel" className="font-display text-2xl font-extrabold tracking-tight text-forest sm:text-3xl">
            Erfassen Sie Ihre erste Immobilie
          </h2>
          <p className="max-w-md leading-relaxed text-foreground/75">
            In wenigen Minuten sind die Eckdaten erfasst. Danach führt Sie Immovia Schritt für Schritt bis zum fertigen Inserat –
            kostenlos und ohne Makler.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/dashboard/immobilien/neu">
                Erste Immobilie erfassen <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-white">
              <Link href="/dashboard/immobilien/neu?ziel=bewertung">
                <Gauge aria-hidden /> Zuerst bewerten
              </Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Sie suchen eine Immobilie?{" "}
            <Link href="/immobilien" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
              <Search className="size-3.5" aria-hidden /> Zur Suche
            </Link>
          </p>
        </div>
        <ol className="grid gap-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex items-start gap-4 rounded-2xl bg-white p-4 shadow-card">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint-100 text-forest">
                <step.icon className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block font-display font-bold">
                  <span className="text-brand">{index + 1}.</span> {step.title}
                </span>
                <span className="block text-sm text-muted-foreground">{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const QUICK = [
  { href: "/dashboard/immobilien/neu", label: "Neue Immobilie", text: "Erfassen und inserieren", icon: HousePlus },
  { href: "/dashboard/bewertungen", label: "Bewertung", text: "Wert einschätzen lassen", icon: Gauge },
  { href: "/dashboard/nachrichten", label: "Nachrichten", text: "Mit Interessenten schreiben", icon: MessageSquare },
  { href: "/dashboard/besichtigungen", label: "Besichtigungen", text: "Termine und Zeitfenster", icon: CalendarCheck },
];

/** Schnellaktionen auf der Startseite des Dashboards. */
export function QuickActions({ hasProperties }: { hasProperties: boolean }) {
  const items = hasProperties ? QUICK : QUICK.slice(2);
  return (
    <nav aria-label="Schnellaktionen">
      <ul className={hasProperties ? "grid grid-cols-2 gap-3 lg:grid-cols-4" : "grid grid-cols-2 gap-3"}>
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex h-full min-h-16 items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-card transition-colors hover:border-mint-300 hover:bg-mint-50"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint-100 text-forest">
                <item.icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{item.label}</span>
                <span className="hidden truncate text-xs text-muted-foreground sm:block">{item.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
