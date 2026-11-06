import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  CalendarCheck,
  EyeOff,
  FileText,
  Flag,
  FolderLock,
  Gauge,
  Heart,
  HousePlus,
  MessageSquare,
  Rocket,
  Search,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CtaBand, PageIntro, SectionHeading } from "@/lib/content/components";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "So funktioniert Immovia",
  description:
    "Verkaufen, vermieten oder suchen: So funktionieren Inserat, Bewertung, Dossier, Suche, Merkliste, Suchauftrag, Anfrage und Besichtigung auf Immovia.",
  path: "/so-funktionierts",
});

const SELLER_STEPS = [
  { icon: HousePlus, title: "Immobilie erfassen", text: "Der Assistent führt durch alle Angaben und speichert automatisch." },
  { icon: Gauge, title: "Bewerten", text: "Preisspanne mit offengelegter Datenbasis – oder ein ehrlicher Hinweis, wenn die Daten fehlen." },
  { icon: FileText, title: "Präsentieren", text: "Bilder optimieren, Texte erstellen, Verkaufsdossier erzeugen." },
  { icon: Rocket, title: "Veröffentlichen", text: "Preis, Kontakt und Adressgenauigkeit festlegen und online stellen." },
  { icon: MessageSquare, title: "Interessenten betreuen", text: "Nachrichten beantworten, Besichtigungen planen, Unterlagen freigeben." },
];

const BUYER_STEPS = [
  { icon: Search, title: "Suchen", text: "Nach Ort, Umkreis, Preis, Zimmern, Fläche und Ausstattung filtern – als Liste oder auf der Karte." },
  { icon: Heart, title: "Merken", text: "Interessante Inserate auf die Merkliste setzen und später vergleichen." },
  { icon: Bell, title: "Suchauftrag", text: "Suche speichern und bei neuen passenden Inseraten benachrichtigt werden – pro Inserat einmal." },
  { icon: MessageSquare, title: "Anfragen", text: "Direkt über die Plattform schreiben; Ihre E-Mail-Adresse bleibt verborgen." },
  { icon: CalendarCheck, title: "Besichtigen", text: "Freie Zeitfenster buchen oder per Nachricht einen Termin vorschlagen." },
];

const PRINCIPLES = [
  { icon: EyeOff, title: "Adresse nach Wahl", text: "Inserierende bestimmen, ob die exakte Adresse, nur die Strasse oder nur der Ort sichtbar ist." },
  { icon: FolderLock, title: "Geschützte Unterlagen", text: "Dokumente sind privat und werden nur gezielt und widerrufbar freigegeben." },
  { icon: BadgeCheck, title: "Ehrliche Kennzeichnungen", text: "Verifizierungen erscheinen nur nach echter Prüfung. «E-Mail bestätigt» ist kein Eigentumsnachweis." },
  { icon: Flag, title: "Melden und Moderation", text: "Verdächtige Inserate können gemeldet werden; das Immovia-Team prüft jede Meldung." },
  { icon: Server, title: "Daten in der Schweiz", text: "Die Datenbank liegt in der Region Zürich. Details in der Datenschutzerklärung." },
];

function StepList({ steps }: { steps: typeof SELLER_STEPS }) {
  return (
    <ol className="mt-8 grid gap-4">
      {steps.map((step, index) => (
        <li key={step.title} className="flex gap-4 rounded-2xl border border-border bg-white p-5 shadow-card">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-mint-100 text-forest">
            <step.icon className="size-5" aria-hidden />
          </span>
          <div>
            <h3 className="font-display font-bold">
              <span className="text-brand">{index + 1}.</span> {step.title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function SoFunktioniertsPage() {
  return (
    <>
      <section className="bg-surface">
        <div className="container-page py-14 sm:py-20">
          <PageIntro
            eyebrow="So funktioniert Immovia"
            title="Eine Plattform für den ganzen Weg"
            lead="Ob Sie verkaufen, vermieten oder ein neues Zuhause suchen: Alles läuft an einem Ort zusammen – verständlich, sicher und ohne versteckte Kosten."
          >
            <Button asChild size="lg">
              <Link href="/verkaufen/start">
                Kostenlos starten <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-white">
              <Link href="/immobilien">
                <Search aria-hidden /> Immobilien suchen
              </Link>
            </Button>
          </PageIntro>
        </div>
      </section>

      <div className="container-page mt-20 grid gap-14 lg:grid-cols-2">
        <section aria-labelledby="verkaufen">
          <SectionHeading id="verkaufen" eyebrow="Für Verkäufer und Vermieter" title="Selbst verkaufen und vermieten" />
          <StepList steps={SELLER_STEPS} />
          <Link href="/verkaufen" className="mt-6 inline-flex items-center gap-2 font-semibold text-primary hover:underline">
            Alle Funktionen für Inserierende <ArrowRight className="size-4" aria-hidden />
          </Link>
        </section>
        <section aria-labelledby="suchen">
          <SectionHeading id="suchen" eyebrow="Für Suchende" title="Finden, merken, besichtigen" />
          <StepList steps={BUYER_STEPS} />
          <Link href="/immobilien" className="mt-6 inline-flex items-center gap-2 font-semibold text-primary hover:underline">
            Zur Immobiliensuche <ArrowRight className="size-4" aria-hidden />
          </Link>
        </section>
      </div>

      <section className="mt-24 bg-surface py-20" aria-labelledby="grundsaetze">
        <div className="container-page">
          <SectionHeading id="grundsaetze" eyebrow="Vertrauen" title="Unsere Grundsätze" />
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map((item) => (
              <li key={item.title} className="rounded-2xl border border-border bg-white p-6 shadow-card">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-mint-100 text-forest">
                  <item.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-display text-lg font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaBand
        title="Noch Fragen?"
        text="In den häufigen Fragen und im Ratgeber finden Sie ausführliche Antworten."
        primary={{ href: "/faq", label: "Häufige Fragen" }}
        secondary={{ href: "/ratgeber", label: "Ratgeber" }}
      />
    </>
  );
}
