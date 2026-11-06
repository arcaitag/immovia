import { resetDatabase } from "./harness";

/** Setzt die lokale Testdatenbank vor allen DB-Tests zurück und spielt alle Migrationen ein. */
export default async function setup() {
  await resetDatabase();
}
