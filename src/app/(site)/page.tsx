import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarCheck, Camera, Check, FileText, Gauge, HousePlus, Inbox, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HeroSearch } from "@/components/home/hero-search";
import { HeroHeadline } from "@/components/home/hero-headline";
import { ListingCard } from "@/components/property/listing-card";
import { getLatestListings } from "@/lib/listings/queries";
import { EXAMPLE_LISTINGS } from "@/lib/listings/examples";
import { MARKETING_IMAGES } from "@/lib/marketing-images";
import { HOME_FAQ } from "@/lib/content/faq";
import { cn } from "@/lib/utils";

export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: "Immovia – Immobilien kaufen, mieten und kostenlos verkaufen" },
  description:
    "Wohnungen und Häuser in der Schweiz finden oder die eigene Immobilie kostenlos inserieren – mit Bewertung, Verkaufsdossier und Interessentenverwaltung.",
  alternates: { canonical: "/" },
};

const SELL_POINTS = [
  "Keine Inseratgebühren und keine Provision",
  "Preis, Texte und Kontakt selbst bestimmen",
  "Genaue Adresse nur, wenn Sie es wünschen",
  "Unterlagen gezielt und widerrufbar freigeben",
];

const STEPS = [
  { icon: HousePlus, title: "Immobilie erfassen", text: "Der Assistent fragt nur, was für Ihr Objekt wichtig ist." },
  { icon: Gauge, title: "Wert einschätzen", text: "Preisspanne mit Datenquellen – oder ein ehrlicher Hinweis, wenn Daten fehlen." },
  { icon: FileText, title: "Professionell präsentieren", text: "Optimierte Bilder, Textvorschläge und ein Verkaufsdossier." },
  { icon: MessageSquare, title: "Interessenten verwalten", text: "Anfragen, Nachrichten und Besichtigungen an einem Ort." },
];

const DOSSIER_PREVIEWS = [
  { name: "Modern", image: MARKETING_IMAGES.livingRoom.src, dark: false },
  { name: "Premium", image: MARKETING_IMAGES.auth.src, dark: true },
  { name: "Klassisch", image: MARKETING_IMAGES.kitchen.src, dark: false },
];

const sectionTitle = "font-display text-[1.75rem] font-extrabold leading-tight tracking-tight sm:text-[2rem]";
const textLink = "inline-flex shrink-0 items-center gap-2 font-semibold text-primary underline-offset-4 hover:underline";

