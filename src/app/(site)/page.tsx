import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  CalendarCheck,
  Camera,
  Check,
  FileText,
  Gauge,
  Heart,
  HousePlus,
  Inbox,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HeroSearch } from "@/components/home/hero-search";
import { UnderlineSwoosh } from "@/components/home/underline-swoosh";
import { ListingCard } from "@/components/property/listing-card";
import { getLatestListings } from "@/lib/listings/queries";
import { EXAMPLE_LISTINGS } from "@/lib/listings/examples";
import { MARKETING_IMAGES } from "@/lib/marketing-images";
import { HOME_FAQ } from "@/lib/content/faq";

export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: "Immovia – Immobilie bewerten, professionell verkaufen. Einfach und kostenlos." },
  alternates: { canonical: "/" },
};

const TRUST = [
  { icon: HousePlus, title: "Kostenlos inserieren", text: "Keine Gebühren für Privatpersonen" },
  { icon: ShieldCheck, title: "Ehrliche Bewertung", text: "Mit offengelegten Datenquellen" },
  { icon: Bell, title: "Suchauftrag", text: "Neue Angebote automatisch erhalten" },
  { icon: Heart, title: "Merkliste", text: "Favoriten speichern und vergleichen" },
];

const STEPS = [
  { icon: HousePlus, title: "Immobilie erfassen", text: "Ein geführter Assistent fragt nur, was für Ihren Objekttyp wichtig ist – mit automatischem Zwischenspeichern." },
  { icon: Gauge, title: "Wert einschätzen", text: "Die Bewertung zeigt Preisspanne, Einflussfaktoren und Datenquellen – oder sagt ehrlich, wenn die Daten nicht reichen." },
  { icon: FileText, title: "Professionell präsentieren", text: "Optimierte Bilder, KI-Texte und ein Verkaufsdossier im Makler-Look entstehen mit wenigen Klicks." },
  { icon: MessageSquare, title: "Interessenten verwalten", text: "Anfragen, Nachrichten und Besichtigungen laufen an einem Ort zusammen – bis zum Abschluss." },
];

const BENEFITS = [
  "Keine Inseratgebühren und keine Provision für Privatpersonen",
  "Volle Kontrolle über Preis, Texte und Kontakt",
  "Exakte Adresse nur, wenn Sie es wünschen",
  "Unterlagen gezielt und widerrufbar freigeben",
  "Besichtigungen ohne Doppelbuchungen planen",
  "Daten in der Schweiz und nach Schweizer Datenschutz verarbeitet",
];

