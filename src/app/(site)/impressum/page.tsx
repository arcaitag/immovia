import type { Metadata } from "next";
import Link from "next/link";
import { DraftNotice, LegalSection, PageIntro, Placeholder } from "@/lib/content/components";
import { LEGAL_DRAFT_DATE, LEGAL_PAGES_ARE_DRAFTS } from "@/lib/content/legal";
import { MARKETING_IMAGES } from "@/lib/marketing-images";
import { formatDateLong } from "@/lib/format";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Impressum",
  description: "Angaben zur Betreiberin der Plattform Immovia.",
  path: "/impressum",
  noindex: LEGAL_PAGES_ARE_DRAFTS,
});

export default function ImpressumPage() {
  const imageCredits = Object.values(MARKETING_IMAGES);
  return (
    <div className="container-page py-14 sm:py-20">
      <PageIntro eyebrow="Rechtliches" title="Impressum" lead={`Stand des Entwurfs: ${formatDateLong(LEGAL_DRAFT_DATE)}`} />
      {LEGAL_PAGES_ARE_DRAFTS ? <DraftNotice className="mt-8 max-w-3xl" /> : null}

      <div className="prose-immovia mt-10 max-w-3xl">
        <LegalSection id="betreiberin" title="Betreiberin">
          <p>
            <Placeholder>Firmenname</Placeholder>
            <br />
            <Placeholder>Rechtsform, z. B. GmbH oder AG</Placeholder>
            <br />
            <Placeholder>Strasse und Hausnummer</Placeholder>
            <br />
            <Placeholder>PLZ und Ort</Placeholder>
            <br />
            Schweiz
          </p>
        </LegalSection>

        <LegalSection id="kontakt" title="Kontakt">
          <p>
            E-Mail: <Placeholder>E-Mail-Adresse</Placeholder>
            <br />
            Telefon: <Placeholder>Telefonnummer, optional</Placeholder>
            <br />
            Online: <Link href="/kontakt">Kontaktformular</Link>
          </p>
        </LegalSection>

        <LegalSection id="vertretung" title="Vertretungsberechtigte Personen">
          <p>
            <Placeholder>Vorname Name, Funktion</Placeholder>
          </p>
        </LegalSection>

        <LegalSection id="register" title="Handelsregister und Unternehmens-Identifikation">
          <p>
            Eintrag im Handelsregister des Kantons <Placeholder>Kanton</Placeholder>
            <br />
            Unternehmens-Identifikationsnummer (UID): <Placeholder>CHE-xxx.xxx.xxx</Placeholder>
            <br />
            Mehrwertsteuernummer: <Placeholder>falls MWST-pflichtig</Placeholder>
          </p>
        </LegalSection>

        <LegalSection id="inhalte" title="Inhalte von Nutzerinnen und Nutzern">
          <p>
            Inserate, Bilder, Dokumente und Nachrichten werden von den jeweiligen Nutzerinnen und Nutzern erstellt. Diese sind
            für die Richtigkeit ihrer Angaben verantwortlich. Immovia ist nicht Partei von Kauf- oder Mietverträgen, die über die
            Plattform angebahnt werden. Inhalte, die gegen die Nutzungsbedingungen verstossen, können über die Funktion
            «Inserat melden» oder über das Kontaktformular gemeldet werden.
          </p>
        </LegalSection>

        <LegalSection id="haftung" title="Haftung für Inhalte und Links">
          <p>
            <Placeholder>Haftungshinweis durch Fachperson formulieren lassen</Placeholder>. Für Inhalte externer Websites, auf
            die verlinkt wird, sind ausschliesslich deren Betreiber verantwortlich.
          </p>
        </LegalSection>

        <LegalSection id="quellen" title="Bild- und Datenquellen">
          <ul>
            <li>Kartendaten und Ortssuche: © swisstopo (Bundesamt für Landestopografie), geo.admin.ch</li>
            <li>
              Marketing- und Beispielbilder: Unsplash (unsplash.com) –{" "}
              {imageCredits
                .map((image) => image.credit)
                .filter((credit, index, all) => all.indexOf(credit) === index)
                .join(", ")}
            </li>
            <li>Schriften: Inter und Manrope (SIL Open Font License), lokal ausgeliefert</li>
          </ul>
        </LegalSection>
      </div>
    </div>
  );
}
