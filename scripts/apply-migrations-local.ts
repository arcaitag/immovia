/**
 * Setzt die lokale Testdatenbank zurück und spielt alle Migrationen ein.
 * Nutzung: npx tsx scripts/apply-migrations-local.ts [--seed]
 */
import { resetDatabase, TEST_URL } from "../tests/db/harness";

async function main() {
  const seed = process.argv.includes("--seed");
  await resetDatabase({ seed });
  console.log(`Migrationen erfolgreich eingespielt${seed ? " (mit Demo-Seed)" : ""}: ${TEST_URL}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
