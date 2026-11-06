/** Häufige Fragen (Startseite und /faq). Antworten sachlich und ohne Rechts- oder Steuerberatung. */
export interface FaqItem {
  question: string;
  answer: string;
  category: "allgemein" | "verkaufen" | "bewertung" | "suchen" | "datenschutz" | "firmen";
}

export const FAQ: FaqItem[] = [
  {
    category: "allgemein",
    question: "Was kostet Immovia?",
    answer:
      "Für Privatpersonen sind Registrierung, Suche, Merkliste, Inserat, Verkaufsdossier, Nachrichten und Besichtigungsplanung kostenlos. Für rechenintensive Funktionen wie KI-Texte, Bewertungen oder Bildbearbeitung gelten grosszügige monatliche Freikontingente. Sie müssen keine Kreditkarte hinterlegen.",
  },
  {
    category: "verkaufen",
    question: "Brauche ich einen Makler, um über Immovia zu verkaufen?",
    answer:
      "Nein. Immovia richtet sich an Privatpersonen, die selbst verkaufen oder vermieten möchten. Bei rechtlichen Fragen zum Kaufvertrag, zur Grundstückgewinnsteuer oder zur Finanzierung empfehlen wir eine Fachperson (z. B. Notariat, Steuerberatung oder Bank).",
  },
  {
    category: "bewertung",
    question: "Wie genau ist die Immobilienbewertung?",
    answer:
      "Die Bewertung zeigt immer, auf welchen Daten sie beruht und wie sicher sie ist. Solange keine lizenzierten Transaktionsdaten angebunden sind, vergleicht Immovia mit Angebotspreisen ähnlicher, echter Inserate auf der Plattform. Gibt es zu wenige Vergleichsobjekte, zeigen wir bewusst keine Zahl. Eine Bewertung ersetzt kein Gutachten.",
  },
  {
    category: "datenschutz",
    question: "Wird meine genaue Adresse öffentlich angezeigt?",
    answer:
      "Nur wenn Sie es wünschen. Sie wählen pro Inserat, ob die exakte Adresse, nur die Strasse oder nur der Ort angezeigt wird. Auf der Karte wird der Standort entsprechend ungenauer dargestellt.",
  },
  {
    category: "verkaufen",
    question: "Werden meine Fotos mit KI verändert?",
    answer:
      "Nur auf Ihren Wunsch. Korrekturen wie Helligkeit oder Weissabgleich verändern keine baulichen Eigenschaften. Substanziell veränderte Bilder wie eine virtuelle Möblierung werden sichtbar als KI-Visualisierung gekennzeichnet, und das Originalbild bleibt immer erhalten.",
  },
  {
    category: "suchen",
    question: "Wie funktioniert ein Suchauftrag?",
    answer:
      "Speichern Sie Ihre Suchkriterien und aktivieren Sie die Benachrichtigung. Sobald ein passendes Inserat veröffentlicht wird, erhalten Sie eine Nachricht – pro Inserat nur einmal.",
  },
  {
    category: "firmen",
    question: "Können auch Immobilienfirmen Immovia nutzen?",
    answer:
      "Ja. Mit einem Firmenkonto verwalten Sie mehrere Objekte und Mitarbeitende mit Rollen. Ihre Firma erhält ein öffentliches Profil.",
  },
  {
    category: "datenschutz",
    question: "Kann ich mein Konto und meine Daten löschen?",
    answer:
      "Ja. In den Einstellungen können Sie Ihre Daten exportieren und Ihr Konto jederzeit löschen. Ihre Inserate, Bilder und Dokumente werden dabei entfernt.",
  },
  // Ergänzungen für die FAQ-Seite (HOME_FAQ bleibt unverändert)
  {
    category: "suchen",
    question: "Brauche ich ein Konto, um Immobilien zu suchen?",
    answer:
      "Nein. Suchen, Filtern und Inserate ansehen funktioniert ohne Konto. Für die Merkliste, Suchaufträge, Anfragen und Besichtigungen brauchen Sie ein kostenloses Konto, damit Ihre Daten und Nachrichten geschützt an einem Ort bleiben.",
  },
  {
    category: "suchen",
    question: "Wie vereinbare ich eine Besichtigung?",
    answer:
      "Öffnen Sie das Inserat und wählen Sie «Besichtigung anfragen». Hat die Inserentin oder der Inserent Zeitfenster freigeschaltet, wählen Sie direkt einen Termin. Sonst fragen Sie per Nachricht an. Alle Zeiten gelten in Schweizer Zeit; über die Bestätigung werden Sie benachrichtigt.",
  },
  {
    category: "allgemein",
    question: "Was bedeutet «Demo» bei einem Inserat?",
    answer:
      "Demo-Inserate sind fiktive Beispiele, die zeigen, wie Immovia funktioniert. Sie sind deutlich gekennzeichnet, werden nicht wirklich angeboten und fliessen nicht in Bewertungen ein.",
  },
  {
    category: "verkaufen",
    question: "Was bedeutet «E-Mail bestätigt» bei einer Inserentin oder einem Inserenten?",
    answer:
      "Nur, dass die E-Mail-Adresse bestätigt wurde. Das ist kein Nachweis über das Eigentum an der Immobilie. Weitere Kennzeichnungen wie «Identität verifiziert» oder «Eigentümerberechtigung geprüft» erscheinen nur, wenn die entsprechende Prüfung tatsächlich durchgeführt wurde.",
  },
  {
    category: "verkaufen",
    question: "Kann ich mein Inserat jederzeit ändern oder als verkauft markieren?",
    answer:
      "Ja. Im Dashboard unter «Meine Immobilien» bearbeiten Sie Angaben, Bilder und Texte. Änderungen erscheinen kurz darauf auf der öffentlichen Seite. In der Verkaufsverwaltung können Sie das Inserat pausieren, reservieren oder als verkauft bzw. vermietet markieren.",
  },
  {
    category: "bewertung",
    question: "Woher stammen die Vergleichsdaten der Bewertung?",
    answer:
      "Solange keine lizenzierten Transaktionsdaten angebunden sind, nutzt Immovia ausschliesslich Angebotspreise echter, veröffentlichter Inserate auf der Plattform. Demo-Inserate sind ausgeschlossen. Die Bewertung weist aus, dass es sich um Angebotspreise und nicht um tatsächlich bezahlte Preise handelt.",
  },
  {
    category: "datenschutz",
    question: "Welche Cookies verwendet Immovia?",
    answer:
      "Für die Anmeldung setzt Immovia technisch notwendige Cookies. Für die Aufrufstatistik von Inseraten verwenden wir ein eigenes Cookie mit einer zufälligen Kennung; gespeichert wird davon nur ein täglich wechselnder Hashwert, keine IP-Adresse. Werbe- oder Tracking-Cookies von Drittanbietern setzen wir nicht ein.",
  },
  {
    category: "firmen",
    question: "Wie lade ich Mitarbeitende in mein Firmenkonto ein?",
    answer:
      "Im Dashboard unter «Firmenkonto» laden Sie Mitarbeitende per E-Mail ein und vergeben eine Rolle (Administrator oder Mitarbeiter). Mitarbeitende sehen nur die Immobilien, Anfragen und Termine Ihrer Firma.",
  },
];

/** Bezeichnungen der FAQ-Kategorien in der Reihenfolge der FAQ-Seite. */
export const FAQ_CATEGORIES: Record<FaqItem["category"], string> = {
  allgemein: "Allgemein",
  suchen: "Suchen, Merken und Besichtigen",
  verkaufen: "Verkaufen und Vermieten",
  bewertung: "Bewertung",
  datenschutz: "Datenschutz und Sicherheit",
  firmen: "Für Immobilienfirmen",
};

export const HOME_FAQ = FAQ.slice(0, 6);
