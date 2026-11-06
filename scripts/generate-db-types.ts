/**
 * Erzeugt src/types/database.ts aus dem Schema der lokalen Testdatenbank
 * im Format von `supabase gen types typescript`.
 *
 * Nutzung: npm run db:local -- start && npx tsx scripts/apply-migrations-local.ts && npm run db:types
 * Alternativ (mit Supabase-Projekt): supabase gen types typescript --project-id <ref> > src/types/database.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { TEST_URL } from "../tests/db/harness";

interface Column {
  table_name: string;
  column_name: string;
  is_nullable: "YES" | "NO";
  column_default: string | null;
  is_identity: "YES" | "NO";
  is_generated: "ALWAYS" | "NEVER";
  udt_schema: string;
  udt_name: string;
  data_type: string;
  ordinal_position: number;
}

const SCALARS: Record<string, string> = {
  uuid: "string",
  text: "string",
  varchar: "string",
  bpchar: "string",
  citext: "string",
  date: "string",
  timestamptz: "string",
  timestamp: "string",
  time: "string",
  timetz: "string",
  interval: "string",
  inet: "string",
  bytea: "string",
  tstzrange: "string",
  int2: "number",
  int4: "number",
  int8: "number",
  float4: "number",
  float8: "number",
  numeric: "number",
  bool: "boolean",
  json: "Json",
  jsonb: "Json",
  void: "undefined",
};

function quote(name: string): string {
  return /^[a-z_][a-z0-9_]*$/i.test(name) ? name : JSON.stringify(name);
}

async function main() {
  const db = new Client({ connectionString: TEST_URL });
  await db.connect();

  const enumsRes = await db.query<{ name: string; values: string[] }>(`
    select t.typname::text as name, array_agg(e.enumlabel::text order by e.enumsortorder) as values
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
    group by t.typname
    order by t.typname`);
  const enumNames = new Set(enumsRes.rows.map((r) => r.name));

  const tablesRes = await db.query<{ table_name: string }>(`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name`);
  const tableNames = new Set(tablesRes.rows.map((r) => r.table_name));

  const columnsRes = await db.query<Column>(`
    select table_name, column_name, is_nullable, column_default, is_identity, is_generated,
           udt_schema, udt_name, data_type, ordinal_position
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, ordinal_position`);

  const fkRes = await db.query<{
    conname: string;
    table_name: string;
    columns: string[];
    ref_table: string;
    ref_columns: string[];
    one_to_one: boolean;
  }>(`
    select c.conname,
           tbl.relname as table_name,
           array(select a.attname::text from unnest(c.conkey) with ordinality k(attnum, ord)
                 join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum order by k.ord) as columns,
           ref.relname as ref_table,
           array(select a.attname::text from unnest(c.confkey) with ordinality k(attnum, ord)
                 join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.attnum order by k.ord) as ref_columns,
           exists (
             select 1 from pg_index i
             where i.indrelid = c.conrelid and i.indisunique and i.indpred is null
               and (select array_agg(x order by x) from unnest(i.indkey::int2[]) x)
                 = (select array_agg(x order by x) from unnest(c.conkey) x)
           ) as one_to_one
    from pg_constraint c
    join pg_class tbl on tbl.oid = c.conrelid
    join pg_namespace n on n.oid = tbl.relnamespace
    join pg_class ref on ref.oid = c.confrelid
    join pg_namespace rn on rn.oid = ref.relnamespace
    where c.contype = 'f' and n.nspname = 'public' and rn.nspname = 'public'
    order by tbl.relname, c.conname`);

  const fnRes = await db.query<{
    name: string;
    arg_names: string[] | null;
    arg_types: string[];
    arg_modes: string[] | null;
    all_arg_types: string[] | null;
    n_defaults: number;
    ret_type: string;
    ret_set: boolean;
  }>(`
    select p.proname as name,
           p.proargnames as arg_names,
           array(select format_type(t, null) from unnest(p.proargtypes::oid[]) t) as arg_types,
           p.proargmodes::text[] as arg_modes,
           case when p.proallargtypes is null then null
                else array(select format_type(t, null) from unnest(p.proallargtypes) t) end as all_arg_types,
           p.pronargdefaults as n_defaults,
           format_type(p.prorettype, null) as ret_type,
           p.proretset as ret_set
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and format_type(p.prorettype, null) <> 'trigger'
    order by p.proname`);

  function mapType(pgType: string): string {
    let t = pgType.trim();
    let isArray = false;
    if (t.endsWith("[]")) {
      isArray = true;
      t = t.slice(0, -2);
    }
    if (t.startsWith("_")) {
      isArray = true;
      t = t.slice(1);
    }
    t = t.replace(/^public\./, "").replace(/\(.*\)$/, "");
    const aliases: Record<string, string> = {
      "timestamp with time zone": "timestamptz",
      "timestamp without time zone": "timestamp",
      "character varying": "varchar",
      character: "bpchar",
      boolean: "bool",
      integer: "int4",
      smallint: "int2",
      bigint: "int8",
      "double precision": "float8",
      real: "float4",
    };
    t = aliases[t] ?? t;
    let ts: string;
    const scalar = SCALARS[t];
    if (scalar) ts = scalar;
    else if (enumNames.has(t)) ts = `Database["public"]["Enums"]["${t}"]`;
    else if (tableNames.has(t)) ts = `Database["public"]["Tables"]["${t}"]["Row"]`;
    else ts = "unknown";
    return isArray ? (ts.includes(" ") || ts.includes("|") ? `(${ts})[]` : `${ts}[]`) : ts;
  }

  const out: string[] = [];
  out.push("// Automatisch erzeugt von scripts/generate-db-types.ts – nicht von Hand bearbeiten.");
  out.push("// Format kompatibel mit `supabase gen types typescript`.");
  out.push("");
  out.push("export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];");
  out.push("");
  out.push("export type Database = {");
  out.push("  __InternalSupabase: {");
  out.push('    PostgrestVersion: "12.2.3";');
  out.push("  };");
  out.push("  public: {");
  out.push("    Tables: {");
  for (const table of [...tableNames]) {
    const cols = columnsRes.rows.filter((c) => c.table_name === table);
    const row = cols.map((c) => {
      const base = mapType(c.data_type === "ARRAY" ? `${c.udt_name}` : c.udt_name);
      return `          ${quote(c.column_name)}: ${base}${c.is_nullable === "YES" ? " | null" : ""};`;
    });
    const insert = cols
      .filter((c) => c.is_generated !== "ALWAYS" && !(c.is_identity === "YES" && c.column_default === null && false))
      .map((c) => {
        const base = mapType(c.udt_name);
        const optional = c.is_nullable === "YES" || c.column_default !== null || c.is_identity === "YES";
        return `          ${quote(c.column_name)}${optional ? "?" : ""}: ${base}${c.is_nullable === "YES" ? " | null" : ""};`;
      });
    const update = cols
      .filter((c) => c.is_generated !== "ALWAYS")
      .map((c) => `          ${quote(c.column_name)}?: ${mapType(c.udt_name)}${c.is_nullable === "YES" ? " | null" : ""};`);
    const rels = fkRes.rows
      .filter((f) => f.table_name === table)
      .map(
        (f) =>
          `          {\n            foreignKeyName: "${f.conname}";\n            columns: [${f.columns.map((c) => `"${c}"`).join(", ")}];\n            isOneToOne: ${f.one_to_one};\n            referencedRelation: "${f.ref_table}";\n            referencedColumns: [${f.ref_columns.map((c) => `"${c}"`).join(", ")}];\n          },`,
      );
    out.push(`      ${quote(table)}: {`);
    out.push("        Row: {");
    out.push(...row);
    out.push("        };");
    out.push("        Insert: {");
    out.push(...insert);
    out.push("        };");
    out.push("        Update: {");
    out.push(...update);
    out.push("        };");
    out.push(rels.length ? `        Relationships: [\n${rels.join("\n")}\n        ];` : "        Relationships: [];");
    out.push("      };");
  }
  out.push("    };");
  out.push("    Views: {");
  out.push("      [_ in never]: never;");
  out.push("    };");
  out.push("    Functions: {");
  const seenFns = new Set<string>();
  for (const fn of fnRes.rows) {
    if (seenFns.has(fn.name)) continue;
    seenFns.add(fn.name);
    const modes = fn.arg_modes ?? [];
    const names = fn.arg_names ?? [];
    const allTypes = fn.all_arg_types ?? fn.arg_types;
    const inArgs: { name: string; type: string }[] = [];
    const outCols: { name: string; type: string }[] = [];
    allTypes.forEach((type, idx) => {
      const mode = modes[idx] ?? "i";
      const name = names[idx] ?? `arg${idx}`;
      if (mode === "i" || mode === "b" || mode === "v") inArgs.push({ name, type });
      if (mode === "o" || mode === "t" || mode === "b") outCols.push({ name, type });
    });
    const firstDefault = inArgs.length - fn.n_defaults;
    const args = inArgs.map(
      (a, idx) => `${quote(a.name)}${idx >= firstDefault ? "?" : ""}: ${mapType(a.type)}`,
    );
    let returns: string;
    if (outCols.length > 0) {
      returns = `{\n${outCols.map((c) => `          ${quote(c.name)}: ${mapType(c.type)} | null;`).join("\n")}\n        }[]`;
    } else {
      const base = mapType(fn.ret_type);
      returns = fn.ret_set ? (base.includes(" ") ? `(${base})[]` : `${base}[]`) : base;
    }
    out.push(`      ${quote(fn.name)}: {`);
    out.push(args.length ? `        Args: { ${args.join("; ")} };` : "        Args: never;");
    out.push(`        Returns: ${returns};`);
    out.push("      };");
  }
  out.push("    };");
  out.push("    Enums: {");
  for (const e of enumsRes.rows) {
    out.push(`      ${quote(e.name)}: ${e.values.map((v) => JSON.stringify(v)).join(" | ")};`);
  }
  out.push("    };");
  out.push("    CompositeTypes: {");
  out.push("      [_ in never]: never;");
  out.push("    };");
  out.push("  };");
  out.push("};");
  out.push("");
  out.push(`type PublicSchema = Database["public"];`);
  out.push("");
  out.push(`export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];`);
  out.push(`export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];`);
  out.push(`export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];`);
  out.push(`export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];`);
  out.push(`export type FunctionReturns<T extends keyof PublicSchema["Functions"]> = PublicSchema["Functions"][T]["Returns"];`);
  out.push("");
  out.push("export const Constants = {");
  out.push("  public: {");
  out.push("    Enums: {");
  for (const e of enumsRes.rows) {
    out.push(`      ${quote(e.name)}: [${e.values.map((v) => JSON.stringify(v)).join(", ")}],`);
  }
  out.push("    },");
  out.push("  },");
  out.push("} as const;");
  out.push("");

  const target = join(__dirname, "..", "src", "types", "database.ts");
  writeFileSync(target, out.join("\n"));
  await db.end();
  console.log(`Typen geschrieben: ${target} (${tableNames.size} Tabellen, ${seenFns.size} Funktionen, ${enumNames.size} Enums)`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
