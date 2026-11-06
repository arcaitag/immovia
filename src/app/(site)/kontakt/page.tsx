import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CircleHelp, Mail, MapPin, Phone } from "lucide-react";
import { createPublicClient } from "@/lib/supabase/public";
import { formatPhone } from "@/lib/format";
import { PageIntro } from "@/lib/content/components";
import { pageMetadata } from "@/lib/seo/metadata";
import { ContactForm } from "./contact-form";

export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: "Kontakt",
  description: "Fragen zu Immovia, zu Ihrem Konto oder zu einem Inserat? Schreiben Sie uns über das Kontaktformular.",
  path: "/kontakt",
});

interface PlatformContact {
  email: string | null;
  phone: string | null;
  address: string | null;
}

/** Kontaktangaben aus den Plattform-Einstellungen (Administration), sofern hinterlegt. */
async function getPlatformContact(): Promise<PlatformContact> {
  const empty = { email: null, phone: null, address: null };
  const supabase = createPublicClient();
  if (!supabase) return empty;
  const { data } = await supabase.from("feature_settings").select("value").eq("key", "platform").maybeSingle();
  const value = data?.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return empty;
  const read = (key: string) => {
    const v = (value as Record<string, unknown>)[key];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  return { email: read("contact_email"), phone: read("contact_phone"), address: read("address") };
}

export default async function KontaktPage() {
  const contact = await getPlatformContact();
  const hasContact = Boolean(contact.email || contact.phone || contact.address);

  return (
    <>
      <section className="bg-surface">
        <div className="container-page py-14 sm:py-20">
          <PageIntro
            eyebrow="Kontakt"
            title="Wir helfen Ihnen gerne weiter"
            lead="Schreiben Sie uns über das Formular. Für Fragen zu einem bestimmten Inserat wenden Sie sich am schnellsten direkt über «Kontakt aufnehmen» im Inserat an die Inserentin oder den Inserenten."
          />
        </div>
      </section>

      <div className="container-page mt-12 grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section aria-labelledby="formular" className="relative rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8">
          <h2 id="formular" className="font-display text-2xl font-extrabold tracking-tight">
            Nachricht senden
          </h2>
          <p className="mb-6 mt-2 text-sm text-muted-foreground">Felder mit * sind Pflichtfelder.</p>
          <ContactForm />
        </section>

        <aside className="grid content-start gap-4">
          {hasContact ? (
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-lg font-bold">Direkter Kontakt</h2>
              <ul className="mt-4 grid gap-3 text-sm">
                {contact.email ? (
                  <li className="flex items-center gap-3">
                    <Mail className="size-4 text-brand" aria-hidden />
                    <a href={`mailto:${contact.email}`} className="font-medium hover:text-forest hover:underline">
                      {contact.email}
                    </a>
                  </li>
                ) : null}
                {contact.phone ? (
                  <li className="flex items-center gap-3">
                    <Phone className="size-4 text-brand" aria-hidden />
                    <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="font-medium hover:text-forest hover:underline">
                      {formatPhone(contact.phone)}
                    </a>
                  </li>
                ) : null}
                {contact.address ? (
                  <li className="flex items-start gap-3">
                    <MapPin className="mt-0.5 size-4 text-brand" aria-hidden />
                    <span className="whitespace-pre-line">{contact.address}</span>
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
          <Link
            href="/faq"
            className="flex items-start gap-4 rounded-2xl border border-border bg-card p-6 transition-colors hover:border-mint-300 hover:bg-mint-50"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-mint-100 text-forest">
              <CircleHelp className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block font-display font-bold">Häufige Fragen</span>
              <span className="mt-1 block text-sm text-muted-foreground">Schnelle Antworten zu Kosten, Inseraten, Bewertung und Datenschutz.</span>
            </span>
          </Link>
          <Link
            href="/ratgeber"
            className="flex items-start gap-4 rounded-2xl border border-border bg-card p-6 transition-colors hover:border-mint-300 hover:bg-mint-50"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-mint-100 text-forest">
              <BookOpen className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block font-display font-bold">Ratgeber</span>
              <span className="mt-1 block text-sm text-muted-foreground">Anleitungen zum Verkaufen und Vermieten in der Schweiz.</span>
            </span>
          </Link>
        </aside>
      </div>
    </>
  );
}
