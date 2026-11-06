import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLATFORM_SETTINGS,
  parsePlatformSettings,
  parseSettingSection,
  settingInputSchemas,
  settingKeySchema,
} from "@/lib/validation/admin";

describe("parsePlatformSettings", () => {
  it("liefert Standardwerte ohne Daten", () => {
    expect(parsePlatformSettings([])).toEqual(DEFAULT_PLATFORM_SETTINGS);
    expect(parsePlatformSettings(null)).toEqual(DEFAULT_PLATFORM_SETTINGS);
  });

  it("übernimmt gespeicherte Werte aus feature_settings", () => {
    const settings = parsePlatformSettings([
      { key: "maintenance", value: { enabled: true, message: "Kurze Wartung bis 22:00 Uhr." } },
      { key: "publishing", value: { require_review: true, min_images: 3, max_images: 30 } },
      { key: "platform", value: { name: "Immovia", contact_email: "Support@Immovia.ch", contact_phone: null, address: null } },
    ]);
    expect(settings.maintenance).toEqual({ enabled: true, message: "Kurze Wartung bis 22:00 Uhr." });
    expect(settings.publishing).toEqual({ require_review: true, min_images: 3, max_images: 30 });
    expect(settings.platform.contact_email).toBe("support@immovia.ch");
    expect(settings.features).toEqual(DEFAULT_PLATFORM_SETTINGS.features);
  });

  it("ersetzt ungültige oder fehlende Felder einzeln durch Standardwerte", () => {
    const section = parseSettingSection("ai_quotas", { description_per_month: "viele", valuation_per_month: 4, unknown: 1 });
    expect(section.description_per_month).toBe(DEFAULT_PLATFORM_SETTINGS.ai_quotas.description_per_month);
    expect(section.valuation_per_month).toBe(4);
    expect(section.assistant_messages_per_day).toBe(DEFAULT_PLATFORM_SETTINGS.ai_quotas.assistant_messages_per_day);
    expect(section).not.toHaveProperty("unknown");
  });

  it("toleriert falsche Typen für ganze Abschnitte", () => {
    expect(parseSettingSection("features", "an")).toEqual(DEFAULT_PLATFORM_SETTINGS.features);
    expect(parseSettingSection("maintenance", [true])).toEqual(DEFAULT_PLATFORM_SETTINGS.maintenance);
    expect(parseSettingSection("features", { assistant: "true" }).assistant).toBe(true);
    expect(parseSettingSection("features", { assistant: false }).assistant).toBe(false);
  });

  it("korrigiert widersprüchliche Bildvorgaben", () => {
    const section = parseSettingSection("publishing", { min_images: 5, max_images: 2 });
    expect(section.max_images).toBeGreaterThanOrEqual(section.min_images);
  });

  it("lehnt ungültige Wartungstexte beim Lesen ab und nutzt den Standardtext", () => {
    expect(parseSettingSection("maintenance", { enabled: true, message: "" })).toEqual({
      enabled: true,
      message: DEFAULT_PLATFORM_SETTINGS.maintenance.message,
    });
  });
});

describe("settingInputSchemas", () => {
  it("validiert die Veröffentlichungsvorgaben streng", () => {
    expect(settingInputSchemas.publishing.safeParse({ require_review: false, min_images: 1, max_images: 40 }).success).toBe(true);
    expect(settingInputSchemas.publishing.safeParse({ require_review: false, min_images: 5, max_images: 2 }).success).toBe(false);
    expect(settingInputSchemas.publishing.safeParse({ require_review: false, min_images: -1, max_images: 2 }).success).toBe(false);
    expect(settingInputSchemas.publishing.safeParse({ require_review: false, min_images: 1.5, max_images: 2 }).success).toBe(false);
  });

  it("wandelt Formularwerte (Text) in Zahlen um", () => {
    const parsed = settingInputSchemas.valuation.parse({ min_comparables: "6", max_age_days: "180", radius_km: "12.5", area_tolerance: "0.3" });
    expect(parsed).toEqual({ min_comparables: 6, max_age_days: 180, radius_km: 12.5, area_tolerance: 0.3 });
  });

  it("verlangt alle Funktionsschalter", () => {
    const { registration: _omit, ...withoutRegistration } = DEFAULT_PLATFORM_SETTINGS.features;
    expect(settingInputSchemas.features.safeParse(withoutRegistration).success).toBe(false);
    expect(settingInputSchemas.features.safeParse(DEFAULT_PLATFORM_SETTINGS.features).success).toBe(true);
  });

  it("prüft Plattform-Kontaktdaten", () => {
    expect(settingInputSchemas.platform.safeParse({ name: "Immovia", contact_email: "", contact_phone: "", address: "" }).success).toBe(true);
    expect(settingInputSchemas.platform.safeParse({ name: "Immovia", contact_email: "kein-mail", contact_phone: "", address: "" }).success).toBe(false);
    expect(settingInputSchemas.platform.safeParse({ name: "I", contact_email: "", contact_phone: "", address: "" }).success).toBe(false);
  });

  it("kennt nur die vorgesehenen Schlüssel", () => {
    expect(settingKeySchema.safeParse("maintenance").success).toBe(true);
    expect(settingKeySchema.safeParse("secret_key").success).toBe(false);
  });
});