export default async function HomePage() {
  const latest = await getLatestListings(6);
  const showExamples = latest.length < 3;
  const cards = showExamples ? EXAMPLE_LISTINGS : latest.slice(0, 6);

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-surface">
        <div className="absolute inset-0 -z-10">
          <Image
            src={MARKETING_IMAGES.hero.src}
            alt={MARKETING_IMAGES.hero.alt}
            fill
            priority
            sizes="100vw"
            className="object-cover object-[70%_center]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white/92 via-white/85 to-white/70 md:bg-gradient-to-r md:from-white md:via-white/85 md:to-white/5" />
        </div>
        <div className="container-page pb-28 pt-14 sm:pt-20 lg:pb-36 lg:pt-24">
          <div className="max-w-2xl animate-fade-up">
            <Badge tone="green" className="mb-5 px-3 py-1 text-[0.8125rem]">
              <Sparkles aria-hidden /> Die neue Schweizer Immobilienplattform
            </Badge>
            <h1 className="font-display text-[2.4rem] font-extrabold leading-[1.06] tracking-[-0.03em] text-forest sm:text-5xl lg:text-[3.6rem]">
              Immobilie bewerten, professionell verkaufen.{" "}
              <span className="relative inline-block text-foreground sm:whitespace-nowrap">
                Einfach und kostenlos.
                <UnderlineSwoosh className="absolute -bottom-2.5 left-[38%] hidden h-3.5 w-[62%] text-brand sm:block" />
              </span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-foreground/75">
              Von der datenbasierten Immobilienbewertung über die professionelle Verkaufsdokumentation bis zur Kommunikation mit
              Interessenten. Alles an einem Ort.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="xl">
                <Link href="/verkaufen/start">
                  Jetzt Immobilie verkaufen <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="xl" variant="outline" className="bg-white/80">
                <Link href="/bewerten">
                  <Gauge aria-hidden /> Immobilie kostenlos bewerten
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Suche */}
      <section aria-label="Immobiliensuche" className="container-page relative z-10 -mt-20 lg:-mt-24">
        <HeroSearch />
      </section>

      {/* Vorteile kurz */}
      <section aria-label="Ihre Vorteile" className="container-page mt-12">
        <ul className="grid gap-6 border-y border-border py-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-border">
          {TRUST.map((item) => (
            <li key={item.title} className="flex items-center gap-4 lg:px-8 lg:first:pl-0">
              <item.icon className="size-9 shrink-0 text-brand" strokeWidth={1.6} aria-hidden />
              <div>
                <p className="font-display font-bold">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Aktuelle Angebote */}
      <section className="container-page mt-20" aria-labelledby="angebote-titel">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="angebote-titel" className="font-display text-3xl font-extrabold tracking-tight sm:text-[2.1rem]">
              Aktuelle Immobilienangebote
            </h2>
            {showExamples ? (
              <p className="mt-2 text-muted-foreground">
                Noch sind wenige Inserate online. Die folgenden Karten sind <strong>Beispiele</strong> und zeigen, wie Ihr
                Inserat erscheint.
              </p>
            ) : null}
          </div>
          <Link href="/immobilien" className="inline-flex items-center gap-2 font-semibold text-primary hover:underline">
            Alle Angebote ansehen <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((listing, index) => (
            <ListingCard key={listing.id || `beispiel-${index}`} listing={listing} />
          ))}
        </div>
      </section>

      {/* So funktioniert's */}
      <section className="mt-24 bg-surface py-20" aria-labelledby="ablauf-titel">
        <div className="container-page">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-brand">So funktioniert Immovia</p>
            <h2 id="ablauf-titel" className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-[2.1rem]">
              Der ganze Verkauf auf einer Plattform
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Sie brauchen kein Fachwissen. Immovia führt Sie Schritt für Schritt – und Sie entscheiden jederzeit selbst.
            </p>
          </div>
          <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
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
          <div className="mt-10">
            <Button asChild variant="outline">
              <Link href="/so-funktionierts">Mehr zum Ablauf</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Kostenlos verkaufen */}
      <section className="container-page mt-24 grid items-center gap-12 lg:grid-cols-2" aria-labelledby="verkaufen-titel">
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-float">
          <Image src={MARKETING_IMAGES.sell.src} alt={MARKETING_IMAGES.sell.alt} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-brand">Kostenlos Immobilien verkaufen</p>
          <h2 id="verkaufen-titel" className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-[2.1rem]">
            Professionell wie ein Makler – ohne Provision
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Inserieren Sie Wohnung, Haus oder Grundstück kostenlos. Immovia liefert die Werkzeuge, die sonst nur
            Immobilienfirmen haben: Bewertung, Bildbearbeitung, Verkaufsdossier und Interessentenverwaltung.
          </p>
          <ul className="mt-6 grid gap-3">
            {BENEFITS.slice(0, 4).map((b) => (
              <li key={b} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-mint-100 text-forest">
                  <Check className="size-4" aria-hidden />
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <Button asChild size="lg" className="mt-8">
            <Link href="/verkaufen">Immobilie verkaufen</Link>
          </Button>
        </div>
      </section>

      {/* Funktionen */}
      <section className="container-page mt-24" aria-labelledby="funktionen-titel">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-brand">Werkzeuge für Ihren Verkauf</p>
          <h2 id="funktionen-titel" className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-[2.1rem]">
            Alles, was ein guter Verkauf braucht
          </h2>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* Bewertung */}
          <article className="flex flex-col rounded-3xl border border-border bg-white p-7 shadow-card">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-mint-100 text-forest">
                <Gauge className="size-5" aria-hidden />
              </span>
              <h3 className="font-display text-xl font-bold">Datenbasierte Immobilienbewertung</h3>
            </div>
            <p className="mt-3 text-muted-foreground">
              Preisspanne, möglicher Inseratepreis und die wichtigsten Wertfaktoren – mit offengelegten Datenquellen.
              Reichen die Daten nicht, zeigen wir keine erfundene Zahl.
            </p>
            <div className="mt-6 rounded-2xl border border-border bg-surface p-5" aria-label="Beispielansicht einer Bewertung">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-muted-foreground">Geschätzter Marktwert</p>
                <Badge tone="dark">Beispiel</Badge>
              </div>
              <p className="mt-1 font-display text-3xl font-extrabold text-forest tabular">CHF 765’000</p>
              <div className="mt-4 h-2 rounded-full bg-gradient-to-r from-mint-200 via-brand to-mint-200" aria-hidden />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular">
                <span>CHF 730’000</span>
                <span>CHF 795’000</span>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Illustrative Darstellung. Echte Bewertungen nennen Datenbasis, Datum und Unsicherheit.
              </p>
            </div>
            <Link href="/bewerten" className="mt-6 inline-flex items-center gap-2 font-semibold text-primary hover:underline">
              Mehr zur Bewertung <ArrowRight className="size-4" aria-hidden />
            </Link>
          </article>

          {/* Verkaufsdossier */}
          <article className="flex flex-col rounded-3xl border border-border bg-white p-7 shadow-card">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-mint-100 text-forest">
                <FileText className="size-5" aria-hidden />
              </span>
              <h3 className="font-display text-xl font-bold">Professionelles Verkaufsdossier</h3>
            </div>
            <p className="mt-3 text-muted-foreground">
              Aus Ihren Angaben entsteht ein PDF im Makler-Look – in drei Vorlagen, mit Bildgalerie, Eckdaten, Lage und
              Kontakt. Neue Versionen jederzeit auf Knopfdruck.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-3" aria-hidden>
              {["Modern", "Premium", "Klassisch"].map((name, i) => (
                <div key={name} className="overflow-hidden rounded-xl border border-border bg-surface">
                  <div className="relative aspect-[3/4]">
                    <Image
                      src={[MARKETING_IMAGES.interior.src, MARKETING_IMAGES.chalet.src, MARKETING_IMAGES.kitchen.src][i] ?? MARKETING_IMAGES.interior.src}
                      alt=""
                      fill
                      sizes="160px"
                      className="object-cover opacity-90"
                    />
                    <div className={i === 1 ? "absolute inset-x-0 bottom-0 h-1/3 bg-forest/85" : "absolute inset-x-0 bottom-0 h-1/3 bg-white/90"} />
                  </div>
                  <p className="px-3 py-2 text-xs font-semibold">{name}</p>
                </div>
              ))}
            </div>
            <Link href="/verkaufen#dossier" className="mt-6 inline-flex items-center gap-2 font-semibold text-primary hover:underline">
              Dossier-Vorlagen ansehen <ArrowRight className="size-4" aria-hidden />
            </Link>
          </article>

          {/* Bilder */}
          <article className="flex flex-col rounded-3xl border border-border bg-white p-7 shadow-card">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-mint-100 text-forest">
                <WandSparkles className="size-5" aria-hidden />
              </span>
              <h3 className="font-display text-xl font-bold">Bilder verbessern</h3>
            </div>
            <p className="mt-3 text-muted-foreground">
              Helligkeit, Kontrast, Weissabgleich und Schärfe automatisch optimieren, Horizont begradigen und vorher-nachher
              vergleichen. Das Original bleibt immer erhalten – veränderte Bilder sind gekennzeichnet.
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
            <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Camera className="size-4" aria-hidden /> Fotos direkt mit dem Smartphone aufnehmen und hochladen
            </p>
          </article>

          {/* Anfragen */}
          <article className="flex flex-col rounded-3xl border border-border bg-white p-7 shadow-card">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-mint-100 text-forest">
                <Inbox className="size-5" aria-hidden />
              </span>
              <h3 className="font-display text-xl font-bold">Alle Anfragen an einem Ort</h3>
            </div>
            <p className="mt-3 text-muted-foreground">
              Nachrichten, Interessentenstatus, private Notizen und Besichtigungstermine – übersichtlich und ohne
              E-Mail-Chaos.
            </p>
            <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-surface" aria-label="Beispielansicht Interessenten">
              {[
                { name: "Martin S.", status: "Besichtigung angefragt", text: "Wäre eine Besichtigung am Samstag möglich?" },
                { name: "Laura K.", status: "Dossier gesendet", text: "Vielen Dank für die Unterlagen!" },
              ].map((lead) => (
                <li key={lead.name} className="flex items-start gap-3 p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-mint-200 text-xs font-bold text-forest">
                    {lead.name.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {lead.name}
                      <Badge tone="amber">{lead.status}</Badge>
                    </p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{lead.text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarCheck className="size-4" aria-hidden /> Besichtigungen mit Zeitfenstern – ohne Doppelbuchungen
            </p>
          </article>
        </div>
      </section>

      {/* Vorteile Privatpersonen */}
      <section className="container-page mt-24" aria-labelledby="vorteile-titel">
        <div className="grid gap-10 rounded-3xl bg-mint-100 p-8 sm:p-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-forest/80">Für Privatpersonen</p>
            <h2 id="vorteile-titel" className="mt-3 font-display text-3xl font-extrabold tracking-tight text-forest sm:text-[2.1rem]">
              Selbst verkaufen, mit gutem Gefühl
            </h2>
            <p className="mt-4 text-forest/80">
              Immovia nimmt Ihnen die Arbeit ab, nicht die Entscheidungen. Sie behalten die Kontrolle über jeden Schritt.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-3 rounded-2xl bg-white/80 p-4 text-sm font-medium text-forest">
                <BadgeCheck className="size-5 shrink-0 text-brand" aria-hidden />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Immobilienfirmen */}
      <section className="container-page mt-24" aria-labelledby="firmen-titel">
        <div className="relative overflow-hidden rounded-3xl bg-forest px-8 py-12 text-white sm:px-12">
          <div className="absolute -right-24 -top-24 size-80 rounded-full bg-brand/30 blur-3xl" aria-hidden />
          <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.12em] text-mint-200">Für Immobilienfirmen</p>
              <h2 id="firmen-titel" className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white sm:text-[2.1rem]">
                Ein Konto für Ihr ganzes Team
              </h2>
              <p className="mt-4 max-w-xl text-white/80">
                Makler und Verwaltungen verwalten mehrere Objekte, Mitarbeitende und Interessenten zentral – mit
                öffentlichem Firmenprofil und Rollen für Ihr Team.
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

      {/* FAQ */}
      <section className="container-page mt-24 grid gap-10 lg:grid-cols-[1fr_1.6fr]" aria-labelledby="faq-titel">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-brand">Häufige Fragen</p>
          <h2 id="faq-titel" className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-[2.1rem]">
            Gut zu wissen
          </h2>
          <p className="mt-4 text-muted-foreground">Weitere Antworten finden Sie in den FAQ und im Ratgeber.</p>
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

      {/* CTA */}
      <section className="container-page mt-24">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-border bg-surface p-8 sm:flex-row sm:items-center sm:p-12">
          <div>
            <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Bereit für den nächsten Schritt?</h2>
            <p className="mt-2 text-muted-foreground">Konto erstellen, Immobilie erfassen und kostenlos inserieren.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/verkaufen/start">Kostenlos starten</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/immobilien">
                <Search aria-hidden /> Immobilien suchen
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
