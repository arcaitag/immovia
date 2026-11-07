/**
 * Chatfenster auf Smartphones: füllt den Bildschirm unter dem Header.
 *
 * Im Browser bleibt unten Platz frei, damit das Eingabefeld nicht unter der Browserleiste liegt
 * (Safari ab iOS 26 legt seine Leiste über die Seite). Als installierte App endet das Fenster über
 * der Tab-Leiste des Dashboards. Ab lg normales Layout neben der Konversationsliste.
 */
export const CHAT_PANEL_CLASS =
  "fixed inset-x-0 bottom-0 top-16 z-10 flex flex-col bg-card pb-[calc(4rem+env(safe-area-inset-bottom))] " +
  "standalone:max-lg:bottom-[calc(4rem+env(safe-area-inset-bottom))] standalone:max-lg:pb-0 " +
  "lg:static lg:inset-auto lg:z-auto lg:min-h-0 lg:flex-1 lg:pb-0";
