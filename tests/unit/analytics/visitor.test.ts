import { describe, expect, it } from "vitest";
import { signVisitorId, verifyVisitorCookie } from "@/lib/analytics/visitor";

const SECRET = "test-geheimnis-mit-genug-laenge-0123456789";
const ID = "3f6c2a1e-8b4d-4c3a-9e2f-1a2b3c4d5e6f";

describe("Besucherkennung der Aufrufstatistik", () => {
  it("akzeptiert nur vom Server signierte Kennungen", () => {
    expect(verifyVisitorCookie(signVisitorId(ID, SECRET), SECRET)).toBe(ID);
  });

  it("lehnt selbst erfundene, alte oder manipulierte Kennungen ab", () => {
    const signed = signVisitorId(ID, SECRET);
    expect(verifyVisitorCookie(ID, SECRET)).toBeNull(); // altes Format ohne Signatur
    expect(verifyVisitorCookie(`${ID}.falsch`, SECRET)).toBeNull();
    expect(verifyVisitorCookie(signed.replace(ID.slice(0, 8), "00000000"), SECRET)).toBeNull();
    expect(verifyVisitorCookie(signVisitorId(ID, "anderes-geheimnis"), SECRET)).toBeNull();
    expect(verifyVisitorCookie(`${signed}.extra`, SECRET)).toBeNull();
    expect(verifyVisitorCookie(signVisitorId("keine-uuid", SECRET), SECRET)).toBeNull();
    expect(verifyVisitorCookie(undefined, SECRET)).toBeNull();
    expect(verifyVisitorCookie("", SECRET)).toBeNull();
  });
});
