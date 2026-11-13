import { describe, expect, it } from "vitest";
import {
  deleteAccountSchema,
  normalizePhone,
  notificationSettingsSchema,
  passwordChangeSchema,
  preferencesSchema,
  profileSchema,
} from "@/lib/validation/account";

describe("normalizePhone", () => {
  it("normalisiert Schweizer Nummern in verschiedenen Schreibweisen", () => {
    expect(normalizePhone("079 123 45 67")).toBe("+41 79 123 45 67");
    expect(normalizePhone("0791234567")).toBe("+41 79 123 45 67");
    expect(normalizePhone("+41 79 123 45 67")).toBe("+41 79 123 45 67");
    expect(normalizePhone("0041 79 123 45 67")).toBe("+41 79 123 45 67");
    expect(normalizePhone("+41 (0)44 123 45 67")).toBe("+41 44 123 45 67");
    expect(normalizePhone("044/123.45.67")).toBe("+41 44 123 45 67");
    expect(normalizePhone("031-123-45-67")).toBe("+41 31 123 45 67");
  });

  it("akzeptiert internationale Nummern im E.164-Format", () => {
    expect(normalizePhone("+49 30 1234567")).toBe("+49301234567");
    expect(normalizePhone("0033 1 23 45 67 89")).toBe("+33123456789");
  });

  it("lehnt ungültige Nummern ab", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("079 123 45")).toBeNull();
    expect(normalizePhone("079 123 45 678")).toBeNull();
    expect(normalizePhone("+41 79 123 45 6")).toBeNull();
    expect(normalizePhone("0012345")).toBeNull();
    expect(normalizePhone("abc 079 123 45 67")).toBeNull();
    expect(normalizePhone("79+1234567")).toBeNull();
    expect(normalizePhone("+123")).toBeNull();
  });
});

describe("profileSchema", () => {
  it("bereinigt und normalisiert gültige Eingaben", () => {
    const result = profileSchema.parse({ firstName: "  Anna ", lastName: "", displayName: " Anna M. ", phone: "079 123 45 67" });
    expect(result).toEqual({ firstName: "Anna", lastName: null, displayName: "Anna M.", phone: "+41 79 123 45 67" });
  });

  it("erlaubt ein leeres Telefonfeld", () => {
    expect(profileSchema.parse({ firstName: "", lastName: "", displayName: "Anna", phone: "" }).phone).toBeNull();
  });

  it("verlangt einen Anzeigenamen mit mindestens 2 Zeichen", () => {
    const result = profileSchema.safeParse({ firstName: "", lastName: "", displayName: " A ", phone: "" });
    expect(result.success).toBe(false);
  });

  it("verhindert Verwechslung mit offiziellen Konten", () => {
    expect(profileSchema.safeParse({ firstName: "", lastName: "", displayName: "Immovia Support", phone: "" }).success).toBe(false);
    expect(profileSchema.safeParse({ firstName: "", lastName: "", displayName: "IMMO VIA", phone: "" }).success).toBe(false);
  });

  it("meldet ungültige Telefonnummern am Feld", () => {
    const result = profileSchema.safeParse({ firstName: "", lastName: "", displayName: "Anna", phone: "123" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.flatten().fieldErrors.phone?.[0]).toMatch(/Telefonnummer/);
  });
});

describe("passwordChangeSchema", () => {
  it("akzeptiert ein gültiges neues Passwort", () => {
    expect(
      passwordChangeSchema.safeParse({ currentPassword: "alt-passwort-1", newPassword: "NeuesPasswort2026", confirm: "NeuesPasswort2026" }).success,
    ).toBe(true);
  });

  it("verlangt dieselben Regeln wie bei der Registrierung", () => {
    const short = passwordChangeSchema.safeParse({ currentPassword: "x", newPassword: "kurz1", confirm: "kurz1" });
    expect(short.success).toBe(false);
    const noDigit = passwordChangeSchema.safeParse({ currentPassword: "x", newPassword: "nurbuchstaben", confirm: "nurbuchstaben" });
    expect(noDigit.success).toBe(false);
  });

  it("prüft die Wiederholung und verlangt ein anderes Passwort", () => {
    const mismatch = passwordChangeSchema.safeParse({ currentPassword: "x", newPassword: "NeuesPasswort2026", confirm: "Anders2026xx" });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) expect(mismatch.error.flatten().fieldErrors.confirm).toBeDefined();
    const same = passwordChangeSchema.safeParse({ currentPassword: "Gleich12345", newPassword: "Gleich12345", confirm: "Gleich12345" });
    expect(same.success).toBe(false);
    if (!same.success) expect(same.error.flatten().fieldErrors.newPassword).toBeDefined();
  });
});

describe("Einstellungen", () => {
  it("verlangt alle Benachrichtigungsschalter als Boolean", () => {
    const valid = {
      email_new_message: true,
      email_new_inquiry: true,
      email_viewings: false,
      email_search_alerts: true,
      email_listing_updates: true,
      email_documents: true,
      email_product_news: false,
    };
    expect(notificationSettingsSchema.parse(valid)).toEqual(valid);
    expect(notificationSettingsSchema.safeParse({ ...valid, email_viewings: "ja" }).success).toBe(false);
  });

  it("ignoriert unbekannte Felder in den Benachrichtigungen", () => {
    const parsed = notificationSettingsSchema.parse({
      email_new_message: true,
      email_new_inquiry: true,
      email_viewings: true,
      email_search_alerts: true,
      email_listing_updates: true,
      email_documents: true,
      email_product_news: true,
      user_id: "fremd",
    });
    expect(parsed).not.toHaveProperty("user_id");
  });

  it("wandelt «Keine Vorgabe» der Angebotsart in null um", () => {
    const base = { ai_processing_consent: true, ai_image_consent: false, analytics_consent: false, marketing_consent: false };
    expect(preferencesSchema.parse({ ...base, default_offer_type: "none" }).default_offer_type).toBeNull();
    expect(preferencesSchema.parse({ ...base, default_offer_type: "rent" }).default_offer_type).toBe("rent");
    expect(preferencesSchema.safeParse({ ...base, default_offer_type: "lease" }).success).toBe(false);
  });
});

describe("deleteAccountSchema", () => {
  it("verlangt das Bestätigungswort", () => {
    expect(deleteAccountSchema.safeParse({ confirmation: "LÖSCHEN" }).success).toBe(true);
    expect(deleteAccountSchema.safeParse({ confirmation: " löschen " }).success).toBe(true);
    expect(deleteAccountSchema.safeParse({ confirmation: "LOESCHEN" }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({ confirmation: "" }).success).toBe(false);
  });
});
