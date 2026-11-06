import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calculator, CircleSlash, Database, FileSearch, Gauge, LineChart, Scale, Tags } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckList, CtaBand, Note, SectionHeading } from "@/lib/content/components";
import { getValuationSettings } from "@/lib/content/settings";
import { formatNumber } from "@/lib/format";
import { pageMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: "Immobilie bewerten – transparent und ehrlich",
  description:
    "So bewertet Immovia Ihre Immobilie: offengelegte Datenquellen, Preisspanne statt Scheingenauigkeit und keine Zahl, wenn die Daten nicht reichen.",
  path: "/bewerten",
});

const PRICE_KINDS = [
  {
    icon: Tags,
    title: "Angebotspreise",
    text: "Preise in Inseraten. Sie zeigen die Erwartung der Verkaufsseite, nicht den tatsächlichen Abschluss.",
    used: true,
  },
  {
    icon: Scale,
    title: "Transaktionspreise",
    text: "Tatsächlich bezahlte Preise aus Kaufverträgen. Diese Daten sind meist nur lizenziert erhältlich.",
    used: false,
  },
  {
    icon: LineChart,
    title: "Statistische Indikatoren",
    text: "Preisindizes und regionale Durchschnittswerte. Gut für Entwicklungen, ungeeignet für ein einzelnes Objekt.",
    used: false,
  },
  {
    icon: Calculator,
    title: "Modellschätzungen",
    text: "Berechnungen aus Objektmerkmalen und Vergleichsdaten. Nur so gut wie die Daten, auf denen sie beruhen.",
    used: false,
  },
];

