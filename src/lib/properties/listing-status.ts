import type { ListingStatus, OfferType } from "@/lib/constants";

/**
 * Statuslogik für Inserate aus Sicht der Eigentümer.
 * Die erlaubten Übergänge spiegeln exakt public.assert_listing_transition
 * (Migration 5); die Datenbank prüft sie beim Speichern ohnehin erneut.
 */

export const ALLOWED_TRANSITIONS: Record<ListingStatus, readonly ListingStatus[]> = {
  draft: ["in_progress", "ready", "pending_review", "published", "archived"],
  in_progress: ["draft", "ready", "pending_review", "published", "archived"],
  ready: ["draft", "in_progress", "pending_review", "published", "archived"],
  pending_review: ["in_progress", "ready", "archived"],
  published: ["paused", "reserved", "sold", "rented", "archived", "in_progress"],
  paused: ["published", "pending_review", "in_progress", "archived", "sold", "rented"],
  reserved: ["published", "paused", "sold", "rented", "archived"],
  sold: ["archived"],
  rented: ["archived", "in_progress"],
  archived: [],
};

export function canTransition(from: ListingStatus, to: ListingStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Öffentlich sichtbar (Suche und Inseratseite). */
export const PUBLIC_STATUSES: readonly ListingStatus[] = ["published", "reserved"];
/** Vor der ersten Veröffentlichung, vom Assistenten automatisch gepflegt. */
export const DRAFT_STATUSES: readonly ListingStatus[] = ["draft", "in_progress", "ready"];

export function isPublicStatus(status: ListingStatus): boolean {
  return PUBLIC_STATUSES.includes(status);
}

export function isDraftStatus(status: ListingStatus): boolean {
  return DRAFT_STATUSES.includes(status);
}

export type StatusAction =
  | "publish"
  | "withdraw_review"
  | "pause"
  | "resume"
  | "reserve"
  | "unreserve"
  | "mark_sold"
  | "mark_rented"
  | "relist"
  | "archive";

export const STATUS_ACTION_KEYS: readonly StatusAction[] = [
  "publish",
  "withdraw_review",
  "pause",
  "resume",
  "reserve",
  "unreserve",
  "mark_sold",
  "mark_rented",
  "relist",
  "archive",
];

export interface StatusActionContext {
  status: ListingStatus;
  offerType: OfferType;
  /** publishing.require_review aus feature_settings */
  requireReview: boolean;
  /** Inserat wurde bereits von der Moderation freigegeben (approved_at gesetzt). */
  approved: boolean;
}

const ACTION_SOURCES: Record<StatusAction, readonly ListingStatus[]> = {
  publish: ["draft", "in_progress", "ready"],
  withdraw_review: ["pending_review"],
  pause: ["published", "reserved"],
  resume: ["paused"],
  reserve: ["published"],
  unreserve: ["reserved"],
  mark_sold: ["published", "paused", "reserved"],
  mark_rented: ["published", "paused", "reserved"],
  relist: ["rented"],
  archive: ["draft", "in_progress", "ready", "pending_review", "published", "paused", "reserved", "sold", "rented"],
};

/** Zielstatus einer Aktion (null, wenn sie für die Angebotsart nicht passt). */
export function statusActionTarget(action: StatusAction, ctx: Omit<StatusActionContext, "status">): ListingStatus | null {
  const needsReview = ctx.requireReview && !ctx.approved;
  switch (action) {
    case "publish":
    case "resume":
      return needsReview ? "pending_review" : "published";
    case "withdraw_review":
      return "in_progress";
    case "pause":
      return "paused";
    case "reserve":
      return "reserved";
    case "unreserve":
      return "published";
    case "mark_sold":
      return ctx.offerType === "sale" ? "sold" : null;
    case "mark_rented":
      return ctx.offerType === "rent" ? "rented" : null;
    case "relist":
      return "in_progress";
    case "archive":
      return "archived";
  }
}

export function isStatusActionAvailable(action: StatusAction, ctx: StatusActionContext): boolean {
  const target = statusActionTarget(action, ctx);
  return target !== null && ACTION_SOURCES[action].includes(ctx.status) && canTransition(ctx.status, target);
}

/**
 * Aktionen für die Statusverwaltung eines bestehenden Inserats (ohne «Veröffentlichen»,
 * das über die Checkliste läuft, und ohne Archivieren von Entwürfen – dafür wird die
 * Immobilie gelöscht).
 */
export function managementActions(ctx: StatusActionContext): StatusAction[] {
  const order: StatusAction[] = [
    "resume",
    "pause",
    "reserve",
    "unreserve",
    "mark_sold",
    "mark_rented",
    "relist",
    "withdraw_review",
    "archive",
  ];
  return order.filter((action) => {
    if (action === "archive" && isDraftStatus(ctx.status)) return false;
    return isStatusActionAvailable(action, ctx);
  });
}

export interface StatusActionCopy {
  label: string;
  confirmTitle: string;
  confirmText: string;
  confirmLabel: string;
  success: string;
  destructive?: boolean;
}

export function statusActionCopy(action: StatusAction, ctx: Omit<StatusActionContext, "status">): StatusActionCopy {
  const target = statusActionTarget(action, ctx);
  switch (action) {
    case "publish":
      return target === "pending_review"
        ? {
            label: "Zur Prüfung einreichen",
            confirmTitle: "Inserat zur Prüfung einreichen?",
            confirmText: "Unser Team prüft das Inserat vor der Veröffentlichung. Sie erhalten eine Benachrichtigung, sobald es online ist.",
            confirmLabel: "Einreichen",
            success: "Das Inserat wurde zur Prüfung eingereicht.",
          }
        : {
            label: "Jetzt veröffentlichen",
            confirmTitle: "Inserat jetzt veröffentlichen?",
            confirmText: "Das Inserat ist danach öffentlich in der Suche und unter seiner eigenen Adresse sichtbar.",
            confirmLabel: "Veröffentlichen",
            success: "Ihr Inserat ist jetzt online.",
          };
    case "resume":
      return target === "pending_review"
        ? {
            label: "Fortsetzen (mit Prüfung)",
            confirmTitle: "Inserat erneut zur Prüfung einreichen?",
            confirmText: "Inserate werden derzeit vor der Veröffentlichung geprüft. Ihr Inserat wird nach der Freigabe wieder sichtbar.",
            confirmLabel: "Einreichen",
            success: "Das Inserat wurde zur Prüfung eingereicht.",
          }
        : {
            label: "Fortsetzen",
            confirmTitle: "Inserat wieder veröffentlichen?",
            confirmText: "Das Inserat ist danach wieder öffentlich sichtbar.",
            confirmLabel: "Fortsetzen",
            success: "Das Inserat ist wieder online.",
          };
    case "withdraw_review":
      return {
        label: "Prüfung zurückziehen",
        confirmTitle: "Prüfung zurückziehen?",
        confirmText: "Das Inserat wird wieder in Bearbeitung gesetzt und nicht geprüft. Sie können es später erneut einreichen.",
        confirmLabel: "Zurückziehen",
        success: "Die Prüfung wurde zurückgezogen.",
      };
    case "pause":
      return {
        label: "Pausieren",
        confirmTitle: "Inserat pausieren?",
        confirmText:
          "Das Inserat ist vorübergehend nicht mehr öffentlich sichtbar. Konversationen und Termine bleiben erhalten. Sie können es jederzeit fortsetzen.",
        confirmLabel: "Pausieren",
        success: "Das Inserat ist pausiert.",
      };
    case "reserve":
      return {
        label: "Als reserviert markieren",
        confirmTitle: "Als reserviert markieren?",
        confirmText: "Das Inserat bleibt sichtbar und wird als «reserviert» gekennzeichnet.",
        confirmLabel: "Reservieren",
        success: "Das Inserat ist als reserviert markiert.",
      };
    case "unreserve":
      return {
        label: "Reservierung aufheben",
        confirmTitle: "Reservierung aufheben?",
        confirmText: "Das Inserat wird wieder als verfügbar angezeigt.",
        confirmLabel: "Aufheben",
        success: "Die Reservierung wurde aufgehoben.",
      };
    case "mark_sold":
      return {
        label: "Als verkauft markieren",
        confirmTitle: "Als verkauft markieren?",
        confirmText:
          "Das Inserat wird aus der öffentlichen Suche entfernt und als verkauft abgeschlossen. Danach ist nur noch das Archivieren möglich.",
        confirmLabel: "Als verkauft markieren",
        success: "Herzlichen Glückwunsch! Das Inserat ist als verkauft markiert.",
        destructive: true,
      };
    case "mark_rented":
      return {
        label: "Als vermietet markieren",
        confirmTitle: "Als vermietet markieren?",
        confirmText:
          "Das Inserat wird aus der öffentlichen Suche entfernt und als vermietet abgeschlossen. Sie können die Immobilie später erneut ausschreiben.",
        confirmLabel: "Als vermietet markieren",
        success: "Das Inserat ist als vermietet markiert.",
        destructive: true,
      };
    case "relist":
      return {
        label: "Erneut vermieten",
        confirmTitle: "Erneut zur Vermietung vorbereiten?",
        confirmText:
          "Das Inserat wird wieder in Bearbeitung gesetzt. Prüfen Sie Preis, Verfügbarkeit und Texte und veröffentlichen Sie es danach erneut.",
        confirmLabel: "Vorbereiten",
        success: "Das Inserat ist wieder in Bearbeitung.",
      };
    case "archive":
      return {
        label: "Archivieren",
        confirmTitle: "Inserat archivieren?",
        confirmText:
          "Archivierte Inserate sind nicht mehr öffentlich und können nicht wieder aktiviert werden. Für die Immobilie können Sie später ein neues Inserat erstellen.",
        confirmLabel: "Archivieren",
        success: "Das Inserat wurde archiviert.",
        destructive: true,
      };
  }
}

/** Pflichtangaben für die Veröffentlichung – gleiche Regeln wie der Trigger listings_before_write. */
export type PublishCheckKey = "title" | "description" | "price" | "location" | "texts_confirmed" | "images";

export interface PublishFacts {
  title: string | null;
  description: string | null;
  price: number | null;
  priceOnRequest: boolean;
  postalCode: string | null;
  municipality: string | null;
  textsConfirmedAt: string | null;
  imageCount: number;
  minImages: number;
}

export interface PublishCheck {
  key: PublishCheckKey;
  label: string;
  ok: boolean;
  hint: string;
  /** Relativer Pfad innerhalb der Immobilie, z. B. "inserat#texte" */
  fix: string;
  fixLabel: string;
}

const filled = (value: string | null | undefined) => typeof value === "string" && value.trim() !== "";

export function publishChecklist(facts: PublishFacts): PublishCheck[] {
  const minImages = Math.max(0, facts.minImages);
  return [
    {
      key: "title",
      label: "Titel des Inserats",
      ok: filled(facts.title),
      hint: "Ein kurzer, sachlicher Titel, z. B. «Helle 4.5-Zimmer-Wohnung mit Balkon».",
      fix: "inserat#texte",
      fixLabel: "Titel erfassen",
    },
    {
      key: "description",
      label: "Beschreibung",
      ok: filled(facts.description),
      hint: "Die ausführliche Objektbeschreibung – selbst geschrieben oder mit KI erstellt.",
      fix: "inserat#texte",
      fixLabel: "Beschreibung erfassen",
    },
    {
      key: "price",
      label: "Preis oder «Preis auf Anfrage»",
      ok: facts.price !== null || facts.priceOnRequest,
      hint: "Geben Sie einen Preis an oder wählen Sie «Preis auf Anfrage».",
      fix: "inserat#preis",
      fixLabel: "Preis festlegen",
    },
    {
      key: "location",
      label: "PLZ und Ort",
      ok: filled(facts.postalCode) && filled(facts.municipality),
      hint: "Ohne Ort kann das Inserat in der Suche nicht gefunden werden.",
      fix: "bearbeiten?abschnitt=adresse",
      fixLabel: "Adresse ergänzen",
    },
    {
      key: "texts_confirmed",
      label: "Texte geprüft und bestätigt",
      ok: Boolean(facts.textsConfirmedAt),
      hint: "Bestätigen Sie, dass alle Angaben den Tatsachen entsprechen.",
      fix: "inserat#bestaetigung",
      fixLabel: "Texte bestätigen",
    },
    {
      key: "images",
      label: minImages === 1 ? "Mindestens ein Bild" : `Mindestens ${minImages} Bilder`,
      ok: facts.imageCount >= minImages,
      hint:
        facts.imageCount > 0 && facts.imageCount < minImages
          ? `Bisher ${facts.imageCount} von ${minImages} Bildern.`
          : "Gute Fotos sind der wichtigste Grund für eine Anfrage.",
      fix: "bilder",
      fixLabel: "Bilder hochladen",
    },
  ];
}

export function isPublishReady(facts: PublishFacts): boolean {
  return publishChecklist(facts).every((check) => check.ok);
}
