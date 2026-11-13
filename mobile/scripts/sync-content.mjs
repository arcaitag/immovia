#!/usr/bin/env node
/**
 * Übernimmt die Inhalte der Website (FAQ, Ratgeber, Marketingbilder) unverändert in die App.
 * Die Website bleibt die Quelle; nach Textänderungen dort: `node mobile/scripts/sync-content.mjs`.
 * Mit `--check` wird nur geprüft, ob die Kopien aktuell sind (Exit-Code 1 bei Abweichung).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const FILES = [
  ["src/lib/marketing-images.ts", "mobile/src/lib/marketing-images.ts"],
  ["src/lib/content/faq.ts", "mobile/src/lib/content/faq.ts"],
  ["src/lib/content/ratgeber.ts", "mobile/src/lib/content/ratgeber.ts"],
];
export const HEADER = "// Kopie der Website-Datei – nicht hier bearbeiten, sondern mit mobile/scripts/sync-content.mjs erneuern.\n";

const check = process.argv.includes("--check");
let stale = 0;
for (const [from, to] of FILES) {
  const expected = HEADER + readFileSync(join(root, from), "utf8");
  let current = null;
  try {
    current = readFileSync(join(root, to), "utf8");
  } catch {}
  if (current === expected) continue;
  stale++;
  if (check) console.error(`Veraltet: ${to}`);
  else {
    mkdirSync(dirname(join(root, to)), { recursive: true });
    writeFileSync(join(root, to), expected);
    console.log(`Aktualisiert: ${to}`);
  }
}
if (check && stale) process.exit(1);
