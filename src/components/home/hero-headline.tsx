import { Fragment } from "react";
import { UnderlineSwoosh } from "@/components/home/underline-swoosh";

const WORDS = ["Immobilien.", "Einfach.", "Digital."] as const;

/**
 * Titel der Startseite. Die drei Wörter steigen nacheinander aus einer Maske auf, danach zeichnet
 * sich der Strich unter «Digital.» (nur CSS, siehe .hero-word in globals.css). Bei reduzierter
 * Bewegung steht alles sofort da; Suchmaschinen und Screenreader erhalten den vollständigen Text.
 */
export function HeroHeadline({ id, className }: { id?: string; className?: string }) {
  return (
    <h1 id={id} className={className}>
      {WORDS.map((word, index) => {
        const masked = (
          <span className="hero-word">
            <span style={{ animationDelay: `${100 + index * 140}ms` }}>{word}</span>
          </span>
        );
        return (
          <Fragment key={word}>
            {index > 0 ? " " : null}
            {index === WORDS.length - 1 ? (
              <span className="relative inline-block align-top">
                {masked}
                <UnderlineSwoosh className="hero-swoosh absolute -bottom-3 left-0 h-3 w-[92%] text-brand" />
              </span>
            ) : (
              masked
            )}
          </Fragment>
        );
      })}
    </h1>
  );
}
