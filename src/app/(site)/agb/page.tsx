import type { Metadata } from "next";
import Link from "next/link";
import { DraftNotice, LegalSection, PageIntro, Placeholder } from "@/lib/content/components";
import { LEGAL_DRAFT_DATE, LEGAL_PAGES_ARE_DRAFTS } from "@/lib/content/legal";
import { formatDateLong } from "@/lib/format";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Allgemeine Geschäftsbedingungen",
  description: "Nutzungsbedingungen der Immobilienplattform Immovia.",
  path: "/agb",
  noindex: LEGAL_PAGES_ARE_DRAFTS,
});

export default function AgbPage() {
  return (
    <div className="container-page py-14 sm:py-20">
      <PageIntro
        eyebrow="Rechtliches"
        title="Allgemeine Geschäftsbedingungen"
        lead={`Nutzungsbedingungen für die Plattform Immovia. Stand des Entwurfs: ${formatDateLong(LEGAL_DRAFT_DATE)}`}
      />
      {LEGAL_PAGES_ARE_DRAFTS ? <DraftNotice className="mt-8 max-w-3xl" /> : null}

      <div className="prose-immovia mt-10 max-w-3xl">
        <LegalSection id="geltung" title="1. Geltungsbereich">
          <p>
            Diese Bedingungen regeln die Nutzung der Plattform Immovia, betrieben von <Placeholder>Firmenname, Sitz</Placeholder>{" "}
            («Immovia»). Mit der Registrierung bzw. Nutzung akzeptieren Sie diese Bedingungen.
          </p>
        </LegalSection>

        <LegalSection id="leistungen" title="2. Leistungen">
          <p>
            Immovia stellt eine Plattform bereit, auf der Immobilien erfasst, bewertet, inseriert und gesucht sowie
            Kontakte und Besichtigungen organisiert werden können. Immovia ist nicht Partei der zwischen Nutzerinnen und Nutzern
            abgeschlossenen Kauf- oder Mietverträge und übernimmt keine Maklertätigkeit.
          </p>
          <p>
            Die Grundfunktionen sind für Privatpersonen kostenlos. Für rechenintensive Funktionen wie KI-Texte, Bewertungen oder
            Bildbearbeitung gelten Kontingente, die Immovia festlegen und anpassen kann. Kostenpflichtige Leistungen werden vor
            einer allfälligen Einführung separat geregelt. <Placeholder>Regelung zu künftigen Preisen prüfen</Placeholder>
          </p>
        </LegalSection>

        <LegalSection id="konto" title="3. Benutzerkonto">
          <ul>
            <li>Ihre Angaben müssen wahr und aktuell sein. Pro Person ist ein privates Konto vorgesehen.</li>
            <li>Sie halten Ihre Zugangsdaten geheim und informieren uns bei Verdacht auf Missbrauch.</li>
            <li>Firmenkonten verwalten ihre Mitarbeitenden und Rollen selbst und sind für deren Handlungen verantwortlich.</li>
          </ul>
        </LegalSection>

        <LegalSection id="inserate" title="4. Inserate und Inhalte">
          <ul>
            <li>Sie inserieren nur Objekte, über die Sie verfügen dürfen oder für die Sie beauftragt sind.</li>
            <li>Angaben, Preise und Bilder müssen wahrheitsgetreu sein. Bekannte Mängel dürfen nicht verschleiert werden.</li>
            <li>
              Sie verfügen über die Rechte an hochgeladenen Bildern und Dokumenten. Mit KI veränderte Bilder werden als solche
              gekennzeichnet; das Entfernen dieser Kennzeichnung ist nicht erlaubt.
            </li>
            <li>Diskriminierende, irreführende oder rechtswidrige Inhalte sind untersagt.</li>
            <li>
              Sie räumen Immovia das Recht ein, Ihre Inhalte zum Betrieb der Plattform zu speichern, technisch zu bearbeiten (z.
              B. Bildgrössen) und anzuzeigen. <Placeholder>Umfang der Nutzungsrechte prüfen</Placeholder>
            </li>
          </ul>
        </LegalSection>

        <LegalSection id="kommunikation" title="5. Kommunikation">
          <p>
            Nachrichten und Anfragen dienen der Kontaktaufnahme zu konkreten Inseraten. Werbung, Spam und belästigende Inhalte
            sind untersagt. Nutzerinnen und Nutzer können andere Personen blockieren und Inhalte melden.
          </p>
        </LegalSection>

        <LegalSection id="ki" title="6. KI-Funktionen und Bewertungen">
          <p>
            KI-Texte sind Vorschläge, die Sie vor der Veröffentlichung prüfen und verantworten. Bewertungen sind unverbindliche
            Einschätzungen auf Basis der ausgewiesenen Datenquellen und ersetzen kein Gutachten. Reichen die Daten nicht aus,
            wird keine Zahl ausgewiesen.
          </p>
        </LegalSection>

        <LegalSection id="moderation" title="7. Moderation und Sperrung">
          <p>
            Immovia kann Inhalte prüfen, Inserate deaktivieren und Konten sperren, wenn Hinweise auf einen Verstoss gegen diese
            Bedingungen oder geltendes Recht vorliegen. Betroffene werden informiert, soweit dies zulässig ist.
          </p>
        </LegalSection>

        <LegalSection id="haftung" title="8. Haftung">
          <p>
            <Placeholder>Haftungsregelung durch Fachperson formulieren lassen</Placeholder>
          </p>
        </LegalSection>

        <LegalSection id="datenschutz" title="9. Datenschutz">
          <p>
            Wie wir Personendaten bearbeiten, beschreibt die <Link href="/datenschutz">Datenschutzerklärung</Link>.
          </p>
        </LegalSection>

        <LegalSection id="aenderungen" title="10. Änderungen und Kündigung">
          <p>
            Immovia kann diese Bedingungen anpassen und informiert registrierte Nutzerinnen und Nutzer rechtzeitig. Sie können
            Ihr Konto jederzeit in den Einstellungen löschen. <Placeholder>Ankündigungsfrist und Kündigungsregeln festlegen</Placeholder>
          </p>
        </LegalSection>

        <LegalSection id="recht" title="11. Anwendbares Recht und Gerichtsstand">
          <p>
            Es gilt Schweizer Recht. Gerichtsstand ist <Placeholder>Ort</Placeholder>, soweit keine zwingenden
            Gerichtsstände bestehen, insbesondere für Konsumentinnen und Konsumenten.
          </p>
        </LegalSection>
      </div>
    </div>
  );
}
