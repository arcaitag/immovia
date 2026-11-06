import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

/**
 * Testumgebung für Datenbank- und RLS-Tests gegen eine echte PostgreSQL-Instanz.
 * Start: `npm run db:local -- start`. Verbindung über TEST_DATABASE_URL.
 */
export const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://postgres@localhost:54329/postgres";
export const TEST_DB = process.env.TEST_DATABASE_NAME ?? "immovia_test";
export const TEST_URL =
  process.env.TEST_DATABASE_URL ?? `postgres://postgres@localhost:54329/${TEST_DB}`;

const ROOT = join(__dirname, "..", "..");

export function migrationFiles(): string[] {
  const dir = join(ROOT, "supabase", "migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => join(dir, f));
}

export async function resetDatabase(options: { seed?: boolean } = {}): Promise<void> {
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(
    `select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()`,
    [TEST_DB],
  );
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  const db = new Client({ connectionString: TEST_URL });
  await db.connect();
  try {
    await db.query(readFileSync(join(ROOT, "tests", "db", "supabase-bootstrap.sql"), "utf8"));
    for (const file of migrationFiles()) {
      try {
        await db.query(readFileSync(file, "utf8"));
      } catch (error) {
        const e = error as { message: string; position?: string };
        throw new Error(`Migration fehlgeschlagen: ${file}\n${e.message} (Position ${e.position ?? "?"})`);
      }
    }
    if (options.seed) {
      await db.query(readFileSync(join(ROOT, "supabase", "seed.sql"), "utf8"));
    }
  } finally {
    await db.end();
  }
}

export type Role = "anon" | "authenticated" | "service_role";

export interface Session {
  /** Führt eine Abfrage im Kontext der Rolle bzw. des Benutzers aus (in einer Transaktion, die zurückgerollt wird). */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

/**
 * Führt `fn` in einer Transaktion aus, die am Ende zurückgerollt wird,
 * es sei denn `commit` ist gesetzt.
 */
export async function withSession<R>(
  client: Client,
  context: { role: Role; userId?: string; commit?: boolean },
  fn: (s: Session) => Promise<R>,
): Promise<R> {
  await client.query("begin");
  try {
    const claims = JSON.stringify(
      context.role === "anon"
        ? { role: "anon" }
        : context.role === "service_role"
          ? { role: "service_role" }
          : { role: "authenticated", sub: context.userId },
    );
    await client.query("select set_config('request.jwt.claims', $1, true)", [claims]);
    await client.query(`set local role ${context.role}`);
    const session: Session = {
      async query<T>(sql: string, params?: unknown[]) {
        const res = await client.query(sql, params as unknown[]);
        return res.rows as T[];
      },
    };
    const result = await fn(session);
    await client.query(context.commit ? "commit" : "rollback");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

/** Legt einen Benutzer in auth.users an (Trigger erzeugt Profil). */
export async function createUser(
  client: Client,
  input: { id: string; email: string; firstName?: string; lastName?: string; confirmed?: boolean },
): Promise<void> {
  await client.query(
    `insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
     values ($1, $2, $3, $4)`,
    [
      input.id,
      input.email,
      input.confirmed === false ? null : new Date().toISOString(),
      JSON.stringify({ first_name: input.firstName ?? "Test", last_name: input.lastName ?? "Person" }),
    ],
  );
}

export async function connect(): Promise<Client> {
  const client = new Client({ connectionString: TEST_URL });
  await client.connect();
  return client;
}
