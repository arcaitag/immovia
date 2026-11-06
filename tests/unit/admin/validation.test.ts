import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  auditActionLabel,
  escapeLikePattern,
  moderateListingInputSchema,
  orgStatusInputSchema,
  parseDateParam,
  parseDaysParam,
  parseEnumParam,
  parsePageParam,
  parseQueryParam,
  roleInputSchema,
  sanitizeOrFilterValue,
  userStatusInputSchema,
  verificationInputSchema,
} from "@/lib/validation/admin";

const id = () => randomUUID();

describe("Admin-Aktionen", () => {
  it("verlangt beim Sperren eines Benutzers eine Begründung", () => {
    expect(userStatusInputSchema.safeParse({ userId: id(), status: "suspended", reason: "" }).success).toBe(false);
    expect(userStatusInputSchema.safeParse({ userId: id(), status: "suspended", reason: "Betrugsverdacht" }).success).toBe(true);
    expect(userStatusInputSchema.safeParse({ userId: id(), status: "active", reason: "" }).success).toBe(true);
    expect(userStatusInputSchema.safeParse({ userId: id(), status: "deleted", reason: "x" }).success).toBe(false);
    expect(userStatusInputSchema.safeParse({ userId: "kein-uuid", status: "active", reason: "" }).success).toBe(false);
  });

  it("prüft Rollen", () => {
    expect(roleInputSchema.safeParse({ userId: id(), role: "moderator", grant: true }).success).toBe(true);
    expect(roleInputSchema.safeParse({ userId: id(), role: "owner", grant: true }).success).toBe(false);
  });

  it("verlangt bei Zurückweisen, Sperren und Markieren eine Begründung", () => {
    expect(moderateListingInputSchema.safeParse({ listingId: id(), action: "approve", reason: "" }).success).toBe(true);
    expect(moderateListingInputSchema.safeParse({ listingId: id(), action: "unblock", reason: "" }).success).toBe(true);
    for (const action of ["reject", "block", "flag"]) {
      expect(moderateListingInputSchema.safeParse({ listingId: id(), action, reason: "" }).success).toBe(false);
      expect(moderateListingInputSchema.safeParse({ listingId: id(), action, reason: "Falsche Angaben zum Preis" }).success).toBe(true);
    }
    expect(moderateListingInputSchema.safeParse({ listingId: id(), action: "delete", reason: "" }).success).toBe(false);
  });

  it("lässt nur zur Art passende Verifizierungen zu", () => {
    const base = { subjectId: id(), status: "verified", method: "Grundbuchauszug geprüft" } as const;
    expect(verificationInputSchema.safeParse({ ...base, subjectType: "property", kind: "ownership" }).success).toBe(true);
    expect(verificationInputSchema.safeParse({ ...base, subjectType: "property", kind: "documentation_complete" }).success).toBe(true);
    expect(verificationInputSchema.safeParse({ ...base, subjectType: "user", kind: "identity" }).success).toBe(true);
    expect(verificationInputSchema.safeParse({ ...base, subjectType: "user", kind: "ownership" }).success).toBe(false);
    expect(verificationInputSchema.safeParse({ ...base, subjectType: "organization", kind: "identity" }).success).toBe(false);
  });

  it("verlangt beim Bestätigen einer Verifizierung die Prüfmethode", () => {
    const base = { subjectType: "user", subjectId: id(), kind: "identity" } as const;
    expect(verificationInputSchema.safeParse({ ...base, status: "verified", method: "" }).success).toBe(false);
    expect(verificationInputSchema.safeParse({ ...base, status: "revoked", method: "" }).success).toBe(true);
  });

  it("verlangt beim Sperren einer Firma eine Begründung", () => {
    expect(orgStatusInputSchema.safeParse({ organizationId: id(), status: "suspended", reason: "kurz" }).success).toBe(false);
    expect(orgStatusInputSchema.safeParse({ organizationId: id(), status: "active", reason: "" }).success).toBe(true);
  });
});

describe("URL-Parameter", () => {
  it("liest Seitenzahlen robust", () => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam("3")).toBe(3);
    expect(parsePageParam(["4", "5"])).toBe(4);
    expect(parsePageParam("-2")).toBe(1);
    expect(parsePageParam("abc")).toBe(1);
    expect(parsePageParam("999999")).toBe(1000);
  });

  it("lässt nur vorgesehene Zeiträume zu", () => {
    expect(parseDaysParam("7")).toBe(7);
    expect(parseDaysParam("90")).toBe(90);
    expect(parseDaysParam("13")).toBe(30);
    expect(parseDaysParam(undefined, 90)).toBe(90);
  });

  it("prüft Enum-, Text- und Datumsparameter", () => {
    expect(parseEnumParam("suspended", ["active", "suspended"] as const)).toBe("suspended");
    expect(parseEnumParam("root", ["active", "suspended"] as const)).toBeUndefined();
    expect(parseQueryParam("  anna\u0000 ")).toBe("anna");
    expect(parseQueryParam("   ")).toBeUndefined();
    expect(parseDateParam("2026-11-06")).toBe("2026-11-06");
    expect(parseDateParam("06.11.2026")).toBeUndefined();
  });

  it("entschärft Suchbegriffe für Datenbankfilter", () => {
    expect(escapeLikePattern("50%_a\\b")).toBe("50\\%\\_a\\\\b");
    expect(sanitizeOrFilterValue("Bern,(title.eq.x)")).toBe("Bern title.eq.x");
    expect(sanitizeOrFilterValue("  Zürich  ")).toBe("Zürich");
  });

  it("übersetzt Audit-Aktionen", () => {
    expect(auditActionLabel("listing.block")).toBe("Inserat gesperrt");
    expect(auditActionLabel("unbekannt.aktion")).toBe("unbekannt.aktion");
  });
});
