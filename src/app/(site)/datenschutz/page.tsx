import type { Metadata } from "next";
import Link from "next/link";
import { DraftNotice, LegalSection, PageIntro, Placeholder } from "@/lib/content/components";
import { LEGAL_DRAFT_DATE, LEGAL_PAGES_ARE_DRAFTS } from "@/lib/content/legal";
import { formatDateLong } from "@/lib/format";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Datenschutzerklärung",
  description:
    "Wie Immovia Personendaten bearbeitet: Konto, Inserate, Nachrichten, Statistik, Cookies, Drittanbieter (Supabase, Vercel, Anthropic, Resend, swisstopo) und Ihre Rechte nach DSG.",
  path: "/datenschutz",
  noindex: LEGAL_PAGES_ARE_DRAFTS,
});

const TOC = [
  { id: "verantwortlich", label: "Verantwortliche Stelle" },
  { id: "daten", label: "Welche Daten wir bearbeiten" },
  { id: "zwecke", label: "Zwecke und Grundlagen" },
  { id: "oeffentlich", label: "Öffentlich sichtbare Angaben" },
  { id: "dienstleister", label: "Dienstleister und Drittanbieter" },
  { id: "ausland", label: "Bekanntgabe ins Ausland" },
  { id: "cookies", label: "Cookies und lokale Speicherung" },
  { id: "statistik", label: "Aufrufstatistik von Inseraten" },
  { id: "ki", label: "Künstliche Intelligenz" },
  { id: "aufbewahrung", label: "Aufbewahrung und Löschung" },
  { id: "sicherheit", label: "Datensicherheit" },
  { id: "rechte", label: "Ihre Rechte" },
  { id: "aenderungen", label: "Änderungen" },
];

