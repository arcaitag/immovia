import type { SearchFilters } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { PROPERTY_TYPES, errorMessage } from "@/lib/labels";
import { supabase, type Database, type Enums, type Tables } from "@/lib/supabase";

/**
 * Konto und Suche: Profil, Passwort, Einstellungen, Benachrichtigungen, Suchaufträge sowie
 * Zusatzangaben zum Inserat (Ausstattung, Besichtigung, Meldung). Alles läuft mit dem Konto des
 * Benutzers direkt gegen Supabase – dieselben Abfragen wie die Website (src/services/account.ts,
 * src/components/saved-searches, src/services/viewings.ts, src/components/listing-detail).
 */

// --- Fehlermeldungen ---------------------------------------------------------

/** Fehler mit fertiger Meldung für die Anzeige (Eingabeprüfung in der App). */
export class InputError extends Error {}

const MESSAGES: Record<string, string> = {
  slot_full: "Dieses Zeitfenster ist leider bereits ausgebucht.",
  slot_too_soon: "Dieses Zeitfenster beginnt zu bald und kann nicht mehr gebucht werden.",
  already_booked: "Sie haben für dieses Inserat bereits einen Besichtigungstermin.",
  own_listing: "Für Ihr eigenes Inserat können Sie keine Besichtigung anfragen.",
  not_found: "Dieses Zeitfenster ist nicht mehr verfügbar.",
};

/** Meldungen wie auf der Website (src/lib/errors.ts, translateAuthError), sonst die allgemeine Übersetzung. */
export function accountErrorMessage(error: unknown): string {
  if (error instanceof InputError) return error.message;
  const e = error as { message?: string; code?: string } | null;
  const raw = (e?.message ?? "").trim();
  const code = e?.code ?? "";
  if (MESSAGES[raw]) return MESSAGES[raw];
  if (code === "weak_password" || /weak|pwned/i.test(raw)) {
    return "Dieses Passwort ist zu unsicher oder wurde in einem Datenleck gefunden. Bitte wählen Sie ein anderes.";
  }
  if (code === "same_password" || /same password|different from the old/i.test(raw)) {
    return "Das neue Passwort muss sich vom bisherigen unterscheiden.";
  }
  if (code === "session_not_found" || code === "session_expired" || code === "bad_jwt") {
    return "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.";
  }
  return errorMessage(error);
}

// --- Profil ------------------------------------------------------------------

export type ProfileFields = Pick<Tables<"profiles">, "first_name" | "last_name" | "display_name" | "phone">;