export default async function BewertenPage() {
  const settings = await getValuationSettings();
  const parameters = [
    settings.minComparables !== null ? `mindestens ${formatNumber(settings.minComparables)} Vergleichsobjekte für eine Zahl` : null,
    settings.radiusKm !== null ? `im Umkreis von ${formatNumber(settings.radiusKm)} km` : null,
    settings.maxAgeDays !== null ? `Vergleichsdaten nicht älter als ${formatNumber(settings.maxAgeDays)} Tage` : null,
    settings.areaTolerance !== null ? `Fläche höchstens ${formatNumber(settings.areaTolerance * 100)} % abweichend` : null,
  ].filter((v): v is string => Boolean(v));

  return (
    <>
      <section className="bg-surface">
        <div className="container-page py-14 sm:py-20">
          <div className="max-w-3xl animate-fade-up">
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-brand">Immobilie bewerten</p>
            <h1 className="mt-3 font-display text-[2.4rem] font-extrabold leading-[1.06] tracking-[-0.03em] text-forest sm:text-5xl">
              Was ist meine Immobilie wert? Ehrlich eingeschätzt.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-foreground/75">
              Die Bewertung von Immovia zeigt immer, worauf sie beruht: welche Daten, wie viele Vergleichsobjekte und wie
              sicher das Ergebnis ist. Reichen die Daten nicht aus, zeigen wir keine Zahl.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="xl">
                <Link href="/verkaufen/start">
                  <Gauge aria-hidden /> Bewertung starten
                </Link>
              </Button>
              <Button asChild size="xl" variant="outline" className="bg-white">
                <Link href="/ratgeber/angebotspreis-festlegen">Ratgeber: Preis festlegen</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Für die Bewertung erfassen Sie Ihre Immobilie in einem kostenlosen Konto.
            </p>
          </div>
        </div>
      </section>

      {settings.enabled === false ? (
        <div className="container-page mt-10">
          <Alert tone="warning" title="Die Bewertung ist derzeit deaktiviert">
            Die Bewertungsfunktion wurde von der Administration vorübergehend ausgeschaltet. Sie können Ihre Immobilie trotzdem
            erfassen und inserieren.
          </Alert>
        </div>
      ) : null}

      <section className="container-page mt-20" aria-labelledby="preisarten">
        <SectionHeading
          id="preisarten"
          eyebrow="Begriffe"
          title="Nicht jeder Preis ist ein Marktwert"
          text="Wir unterscheiden konsequent zwischen vier Arten von Preisangaben – und sagen Ihnen, welche wir verwenden."
        />
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PRICE_KINDS.map((kind) => (
            <li key={kind.title} className="flex flex-col rounded-2xl border border-border bg-white p-6 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-mint-100 text-forest">
                  <kind.icon className="size-5" aria-hidden />
                </span>
                {kind.used ? <Badge tone="green">Verwendet</Badge> : <Badge tone="neutral">Noch nicht angebunden</Badge>}
              </div>
              <h3 className="mt-5 font-display text-lg font-bold">{kind.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{kind.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-24 bg-surface py-20" aria-labelledby="methode">
        <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <SectionHeading id="methode" eyebrow="Methode" title="So entsteht die Einschätzung" />
            <ol className="mt-8 grid gap-6">
              {[
                {
                  icon: FileSearch,
                  title: "Ihre Angaben",
                  text: "Grundlage sind die Daten, die Sie erfassen: Lage, Typ, Fläche, Zimmer, Baujahr, Zustand und Ausstattung.",
                },
                {
                  icon: Database,
                  title: "Vergleichsobjekte",
                  text: "Wir suchen ähnliche, echte und veröffentlichte Inserate auf Immovia. Demo-Inserate sind ausgeschlossen.",
                },
                {
                  icon: Calculator,
                  title: "Spanne und Sicherheit",
                  text: "Aus den Vergleichsobjekten berechnet ein nachvollziehbares Verfahren eine Preisspanne und einen möglichen Inseratepreis. Die KI erklärt nur die Faktoren – sie erfindet keine Zahlen.",
                },
                {
                  icon: CircleSlash,
                  title: "Keine Zahl ohne Daten",
                  text: "Gibt es zu wenige passende Vergleichsobjekte, sagt die Bewertung das offen und nennt keinen Wert.",
                },
              ].map((step) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white text-forest shadow-card">
                    <step.icon className="size-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold">{step.title}</h3>
                    <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted-foreground">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="grid content-start gap-5">
            <div className="rounded-2xl border border-border bg-white p-6 shadow-card">
              <p className="font-display text-lg font-bold">Aktuelle Einstellungen der Vergleichsbewertung</p>
              {parameters.length ? (
                <CheckList className="mt-4 text-[0.9375rem]" items={parameters} />
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Die Parameter werden in der Administration festgelegt.</p>
              )}
              <p className="mt-4 text-xs text-muted-foreground">
                Diese Werte werden von der Administration verwaltet und können angepasst werden.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-white p-6 shadow-card">
              <p className="font-display text-lg font-bold">Was die Bewertung enthält</p>
              <CheckList
                className="mt-4 text-[0.9375rem]"
                items={[
                  "Preisspanne und möglicher Inseratepreis, sofern die Daten reichen",
                  "Datum, Datenquellen sowie Qualität und Aktualität der Daten",
                  "Faktoren, die den Wert erhöhen oder senken",
                  "Vergleichsobjekte mit Angebotspreis",
                  "Nachvollziehbare Angabe zur Sicherheit des Ergebnisses",
                  "Frühere Bewertungen bleiben gespeichert und lassen sich vergleichen",
                ]}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="container-page mt-20 max-w-4xl">
        <Note tone="warning" title="Eine Bewertung ersetzt kein Gutachten">
          Angebotspreise sind keine bezahlten Preise. Die Einschätzung ist eine Orientierung für Ihren Angebotspreis. Für
          Erbteilungen, Scheidungen oder Finanzierungen braucht es in der Regel die Schätzung einer Fachperson bzw. der Bank.
          Eine Schnittstelle für lizenzierte Schweizer Transaktionsdaten ist vorbereitet, aber noch nicht angebunden.
        </Note>
        <div className="mt-6">
          <Link href="/faq#bewertung" className="inline-flex items-center gap-2 font-semibold text-primary hover:underline">
            Fragen zur Bewertung <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>

      <CtaBand
        title="Ihre Immobilie einschätzen lassen"
        text="Erfassen Sie Ihre Immobilie kostenlos. Die Bewertung starten Sie im zweiten Schritt des Verkaufsassistenten."
        primary={{ href: "/verkaufen/start", label: "Kostenlos starten" }}
        secondary={{ href: "/verkaufen", label: "Alle Funktionen" }}
      />
    </>
  );
}
