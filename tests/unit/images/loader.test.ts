import { describe, expect, it } from "vitest";
import immoviaImageLoader from "@/lib/images/loader";
import { MARKETING_IMAGES } from "@/lib/marketing-images";

describe("Bild-Loader", () => {
  it("setzt Breite, Qualität und Format für Unsplash", () => {
    const url = new URL(immoviaImageLoader({ src: "https://images.unsplash.com/photo-1", width: 1200 }));
    expect(Object.fromEntries(url.searchParams)).toEqual({ w: "1200", q: "70", auto: "format", fit: "crop" });
  });

  it("behält einen Bildausschnitt (rect) bei, z. B. für das Startseitenbild", () => {
    const url = new URL(immoviaImageLoader({ src: MARKETING_IMAGES.hero.src, width: 1920, quality: 60 }));
    expect(url.searchParams.get("rect")).toBe("0,860,3840,1550");
    expect(url.searchParams.get("w")).toBe("1920");
    expect(url.searchParams.get("q")).toBe("60");
  });

  it("wählt die beim Upload erzeugte Variante für Inseratbilder", () => {
    const src = "https://example.supabase.co/storage/v1/object/public/property-images/a/b-lg.webp";
    expect(immoviaImageLoader({ src, width: 640 })).toMatch(/-sm\.webp$/);
    expect(immoviaImageLoader({ src, width: 1080 })).toMatch(/-md\.webp$/);
    expect(immoviaImageLoader({ src, width: 1920 })).toMatch(/-lg\.webp$/);
  });

  it("lässt lokale Dateien unverändert", () => {
    expect(immoviaImageLoader({ src: "/og.png", width: 640 })).toBe("/og.png");
  });
});
