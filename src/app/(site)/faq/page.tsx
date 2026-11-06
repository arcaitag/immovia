import type { Metadata } from "next";
import Link from "next/link";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FAQ, FAQ_CATEGORIES, type FaqItem } from "@/lib/content/faq";
import { CtaBand, PageIntro } from "@/lib/content/components";
import { JsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Häufige Fragen",
  description:
    "Antworten zu Kosten, Inseraten, Bewertung, Suche, Besichtigungen, Datenschutz und Firmenkonten bei Immovia, der Schweizer Immobilienplattform.",
  path: "/faq",
});

export default function FaqPage() {
  const categories = Object.entries(FAQ_CATEGORIES) as [FaqItem["category"], string][];
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }}
      />
      <section className="bg-surface">
        <div className="container-page py-14 sm:py-20">
          <PageIntro
            eyebrow="Hilfe"
            title="Häufige Fragen"
            lead={
              <>
                Kurze Antworten auf die wichtigsten Fragen. Ausführliche Anleitungen finden Sie im{" "}
                <Link href="/ratgeber" className="font-semibold text-primary underline-offset-4 hover:underline">
                  Ratgeber
                </Link>
                .
              </>
            }
          />
        </div>
      </section>

      <div className="container-page mt-12 grid gap-12 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="Kategorien" className="hidden lg:block">
          <ul className="sticky top-24 grid gap-1">
            {categories.map(([key, label]) =>
              FAQ.some((item) => item.category === key) ? (
                <li key={key}>
                  <a href={`#${key}`} className="block rounded-xl px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-mint-50 hover:text-forest">
                    {label}
                  </a>
                </li>
              ) : null,
            )}
          </ul>
        </nav>
        <div className="grid gap-12">
          {categories.map(([key, label]) => {
            const items = FAQ.filter((item) => item.category === key);
            if (!items.length) return null;
            return (
              <section key={key} id={key} aria-labelledby={`${key}-titel`} className="scroll-mt-24">
                <h2 id={`${key}-titel`} className="font-display text-2xl font-extrabold tracking-tight">
                  {label}
                </h2>
                <Accordion type="multiple" className="mt-3 border-t border-border">
                  {items.map((item) => (
                    <AccordionItem key={item.question} value={item.question}>
                      <AccordionTrigger>{item.question}</AccordionTrigger>
                      <AccordionContent>{item.answer}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>
            );
          })}
        </div>
      </div>

      <CtaBand
        title="Ihre Frage ist nicht dabei?"
        text="Schreiben Sie uns – wir antworten so rasch wie möglich."
        primary={{ href: "/kontakt", label: "Kontakt aufnehmen" }}
        secondary={{ href: "/ratgeber", label: "Zum Ratgeber" }}
      />
    </>
  );
}
