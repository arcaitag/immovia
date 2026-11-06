import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createOrganizationSchema,
  inviteMemberSchema,
  invitationTokenSchema,
  normalizeUid,
  normalizeWebsite,
  organizationProfileSchema,
  parseInvitationPreview,
  uidCheckDigit,
} from "@/lib/validation/organization";

describe("UID (Unternehmens-Identifikationsnummer)", () => {
  it("berechnet die Prüfziffer", () => {
    expect(uidCheckDigit("10015521")).toBe(2);
    expect(uidCheckDigit("11369031")).toBe(9);
    expect(uidCheckDigit("1234")).toBeNull();
  });

  it("normalisiert gültige Nummern", () => {
    expect(normalizeUid("CHE-100.155.212")).toBe("CHE-100.155.212");
    expect(normalizeUid("che100155212")).toBe("CHE-100.155.212");
    expect(normalizeUid("CHE-113.690.319 MWST")).toBe("CHE-113.690.319");
    expect(normalizeUid("113 690 319")).toBe("CHE-113.690.319");
  });

  it("lehnt falsche Prüfziffern und Formate ab", () => {
    expect(normalizeUid("CHE-100.155.213")).toBeNull();
    expect(normalizeUid("CHE-123.456")).toBeNull();
    expect(normalizeUid("DE-100.155.212")).toBeNull();
  });
});

describe("normalizeWebsite", () => {
  it("ergänzt https:// und akzeptiert gültige Adressen", () => {
    expect(normalizeWebsite("www.muster.ch")).toBe("https://www.muster.ch");
    expect(normalizeWebsite("http://muster.ch/team")).toBe("http://muster.ch/team");
  });

  it("lehnt ungültige Adressen ab", () => {
    expect(normalizeWebsite("javascript:alert(1)")).toBeNull();
    expect(normalizeWebsite("muster")).toBeNull();
    expect(normalizeWebsite("https://user:pw@muster.ch")).toBeNull();
    expect(normalizeWebsite("muster .ch")).toBeNull();
  });
});

describe("Firmenformulare", () => {
  it("prüft den Firmennamen beim Erstellen", () => {
    expect(createOrganizationSchema.safeParse({ name: "Muster Immobilien AG", email: "", phone: "" }).success).toBe(true);
    expect(createOrganizationSchema.safeParse({ name: "M", email: "", phone: "" }).success).toBe(false);
    expect(createOrganizationSchema.safeParse({ name: "Immovia Partner", email: "", phone: "" }).success).toBe(false);
  });

  const validProfile = {
    organizationId: randomUUID(),
    name: "Muster Immobilien AG",
    description: "",
    street: "Bahnhofstrasse 1",
    postalCode: "3000",
    city: "Bern",
    canton: "BE",
    phone: "031 123 45 67",
    email: "Info@Muster.ch",
    website: "muster.ch",
    uidNumber: "CHE100155212",
    isPublic: true,
  };

  it("normalisiert das Firmenprofil", () => {
    const parsed = organizationProfileSchema.parse(validProfile);
    expect(parsed.phone).toBe("+41 31 123 45 67");
    expect(parsed.email).toBe("info@muster.ch");
    expect(parsed.website).toBe("https://muster.ch");
    expect(parsed.uidNumber).toBe("CHE-100.155.212");
    expect(parsed.description).toBeNull();
    expect(parsed.canton).toBe("BE");
  });

  it("erlaubt leere optionale Felder", () => {
    const parsed = organizationProfileSchema.parse({
      ...validProfile,
      street: "",
      postalCode: "",
      city: "",
      canton: "",
      phone: "",
      email: "",
      website: "",
      uidNumber: "",
    });
    expect(parsed).toMatchObject({ street: null, postalCode: null, city: null, canton: null, phone: null, email: null, website: null, uidNumber: null });
  });

  it("meldet ungültige Felder", () => {
    const result = organizationProfileSchema.safeParse({ ...validProfile, postalCode: "0300", canton: "XX", uidNumber: "CHE-100.155.213" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.postalCode).toBeDefined();
      expect(errors.canton).toBeDefined();
      expect(errors.uidNumber).toBeDefined();
    }
  });

  it("vergibt bei Einladungen keine Inhaberrolle", () => {
    const base = { organizationId: randomUUID(), email: "neu@firma.ch" };
    expect(inviteMemberSchema.safeParse({ ...base, role: "member" }).success).toBe(true);
    expect(inviteMemberSchema.safeParse({ ...base, role: "admin" }).success).toBe(true);
    expect(inviteMemberSchema.safeParse({ ...base, role: "owner" }).success).toBe(false);
  });
});

describe("Einladungen", () => {
  it("akzeptiert nur Hex-Tokens", () => {
    expect(invitationTokenSchema.safeParse("a".repeat(64)).success).toBe(true);
    expect(invitationTokenSchema.safeParse("../../etc").success).toBe(false);
    expect(invitationTokenSchema.safeParse("abc").success).toBe(false);
  });

  it("liest die Einladungsvorschau robust", () => {
    expect(parseInvitationPreview(null).status).toBe("invalid");
    expect(parseInvitationPreview({ status: "irgendwas" }).status).toBe("invalid");
    const preview = parseInvitationPreview({
      status: "open",
      organization_name: "Muster AG",
      role: "owner",
      email_matches: true,
      already_member: false,
      email_hint: "n***@firma.ch",
    });
    expect(preview).toMatchObject({ status: "open", organizationName: "Muster AG", role: null, emailMatches: true, alreadyMember: false });
  });
});
