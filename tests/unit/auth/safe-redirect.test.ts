import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/validation/auth";

describe("safeRedirectPath", () => {
  it("lässt interne Pfade mit Suche und Anker durch", () => {
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("/immobilien/haus-in-bern#anfrage")).toBe("/immobilien/haus-in-bern#anfrage");
    expect(safeRedirectPath("/kaufen?typ=apartment&zimmer_von=3")).toBe("/kaufen?typ=apartment&zimmer_von=3");
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example/phish",
    "/\n/evil.example",
    "/\r\n/evil.example",
    "\t//evil.example",
    "/%5C/evil.example\\",
    "/.//evil.example",
    "/./\\evil.example",
    "javascript:alert(1)",
    "evil.example",
    "",
  ])("lehnt externe oder manipulierte Ziele ab: %j", (value) => {
    const result = safeRedirectPath(value);
    expect(result).toBe("/dashboard");
    expect(new URL(result, "https://immovia.ch").origin).toBe("https://immovia.ch");
  });

  it("lehnt Auth- und API-Routen ab, auch über Punkt-Segmente", () => {
    expect(safeRedirectPath("/auth/callback")).toBe("/dashboard");
    expect(safeRedirectPath("/api/account/export")).toBe("/dashboard");
    expect(safeRedirectPath("/dashboard/../auth/abmelden")).toBe("/dashboard");
    expect(safeRedirectPath("/api")).toBe("/dashboard");
  });

  it("gibt bei fehlenden Werten das Ersatzziel zurück", () => {
    expect(safeRedirectPath(undefined, "/login")).toBe("/login");
    expect(safeRedirectPath(42, "/login")).toBe("/login");
  });

  it("jedes zugelassene Ziel bleibt auf der eigenen Domain", () => {
    for (const value of ["/a//b", "/%2F%2Fevil.example", "/.//evil.example", "/x?next=//evil.example"]) {
      const result = safeRedirectPath(value);
      expect(new URL(result, "https://immovia.ch").origin).toBe("https://immovia.ch");
    }
  });
});
