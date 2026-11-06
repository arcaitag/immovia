import Link from "next/link";
import { Logo } from "@/components/layout/logo";

const COLUMNS = [
  {
    title: "Immobilien",
    links: [
      { href: "/immobilien", label: "Immobilien suchen" },
      { href: "/kaufen", label: "Kaufen" },
      { href: "/mieten", label: "Mieten" },
      { href: "/immobilien?neubau=1", label: "Neubauprojekte" },
    ],
  },
  {
    title: "Verkaufen",
    links: [
      { href: "/verkaufen", label: "Immobilie verkaufen" },
      { href: "/bewerten", label: "Immobilie bewerten" },
      { href: "/so-funktionierts", label: "So funktioniert Immovia" },
      { href: "/fuer-makler", label: "Für Immobilienfirmen" },
    ],
  },
  {
    title: "Hilfe",
    links: [
      { href: "/ratgeber", label: "Ratgeber" },
      { href: "/faq", label: "Häufige Fragen" },
      { href: "/kontakt", label: "Kontakt" },
    ],
  },
  {
    title: "Rechtliches",
    links: [
      { href: "/impressum", label: "Impressum" },
      { href: "/datenschutz", label: "Datenschutz" },
      { href: "/agb", label: "AGB" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-surface">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            Die Schweizer Plattform, um Immobilien selbst zu bewerten, professionell zu verkaufen und Interessenten an
            einem Ort zu verwalten.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h2 className="text-sm font-bold text-foreground">{col.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-forest">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Immovia. Alle Rechte vorbehalten.</p>
          <p>Kartendaten © swisstopo · Beispielbilder: Unsplash</p>
        </div>
      </div>
    </footer>
  );
}