export default function DatenschutzPage() {
  return (
    <div className="container-page py-14 sm:py-20">
      <PageIntro
        eyebrow="Rechtliches"
        title="Datenschutzerklärung"
        lead={`Wie Immovia mit Ihren Personendaten umgeht. Stand des Entwurfs: ${formatDateLong(LEGAL_DRAFT_DATE)}`}
      />
      {LEGAL_PAGES_ARE_DRAFTS ? <DraftNotice className="mt-8 max-w-3xl" /> : null}

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="prose-immovia min-w-0 max-w-3xl">
          <p>
            Diese Datenschutzerklärung beschreibt, welche Personendaten bei der Nutzung von Immovia bearbeitet werden. Sie
            richtet sich nach dem Schweizer Bundesgesetz über den Datenschutz (DSG) und berücksichtigt, soweit anwendbar, die
            Datenschutz-Grundverordnung der EU (DSGVO).
          </p>

          <LegalSection id="verantwortlich" title="1. Verantwortliche Stelle">
            <p>
              Verantwortlich für die Datenbearbeitung ist <Placeholder>Firmenname, Rechtsform</Placeholder>,{" "}
              <Placeholder>Adresse</Placeholder>, E-Mail <Placeholder>Datenschutz-E-Mail-Adresse</Placeholder>.
            </p>
            <p>
              Vertretung in der EU (falls nach DSGVO erforderlich): <Placeholder>Name und Adresse oder «nicht erforderlich»</Placeholder>.
            </p>
          </LegalSection>

          <LegalSection id="daten" title="2. Welche Daten wir bearbeiten">
            <h3>Benutzerkonto</h3>
            <p>
              Name, Anzeigename, E-Mail-Adresse, Passwort (nur verschlüsselt als Hash gespeichert), optional Telefonnummer und
              Profilbild, Kontotyp, Sprache sowie Ihre Einstellungen zu Benachrichtigungen und Einwilligungen.
            </p>
            <h3>Immobilien, Inserate, Bilder und Dokumente</h3>
            <p>
              Angaben zu Ihren Immobilien inklusive der exakten Adresse. Öffentlich erscheint der Standort nur so genau, wie Sie
              es wählen (exakte Adresse, nur Strasse oder nur Ort). Hochgeladene Originalbilder liegen in einem privaten
              Speicherbereich; die öffentlichen Bildversionen werden neu erzeugt und enthalten keine eingebetteten Standort- oder
              Kameradaten (EXIF). Dokumente sind privat und nur über von Ihnen erteilte, widerrufbare Freigaben abrufbar.
            </p>
            <h3>Kommunikation</h3>
            <p>
              Anfragen, Nachrichten, Besichtigungstermine und deren Status. Notizen, die Inserentinnen und Inserenten zu
              Interessierten oder Terminen erfassen, sind nur für diese sichtbar.
            </p>
            <h3>Suche</h3>
            <p>Merkliste und gespeicherte Suchaufträge mit Ihren Suchkriterien.</p>
            <h3>Kontaktformular</h3>
            <p>Name, E-Mail-Adresse, Thema und Nachricht sowie, falls Sie angemeldet sind, die Zuordnung zu Ihrem Konto.</p>
            <h3>Schutz vor Missbrauch</h3>
            <p>
              Um Spam und Missbrauch zu verhindern, zählen wir Anfragen pro Benutzerkonto bzw. E-Mail-Adresse in kurzen
              Zeitfenstern. Diese Zähler werden nach kurzer Zeit automatisch gelöscht.
            </p>
            <h3>Technische Daten</h3>
            <p>
              Beim Aufruf der Website verarbeitet unsere Hosting-Anbieterin technisch notwendige Daten wie IP-Adresse,
              Zeitpunkt, aufgerufene Adresse und Browserinformationen in Server-Protokollen. Aufbewahrungsdauer:{" "}
              <Placeholder>gemäss Einstellungen der Hosting-Anbieterin ergänzen</Placeholder>.
            </p>
          </LegalSection>

          <LegalSection id="zwecke" title="3. Zwecke und Grundlagen">
            <ul>
              <li>Bereitstellung der Plattform und Ihres Kontos (Vertrag bzw. Nutzungsverhältnis).</li>
              <li>Veröffentlichung von Inseraten und Vermittlung des Kontakts zwischen Inserierenden und Interessierten.</li>
              <li>Benachrichtigungen im Dashboard und per E-Mail gemäss Ihren Einstellungen.</li>
              <li>Sicherheit, Missbrauchsbekämpfung und Moderation gemeldeter Inhalte (berechtigtes Interesse).</li>
              <li>Anonyme Aufrufstatistik für Inserentinnen und Inserenten (berechtigtes Interesse).</li>
              <li>KI-Funktionen nur, wenn Sie diese selbst auslösen.</li>
            </ul>
            <p>
              Soweit die DSGVO anwendbar ist, stützen wir uns auf Art. 6 Abs. 1 lit. b (Vertrag), lit. f (berechtigtes
              Interesse) und, wo vorgesehen, lit. a (Einwilligung) DSGVO. <Placeholder>Rechtsgrundlagen fachlich prüfen</Placeholder>
            </p>
          </LegalSection>

          <LegalSection id="oeffentlich" title="4. Öffentlich sichtbare Angaben">
            <p>
              Für alle Besucherinnen und Besucher sichtbar sind veröffentlichte Inserate mit Bildern, Texten und dem Standort in
              der von Ihnen gewählten Genauigkeit sowie Ihr Anzeigename, Ihr Profilbild, der Kontotyp, «Mitglied seit» und
              tatsächlich durchgeführte Verifizierungen. Ihre E-Mail-Adresse wird nicht angezeigt. Eine Telefonnummer erscheint
              nur, wenn Sie dies im Inserat ausdrücklich aktivieren. Firmenprofile zeigen die von der Firma hinterlegten
              Kontaktangaben.
            </p>
          </LegalSection>

          <LegalSection id="dienstleister" title="5. Dienstleister und Drittanbieter">
            <p>Wir setzen folgende Dienstleister ein, die Daten in unserem Auftrag bearbeiten:</p>
            <ul>
              <li>
                <strong>Supabase</strong> – Datenbank, Anmeldung und Dateispeicher. Die Daten werden in der Region Zürich
                (eu-central-2) gespeichert. Vertragspartnerin und Sitz: <Placeholder>prüfen und ergänzen</Placeholder>.
              </li>
              <li>
                <strong>Vercel</strong> – Hosting der Website. Serverfunktionen laufen in der Region Frankfurt (fra1); statische
                Inhalte werden über das weltweite Netzwerk von Vercel ausgeliefert. Vertragspartnerin: Vercel Inc., USA{" "}
                <Placeholder>prüfen</Placeholder>.
              </li>
              <li>
                <strong>Anthropic</strong> – KI-Texte, Erklärungen zur Bewertung und KI-Assistent. Übermittelt werden nur die für
                die jeweilige Funktion nötigen Angaben (z. B. Objektdaten oder Ihre Frage an den Assistenten), und nur wenn Sie die
                Funktion auslösen. Bedingungen zur Datenverwendung: <Placeholder>Vertragsbedingungen prüfen und ergänzen</Placeholder>.
              </li>
              <li>
                <strong>Resend</strong> – Versand von E-Mails (E-Mail-Adresse und Inhalt der Benachrichtigung).{" "}
                <Placeholder>Vertragspartnerin und Sitz ergänzen</Placeholder>
              </li>
              <li>
                <strong>swisstopo / geo.admin.ch</strong> (Bundesamt für Landestopografie) – Karten und Ortssuche. Die
                Kartenkacheln lädt Ihr Browser direkt von vectortiles.geo.admin.ch; dabei wird Ihre IP-Adresse an die
                Bundesgeodaten-Infrastruktur übermittelt. Die Orts- und Adresssuche läuft über unseren Server, sodass Ihre
                IP-Adresse dabei nicht weitergegeben wird.
              </li>
              <li>
                <strong>Unsplash</strong> – Beispiel- und Demobilder werden von images.unsplash.com geladen; dabei wird Ihre
                IP-Adresse an Unsplash übermittelt.
              </li>
            </ul>
            <p>Schriften werden von unserem eigenen Server ausgeliefert. Es findet keine Abfrage bei Google Fonts statt.</p>
          </LegalSection>

          <LegalSection id="ausland" title="6. Bekanntgabe ins Ausland">
            <p>
              Einzelne Dienstleister haben ihren Sitz in den USA oder können von dort auf Daten zugreifen. Eine Bekanntgabe
              erfolgt nur mit geeigneten Garantien, etwa einer Zertifizierung nach dem Swiss-U.S. Data Privacy Framework oder
              Standardvertragsklauseln. <Placeholder>Garantie je Anbieter prüfen und ergänzen</Placeholder>
            </p>
          </LegalSection>

          <LegalSection id="cookies" title="7. Cookies und lokale Speicherung">
            <ul>
              <li>
                <strong>Anmeldung</strong> (Supabase, z. B. «sb-…-auth-token»): technisch notwendig, um Sie angemeldet zu halten.
                Gültig bis zur Abmeldung bzw. bis die Sitzung abläuft.
              </li>
              <li>
                <strong>Aufrufstatistik</strong> («iv_vid»): zufällige Kennung ohne Bezug zu Ihrem Konto, nur vom Server lesbar,
                gültig für ein Jahr. Details im nächsten Abschnitt.
              </li>
              <li>
                <strong>Lokaler Speicher im Browser</strong>: Entwürfe von Nachrichten an Inserierende werden bis zum Absenden
                bzw. bis zum Schliessen des Tabs in Ihrem Browser zwischengespeichert.
              </li>
            </ul>
            <p>Wir verwenden keine Werbe- oder Tracking-Cookies von Drittanbietern.</p>
          </LegalSection>

          <LegalSection id="statistik" title="8. Aufrufstatistik von Inseraten">
            <p>
              Damit Inserierende sehen, wie oft ihr Inserat aufgerufen wurde, zählen wir Aufrufe datenschutzfreundlich: Aus der
              zufälligen Kennung im Cookie «iv_vid», dem Datum und einem geheimen Wert wird ein Hashwert gebildet. Gespeichert
              wird nur dieser Hashwert, der sich täglich ändert – keine IP-Adresse. Pro Besucher, Inserat und Tag wird höchstens
              ein Aufruf gezählt. Aufrufe von Suchmaschinen-Robotern sowie der Inserierenden selbst werden nicht gezählt.
              Inserierende sehen nur Summen. Zum Schutz vor künstlich erhöhten Zahlen begrenzen wir, wie viele neue Kennungen
              pro Stunde von derselben IP-Adresse entstehen: Dafür speichern wir höchstens zwei Tage lang einen täglich
              wechselnden Hashwert der IP-Adresse in einem Zähler, nie die IP-Adresse selbst.
            </p>
          </LegalSection>

          <LegalSection id="ki" title="9. Künstliche Intelligenz">
            <p>
              KI-Funktionen (z. B. Textvorschläge, Erklärungen zur Bewertung, Assistent) werden nur ausgeführt, wenn Sie sie
              auslösen. Ergebnisse sind Vorschläge, die Sie prüfen und anpassen. Zahlen zur Bewertung berechnet nicht das
              Sprachmodell, sondern ein nachvollziehbares Verfahren auf Basis der ausgewiesenen Datenquellen. Mit KI veränderte
              Bilder werden öffentlich gekennzeichnet, und das Original bleibt erhalten.
            </p>
          </LegalSection>

          <LegalSection id="aufbewahrung" title="10. Aufbewahrung und Löschung">
            <p>
              Wir bewahren Daten so lange auf, wie Ihr Konto besteht oder es für die genannten Zwecke nötig ist. Wenn Sie Ihr
              Konto löschen, werden Ihre Profildaten, Immobilien, Inserate, Bilder und Dokumente entfernt. Gesetzliche
              Aufbewahrungspflichten bleiben vorbehalten. Aufbewahrungsdauer für Kontaktanfragen, Meldungen und
              Protokolle: <Placeholder>Fristen festlegen</Placeholder>.
            </p>
          </LegalSection>

          <LegalSection id="sicherheit" title="11. Datensicherheit">
            <p>
              Die Übertragung erfolgt verschlüsselt (HTTPS). Zugriffe werden serverseitig und in der Datenbank zeilenweise
              geprüft. Private Dateien liegen in geschützten Speicherbereichen und werden nur über kurzlebige, signierte Links
              ausgeliefert.
            </p>
          </LegalSection>

          <LegalSection id="rechte" title="12. Ihre Rechte">
            <p>Sie haben im Rahmen des anwendbaren Rechts insbesondere folgende Rechte:</p>
            <ul>
              <li>Auskunft über die zu Ihnen bearbeiteten Personendaten (Art. 25 DSG).</li>
              <li>Berichtigung unrichtiger Daten sowie Löschung oder Einschränkung der Bearbeitung.</li>
              <li>Widerspruch gegen Bearbeitungen, die auf einem berechtigten Interesse beruhen.</li>
              <li>Herausgabe bzw. Übertragung Ihrer Daten in einem gängigen elektronischen Format (Art. 28 DSG).</li>
            </ul>
            <p>
              Ihre Daten exportieren und Ihr Konto löschen können Sie selbst in den{" "}
              <Link href="/dashboard/einstellungen">Einstellungen</Link>. Für weitere Anliegen schreiben Sie uns über das{" "}
              <Link href="/kontakt">Kontaktformular</Link>. Sie können sich zudem an den Eidgenössischen Datenschutz- und
              Öffentlichkeitsbeauftragten (EDÖB) bzw. – soweit die DSGVO anwendbar ist – an eine Aufsichtsbehörde in der EU
              wenden.
            </p>
          </LegalSection>

          <LegalSection id="aenderungen" title="13. Änderungen">
            <p>
              Wir passen diese Datenschutzerklärung an, wenn sich unsere Datenbearbeitung ändert. Massgebend ist die jeweils hier
              veröffentlichte Fassung.
            </p>
          </LegalSection>
        </div>

        <aside aria-label="Inhalt" className="hidden lg:block">
          <nav className="sticky top-24 rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-bold">Inhalt</p>
            <ol className="mt-3 grid gap-2 text-sm">
              {TOC.map((entry) => (
                <li key={entry.id}>
                  <a href={`#${entry.id}`} className="text-muted-foreground transition-colors hover:text-forest">
                    {entry.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>
      </div>
    </div>
  );
}
