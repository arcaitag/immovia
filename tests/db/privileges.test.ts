/**
 * Rechte-Invarianten nach allen Migrationen. Die lokale Testdatenbank vergibt – wie Supabase –
 * standardmässig volle Rechte an anon/authenticated (siehe supabase-bootstrap.sql). Diese Tests
 * stellen sicher, dass die Migrationen das wirksam einschränken. Schlägt ein Test nach einer neuen
 * Migration fehl: Rechte in der Migration gezielt setzen oder die Allowlist bewusst erweitern
 * (auch in 20261106900000_security_hardening.sql).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { connect, resetDatabase } from "./harness";

let db: Client;

beforeAll(async () => {
  await resetDatabase();
  db = await connect();
});

afterAll(async () => {
  await db?.end();
});

const ANON_FUNCTIONS = [
  "can_manage_listing",
  "can_manage_property",
  "can_read_document",
  "can_read_document_object",
  "feature_setting",
  "get_listing_availability",
  "get_listing_public_contact",
  "get_organization_invitation",
  "get_public_verifications",
  "get_viewing_slots",
  "is_listing_public",
  "is_moderator",
  "is_org_member",
  "is_property_public",
  "is_public_dossier_object",
  "search_listings",
  "shares_conversation_with",
  "submit_contact_request",
  "try_uuid",
];

const INTERNAL_FUNCTIONS = [
  "check_rate_limit",
  "claim_emails",
  "claim_job",
  "claim_jobs",
  "cleanup_email_outbox",
  "cleanup_rate_limits",
  "enforce_rate_limit",
  "ensure_conversation",
  "is_privileged_context",
  "notify_user",
  "post_system_message",
  "purge_deleted_properties",
  "queue_email",
  "queue_search_alerts",
  "record_listing_view",
  "saved_search_matches_listing",
  "storage_cleanup_candidates",
  "write_audit_log",
];

const DELETE_TABLES = [
  "assistant_threads",
  "favorites",
  "lead_notes",
  "notifications",
  "organization_members",
  "properties",
  "property_features",
  "property_images",
  "property_renovations",
  "saved_searches",
  "user_blocks",
  "viewing_appointment_notes",
  "viewing_slots",
];

async function rows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query(sql, params)).rows as T[];
}

async function executableBy(role: string): Promise<string[]> {
  const result = await rows<{ proname: string }>(
    `select distinct p.proname
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege($1, p.oid, 'execute')
     order by 1`,
    [role],
  );
  return result.map((r) => r.proname);
}

describe("Funktionsrechte", () => {
  it("anon darf nur die freigegebenen Funktionen ausführen", async () => {
    expect(await executableBy("anon")).toEqual([...ANON_FUNCTIONS].sort());
  });

  it("authenticated darf keine internen Funktionen und keine Trigger-Funktionen ausführen", async () => {
    const allowed = new Set(await executableBy("authenticated"));
    for (const name of INTERNAL_FUNCTIONS) expect(allowed.has(name), name).toBe(false);
    const triggers = await rows<{ proname: string }>(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prorettype = 'trigger'::regtype`,
    );
    expect(triggers.length).toBeGreaterThan(0);
    for (const { proname } of triggers) expect(allowed.has(proname), proname).toBe(false);
  });

  it("alle SECURITY-DEFINER-Funktionen haben einen festen search_path", async () => {
    const unsafe = await rows<{ proname: string }>(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prosecdef
         and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`,
    );
    expect(unsafe).toEqual([]);
  });
});

describe("Tabellenrechte", () => {
  async function tablePrivileges(role: string) {
    return rows<{ relname: string; privilege_type: string }>(
      `select c.relname, a.privilege_type
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       cross join lateral aclexplode(c.relacl) a
       join pg_roles r on r.oid = a.grantee
       where n.nspname = 'public' and c.relkind = 'r' and r.rolname = $1
       order by 1, 2`,
      [role],
    );
  }

  it("alle Tabellen haben RLS aktiviert", async () => {
    const withoutRls = await rows<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(withoutRls).toEqual([]);
  });

  it("anon hat auf Tabellenebene nur SELECT", async () => {
    const privileges = await tablePrivileges("anon");
    expect(privileges.filter((p) => p.privilege_type !== "SELECT")).toEqual([]);
  });

  it("authenticated schreibt nur über Spaltenrechte und löscht nur auf freigegebenen Tabellen", async () => {
    const privileges = await tablePrivileges("authenticated");
    const unexpected = privileges.filter(
      (p) => p.privilege_type !== "SELECT" && !(p.privilege_type === "DELETE" && DELETE_TABLES.includes(p.relname)),
    );
    expect(unexpected).toEqual([]);
  });

  it("neue Tabellen erhalten für anon/authenticated nur noch SELECT", async () => {
    await db.query("create table public.zz_privilege_probe (id int primary key)");
    try {
      const privileges = await rows<{ rolname: string; privilege_type: string }>(
        `select r.rolname, a.privilege_type
         from pg_class c cross join lateral aclexplode(c.relacl) a join pg_roles r on r.oid = a.grantee
         where c.oid = 'public.zz_privilege_probe'::regclass and r.rolname in ('anon', 'authenticated')`,
      );
      expect(privileges.every((p) => p.privilege_type === "SELECT")).toBe(true);
    } finally {
      await db.query("drop table public.zz_privilege_probe");
    }
  });
});

describe("Öffentliche Daten ohne private Felder", () => {
  it("listings enthält keine privaten Kontaktfelder mehr", async () => {
    const columns = await rows<{ column_name: string }>(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'listings' and column_name in ('contact_email', 'contact_phone')`,
    );
    expect(columns).toEqual([]);
  });

  it("anon kann verifications und listing_contacts nicht lesen", async () => {
    const policies = await rows<{ tablename: string; roles: string }>(
      `select tablename, roles::text from pg_policies
       where schemaname = 'public' and tablename in ('verifications', 'listing_contacts') and cmd in ('SELECT', 'ALL')`,
    );
    for (const policy of policies) expect(policy.roles).not.toContain("anon");
  });
});
