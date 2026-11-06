import type { Metadata } from "next";
import { ARTICLES, ARTICLE_CATEGORIES } from "@/lib/content/ratgeber";
import { PageIntro, CtaBand, Note } from "@/lib/content/components";
import { pageMetadata } from "@/lib/seo/metadata";
import { ArticleCard } from "./article-card";

export const metadata: Metadata = pageMetadata({
  title: "Ratgeber für Verkauf und Vermietung",
  description:
    "Praktische Ratgeber zum Verkaufen und Vermieten in der Schweiz: Unterlagen, Ablauf ohne Makler, Besichtigungen, Immobilienfotos, Mietinserat und Grundstückgewinnsteuer.",
  path: "/ratgeber",
});

export default function RatgeberPage() {
  return (
    <>
      <section className="bg-surface">
        <div className="container-page py-14 sm:py-20">
          <PageIntro
            eyebrow="Ratgeber"
            title="Gut vorbereitet verkaufen und vermieten"
            lead="Verständliche Anleitungen für Privatpersonen in der Schweiz – von den richtigen Unterlagen bis zur Übergabe."
          />
        </div>
      </section>

      <div className="container-page mt-12">
        <Note>
          Die Ratgeber bieten allgemeine Informationen und ersetzen keine Rechts- oder Steuerberatung. Kantonale Regeln können
          abweichen.
        </Note>
      </div>

      {ARTICLE_CATEGORIES.map((category) => {
        const articles = ARTICLES.filter((a) => a.category === category);
        if (!articles.length) return null;
        const id = `kategorie-${category.toLowerCase().replace(/[^a-z]+/g, "-")}`;
        return (
          <section key={category} aria-labelledby={id} className="container-page mt-14">
            <h2 id={id} className="font-display text-2xl font-extrabold tracking-tight sm:text-[1.75rem]">
              {category}
            </h2>
            <ul role="list" className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((article, index) => (
                <li key={article.slug}>
                  <ArticleCard article={article} priority={category === ARTICLE_CATEGORIES[0] && index < 2} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <CtaBand
        title="Bereit für den Verkauf?"
        text="Erfassen Sie Ihre Immobilie Schritt für Schritt – kostenlos und mit allen Werkzeugen für einen professionellen Auftritt."
        primary={{ href: "/verkaufen/start", label: "Kostenlos starten" }}
        secondary={{ href: "/so-funktionierts", label: "So funktioniert Immovia" }}
      />
    </>
  );
}
