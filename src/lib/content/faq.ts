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
    question: "Wie genau ist die KI-Immobilienbewertung?",
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
];

export const HOME_FAQ = FAQ.slice(0, 6);