export default async function HomePage() {
  const latest = await getLatestListings(3);
  // Noch keine Inserate: klar gekennzeichnete Beispiele statt einer leeren Fläche
  const showExamples = latest.length === 0;
  const cards = showExamples ? EXAMPLE_LISTINGS.slice(0, 3) : latest.slice(0, 3);
  const freeSlots = showExamples ? 0 : 3 - cards.length;

  return (
    <>
      {/* Hero mit Suche */}
      <section aria-labelledby="hero-titel" className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <Image
            src={MARKETING_IMAGES.hero.src}
            alt=""
            fill
            priority
            sizes="100vw"
            quality={60}
            // Das Haus steht rechts über der Suchbox; breitere Bildschirme zeigen das Bild grösser
            className="object-cover object-[62%_70%] 2xl:object-[62%_55%] min-[2200px]:object-[62%_45%]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white/90 via-white/65 to-white/15 md:bg-gradient-to-r md:from-white md:from-5% md:via-white/80 md:via-35% md:to-white/0 md:to-70%" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/45 to-transparent" />
        </div>
        <div className="container-page pb-8 pt-8 sm:pb-10 sm:pt-12 lg:pb-12 lg:pt-14">
          <HeroHeadline
            id="hero-titel"
            className="font-display text-[2.15rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-foreground sm:text-5xl lg:text-[3.1rem]"
          />
          {/* Zeilenumbruch nach dem ersten Satz: bleibt auf Tablets links vom Haus im Bild */}
          <p className="mt-5 animate-fade-up text-balance text-lg text-foreground/80 [animation-delay:0.45s] motion-reduce:[animation-delay:0s] sm:text-xl">
            Entdecke, bewerte und vermarkte Immobilien.
            <br />
            Alles auf einer Plattform.
          </p>
          <div className="mt-6 sm:mt-8">
            <HeroSearch />
          </div>
        </div>
      </section>

      {/* Aktuelle Immobilienangebote */}
      <section aria-labelledby="angebote-titel" className="container-page mt-10 sm:mt-14">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <h2 id="angebote-titel" className={sectionTitle}>
            Aktuelle Immobilienangebote
          </h2>
          <Link href="/immobilien" className={cn(textLink, "pb-1")}>
            Alle Angebote <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        {showExamples ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Noch sind keine Inserate online. Die Karten zeigen <strong className="font-semibold text-foreground">Beispiele</strong>,
            wie Inserate auf Immovia erscheinen.
          </p>
        ) : null}
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((listing, index) => (
            <ListingCard
              key={listing.id || `beispiel-${index}`}
              listing={listing}
              variant="compact"
              sizes="(min-width: 1280px) 410px, (min-width: 640px) 50vw, 100vw"
              // Tablet: zwei Karten in einer Reihe
              className={index === 2 ? "sm:max-lg:hidden" : undefined}
            />
          ))}
          {freeSlots > 0 ? (
            <div
              className={cn(
                "flex flex-col justify-center rounded-2xl border border-dashed border-mint-300 bg-mint-50 p-7",
                cards.length === 2 && "sm:max-lg:hidden",
              )}
            >
              <p className="font-display text-lg font-bold">Ihre Immobilie hier?</p>
              <p className="mt-1.5 text-sm text-muted-foreground">Kostenlos inserieren – mit Bewertung, Dossier und Anfragen an einem Ort.</p>
              <Button asChild className="mt-5 self-start">
                <Link href="/verkaufen/start">Kostenlos inserieren</Link>
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      {/* Immobilien kostenlos verkaufen */}
      <section aria-labelledby="verkaufen-titel" className="mt-20 bg-mint-50 py-16 sm:mt-24 sm:py-20">
        <div className="container-page grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-float">
            <Image src={MARKETING_IMAGES.sell.src} alt={MARKETING_IMAGES.sell.alt} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          </div>
          <div>
            <h2 id="verkaufen-titel" className={sectionTitle}>
              Immobilien kostenlos verkaufen
            </h2>
            <p className="mt-3 max-w-xl text-lg text-muted-foreground">
              Inserieren Sie Wohnung, Haus oder Grundstück ohne Provision – mit den Werkzeugen, die sonst nur Makler haben.
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {SELL_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3 text-[0.9375rem]">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-mint-200 text-forest">
                    <Check className="size-4" aria-hidden />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/verkaufen/start">Kostenlos inserieren</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/verkaufen">So verkaufen Sie mit Immovia</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* So funktioniert Immovia */}
      <section aria-labelledby="ablauf-titel" className="container-page mt-20 sm:mt-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="ablauf-titel" className={sectionTitle}>
            So funktioniert Immovia
          </h2>
          <Link href="/so-funktionierts" className={cn(textLink, "pb-1")}>
            Mehr zum Ablauf <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-2xl border border-border bg-white p-6">
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-mint-100 text-forest">
                  <step.icon className="size-5" aria-hidden />
                </span>
                <span className="font-display text-sm font-bold text-muted-foreground tabular" aria-hidden>
                  Schritt {index + 1}
                </span>
              </div>
              <h3 className="mt-4 font-display text-lg font-bold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Immobilienbewertung */}
      <section aria-labelledby="bewertung-titel" className="container-page mt-20 grid items-center gap-10 sm:mt-24 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2 id="bewertung-titel" className={sectionTitle}>
            Kostenlose Immobilienbewertung
          </h2>
          <p className="mt-3 max-w-xl text-lg text-muted-foreground">
            Preisspanne, möglicher Inseratepreis und die wichtigsten Wertfaktoren – mit offengelegten Datenquellen. Reichen die
            Daten nicht, zeigen wir keine erfundene Zahl.
          </p>
          <Button asChild size="lg" className="mt-7">
            <Link href="/bewerten">
              <Gauge aria-hidden /> Kostenlos bewerten
            </Link>
          </Button>
        </div>
        <div className="rounded-3xl border border-border bg-white p-6 shadow-card sm:p-8" aria-label="Beispielansicht einer Bewertung">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-muted-foreground">Geschätzter Marktwert</p>
            <Badge tone="dark">Beispiel</Badge>
          </div>
          <p className="mt-1 font-display text-4xl font-extrabold tracking-tight text-forest tabular">CHF 765’000</p>
          <div className="mt-5 h-2 rounded-full bg-gradient-to-r from-mint-200 via-brand to-mint-200" aria-hidden />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular">
            <span>CHF 730’000</span>
            <span>CHF 795’000</span>
          </div>
          <ul className="mt-6 grid gap-2.5 border-t border-border pt-5 text-sm">
            {[
              ["Lage und Besonnung", "wertsteigernd"],
              ["Baujahr und Zustand", "neutral"],
              ["Vergleichsangebote in der Region", "12 Angebote"],
            ].map(([factor, effect]) => (
              <li key={factor} className="flex items-center justify-between gap-4">
                <span>{factor}</span>
                <span className="text-muted-foreground">{effect}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs text-muted-foreground">Illustrative Darstellung. Echte Bewertungen nennen Datenbasis, Datum und Unsicherheit.</p>
        </div>
      </section>

      {/* Verkaufsdossier und Bildoptimierung */}
      <section aria-labelledby="praesentation-titel" className="mt-20 bg-mint-50 py-16 sm:mt-24 sm:py-20">
        <div className="container-page">
          <h2 id="praesentation-titel" className={sectionTitle}>
            Verkaufsdossier und Bildoptimierung
          </h2>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <article className="flex flex-col rounded-3xl bg-white p-6 shadow-card sm:p-7">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-mint-100 text-forest">
                  <FileText className="size-5" aria-hidden />
                </span>
                <h3 className="font-display text-xl font-bold">Verkaufsdossier als PDF</h3>
              </div>
              <p className="mt-3 text-muted-foreground">
                Bildergalerie, Eckdaten, Lage und Kontakt in einem Dossier – drei Vorlagen, neue Versionen auf Knopfdruck.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-3" aria-hidden>
                {DOSSIER_PREVIEWS.map((preview) => (
                  <div key={preview.name} className="overflow-hidden rounded-xl border border-border bg-surface">
                    <div className="relative aspect-[3/4]">
                      <Image src={preview.image} alt="" fill sizes="160px" className="object-cover" />
                      <div className={cn("absolute inset-x-0 bottom-0 h-1/3", preview.dark ? "bg-forest/85" : "bg-white/90")} />
                    </div>
                    <p className="px-3 py-2 text-xs font-semibold">{preview.name}</p>
                  </div>
                ))}
              </div>
              <Link href="/verkaufen#dossier" className={cn(textLink, "mt-6 self-start")}>
                Dossier-Vorlagen ansehen <ArrowRight className="size-4" aria-hidden />
              </Link>
            </article>

            <article className="flex flex-col rounded-3xl bg-white p-6 shadow-card sm:p-7">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-mint-100 text-forest">
                  <Camera className="size-5" aria-hidden />
                </span>
                <h3 className="font-display text-xl font-bold">Bilder automatisch verbessern</h3>
              </div>
              <p className="mt-3 text-muted-foreground">
                Helligkeit, Kontrast, Weissabgleich und Schärfe optimieren, Horizont begradigen. Das Original bleibt immer erhalten.
              </p>
              <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-2xl border border-border" aria-hidden>
                <div className="relative aspect-[4/3]">
                  <Image src={MARKETING_IMAGES.interior.src} alt="" fill sizes="300px" className="object-cover brightness-[0.82] contrast-[0.9] saturate-[0.8]" />
                  <span className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-semibold">Vorher</span>
                </div>
                <div className="relative aspect-[4/3] border-l-2 border-white">
                  <Image src={MARKETING_IMAGES.interior.src} alt="" fill sizes="300px" className="object-cover" />
                  <span className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-semibold">Nachher</span>
                </div>
              </div>
              <p className="mt-6 text-sm text-muted-foreground">Fotos direkt mit dem Smartphone aufnehmen und hochladen.</p>
            </article>
          </div>
        </div>
      </section>

      {/* Kommunikation und Interessentenverwaltung */}
      <section aria-labelledby="anfragen-titel" className="container-page mt-20 grid items-center gap-10 sm:mt-24 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2 id="anfragen-titel" className={sectionTitle}>
            Kommunikation und Interessentenverwaltung
          </h2>
          <p className="mt-3 max-w-xl text-lg text-muted-foreground">
            Nachrichten, Interessentenstatus, private Notizen und Besichtigungen – übersichtlich an einem Ort statt im E-Mail-Postfach.
          </p>
          <ul className="mt-6 grid gap-3 text-[0.9375rem]">
            <li className="flex items-center gap-3">
              <CalendarCheck className="size-5 shrink-0 text-brand" aria-hidden /> Besichtigungen mit Zeitfenstern, ohne Doppelbuchungen
            </li>
            <li className="flex items-center gap-3">
              <Inbox className="size-5 shrink-0 text-brand" aria-hidden /> Alle Anfragen zu einem Inserat gebündelt
            </li>
          </ul>
        </div>
        <div className="rounded-3xl border border-border bg-white p-2 shadow-card" aria-label="Beispielansicht Interessenten">
          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <p className="text-sm font-semibold">Interessenten</p>
            <Badge tone="dark">Beispiel</Badge>
          </div>
          <ul className="divide-y divide-border rounded-2xl bg-surface">
            {[
              { name: "Martin S.", status: "Besichtigung angefragt", text: "Wäre eine Besichtigung am Samstag möglich?" },
              { name: "Laura K.", status: "Dossier gesendet", text: "Vielen Dank für die Unterlagen!" },
              { name: "Daniel M.", status: "Neue Anfrage", text: "Ist die Wohnung noch verfügbar?" },
            ].map((lead) => (
              <li key={lead.name} className="flex items-start gap-3 p-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-mint-200 text-xs font-bold text-forest">
                  {lead.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {lead.name}
                    <Badge tone={lead.status === "Neue Anfrage" ? "green" : "amber"}>{lead.status}</Badge>
                  </p>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{lead.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Angebote für Firmen */}
      <section aria-labelledby="firmen-titel" className="container-page mt-20 sm:mt-24">
        <div className="relative overflow-hidden rounded-3xl bg-forest px-7 py-11 text-white sm:px-12">
          <div className="absolute -right-24 -top-24 size-80 rounded-full bg-brand/30 blur-3xl" aria-hidden />
          <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div>
              <h2 id="firmen-titel" className={cn(sectionTitle, "text-white")}>
                Angebote für Immobilienfirmen
              </h2>
              <p className="mt-3 max-w-xl text-white/80">
                Mehrere Objekte, Mitarbeitende und Interessenten zentral verwalten – mit Firmenprofil und Rollen für Ihr Team.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <Button asChild size="lg" variant="secondary">
                <Link href="/fuer-makler">Mehr für Firmen</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <Link href="/registrieren">Firmenkonto erstellen</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Häufige Fragen */}
      <section aria-labelledby="faq-titel" className="container-page mb-4 mt-20 grid gap-10 sm:mt-24 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <h2 id="faq-titel" className={sectionTitle}>
            Häufige Fragen
          </h2>
          <p className="mt-3 text-muted-foreground">Weitere Antworten finden Sie in den FAQ und im Ratgeber.</p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/faq">Alle Fragen</Link>
          </Button>
        </div>
        <Accordion type="single" collapsible className="border-t border-border">
          {HOME_FAQ.map((item) => (
            <AccordionItem key={item.question} value={item.question}>
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent>{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </>
  );
}
