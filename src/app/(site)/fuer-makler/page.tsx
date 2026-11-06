import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, Building2, CalendarCheck, FileText, Globe, Inbox, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheckList, CtaBand, SectionHeading } from "@/lib/content/components";
import { getPublicPlans } from "@/lib/content/settings";
import { MARKETING_IMAGES } from "@/lib/marketing-images";
import { formatChf, formatNumber } from "@/lib/format";
import { pageMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: "Für Immobilienfirmen und Makler",
  description:
    "Firmenkonto für Makler und Verwaltungen: mehrere Objekte, Mitarbeitende mit Rollen, gemeinsame Anfragen und Termine sowie ein öffentliches Firmenprofil.",
  path: "/fuer-makler",
});

const FEATURES = [
  { icon: Users, title: "Team mit Rollen", text: "Inhaber, Administratoren und Mitarbeitende – jede Person sieht nur die Objekte Ihrer Firma." },
  { icon: Inbox, title: "Gemeinsames Postfach", text: "Anfragen und Nachrichten zu Firmeninseraten sind für das ganze Team zugänglich." },
  { icon: CalendarCheck, title: "Besichtigungen im Team", text: "Zeitfenster planen, Termine bestätigen und private Notizen für Kolleginnen und Kollegen erfassen." },
  { icon: Globe, title: "Öffentliches Firmenprofil", text: "Logo, Beschreibung, Kontakt und alle aktuellen Inserate auf einer eigenen Seite." },
  { icon: FileText, title: "Dossiers und Texte", text: "Dieselben Werkzeuge wie für Privatpersonen: Bewertung, Bildbearbeitung, KI-Texte und Verkaufsdossier." },
  { icon: BarChart3, title: "Statistiken pro Inserat", text: "Aufrufe, Anfragen, Merklisten und Besichtigungen – aus tatsächlichen Ereignissen." },
];

export default async function FuerMaklerPage() {
  const businessPlans = (await getPublicPlans()).filter((plan) => plan.audience === "business");

  return (
    <>
      <section className="relative isolate overflow-hidden bg-forest text-white">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-brand/30 blur-3xl" aria-hidden />
        <div className="container-page relative grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-mint-200">Für Immobilienfirmen</p>
            <h1 className="mt-3 font-display text-[2.4rem] font-extrabold leading-[1.06] tracking-[-0.03em] text-white sm:text-5xl">
              Ein Konto für Ihr ganzes Team
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/80">
              Makler, Verwaltungen und Bauträger verwalten Objekte, Mitarbeitende und Interessenten zentral – mit
              öffentlichem Firmenprofil und klaren Rollen.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="xl" variant="secondary">
                <Link href={`/registrieren?weiter=${encodeURIComponent("/dashboard/firma")}`}>
                  <Building2 aria-hidden /> Firmenkonto erstellen
                </Link>
              </Button>
              <Button asChild size="xl" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <Link href="/kontakt">Kontakt aufnehmen</Link>
              </Button>
            </div>
          </div>
          <div className="relative hidden aspect-[4/3] overflow-hidden rounded-3xl lg:block">
            <Image src={MARKETING_IMAGES.auth.src} alt={MARKETING_IMAGES.auth.alt} fill priority sizes="40vw" className="object-cover" />
          </div>
        </div>
      </section>

      <section className="container-page mt-20" aria-labelledby="funktionen">
        <SectionHeading id="funktionen" eyebrow="Funktionen" title="Gemacht für die Zusammenarbeit" />
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="rounded-2xl border border-border bg-white p-6 shadow-card">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-mint-100 text-forest">
                <feature.icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-24 bg-surface py-20" aria-labelledby="start">
        <div className="container-page grid gap-12 lg:grid-cols-2 lg:items-start">
          <div>
            <SectionHeading id="start" eyebrow="Einrichtung" title="In wenigen Minuten startklar" />
            <ol className="mt-8 grid gap-4">
              {[
                { icon: UserPlus, text: "Konto registrieren und als Kontotyp «Immobilienfirma» wählen." },
                { icon: Building2, text: "Im Dashboard unter «Firmenkonto» Ihre Firma mit Logo und Kontaktangaben anlegen." },
                { icon: Users, text: "Mitarbeitende per E-Mail einladen und Rollen vergeben." },
                { icon: FileText, text: "Objekte erfassen und im Namen der Firma veröffentlichen." },
              ].map((step, index) => (
                <li key={step.text} className="flex items-start gap-4 rounded-2xl bg-white p-5 shadow-card">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint-100 font-display font-bold text-forest">
                    {index + 1}
                  </span>
                  <p className="pt-2 text-[0.9375rem]">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-3xl border border-border bg-white p-8 shadow-card">
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-brand">Konditionen</p>
            <h2 className="mt-3 font-display text-2xl font-extrabold tracking-tight">Startphase ohne Kosten</h2>
            <p className="mt-3 text-muted-foreground">
              Firmenkonten sind in der Startphase kostenlos. Sie brauchen keine Kreditkarte. Über künftige Angebote informieren
              wir rechtzeitig.
            </p>
            {businessPlans.length ? (
              <ul className="mt-6 grid gap-3">
                {businessPlans.map((plan) => (
                  <li key={plan.id} className="rounded-2xl border border-border bg-surface p-5">
                    <p className="font-display font-bold">{plan.name}</p>
                    <CheckList
                      className="mt-3 text-sm"
                      items={[
                        plan.priceChfMonthly > 0 ? `${formatChf(plan.priceChfMonthly)} pro Monat` : "Kostenlos",
                        ...(plan.activeListings !== null ? [`Bis ${formatNumber(plan.activeListings)} aktive Inserate`] : []),
                        ...(plan.members !== null ? [`Bis ${formatNumber(plan.members)} Teammitglieder`] : []),
                      ]}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
            <Button asChild className="mt-6">
              <Link href={`/registrieren?weiter=${encodeURIComponent("/dashboard/firma")}`}>
                Jetzt Firmenkonto erstellen <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <CtaBand
        title="Fragen zu Firmenkonten?"
        text="Wir beraten Sie gerne bei der Einrichtung für Ihr Team."
        primary={{ href: "/kontakt", label: "Kontakt aufnehmen" }}
        secondary={{ href: "/faq#firmen", label: "Häufige Fragen" }}
      />
    </>
  );
}
