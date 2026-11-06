import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ARTICLES, getArticle, readingMinutes, type ArticleBlock } from "@/lib/content/ratgeber";
import { CheckList, Note } from "@/lib/content/components";
import { formatDateLong } from "@/lib/format";
import { JsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { buildBreadcrumbJsonLd } from "@/lib/seo/listing-jsonld";
import { absoluteUrl } from "@/lib/seo/site";
import { ArticleCard } from "../article-card";

export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return ARTICLES.map((article) => ({ slug: article.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return { title: "Artikel nicht gefunden", robots: { index: false } };
  return pageMetadata({
    title: article.title,
    description: article.description,
    path: `/ratgeber/${article.slug}`,
    type: "article",
    modifiedTime: article.updatedAt,
    images: [{ url: `${article.image.src}?w=1200&q=75&auto=format&fit=crop`, alt: article.image.alt }],
  });
}

const PROSE_TYPES = new Set<ArticleBlock["type"]>(["p", "h2", "h3", "ul", "ol"]);

/** Fasst aufeinanderfolgende Textblöcke zusammen, damit Hinweise und Checklisten nicht vom Prosa-Stil erfasst werden. */
function groupBlocks(blocks: ArticleBlock[]): { prose: boolean; blocks: ArticleBlock[] }[] {
  const groups: { prose: boolean; blocks: ArticleBlock[] }[] = [];
  for (const block of blocks) {
    const prose = PROSE_TYPES.has(block.type);
    const last = groups[groups.length - 1];
    if (last && last.prose && prose) last.blocks.push(block);
    else groups.push({ prose, blocks: [block] });
  }
  return groups;
}

function Block({ block }: { block: ArticleBlock }) {
  switch (block.type) {
    case "p":
      return <p>{block.text}</p>;
    case "h2":
      return (
        <h2 id={block.id} className="scroll-mt-24">
          {block.text}
        </h2>
      );
    case "h3":
      return <h3>{block.text}</h3>;
    case "ul":
      return (
        <ul>
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol>
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      );
    case "checklist":
      return (
        <div className="my-8 rounded-2xl border border-border bg-surface p-6">
          <p className="mb-4 font-display text-lg font-bold">Checkliste</p>
          <CheckList items={block.items} />
        </div>
      );
    case "note":
      return (
        <Note title={block.title} tone={block.tone}>
          {block.text}
        </Note>
      );
  }
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const headings = article.blocks.filter((b): b is Extract<ArticleBlock, { type: "h2" }> => b.type === "h2");
  const related = article.related.map(getArticle).filter((a): a is NonNullable<typeof a> => Boolean(a));
  const url = absoluteUrl(`/ratgeber/${article.slug}`);

  return (
    <article className="pb-4">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: article.title,
          description: article.description,
          dateModified: article.updatedAt,
          inLanguage: "de-CH",
          mainEntityOfPage: url,
          image: [`${article.image.src}?w=1200&q=75&auto=format&fit=crop`],
          publisher: { "@type": "Organization", name: "Immovia", url: absoluteUrl("/") },
        }}
      />
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Ratgeber", url: absoluteUrl("/ratgeber") },
          { name: article.title, url },
        ])}
      />

      <header className="bg-surface">
        <div className="container-page py-10 sm:py-14">
          <Link href="/ratgeber" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            <ArrowLeft className="size-4" aria-hidden /> Alle Ratgeber
          </Link>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <Badge tone="green">{article.category}</Badge>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-4" aria-hidden /> {readingMinutes(article)} Min. Lesezeit
            </span>
            <span>
              Stand: <time dateTime={article.updatedAt}>{formatDateLong(article.updatedAt)}</time>
            </span>
          </div>
          <h1 className="mt-4 max-w-3xl font-display text-[2rem] font-extrabold leading-[1.1] tracking-[-0.03em] text-forest sm:text-[2.75rem]">
            {article.title}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/75">{article.description}</p>
        </div>
      </header>

      <div className="container-page mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0 max-w-3xl">
          <div className="relative aspect-[16/8] overflow-hidden rounded-3xl bg-muted">
            <Image src={article.image.src} alt={article.image.alt} fill priority sizes="(min-width: 1024px) 760px, 100vw" className="object-cover" />
          </div>

          <Note tone={article.legalTopic ? "warning" : "info"} title="Keine Rechts- oder Steuerberatung">
            Dieser Ratgeber gibt einen allgemeinen Überblick für die Schweiz. Kantonale Regeln können abweichen. Für Ihren
            Einzelfall wenden Sie sich an eine Fachperson, etwa ein Notariat, eine Steuerberatung oder die zuständige Behörde.
          </Note>

          {groupBlocks(article.blocks).map((group, groupIndex) =>
            group.prose ? (
              <div key={groupIndex} className="prose-immovia text-[1.0625rem]">
                {group.blocks.map((block, index) => (
                  <Block key={index} block={block} />
                ))}
              </div>
            ) : (
              group.blocks.map((block, index) => <Block key={`${groupIndex}-${index}`} block={block} />)
            ),
          )}

          {article.cta ? (
            <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl bg-mint-100 p-6 text-forest sm:flex-row sm:items-center sm:justify-between">
              <p className="font-display text-lg font-bold">Mit Immovia umsetzen</p>
              <Button asChild>
                <Link href={article.cta.href}>
                  {article.cta.label} <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
          ) : null}
        </div>

        {headings.length > 1 ? (
          <aside aria-label="Inhalt" className="hidden lg:block">
            <nav className="sticky top-24 rounded-2xl border border-border bg-card p-5">
              <p className="text-sm font-bold">Inhalt</p>
              <ol className="mt-3 grid gap-2 text-sm">
                {headings.map((heading) => (
                  <li key={heading.id}>
                    <a href={`#${heading.id}`} className="text-muted-foreground transition-colors hover:text-forest">
                      {heading.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>
        ) : null}
      </div>

      {related.length ? (
        <section aria-labelledby="weitere-ratgeber" className="container-page mt-20">
          <h2 id="weitere-ratgeber" className="font-display text-2xl font-extrabold tracking-tight">
            Weitere Ratgeber
          </h2>
          <ul role="list" className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <li key={item.slug}>
                <ArticleCard article={item} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