export async function getProfile(userId: string): Promise<ProfileFields | null> {
  const { data, error } = await supabase.from("profiles").select("first_name, last_name, display_name, phone").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export const PHONE_ERROR = "Bitte geben Sie eine gültige Telefonnummer ein, z. B. 079 123 45 67 oder +41 79 123 45 67.";

/** Normalisiert Telefonnummern wie die Website (src/lib/validation/account.ts). Liefert null bei ungültiger Eingabe. */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || /[^\d\s+()./-]/.test(trimmed)) return null;
  let value = trimmed.replace(/[\s()./-]/g, "");
  if (value.lastIndexOf("+") > 0) return null;
  if (value.startsWith("00")) value = `+${value.slice(2)}`;
  if (/^0[1-9]\d{8}$/.test(value)) value = `+41${value.slice(1)}`;
  if (/^\+410[1-9]\d{8}$/.test(value)) value = `+41${value.slice(4)}`;
  if (value.startsWith("+41")) {
    const m = value.match(/^\+41([1-9]\d)(\d{3})(\d{2})(\d{2})$/);
    return m ? `+41 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : null;
  }
  if (/^\+[1-9]\d{7,14}$/.test(value)) return value;
  return null;
}

export interface ProfileInput {
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string;
}
export type ProfileErrors = Partial<Record<keyof ProfileInput, string>>;

/** Gleiche Regeln wie profileSchema der Website. */
export function validateProfile(input: ProfileInput): ProfileErrors {
  const errors: ProfileErrors = {};
  if (input.firstName.trim().length > 80) errors.firstName = "Höchstens 80 Zeichen.";
  if (input.lastName.trim().length > 80) errors.lastName = "Höchstens 80 Zeichen.";
  const display = input.displayName.trim();
  if (display.length < 2) errors.displayName = "Bitte geben Sie einen Anzeigenamen mit mindestens 2 Zeichen ein.";
  else if (display.length > 80) errors.displayName = "Höchstens 80 Zeichen.";
  else if (/immovia/i.test(display.replace(/[\s._-]/g, ""))) errors.displayName = "Der Anzeigename darf «Immovia» nicht enthalten.";
  const phone = input.phone.trim();
  if (phone && (phone.length > 30 || !normalizePhone(phone))) errors.phone = PHONE_ERROR;
  return errors;
}

export async function updateProfile(userId: string, input: ProfileInput): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: input.firstName.trim() || null,
      last_name: input.lastName.trim() || null,
      display_name: input.displayName.trim(),
      phone: input.phone.trim() ? normalizePhone(input.phone) : null,
    })
    .eq("id", userId)
    .select("id")
    .single();
  if (error) throw error;
}

// --- Passwort ----------------------------------------------------------------

/** Passwortregel der Website: 10–72 Zeichen, Buchstaben und mindestens eine Zahl. */
export function passwordRuleError(password: string): string | null {
  if (password.length < 10) return "Das Passwort muss mindestens 10 Zeichen lang sein.";
  if (password.length > 72) return "Das Passwort darf höchstens 72 Zeichen lang sein.";
  if (!(/[A-Za-zÄÖÜäöü]/.test(password) && /\d/.test(password))) return "Verwenden Sie Buchstaben und mindestens eine Zahl.";
  return null;
}

/** Wirft bei falschem aktuellem Passwort – damit das Formular den Fehler am richtigen Feld zeigt. */
export class CurrentPasswordError extends InputError {}

/**
 * Passwort ändern wie die Website: Das aktuelle Passwort wird per Anmeldung geprüft (erneuert die
 * Sitzung), danach wird das neue Passwort gesetzt.
 */
export async function changePassword(email: string, currentPassword: string, newPassword: string): Promise<void> {
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (signInError) {
    const code = signInError.code ?? "";
    if (code === "over_request_rate_limit" || signInError.status === 429) throw new InputError("Zu viele Versuche. Bitte warten Sie einen Moment.");
    if (code === "email_not_confirmed") throw new InputError("Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.");
    if (/Network request failed|Failed to fetch/i.test(signInError.message)) throw signInError;
    throw new CurrentPasswordError("Das aktuelle Passwort ist nicht korrekt.");
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// --- Einstellungen -----------------------------------------------------------

export const CONSENT_KEYS = ["ai_processing_consent", "ai_image_consent", "analytics_consent", "marketing_consent"] as const;
export type ConsentKey = (typeof CONSENT_KEYS)[number];
export type ConsentValues = Record<ConsentKey, boolean>;

/** Texte gemäss src/components/account/preferences-form.tsx (gekürzt). */
export const CONSENTS: { key: ConsentKey; label: string; description: string }[] = [
  {
    key: "ai_processing_consent",
    label: "KI-Verarbeitung erlauben",
    description:
      "Für KI-Texte, Erklärungen zur Bewertung und den KI-Assistenten. Dabei übermitteln wir die nötigen Angaben zum Objekt (z. B. Objektart, Zimmer, Fläche, Ausstattung, Ort) und Ihre Eingaben im Assistenten an unseren KI-Anbieter Anthropic (USA). Die Daten werden nicht zum Training von KI-Modellen verwendet und standardmässig innert 30 Tagen gelöscht. Ohne Einwilligung bleiben alle anderen Funktionen nutzbar.",
  },
  {
    key: "ai_image_consent",
    label: "Bild-KI erlauben",
    description:
      "Für Designvorschläge im Bilderstudio («Aufräumen», «Neu einrichten»). Dabei senden wir das ausgewählte Foto ohne Standortdaten über das AI Gateway von Vercel (USA) an den Anbieter des Bildmodells. Wir verlangen bei jeder Anfrage, dass das Foto nicht zum Training von KI-Modellen verwendet wird. Vorschläge werden erst nach Ihrer Prüfung veröffentlicht, gekennzeichnet als «KI-Visualisierung».",
  },
  {
    key: "analytics_consent",
    label: "Nutzungsstatistik",
    description:
      "Erlaubt uns, pseudonymisiert auszuwerten, wie Sie Immovia nutzen, um die Plattform zu verbessern. Die Aufrufzahlen von Inseraten werden unabhängig davon mit einer gehashten Kennung ohne IP-Adresse gezählt.",
  },
  {
    key: "marketing_consent",
    label: "Angebote und Aktionen",
    description: "Informationen zu Angeboten von Immovia per E-Mail. Die Einwilligung können Sie jederzeit widerrufen.",
  },
];

export const NOTIFICATION_KEYS = [
  "email_new_message",
  "email_new_inquiry",
  "email_viewings",
  "email_search_alerts",
  "email_listing_updates",
  "email_documents",
  "email_product_news",
] as const;
export type NotificationKey = (typeof NOTIFICATION_KEYS)[number];
export type NotificationValues = Record<NotificationKey, boolean>;

/** Wie NOTIFICATION_SETTINGS der Website (src/lib/validation/account.ts). */
export const NOTIFICATION_SETTINGS: { key: NotificationKey; label: string; description: string }[] = [
  { key: "email_new_message", label: "Neue Nachrichten", description: "E-Mail bei neuen Nachrichten in Ihren Konversationen (gebündelt, höchstens alle 15 Minuten)." },
  { key: "email_new_inquiry", label: "Neue Anfragen", description: "E-Mail, wenn jemand Ihr Inserat anfragt." },
  { key: "email_viewings", label: "Besichtigungen", description: "Anfragen, Bestätigungen, Absagen und Erinnerungen zu Besichtigungsterminen." },
  { key: "email_search_alerts", label: "Suchaufträge", description: "Neue Inserate, die zu Ihren Suchaufträgen passen." },
  { key: "email_listing_updates", label: "Meine Inserate", description: "Hinweise zu Ihren Inseraten, z. B. wenn ein Inserat online ist." },
  { key: "email_documents", label: "Dokumente", description: "E-Mail, wenn Ihnen jemand ein Dokument freigibt." },
  { key: "email_product_news", label: "Neuigkeiten zu Immovia", description: "Gelegentliche Informationen zu neuen Funktionen. Jederzeit abbestellbar." },
];

export interface AccountSettings {
  consents: ConsentValues | null;
  notifications: NotificationValues | null;
}

export async function getAccountSettings(userId: string): Promise<AccountSettings> {
  const [preferences, notifications] = await Promise.all([
    supabase.from("user_preferences").select(CONSENT_KEYS.join(", ")).eq("user_id", userId).maybeSingle(),
    supabase.from("user_notification_settings").select(NOTIFICATION_KEYS.join(", ")).eq("user_id", userId).maybeSingle(),
  ]);
  if (preferences.error) throw preferences.error;
  if (notifications.error) throw notifications.error;
  return {
    consents: preferences.data as unknown as ConsentValues | null,
    notifications: notifications.data as unknown as NotificationValues | null,
  };
}

export async function updateConsent(userId: string, key: ConsentKey, value: boolean): Promise<void> {
  const patch = { [key]: value } as Database["public"]["Tables"]["user_preferences"]["Update"];
  const { data, error } = await supabase.from("user_preferences").update(patch).eq("user_id", userId).select("user_id").maybeSingle();
  if (error) throw error;
  if (!data) throw new InputError("Ihre Einstellungen wurden nicht gefunden.");
}

export async function updateNotificationSetting(userId: string, key: NotificationKey, value: boolean): Promise<void> {
  const patch = { [key]: value } as Database["public"]["Tables"]["user_notification_settings"]["Update"];
  const { data, error } = await supabase.from("user_notification_settings").update(patch).eq("user_id", userId).select("user_id").maybeSingle();
  if (error) throw error;
  if (!data) throw new InputError("Ihre Benachrichtigungseinstellungen wurden nicht gefunden.");
}

// --- Benachrichtigungen ------------------------------------------------------

export type NotificationRow = Pick<Tables<"notifications">, "id" | "type" | "title" | "body" | "link" | "read_at" | "created_at">;

export async function notifications(): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function unreadNotificationCount(): Promise<number> {
  const { count, error } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (error) throw error;
}

/** Ziel in der App für den Link einer Benachrichtigung (Links zeigen auf Seiten der Website). */
export function notificationTarget(link: string | null): { kind: "chat"; id: string } | { kind: "listing"; slug: string } | null {
  if (!link) return null;
  const chat = link.match(/^\/dashboard\/nachrichten\/([0-9a-f-]{36})$/i);
  if (chat) return { kind: "chat", id: chat[1] };
  const listing = link.match(/^\/immobilien\/([^/?#]+)$/);
  if (listing) return { kind: "listing", slug: decodeURIComponent(listing[1]) };
  return null;
}

// --- Suchaufträge ------------------------------------------------------------

export const MAX_SAVED_SEARCHES = 25;

export const ALERT_FREQUENCIES = {
  instant: { label: "Sofort", description: "Sobald ein passendes Inserat veröffentlicht wird" },
  daily: { label: "Täglich", description: "Eine Zusammenfassung pro Tag" },
  weekly: { label: "Wöchentlich", description: "Eine Zusammenfassung pro Woche" },
} as const;
export type AlertFrequency = keyof typeof ALERT_FREQUENCIES;

/**
 * Gespeicherte Kriterien. Die Schlüssel entsprechen exakt src/lib/search/criteria.ts der Website und
 * saved_search_matches_listing() in der Datenbank – nur so finden die Benachrichtigungen passende Inserate.
 */
export type SavedCriteria = Record<string, unknown>;

/** Kriterien, die die Suche der App anwenden kann. */
const APP_KEYS = new Set(["offer", "types", "q", "price_max", "rooms_min", "area_min", "label"]);

/** Filter der App → gespeicherte Kriterien (nur gesetzte Werte, wie toSavedCriteria der Website). */
export function criteriaFromFilters(filters: SearchFilters): SavedCriteria {
  const criteria: SavedCriteria = {};
  if (filters.offer) criteria.offer = filters.offer;
  if (filters.types.length) criteria.types = filters.types.slice(0, 10);
  const q = filters.query.trim().slice(0, 80);
  if (q) criteria.q = q;
  if (filters.priceMax !== null && filters.priceMax >= 0) criteria.price_max = filters.priceMax;
  if (filters.roomsMin !== null && filters.roomsMin >= 0) criteria.rooms_min = filters.roomsMin;
  if (filters.areaMin !== null && filters.areaMin >= 0) criteria.area_min = filters.areaMin;
  return criteria;
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Gespeicherte Kriterien → Filter der App. `partial` ist true, wenn der Suchauftrag (auf der Website
 * erstellt) Kriterien enthält, die die Suche der App nicht kennt – die App sucht dann breiter.
 */
export function filtersFromCriteria(value: unknown): { filters: SearchFilters; partial: boolean } {
  const c = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const types = Array.isArray(c.types) ? c.types.filter((t): t is Enums<"property_type"> => typeof t === "string" && t in PROPERTY_TYPES) : [];
  // Ort: Freitext der Suche, sonst Gemeinde oder PLZ eines Website-Suchauftrags
  const query = asText(c.q) || asText(c.municipality) || asText(c.postal_code);
  const usedPlace = !asText(c.q) && (asText(c.municipality) ? "municipality" : asText(c.postal_code) ? "postal_code" : null);
  const partial = Object.entries(c).some(
    ([key, v]) => !APP_KEYS.has(key) && key !== usedPlace && v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length),
  );
  return {
    filters: {
      offer: c.offer === "sale" || c.offer === "rent" ? c.offer : null,
      query,
      types,
      priceMax: asNumber(c.price_max),
      roomsMin: asNumber(c.rooms_min),
      areaMin: asNumber(c.area_min),
      sort: "newest",
    },
    partial,
  };
}

/** Kurze, lesbare Zusammenfassung (wie describeCriteria der Website). */
export function describeCriteria(value: unknown): string {
  const c = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const types = Array.isArray(c.types) ? c.types.filter((t): t is Enums<"property_type"> => typeof t === "string" && t in PROPERTY_TYPES) : [];
  const parts: string[] = [];
  const typeLabel = types.length ? types.map((t) => PROPERTY_TYPES[t]).join(", ") : "Immobilien";
  parts.push(`${typeLabel}${c.offer === "sale" ? " zum Kaufen" : c.offer === "rent" ? " zum Mieten" : ""}`);
  const place = asText(c.label) || asText(c.municipality) || asText(c.postal_code) || (asText(c.canton) && `Kanton ${asText(c.canton)}`) || asText(c.q);
  const radius = asNumber(c.radius);
  if (place) parts.push(`in ${place}${radius ? ` (+${radius} km)` : ""}`);
  const rooms = asNumber(c.rooms_min);
  if (rooms) parts.push(`ab ${String(rooms).replace(".", ",")} Zimmer`);
  const price = asNumber(c.price_max);
  if (price) parts.push(`bis CHF ${formatNumber(price)}`);
  const area = asNumber(c.area_min);
  if (area) parts.push(`ab ${formatNumber(area)} m²`);
  return parts.join(" · ");
}

/** Filter als Routen-Parameter für die Suche («/»?suche=…). */
export function encodeFiltersParam(filters: SearchFilters): string {
  return JSON.stringify(filters);
}

export function decodeFiltersParam(raw: string | undefined): SearchFilters | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<SearchFilters> | null;
    if (!v || typeof v !== "object") return null;
    return {
      offer: v.offer === "sale" || v.offer === "rent" ? v.offer : null,
      query: typeof v.query === "string" ? v.query.slice(0, 80) : "",
      types: Array.isArray(v.types) ? v.types.filter((t) => typeof t === "string" && t in PROPERTY_TYPES) : [],
      priceMax: asNumber(v.priceMax),
      roomsMin: asNumber(v.roomsMin),
      areaMin: asNumber(v.areaMin),
      sort: v.sort === "price_asc" || v.sort === "price_desc" ? v.sort : "newest",
    };
  } catch {
    return null;
  }
}

export interface SavedSearch {
  id: string;
  name: string;
  criteria: unknown;
  alertEnabled: boolean;
  frequency: AlertFrequency;
  matches: number;
  createdAt: string;
}

export async function savedSearches(): Promise<SavedSearch[]> {
  const { data, error } = await supabase
    .from("saved_searches")
    .select("id, name, criteria, alert_enabled, alert_frequency, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const counts = await Promise.all(
    rows.map((s) => supabase.from("saved_search_matches").select("listing_id", { count: "exact", head: true }).eq("saved_search_id", s.id)),
  );
  return rows.map((s, index) => ({
    id: s.id,
    name: s.name,
    criteria: s.criteria,
    alertEnabled: s.alert_enabled,
    frequency: s.alert_frequency in ALERT_FREQUENCIES ? (s.alert_frequency as AlertFrequency) : "instant",
    matches: counts[index]?.count ?? 0,
    createdAt: s.created_at,
  }));
}

export async function createSavedSearch(input: { name: string; filters: SearchFilters; alertEnabled: boolean; frequency: AlertFrequency }): Promise<void> {
  const name = input.name.trim();
  if (!name) throw new InputError("Bitte geben Sie einen Namen ein.");
  if (name.length > 120) throw new InputError("Der Name darf höchstens 120 Zeichen lang sein.");
  const { count, error: countError } = await supabase.from("saved_searches").select("id", { count: "exact", head: true });
  if (countError) throw countError;
  if ((count ?? 0) >= MAX_SAVED_SEARCHES) {
    throw new InputError(`Sie können höchstens ${MAX_SAVED_SEARCHES} Suchaufträge speichern. Löschen Sie zuerst einen bestehenden Suchauftrag.`);
  }
  const { error } = await supabase.from("saved_searches").insert({
    name,
    criteria: criteriaFromFilters(input.filters) as Database["public"]["Tables"]["saved_searches"]["Insert"]["criteria"],
    alert_enabled: input.alertEnabled,
    alert_frequency: input.frequency,
  });
  if (error) throw error;
}

export async function updateSavedSearch(id: string, patch: { alertEnabled?: boolean; frequency?: AlertFrequency }): Promise<void> {
  const update: Database["public"]["Tables"]["saved_searches"]["Update"] = {};
  if (patch.alertEnabled !== undefined) update.alert_enabled = patch.alertEnabled;
  if (patch.frequency !== undefined) update.alert_frequency = patch.frequency;
  const { data, error } = await supabase.from("saved_searches").update(update).eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new InputError("Dieser Suchauftrag wurde nicht gefunden.");
}

export async function deleteSavedSearch(id: string): Promise<void> {
  const { error } = await supabase.from("saved_searches").delete().eq("id", id);
  if (error) throw error;
}

// --- Inserat: Ausstattung, Dokumente, Dossier --------------------------------

/** Bezeichnungen aus FEATURE_CATALOG (src/lib/constants.ts). */
export const FEATURE_LABELS: Record<string, string> = {
  lake_view: "Seesicht",
  mountain_view: "Bergsicht",
  quiet_location: "Ruhige Lage",
  near_public_transport: "Nähe ÖV",
  fireplace: "Cheminée",
  floor_heating: "Bodenheizung",
  own_washing_machine: "Eigene Waschmaschine",
  dishwasher: "Geschirrspüler",
  steamer: "Steamer",
  walk_in_closet: "Ankleide",
  parquet: "Parkett",
  fiber_optic: "Glasfaser",
  smart_home: "Smart Home",
  solar_panels: "Photovoltaik",
  ev_charging: "E-Ladestation",
  conservatory: "Wintergarten",
  pool: "Pool",
  playground: "Spielplatz",
  storage_room: "Bastelraum",
  bike_room: "Veloraum",
  hobby_room: "Hobbyraum",
  guest_toilet: "Gäste-WC",
  sauna: "Sauna",
};

export interface ListingExtras {
  /** Bezeichnungen der erfassten Ausstattungsmerkmale (property_features) */
  features: string[];
  /** Öffentliche Dokumente (nur Titel; geöffnet werden sie auf der Website) */
  documents: { id: string; title: string }[];
  hasPublicDossier: boolean;
}

export async function listingExtras(listing: Pick<Tables<"listings">, "property_id" | "dossier_public">): Promise<ListingExtras> {
  const pid = listing.property_id;
  const [featuresRes, documentsRes, dossierRes] = await Promise.all([
    supabase.from("property_features").select("feature_key").eq("property_id", pid),
    supabase
      .from("property_documents")
      .select("id, title")
      .eq("property_id", pid)
      .eq("visibility", "public")
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    listing.dossier_public
      ? supabase.from("generated_dossiers").select("id").eq("property_id", pid).eq("is_public", true).eq("status", "ready").limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    features: (featuresRes.data ?? []).map((f) => FEATURE_LABELS[f.feature_key]).filter((label): label is string => Boolean(label)),
    documents: documentsRes.data ?? [],
    hasPublicDossier: Boolean(dossierRes.data),
  };
}

// --- Besichtigungen ----------------------------------------------------------

export const APPOINTMENT_STATUS: Record<Enums<"appointment_status">, string> = {
  requested: "Angefragt",
  confirmed: "Bestätigt",
  reschedule_requested: "Änderung angefragt",
  cancelled: "Abgesagt",
  completed: "Durchgeführt",
  no_show: "Nicht erschienen",
};

export interface ViewingSlot {
  id: string;
  starts_at: string;
  ends_at: string;
  available: number;
  note: string | null;
  my_appointment_id: string | null;
  my_status: Enums<"appointment_status"> | null;
  /** Beim Laden noch frei und früh genug buchbar */
  bookable: boolean;
}

/** Buchbar sind nur Zeitfenster, die frühestens in einer Stunde beginnen (wie book_viewing). */
const BOOKING_LEAD_MS = 60 * 60_000;

export async function viewingSlots(listingId: string): Promise<ViewingSlot[]> {
  const { data, error } = await supabase.rpc("get_viewing_slots", { p_listing_id: listingId });
  if (error) throw error;
  const now = Date.now();
  return ((data ?? []) as unknown as Omit<ViewingSlot, "bookable">[])
    .filter((slot) => Boolean(slot.id && slot.starts_at && slot.ends_at))
    .map((slot) => {
      const available = Number(slot.available ?? 0);
      return { ...slot, available, bookable: available > 0 && new Date(slot.starts_at).getTime() - now > BOOKING_LEAD_MS };
    });
}

/** Besichtigung anfragen (Datenbankfunktion book_viewing wie bookViewing der Website). */
export async function bookViewing(slotId: string, message: string): Promise<string> {
  const text = message.trim();
  if (text.length > 1000) throw new InputError("Die Nachricht darf höchstens 1000 Zeichen lang sein.");
  const { data, error } = await supabase.rpc("book_viewing", { p_slot_id: slotId, ...(text ? { p_message: text } : {}) });
  if (error) {
    if (error.message === "invalid_message") throw new InputError("Die Nachricht darf höchstens 1000 Zeichen lang sein.");
    throw error;
  }
  return data as string;
}

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

/** «Sa, 14.11.2026, 10:00–10:30» in der Zeitzone des Geräts. */
export function formatSlot(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${WEEKDAYS[start.getDay()]}, ${pad(start.getDate())}.${pad(start.getMonth() + 1)}.${start.getFullYear()}, ${time(start)}–${time(end)}`;
}

