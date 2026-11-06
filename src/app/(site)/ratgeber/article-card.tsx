import Image from "next/image";
import Link from "next/link";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { readingMinutes, type Article } from "@/lib/content/ratgeber";

export function ArticleCard({ article, priority = false }: { article: Article; priority?: boolean }) {
  return (
    <Link
      href={`/ratgeber/${article.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        <Image
          src={article.image.src}
          alt=""
          fill
          priority={priority}
          sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Badge tone="green">{article.category}</Badge>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden /> {readingMinutes(article)} Min. Lesezeit
          </span>
        </div>
        <h3 className="font-display text-lg font-bold leading-snug group-hover:text-forest">{article.title}</h3>
        <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{article.description}</p>
      </div>
    </Link>
  );
}
