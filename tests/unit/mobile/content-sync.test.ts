import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Die App zeigt dieselben Texte und Bilder wie die Website. Die Dateien in mobile/ sind Kopien;
 * nach Änderungen an der Website: `node mobile/scripts/sync-content.mjs`.
 */
const HEADER = "// Kopie der Website-Datei – nicht hier bearbeiten, sondern mit mobile/scripts/sync-content.mjs erneuern.\n";
const FILES = [
  ["src/lib/marketing-images.ts", "mobile/src/lib/marketing-images.ts"],
  ["src/lib/content/faq.ts", "mobile/src/lib/content/faq.ts"],
  ["src/lib/content/ratgeber.ts", "mobile/src/lib/content/ratgeber.ts"],
] as const;

describe("Inhalte der App", () => {
  it.each(FILES)("%s ist in der App aktuell", (from, to) => {
    const root = process.cwd();
    expect(readFileSync(join(root, to), "utf8")).toBe(HEADER + readFileSync(join(root, from), "utf8"));
  });
});