// --- Inserat melden ----------------------------------------------------------

/** Wie REPORT_REASONS der Website (src/lib/constants.ts). */
export const REPORT_REASONS = {
  spam: "Spam oder Werbung",
  fraud: "Betrugsverdacht",
  inappropriate: "Unangemessener Inhalt",
  wrong_information: "Falsche Angaben",
  discrimination: "Diskriminierung",
  duplicate: "Doppeltes Inserat",
  other: "Anderer Grund",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

/** Meldet ein Inserat an die Moderation (user_reports), wie reportListingAction der Website. */
export async function reportListing(listingId: string, reason: ReportReason, details: string): Promise<void> {
  const text = details.trim();
  if (text.length > 2000) throw new InputError("Die Beschreibung darf höchstens 2000 Zeichen lang sein.");
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id")
    .eq("id", listingId)
    .in("status", ["published", "reserved"])
    .maybeSingle();
  if (listingError) throw listingError;
  if (!listing) throw new InputError("Dieses Inserat ist nicht mehr verfügbar.");
  const { error } = await supabase.from("user_reports").insert({ target_type: "listing", target_id: listing.id, reason, details: text || null });
  if (error) {
    if (error.code === "23505") throw new InputError("Sie haben dieses Inserat bereits gemeldet. Unser Team prüft Ihre Meldung.");
    throw error;
  }
}
