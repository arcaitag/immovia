import { ListChecks } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

function formatFact(value: unknown): string {
  if (value === null || value === undefined) return "–";
  if (Array.isArray(value)) return value.map((item) => formatFact(item)).join(", ");
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .filter((v) => v !== null && v !== undefined && v !== "")
      .map((v) => formatFact(v))
      .join(" ");
  }
  return String(value);
}

/**
 * Transparenz: genau diese Angaben erhält die KI für die Texte (ohne Strasse, Hausnummer,
 * Koordinaten, Namen oder Kontaktdaten).
 */
export function DescriptionFacts({ facts }: { facts: Record<string, unknown> }) {
  const entries = Object.entries(facts);
  return (
    <Accordion type="single" collapsible className="rounded-2xl border border-border bg-card px-5">
      <AccordionItem value="facts" className="border-none">
        <AccordionTrigger className="py-4 text-left">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <ListChecks className="size-4 text-forest" aria-hidden /> Welche Angaben erhält die KI? ({entries.length})
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Nur diese erfassten Angaben werden übermittelt – ohne Strasse, Hausnummer, Koordinaten, Namen oder Kontaktdaten. Fehlt etwas Wichtiges,
            ergänzen Sie es im Schritt «Erfassen» und erstellen Sie die Texte neu.
          </p>
          <dl className="grid gap-x-6 gap-y-2 pb-4 text-sm sm:grid-cols-2">
            {entries.map(([key, value]) => (
              <div key={key} className="grid grid-cols-[minmax(0,10rem)_1fr] gap-3 border-b border-border/60 pb-2">
                <dt className="text-muted-foreground">{key}</dt>
                <dd className="font-medium">{formatFact(value)}</dd>
              </div>
            ))}
          </dl>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
