import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  FileText,
  FolderLock,
  Gauge,
  HousePlus,
  Images,
  Inbox,
  MapPin,
  PenLine,
  Rocket,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckList, CtaBand, SectionHeading } from "@/lib/content/components";
import { FAQ } from "@/lib/content/faq";
import { getAiQuotas } from "@/lib/content/settings";
import { MARKETING_IMAGES } from "@/lib/marketing-images";
import { formatNumber } from "@/lib/format";
import { pageMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: "Immobilie verkaufen ohne Provision",
  description:
    "Verkaufen oder vermieten Sie Ihre Immobilie selbst: kostenlos inserieren, ehrlich bewerten, Bilder optimieren, Verkaufsdossier erstellen und Interessenten an einem Ort verwalten.",
  path: "/verkaufen",
});

const STEPS = [
  { icon: HousePlus, title: "Immobilie erfassen", text: "Ein Assistent fragt nur, was für Ihren Objekttyp wichtig ist. Alles wird automatisch zwischengespeichert." },
  { icon: Gauge, title: "Wert einschätzen", text: "Die Bewertung zeigt Spanne, Datenbasis und Unsicherheit – oder sagt ehrlich, wenn die Daten nicht reichen." },
  { icon: Images, title: "Bilder hochladen", text: "Fotos direkt vom Smartphone hochladen, sortieren, zuschneiden und das Titelbild festlegen." },
  { icon: PenLine, title: "Beschreibung erstellen", text: "KI-Textvorschläge auf Basis Ihrer Angaben – Sie prüfen, ändern und bestätigen jeden Text." },
  { icon: FileText, title: "Dossier erzeugen", text: "Ein PDF-Verkaufsdossier im Makler-Look, in drei Vorlagen und jederzeit neu erstellbar." },
  { icon: MapPin, title: "Inserat festlegen", text: "Preis, Kontakt und Genauigkeit der Adresse bestimmen Sie selbst – mit Vorschau." },
  { icon: Rocket, title: "Veröffentlichen", text: "Ihr Inserat erscheint in der Suche; passende Suchaufträge werden automatisch benachrichtigt." },
  { icon: Inbox, title: "Verkauf begleiten", text: "Anfragen, Nachrichten, Besichtigungen und Interessentenstatus an einem Ort – bis zum Abschluss." },
];

const FEATURES = [
  {
    icon: Gauge,
    title: "Ehrliche Bewertung",
    text: "Vergleich mit Angebotspreisen echter Inserate, klar gekennzeichnet. Ohne genügend Vergleichsobjekte zeigen wir keine Zahl.",
    href: "/bewerten",
  },
  {
    icon: WandSparkles,
    title: "Bilder verbessern",
    text: "Helligkeit, Kontrast, Weissabgleich und Schärfe automatisch optimieren. Das Original bleibt erhalten, veränderte Bilder sind gekennzeichnet.",
  },
  {
    icon: Sparkles,
    title: "Texte in fünf Stilen",
    text: "Sachlich, modern, elegant, emotional oder premium – ohne erfundene Ausstattung oder Lagevorteile.",
  },
  {
    icon: CalendarCheck,
    title: "Besichtigungen planen",
    text: "Zeitfenster freischalten, Interessierte buchen selbst. Doppelbuchungen verhindert die Datenbank zuverlässig.",
  },
  {
    icon: FolderLock,
    title: "Unterlagen sicher teilen",
    text: "Grundbuchauszug, Pläne oder Reglemente gezielt an einzelne Interessierte freigeben – und jederzeit widerrufen.",
  },
  {
    icon: BarChart3,
    title: "Echte Statistiken",
    text: "Aufrufe, Anfragen, Merklisten und Besichtigungen pro Inserat – gezählt aus tatsächlichen Ereignissen.",
  },
];

