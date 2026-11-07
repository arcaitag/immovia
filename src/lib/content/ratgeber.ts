import { MARKETING_IMAGES } from "@/lib/marketing-images";

/**
 * Ratgeber-Artikel. Sachliche, allgemeine Informationen für die Schweiz –
 * keine Rechts- oder Steuerberatung. Gesetzesverweise nur, wo sie eindeutig sind.
 */

export type ArticleBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string; id: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "checklist"; items: string[] }
  | { type: "note"; title?: string; text: string; tone?: "info" | "warning" };

export type ArticleCategory = "Verkaufen" | "Vermieten" | "Recht und Steuern";

export interface Article {
  slug: string;
  title: string;
  description: string;
  category: ArticleCategory;
  /** Datum der letzten inhaltlichen Prüfung (YYYY-MM-DD) */
  updatedAt: string;
  image: { src: string; alt: string };
  /** Rechtliche oder steuerliche Themen erhalten einen deutlicheren Hinweis */
  legalTopic?: boolean;
  related: string[];
  cta?: { label: string; href: string };
  blocks: ArticleBlock[];
}

export const ARTICLES: Article[] = [
  {
    slug: "unterlagen-immobilienverkauf",
    title: "Diese Unterlagen brauchen Sie für den Verkauf Ihrer Immobilie",
    description:
      "Grundbuchauszug, Pläne, Nebenkosten, Reglemente: Welche Dokumente Kaufinteressenten und Banken erwarten und wie Sie sie sicher teilen.",
    category: "Verkaufen",
    updatedAt: "2026-11-06",
    image: MARKETING_IMAGES.interior,
    related: ["verkaufen-ohne-makler", "angebotspreis-festlegen"],
    cta: { label: "Dokumente im Dashboard verwalten", href: "/dashboard/dokumente" },
    blocks: [
      {
        type: "p",
        text: "Vollständige Unterlagen schaffen Vertrauen. Kaufinteressenten können Fragen schneller klären, und ihre Bank braucht für die Prüfung der Hypothek ohnehin Angaben zum Objekt. Wer früh sammelt, verkürzt den Verkauf und vermeidet Rückfragen im letzten Moment.",
      },
      { type: "h2", id: "grundlagen", text: "Grundlegende Unterlagen" },
      {
        type: "ul",
        items: [
          "Aktueller Grundbuchauszug: zeigt Eigentum, Dienstbarkeiten (z. B. Wegrechte), Grundpfandrechte und Anmerkungen. Erhältlich beim zuständigen Grundbuchamt.",
          "Katasterplan bzw. Situationsplan mit den Grundstücksgrenzen.",
          "Grundrisse und, falls vorhanden, Schnitte und Ansichten. Geben Sie an, wie die Wohnfläche gemessen wurde.",
          "Baubeschrieb oder Beschrieb des Innenausbaus.",
          "Aussagekräftige Fotos aller Räume und des Aussenbereichs.",
        ],
      },
      { type: "h2", id: "zustand", text: "Zustand, Technik und Kosten" },
      {
        type: "ul",
        items: [
          "Baujahr und eine Liste der Renovationen mit Jahr und Belegen.",
          "Angaben zur Heizung (Art, Alter, Wartung) und – falls vorhanden – ein Gebäudeenergieausweis der Kantone (GEAK).",
          "Police bzw. Schätzung der Gebäudeversicherung.",
          "Nebenkostenabrechnungen der letzten Jahre.",
          "Baubewilligungen für Um- und Anbauten.",
          "Bei Bedarf: Auszug aus dem Kataster der belasteten Standorte. Viele Kantone stellen ihn online zur Verfügung.",
        ],
      },
      {
        type: "note",
        text: "In einigen Kantonen ist bei einer Handänderung ein GEAK vorgeschrieben. Ob das für Ihr Objekt gilt, erfahren Sie bei der Energiefachstelle Ihres Kantons.",
      },
      { type: "h2", id: "stockwerkeigentum", text: "Zusätzlich bei Stockwerkeigentum" },
      {
        type: "ul",
        items: [
          "Begründungsakt und Aufteilungsplan mit der Wertquote Ihrer Einheit.",
          "Reglement der Stockwerkeigentümergemeinschaft und gegebenenfalls die Hausordnung.",
          "Protokolle der letzten Eigentümerversammlungen. Sie zeigen geplante Sanierungen und offene Themen.",
          "Stand des Erneuerungsfonds, aktuelles Budget und die letzte Jahresrechnung.",
        ],
      },
      { type: "h2", id: "vertraege", text: "Verträge und Finanzierung" },
      {
        type: "ul",
        items: [
          "Hypothekarverträge: Klären Sie mit Ihrer Bank Laufzeiten und mögliche Kosten einer vorzeitigen Auflösung.",
          "Mietverträge bei vermieteten Objekten. Das Mietverhältnis geht mit dem Eigentum grundsätzlich auf die Käuferschaft über (Art. 261 OR).",
          "Verträge mit Dritten, etwa für Wartung oder Hauswartung.",
        ],
      },
      { type: "h2", id: "teilen", text: "Unterlagen sicher teilen" },
      {
        type: "p",
        text: "Viele Dokumente enthalten Personendaten, etwa Namen im Grundbuchauszug oder in Mietverträgen. Stellen Sie solche Unterlagen nicht öffentlich ins Inserat, sondern geben Sie sie gezielt an ernsthafte Interessenten frei. Bei Immovia können Sie Freigaben jederzeit widerrufen; Downloads laufen über kurzlebige, geschützte Links.",
      },
      {
        type: "checklist",
        items: [
          "Grundbuchauszug bestellt",
          "Pläne und Flächenangaben zusammengestellt",
          "Renovationen mit Jahr und Belegen notiert",
          "Nebenkosten der letzten Jahre bereit",
          "Bei Stockwerkeigentum: Reglement, Protokolle und Erneuerungsfonds",
          "Vertrauliche Dokumente nur gezielt freigeben",
        ],
      },
    ],
  },
  {
    slug: "verkaufen-ohne-makler",
    title: "Immobilie ohne Makler verkaufen: der Ablauf Schritt für Schritt",
    description:
      "Vom Preis über die Besichtigung bis zum Grundbucheintrag: So läuft ein Privatverkauf in der Schweiz ab und wo eine Fachperson sinnvoll ist.",
    category: "Verkaufen",
    updatedAt: "2026-11-06",
    image: MARKETING_IMAGES.sell,
    legalTopic: true,
    related: ["unterlagen-immobilienverkauf", "angebotspreis-festlegen", "grundstueckgewinnsteuer"],
    cta: { label: "Verkauf kostenlos starten", href: "/verkaufen/start" },
    blocks: [
      {
        type: "p",
        text: "Ein Privatverkauf ist gut machbar, wenn Sie strukturiert vorgehen. Sie entscheiden selbst über Preis, Präsentation und Käuferschaft. Für einzelne Schritte – etwa die Schätzung oder den Kaufvertrag – können Sie gezielt Fachpersonen beiziehen.",
      },
      { type: "h2", id: "vorbereiten", text: "1. Ziele und Zeitplan klären" },
      {
        type: "p",
        text: "Überlegen Sie, bis wann Sie verkaufen möchten, wo Sie danach wohnen und wie Ihre Hypothek abgelöst wird. Sprechen Sie früh mit Ihrer Bank, damit Sie Fristen und allfällige Kosten kennen.",
      },
      { type: "h2", id: "preis", text: "2. Wert einschätzen und Preis festlegen" },
      {
        type: "p",
        text: "Angebotspreise auf Inseraten sind nicht dasselbe wie tatsächlich bezahlte Preise. Holen Sie mehrere Einschätzungen ein, zum Beispiel von Ihrer Bank oder einer unabhängigen Schätzerin bzw. einem Schätzer, und vergleichen Sie ähnliche Objekte in Ihrer Region.",
      },
      { type: "h2", id: "praesentation", text: "3. Unterlagen, Inserat und Dossier" },
      {
        type: "p",
        text: "Stellen Sie die Unterlagen zusammen, machen Sie gute Fotos und beschreiben Sie das Objekt ehrlich. Ein Verkaufsdossier fasst alle Angaben übersichtlich zusammen und lässt sich an Interessierte senden.",
      },
      { type: "h2", id: "besichtigungen", text: "4. Anfragen und Besichtigungen" },
      {
        type: "p",
        text: "Bündeln Sie Besichtigungen in festen Zeitfenstern und notieren Sie nach jedem Termin, wie interessiert die Personen sind und welche Fragen offen sind.",
      },
      { type: "h2", id: "finanzierung", text: "5. Finanzierung der Käuferschaft prüfen" },
      {
        type: "p",
        text: "Bevor Sie sich auf eine Käuferin oder einen Käufer festlegen, sollten Sie eine schriftliche Finanzierungsbestätigung der Bank sehen. Banken stützen sich dabei auf ihre eigene Bewertung des Objekts.",
      },
      { type: "h2", id: "reservation", text: "6. Verhandlung und Reservation" },
      {
        type: "p",
        text: "Ob eine Reservationsvereinbarung verbindlich ist und ob eine Reservationszahlung zurückgefordert werden kann, hängt stark von der Ausgestaltung ab. Lassen Sie sich dazu vom Notariat beraten, bevor Sie etwas unterschreiben.",
      },
      { type: "h2", id: "kaufvertrag", text: "7. Kaufvertrag beim Notariat" },
      {
        type: "p",
        text: "Ein Kaufvertrag über ein Grundstück muss öffentlich beurkundet werden (Art. 216 OR). Die Urkundsperson erstellt den Vertrag nach kantonalem Recht. Darin werden unter anderem Preis, Zahlungsmodalitäten, Übergabetermin und die Gewährleistung geregelt.",
      },
      {
        type: "note",
        tone: "warning",
        title: "Kosten und Steuern",
        text: "Je nach Kanton fallen Notariats- und Grundbuchgebühren sowie eine Handänderungssteuer an. Wer welche Kosten trägt, ist teilweise gesetzlich geregelt und teilweise Verhandlungssache. Auf den Gewinn wird in der Regel eine Grundstückgewinnsteuer erhoben.",
      },
      { type: "h2", id: "grundbuch", text: "8. Grundbucheintrag und Übergabe" },
      {
        type: "p",
        text: "Das Eigentum geht mit dem Eintrag ins Grundbuch über (Art. 656 ZGB). Halten Sie bei der Übergabe Zählerstände, Schlüssel und den Zustand in einem Protokoll fest, das beide Seiten unterschreiben.",
      },
      {
        type: "checklist",
        items: [
          "Zeitplan und Hypothek mit der Bank geklärt",
          "Mehrere Werteinschätzungen eingeholt",
          "Unterlagen und Dossier bereit",
          "Finanzierungsbestätigung der Käuferschaft gesehen",
          "Kaufvertrag vom Notariat beurkundet",
          "Übergabeprotokoll unterzeichnet",
        ],
      },
    ],
  },
  {
    slug: "besichtigung-vorbereiten",
    title: "Besichtigungen gut vorbereiten und sicher durchführen",
    description: "Wie Sie Besichtigungstermine planen, Ihre Immobilie vorbereiten und Interessierte überzeugen – mit Tipps zu Sicherheit und Nachbereitung.",
    category: "Verkaufen",
    updatedAt: "2026-11-06",
    image: MARKETING_IMAGES.kitchen,
    related: ["immobilienfotos-smartphone", "verkaufen-ohne-makler"],
    cta: { label: "Besichtigungszeitfenster planen", href: "/dashboard/besichtigungen" },
    blocks: [
      {
        type: "p",
        text: "Die Besichtigung ist oft der Moment, in dem sich Interessierte entscheiden. Mit etwas Planung wirkt Ihre Immobilie gepflegt, und Sie behalten den Überblick.",
      },
      { type: "h2", id: "planen", text: "Termine planen" },
      {
        type: "ul",
        items: [
          "Legen Sie feste Zeitfenster fest, statt jeden Termin einzeln abzusprechen. So vermeiden Sie Doppelbuchungen.",
          "Beschreiben Sie Anfahrt, Parkmöglichkeiten und Eingang.",
          "Planen Sie genügend Zeit pro Termin ein, auch für Fragen.",
        ],
      },
      { type: "h2", id: "vorbereiten", text: "Die Immobilie vorbereiten" },
      {
        type: "ul",
        items: [
          "Aufräumen, lüften und alle Lampen einschalten.",
          "Persönliche Gegenstände, Dokumente und Wertsachen wegräumen.",
          "Grundrisse, Nebenkostenabrechnung und Renovationsliste bereitlegen.",
          "Kleine Mängel beheben, die sich einfach beheben lassen.",
        ],
      },
      { type: "h2", id: "durchfuehren", text: "Während der Besichtigung" },
      {
        type: "ul",
        items: [
          "Führen Sie in einer sinnvollen Reihenfolge durch die Räume und lassen Sie den Interessierten Zeit.",
          "Sprechen Sie bekannte Mängel offen an. Das schafft Vertrauen und beugt späteren Streitigkeiten vor.",
          "Notieren Sie Fragen, die Sie nicht sofort beantworten können, und liefern Sie die Antwort nach.",
          "Machen Sie keine Zusagen unter Zeitdruck.",
        ],
      },
      { type: "h2", id: "sicherheit", text: "Sicherheit" },
      {
        type: "ul",
        items: [
          "Vereinbaren Sie Termine mit Personen, die sich vorher registriert und angemeldet haben.",
          "Lassen Sie sich begleiten, wenn Sie sich dabei wohler fühlen.",
          "Geben Sie keine Originaldokumente heraus und verlangen Sie keine Ausweiskopien ohne konkreten Grund.",
        ],
      },
      { type: "h2", id: "vermietet", text: "Wenn das Objekt bewohnt ist" },
      {
        type: "p",
        text: "Ist die Wohnung vermietet, müssen Mieterinnen und Mieter Besichtigungen für einen Verkauf oder eine Wiedervermietung gestatten, soweit diese nötig sind. Die Termine müssen rechtzeitig angekündigt werden, und auf die Interessen der Mieterschaft ist Rücksicht zu nehmen (Art. 257h OR).",
      },
      { type: "h2", id: "nachbereiten", text: "Nach der Besichtigung" },
      {
        type: "p",
        text: "Halten Sie fest, wer wie interessiert ist, senden Sie zugesagte Unterlagen zeitnah und setzen Sie bei mehreren Interessierten eine faire Frist für Rückmeldungen.",
      },
    ],
  },
  {
    slug: "immobilienfotos-smartphone",
    title: "Gute Immobilienfotos mit dem Smartphone",
    description: "Licht, Perspektive, Auswahl: So entstehen ehrliche, ansprechende Bilder Ihrer Immobilie – ohne Profi-Ausrüstung.",
    category: "Verkaufen",
    updatedAt: "2026-11-06",
    image: MARKETING_IMAGES.livingRoom,
    related: ["besichtigung-vorbereiten", "mietinserat-erstellen"],
    cta: { label: "Bilder hochladen und optimieren", href: "/dashboard/bilderstudio" },
    blocks: [
      {
        type: "p",
        text: "Die Bilder entscheiden, ob jemand Ihr Inserat öffnet. Mit einem aktuellen Smartphone und etwas Vorbereitung gelingen Fotos, die den Raum realistisch und einladend zeigen.",
      },
      { type: "h2", id: "licht", text: "Licht" },
      {
        type: "ul",
        items: [
          "Fotografieren Sie bei Tageslicht, öffnen Sie Vorhänge und schalten Sie zusätzlich alle Lampen ein.",
          "Vermeiden Sie Aufnahmen direkt gegen helle Fenster oder nutzen Sie die HDR-Funktion.",
          "Aussenaufnahmen gelingen am besten bei trockenem Wetter und weichem Licht.",
        ],
      },
      { type: "h2", id: "perspektive", text: "Perspektive" },
      {
        type: "ul",
        items: [
          "Halten Sie das Smartphone auf etwa Brusthöhe und im Querformat.",
          "Blenden Sie die Gitterlinien ein und achten Sie darauf, dass senkrechte Linien senkrecht bleiben.",
          "Fotografieren Sie aus einer Raumecke, damit der Raum gut erkennbar ist.",
          "Setzen Sie den Weitwinkel zurückhaltend ein; starke Verzerrungen wirken unnatürlich.",
        ],
      },
      { type: "h2", id: "vorbereitung", text: "Vorbereitung" },
      {
        type: "ul",
        items: [
          "Aufräumen, Kabel verstecken, Betten machen.",
          "Persönliche Fotos, Namen und Autokennzeichen aus dem Bild nehmen.",
          "Die Linse reinigen – das wird oft vergessen.",
        ],
      },
      { type: "h2", id: "auswahl", text: "Auswahl und Reihenfolge" },
      {
        type: "p",
        text: "Wählen Sie ein starkes Titelbild, etwa den Wohnraum oder die Aussenansicht. Zeigen Sie danach jeden wichtigen Raum, den Aussenbereich und die Aussicht. Grundrisse helfen Interessierten, sich zu orientieren.",
      },
      { type: "h2", id: "ehrlich", text: "Ehrlich bleiben" },
      {
        type: "p",
        text: "Korrekturen von Helligkeit, Farbe und Schärfe sind üblich. Mängel zu verdecken oder bauliche Eigenschaften zu verändern, ist dagegen irreführend. Virtuell eingerichtete Bilder kennzeichnet Immovia sichtbar als KI-Visualisierung, und das Originalbild bleibt erhalten.",
      },
      {
        type: "note",
        text: "Beim Hochladen entfernt Immovia die eingebetteten Standort- und Kameradaten (EXIF) aus den öffentlichen Bildversionen.",
      },
    ],
  },
  {
    slug: "mietinserat-erstellen",
    title: "Mietinserat erstellen: Das gehört hinein",
    description:
      "Nettomiete, Nebenkosten, Bezugstermin, Anmeldung: Worauf Sie bei einem Mietinserat in der Schweiz achten sollten.",
    category: "Vermieten",
    updatedAt: "2026-11-06",
    image: MARKETING_IMAGES.interior,
    legalTopic: true,
    related: ["immobilienfotos-smartphone", "besichtigung-vorbereiten"],
    cta: { label: "Wohnung kostenlos inserieren", href: "/verkaufen/start" },
    blocks: [
      {
        type: "p",
        text: "Ein klares Mietinserat spart Ihnen Rückfragen und bringt passende Anfragen. Wichtig sind vollständige Angaben zu Kosten, Verfügbarkeit und Ausstattung.",
      },
      { type: "h2", id: "angaben", text: "Diese Angaben erwarten Interessierte" },
      {
        type: "ul",
        items: [
          "Nettomiete und Nebenkosten getrennt, mit dem Hinweis, ob die Nebenkosten akonto (mit Abrechnung) oder pauschal verrechnet werden.",
          "Zimmerzahl, Wohnfläche, Etage und Lift.",
          "Bezugstermin bzw. «nach Vereinbarung».",
          "Parkplatz oder Garage und deren Miete.",
          "Haustiere, Waschmaschine oder Waschküche, Keller und Estrich.",
        ],
      },
      {
        type: "p",
        text: "Nebenkosten muss die Mieterschaft nur bezahlen, wenn dies im Vertrag besonders vereinbart ist (Art. 257a OR). Beschreiben Sie deshalb auch im Inserat, welche Kosten darin enthalten sind.",
      },
      { type: "h2", id: "anfangsmietzins", text: "Anfangsmietzins und Formularpflicht" },
      {
        type: "p",
        text: "Kantone mit Wohnungsmangel können vorschreiben, dass beim Abschluss eines neuen Mietvertrags ein amtliches Formular verwendet wird, das unter anderem den bisherigen Mietzins nennt (Art. 270 OR). Prüfen Sie, ob das in Ihrem Kanton gilt.",
      },
      { type: "h2", id: "depot", text: "Mietzinsdepot" },
      {
        type: "p",
        text: "Bei Wohnräumen darf die Sicherheit höchstens drei Monatsmieten betragen. Sie wird bei einer Bank auf einem Spar- oder Depotkonto auf den Namen der Mieterschaft hinterlegt (Art. 257e OR).",
      },
      { type: "h2", id: "auswahl", text: "Faire Auswahl und Datenschutz" },
      {
        type: "p",
        text: "Fragen Sie im Anmeldeformular nur, was für die Auswahl nötig ist, etwa Kontaktangaben, Haushaltsgrösse und Angaben zur Zahlungsfähigkeit. Angaben zu Religion, Gesundheit oder Herkunft gehören nicht dazu. Der Eidgenössische Datenschutz- und Öffentlichkeitsbeauftragte (EDÖB) hat dazu Hinweise veröffentlicht.",
      },
      {
        type: "checklist",
        items: [
          "Nettomiete und Nebenkosten getrennt angegeben",
          "Bezugstermin und Besichtigungsmöglichkeiten genannt",
          "Kantonale Formularpflicht geprüft",
          "Anmeldeformular auf nötige Angaben beschränkt",
        ],
      },
    ],
  },
  {
    slug: "grundstueckgewinnsteuer",
    title: "Grundstückgewinnsteuer: allgemein erklärt",
    description:
      "Was die Grundstückgewinnsteuer ist, wie der Gewinn berechnet wird und wann sie aufgeschoben werden kann – ein Überblick ohne kantonale Details.",
    category: "Recht und Steuern",
    updatedAt: "2026-11-06",
    image: MARKETING_IMAGES.chalet,
    legalTopic: true,
    related: ["verkaufen-ohne-makler", "angebotspreis-festlegen"],
    blocks: [
      {
        type: "p",
        text: "Wer in der Schweiz ein Grundstück mit Gewinn verkauft, muss in der Regel eine Grundstückgewinnsteuer bezahlen. Sie wird von den Kantonen – teilweise zusammen mit den Gemeinden – erhoben. Der Bund kennt keine Grundstückgewinnsteuer. Die Grundsätze stehen im Steuerharmonisierungsgesetz (Art. 12 StHG), die Einzelheiten regelt jeder Kanton selbst.",
      },
      { type: "h2", id: "gewinn", text: "Wie der Gewinn berechnet wird" },
      {
        type: "p",
        text: "Steuerbar ist vereinfacht gesagt der Verkaufserlös abzüglich der Anlagekosten. Zu den Anlagekosten gehören der damalige Erwerbspreis und wertvermehrende Investitionen, etwa ein Anbau. Welche weiteren Kosten abziehbar sind, regeln die Kantone unterschiedlich. Werterhaltender Unterhalt wird oft bereits bei der Einkommenssteuer berücksichtigt.",
      },
      {
        type: "note",
        text: "Bewahren Sie Belege für wertvermehrende Investitionen lückenlos auf. Ohne Belege lassen sie sich beim Verkauf oft nicht geltend machen.",
      },
      { type: "h2", id: "besitzdauer", text: "Einfluss der Besitzdauer" },
      {
        type: "p",
        text: "Die Kantone berücksichtigen die Besitzdauer: Gewinne aus kurzfristigen Verkäufen werden stärker besteuert, bei langer Besitzdauer gibt es je nach Kanton Ermässigungen.",
      },
      { type: "h2", id: "aufschub", text: "Wann die Steuer aufgeschoben wird" },
      {
        type: "ul",
        items: [
          "Bei Eigentumswechseln durch Erbgang, Erbvorbezug oder Schenkung.",
          "Bei bestimmten Eigentumswechseln unter Ehegatten, etwa im Zusammenhang mit dem Güterrecht oder einer Scheidung.",
          "Wenn ein selbst genutztes Wohneigentum verkauft und der Erlös innert angemessener Frist für ein gleich genutztes Ersatzobjekt in der Schweiz verwendet wird.",
        ],
      },
      { type: "h2", id: "sicherstellung", text: "Wer bezahlt und wie die Käuferschaft sich absichert" },
      {
        type: "p",
        text: "Steuerpflichtig ist grundsätzlich die verkaufende Person. Viele Kantone sichern die Steuer mit einem gesetzlichen Pfandrecht am Grundstück. Käuferinnen und Käufer verlangen deshalb oft, dass ein Teil des Kaufpreises bis zur Bezahlung der Steuer zurückbehalten oder sichergestellt wird. Das wird im Kaufvertrag geregelt.",
      },
      {
        type: "note",
        tone: "warning",
        title: "Kantonale Unterschiede",
        text: "Steuersätze, Fristen, abziehbare Kosten und das Verfahren unterscheiden sich von Kanton zu Kanton erheblich. Für eine Berechnung im Einzelfall wenden Sie sich an die kantonale Steuerverwaltung oder eine Steuerberatung.",
      },
    ],
  },
  {
    slug: "angebotspreis-festlegen",
    title: "Den richtigen Angebotspreis festlegen",
    description:
      "Angebotspreis, Marktwert, Transaktionspreis: Was die Begriffe bedeuten und wie Sie einen realistischen Preis für Ihre Immobilie finden.",
    category: "Verkaufen",
    updatedAt: "2026-11-06",
    image: MARKETING_IMAGES.sell,
    related: ["verkaufen-ohne-makler", "unterlagen-immobilienverkauf"],
    cta: { label: "Mehr zur Bewertung bei Immovia", href: "/bewerten" },
    blocks: [
      {
        type: "p",
        text: "Ein realistischer Preis ist der wichtigste Hebel für einen zügigen Verkauf. Ist er zu hoch, bleibt das Inserat lange online; ist er zu tief, verschenken Sie Geld.",
      },
      { type: "h2", id: "begriffe", text: "Vier Begriffe, die oft verwechselt werden" },
      {
        type: "ul",
        items: [
          "Angebotspreis: der Preis in einem Inserat. Er zeigt die Erwartung der Verkaufsseite, nicht den Abschluss.",
          "Transaktionspreis: der tatsächlich im Kaufvertrag vereinbarte Preis. Solche Daten sind meist nicht frei zugänglich.",
          "Statistische Indikatoren: Preisindizes und Durchschnittswerte für Regionen. Sie zeigen Entwicklungen, aber keinen Wert für ein einzelnes Objekt.",
          "Modellschätzung: eine Berechnung aus Objektmerkmalen und Vergleichsdaten. Ihre Aussagekraft hängt von den verwendeten Daten ab.",
        ],
      },
      { type: "h2", id: "quellen", text: "So kommen Sie zu einer fundierten Einschätzung" },
      {
        type: "ul",
        items: [
          "Vergleichen Sie Inserate ähnlicher Objekte in Ihrer Region: Lage, Fläche, Zustand und Baujahr sollten passen.",
          "Holen Sie eine Bewertung Ihrer Bank oder einer unabhängigen Schätzerin bzw. eines Schätzers ein.",
          "Nutzen Sie Bewertungsmodelle, die ihre Datenbasis offenlegen und eine Spanne statt einer scheinbar exakten Zahl nennen.",
        ],
      },
      { type: "h2", id: "strategie", text: "Preisstrategie" },
      {
        type: "p",
        text: "Ein Preis knapp über Ihrer Schmerzgrenze lässt Verhandlungsspielraum. Wiederholte Preissenkungen fallen Interessierten jedoch auf und können Misstrauen wecken. «Preis auf Anfrage» erschwert die Vergleichbarkeit und kann Anfragen kosten.",
      },
      { type: "h2", id: "finanzierung", text: "Finanzierbarkeit im Blick" },
      {
        type: "p",
        text: "Die Bank der Käuferschaft finanziert auf Basis ihrer eigenen Bewertung. Liegt der Kaufpreis darüber, muss die Differenz mit zusätzlichen Eigenmitteln gedeckt werden. Ein deutlich überhöhter Preis kann deshalb an der Finanzierung scheitern.",
      },
    ],
  },
];

export const ARTICLE_CATEGORIES: ArticleCategory[] = ["Verkaufen", "Vermieten", "Recht und Steuern"];

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((article) => article.slug === slug);
}

/** Lesezeit in Minuten (ca. 200 Wörter pro Minute). */
export function readingMinutes(article: Article): number {
  const words = article.blocks
    .map((block) => {
      if (block.type === "ul" || block.type === "ol" || block.type === "checklist") return block.items.join(" ");
      return block.text;
    })
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