const DOSSIER_TEMPLATES = [
  { name: "Modern", text: "Weiss und Hellgrün, viel Freiraum, klare Kacheln für die Eckdaten.", image: MARKETING_IMAGES.interior },
  { name: "Premium", text: "Grossflächige Fotografie, reduzierte Typografie, dunkles Grün als Akzent.", image: MARKETING_IMAGES.chalet },
  { name: "Klassisch", text: "Sachlich und besonders übersichtlich mit Tabellen für alle Angaben.", image: MARKETING_IMAGES.kitchen },
];

export default async function VerkaufenPage() {
  const quotas = await getAiQuotas();
  const faq = FAQ.filter((item) => item.category === "verkaufen" || item.category === "bewertung");
  const quotaItems = [
    quotas.descriptionPerMonth !== null ? `${formatNumber(quotas.descriptionPerMonth)} KI-Textentwürfe` : null,
    quotas.valuationPerMonth !== null ? `${formatNumber(quotas.valuationPerMonth)} Bewertungen` : null,
    quotas.imageEnhancePerMonth !== null ? `${formatNumber(quotas.imageEnhancePerMonth)} Bildoptimierungen` : null,
  ].filter((v): v is string => Boolean(v));

  return (
    <>
      <section className="relative isolate overflow-hidden bg-surface">
        <div className="container-page grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.1fr_1fr]">
          <div className="animate-fade-up">
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-brand">Immobilie verkaufen oder vermieten</p>
            <h1 className="mt-3 font-display text-[2.4rem] font-extrabold leading-[1.06] tracking-[-0.03em] text-forest sm:text-5xl lg:text-[3.4rem]">
              Selbst verkaufen – mit den Werkzeugen der Profis
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-foreground/75">
              Inserieren Sie Wohnung, Haus oder Grundstück kostenlos. Immovia führt Sie von der Erfassung über Bewertung,
              Bilder und Verkaufsdossier bis zur Besichtigung – und Sie behalten jederzeit die Kontrolle.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="xl">
                <Link href="/verkaufen/start">
                  Jetzt kostenlos starten <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="xl" variant="outline" className="bg-white">
                <Link href="/bewerten">
                  <Gauge aria-hidden /> Wie die Bewertung funktioniert
                </Link>
              </Button>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-float">
            <Image src={MARKETING_IMAGES.sell.src} alt={MARKETING_IMAGES.sell.alt} fill priority sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />
          </div>
        </div>
      </section>

      <section aria-label="Ihre Vorteile" className="container-page mt-12">
        <ul className="grid gap-6 border-y border-border py-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-border">
          {[
            { title: "Kostenlos inserieren", text: "Keine Inseratgebühren für Privatpersonen" },
            { title: "Keine Provision", text: "Sie verkaufen direkt an die Käuferschaft" },
            { title: "Ihre Adresse, Ihre Wahl", text: "Exakt, nur Strasse oder nur Ort" },
            { title: "Daten in der Schweiz", text: "Datenbank in der Region Zürich" },
          ].map((item) => (
            <li key={item.title} className="flex items-center gap-4 lg:px-8 lg:first:pl-0">
              <ShieldCheck className="size-9 shrink-0 text-brand" strokeWidth={1.6} aria-hidden />
              <div>
                <p className="font-display font-bold">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="container-page mt-24" aria-labelledby="ablauf">
        <SectionHeading id="ablauf" eyebrow="Ablauf" title="In acht Schritten zum Verkauf" text="Sie können jederzeit zwischen den Schritten wechseln, ohne Daten zu verlieren." />
        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative rounded-2xl border border-border bg-white p-6 shadow-card">
              <span className="absolute right-5 top-5 font-display text-4xl font-extrabold text-mint-200" aria-hidden>
                {index + 1}
              </span>
              <span className="flex size-12 items-center justify-center rounded-2xl bg-mint-100 text-forest">
                <step.icon className="size-6" aria-hidden />
              </span>
              <h3 className="mt-5 font-display text-lg font-bold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-24 bg-surface py-20" aria-labelledby="funktionen">
        <div className="container-page">
          <SectionHeading id="funktionen" eyebrow="Funktionen" title="Alles, was ein guter Verkauf braucht" />
          <ul className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex flex-col rounded-2xl border border-border bg-white p-6 shadow-card">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-mint-100 text-forest">
                  <feature.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-5 font-display text-lg font-bold">{feature.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{feature.text}</p>
                {feature.href ? (
                  <Link href={feature.href} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                    Mehr erfahren <ArrowRight className="size-4" aria-hidden />
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="dossier" className="container-page mt-24 scroll-mt-24" aria-labelledby="dossier-titel">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <SectionHeading
              id="dossier-titel"
              eyebrow="Verkaufsdossier"
              title="Ein Dossier wie vom Makler"
              text="Aus Ihren Angaben entsteht ein PDF mit Titelseite, Eckdaten, Beschreibung, Lage, Bildgalerie, Grundrissen und Kontakt."
            />
            <CheckList
              className="mt-6"
              items={[
                "Drei Vorlagen zur Auswahl, Vorschau vor dem Erstellen",
                "Texte anpassen und Bilder sortieren",
                "Neue Version nach Änderungen – mit Datum gespeichert",
                "Im Inserat öffentlich freigeben oder nur gezielt senden",
              ]}
            />
          </div>
          <ul className="grid grid-cols-3 gap-3 sm:gap-5" aria-label="Dossier-Vorlagen">
            {DOSSIER_TEMPLATES.map((template, index) => (
              <li key={template.name} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
                <div className="relative aspect-[3/4]">
                  <Image src={template.image.src} alt="" fill sizes="(min-width: 1024px) 220px, 30vw" className="object-cover" />
                  <div className={index === 1 ? "absolute inset-x-0 bottom-0 h-1/3 bg-forest/85" : "absolute inset-x-0 bottom-0 h-1/3 bg-white/90"} />
                </div>
                <div className="p-3 sm:p-4">
                  <p className="font-display text-sm font-bold sm:text-base">{template.name}</p>
                  <p className="mt-1 hidden text-xs leading-relaxed text-muted-foreground sm:block">{template.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-page mt-24" aria-labelledby="kosten">
        <div className="grid gap-10 rounded-3xl bg-mint-100 p-8 sm:p-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-forest/80">Kosten</p>
            <h2 id="kosten" className="mt-3 font-display text-3xl font-extrabold tracking-tight text-forest sm:text-[2.1rem]">
              Für Privatpersonen kostenlos
            </h2>
            <p className="mt-4 text-forest/80">
              Registrierung, Inserat, Dossier, Nachrichten und Besichtigungsplanung kosten nichts. Sie brauchen keine Kreditkarte.
            </p>
          </div>
          <div className="rounded-2xl bg-white/85 p-6 text-forest">
            <p className="font-semibold">Rechenintensive Funktionen mit monatlichem Freikontingent</p>
            {quotaItems.length ? (
              <CheckList className="mt-4 text-sm" items={quotaItems.map((item) => `${item} pro Monat`)} />
            ) : (
              <p className="mt-2 text-sm text-forest/80">KI-Texte, Bewertungen und Bildoptimierungen sind in einem grosszügigen Rahmen enthalten.</p>
            )}
          </div>
        </div>
      </section>

      {faq.length ? (
        <section className="container-page mt-24 grid gap-10 lg:grid-cols-[1fr_1.6fr]" aria-labelledby="fragen">
          <div>
            <SectionHeading id="fragen" eyebrow="Häufige Fragen" title="Gut zu wissen" />
            <Button asChild variant="outline" className="mt-6">
              <Link href="/faq">Alle Fragen</Link>
            </Button>
          </div>
          <Accordion type="single" collapsible className="border-t border-border">
            {faq.map((item) => (
              <AccordionItem key={item.question} value={item.question}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ) : null}

      <CtaBand
        title="Starten Sie jetzt – kostenlos"
        text="Konto erstellen, Immobilie erfassen und Schritt für Schritt zum professionellen Inserat."
        primary={{ href: "/verkaufen/start", label: "Kostenlos starten" }}
        secondary={{ href: "/ratgeber/verkaufen-ohne-makler", label: "Ratgeber: Ablauf ohne Makler" }}
      />
    </>
  );
}
