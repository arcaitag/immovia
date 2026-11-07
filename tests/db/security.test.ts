/**
 * Szenario D (Sicherheit) und Zugriffsregeln gegen eine echte PostgreSQL-Datenbank
 * mit allen Migrationen. Jede Abfrage läuft mit der Rolle und den JWT-Claims des
 * jeweiligen Benutzers – genau wie über die Supabase-API.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { connect, resetDatabase, withSession } from "./harness";
import { IDS, seedFixtures } from "./fixtures";

let db: Client;

beforeAll(async () => {
  await resetDatabase();
  db = await connect();
  await seedFixtures(db);
});

afterAll(async () => {
  await db?.end();
});

const as = (userId: string) => ({ role: "authenticated" as const, userId });
const anon = { role: "anon" as const };

async function expectError(promise: Promise<unknown>, pattern: RegExp) {
  await expect(promise).rejects.toThrow(pattern);
}

describe("Szenario D: fremde IDs und private Daten", () => {
  it("Fremde Person kann eine fremde Immobilie per ID weder lesen noch ändern", async () => {
    await withSession(db, as(IDS.stranger), async (s) => {
      expect(await s.query("select id from public.properties where id = $1", [IDS.property])).toHaveLength(0);
      const updated = await s.query("update public.properties set rooms = 9 where id = $1 returning id", [IDS.property]);
      expect(updated).toHaveLength(0);
      const deleted = await s.query("delete from public.properties where id = $1 returning id", [IDS.property]);
      expect(deleted).toHaveLength(0);
    });
  });

  it("Fremde Person kann kein Inserat für eine fremde Immobilie anlegen", async () => {
    await withSession(db, as(IDS.stranger), async (s) => {
      await expectError(
        s.query("insert into public.listings (property_id, title) values ($1, 'Fake')", [IDS.property]),
        /row-level security|not_found/,
      );
    });
  });

  it("Eigentümer sieht und bearbeitet die eigene Immobilie", async () => {
    await withSession(db, as(IDS.seller), async (s) => {
      expect(await s.query("select id from public.properties where id = $1", [IDS.property])).toHaveLength(1);
      const updated = await s.query("update public.properties set bathrooms = 2 where id = $1 returning id", [IDS.property]);
      expect(updated).toHaveLength(1);
    });
  });

  it("Besucher sehen nur den öffentlichen Ausschnitt: keine Strasse bei Standort «nur Ort», keine Objekttabelle", async () => {
    await withSession(db, anon, async (s) => {
      expect(await s.query("select id from public.properties")).toHaveLength(0);
      const rows = await s.query<{ public_address: string; public_latitude: number }>(
        "select public_address, public_latitude from public.listings where id = $1",
        [IDS.listing],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.public_address).toBe("3072 Ostermundigen");
      expect(rows[0]?.public_address).not.toMatch(/Geheimweg/);
      expect(rows[0]?.public_latitude).toBeCloseTo(46.96, 2);
      expect(await s.query("select id from public.listings where id = $1", [IDS.draftListing])).toHaveLength(0);
    });
  });

  it("Entwürfe sind nur für Verwaltende sichtbar", async () => {
    await withSession(db, as(IDS.buyer), async (s) => {
      expect(await s.query("select id from public.listings where id = $1", [IDS.draftListing])).toHaveLength(0);
    });
    await withSession(db, as(IDS.seller), async (s) => {
      expect(await s.query("select id from public.listings where id = $1", [IDS.draftListing])).toHaveLength(1);
    });
  });

  it("Profile anderer Benutzer (E-Mail, Telefon) sind nicht lesbar", async () => {
    await withSession(db, as(IDS.buyer), async (s) => {
      expect(await s.query("select email from public.profiles where id = $1", [IDS.seller])).toHaveLength(0);
      expect(await s.query("select email from public.profiles where id = $1", [IDS.buyer])).toHaveLength(1);
    });
    await withSession(db, anon, async (s) => {
      expect(await s.query("select id from public.profiles")).toHaveLength(0);
      expect(await s.query("select id from public.email_outbox")).toHaveLength(0);
    });
  });
});

describe("Szenario D: private Dokumente", () => {
  it("Private Dokumente anderer Benutzer sind weder als Datensatz noch als Datei abrufbar", async () => {
    await withSession(db, as(IDS.buyer), async (s) => {
      const docs = await s.query<{ id: string }>("select id from public.property_documents where property_id = $1", [IDS.property]);
      expect(docs.map((d) => d.id)).toEqual([IDS.publicDoc]);
      const objects = await s.query("select name from storage.objects where bucket_id = 'documents' and name like $1", [
        `%${IDS.privateDoc}%`,
      ]);
      expect(objects).toHaveLength(0);
    });
    await withSession(db, anon, async (s) => {
      const objects = await s.query<{ name: string }>("select name from storage.objects where bucket_id = 'documents'");
      expect(objects.map((o) => o.name)).toEqual([`${IDS.property}/${IDS.publicDoc}.pdf`]);
    });
  });

  it("Eigentümer kann private Dokumente lesen", async () => {
    await withSession(db, as(IDS.seller), async (s) => {
      const objects = await s.query("select name from storage.objects where bucket_id = 'documents'");
      expect(objects).toHaveLength(2);
    });
  });

  it("Freigabe nur an Personen mit Kontakt, widerrufbar", async () => {
    // Ohne Kontakt keine Freigabe
    await withSession(db, as(IDS.seller), async (s) => {
      await expectError(s.query("select public.grant_document_access($1, $2)", [IDS.privateDoc, IDS.buyer]), /grantee_not_in_contact/);
    });
    // Käufer fragt an (Kontakt entsteht), Verkäufer gibt frei
    await withSession(db, { ...as(IDS.buyer), commit: true }, async (s) => {
      await s.query("select public.create_inquiry($1, $2)", [IDS.listing, "Guten Tag, ich interessiere mich für die Wohnung."]);
    });
    const grant = await withSession(db, { ...as(IDS.seller), commit: true }, async (s) => {
      const rows = await s.query<{ g: string }>("select public.grant_document_access($1, $2) as g", [IDS.privateDoc, IDS.buyer]);
      return rows[0]?.g;
    });
    await withSession(db, as(IDS.buyer), async (s) => {
      const objects = await s.query("select name from storage.objects where bucket_id = 'documents' and name like $1", [
        `%${IDS.privateDoc}%`,
      ]);
      expect(objects).toHaveLength(1);
    });
    // Fremde Person bleibt aussen vor
    await withSession(db, as(IDS.stranger), async (s) => {
      expect(await s.query("select id from public.property_documents where id = $1", [IDS.privateDoc])).toHaveLength(0);
      await expectError(s.query("select public.revoke_document_access($1)", [grant]), /not_found/);
    });
    // Widerruf
    await withSession(db, { ...as(IDS.seller), commit: true }, async (s) => {
      await s.query("select public.revoke_document_access($1)", [grant]);
    });
    await withSession(db, as(IDS.buyer), async (s) => {
      expect(await s.query("select id from public.property_documents where id = $1", [IDS.privateDoc])).toHaveLength(0);
    });
  });

  it("Dokumente mit Personendaten können nicht öffentlich gemacht werden", async () => {
    await withSession(db, as(IDS.seller), async (s) => {
      await expectError(
        s.query("update public.property_documents set visibility = 'public' where id = $1", [IDS.privateDoc]),
        /property_documents_personal_not_public/,
      );
    });
  });
});

describe("Szenario D: Admin-Bereich und Rollen", () => {
  it("Normale Benutzer können keine Admin-Funktionen ausführen", async () => {
    await withSession(db, as(IDS.buyer), async (s) => {
      await expectError(s.query("select public.admin_platform_stats()"), /forbidden/);
    });
    await withSession(db, as(IDS.buyer), async (s) => {
      await expectError(s.query("select public.admin_set_user_status($1, 'suspended')", [IDS.seller]), /forbidden/);
    });
    await withSession(db, as(IDS.buyer), async (s) => {
      await expectError(s.query("select public.admin_moderate_listing($1, 'block')", [IDS.listing]), /forbidden/);
    });
    await withSession(db, as(IDS.buyer), async (s) => {
      await expectError(s.query("select public.admin_update_setting('maintenance', '{\"enabled\": true}')"), /forbidden/);
    });
  });

  it("Benutzer können sich nicht selbst Rollen oder einen anderen Status geben", async () => {
    await withSession(db, as(IDS.buyer), async (s) => {
      await expectError(s.query("insert into public.user_roles (user_id, role) values ($1, 'admin')", [IDS.buyer]), /permission denied/);
    });
    await withSession(db, as(IDS.buyer), async (s) => {
      await expectError(s.query("update public.profiles set status = 'active' where id = $1", [IDS.buyer]), /permission denied/);
    });
    await withSession(db, as(IDS.seller), async (s) => {
      await expectError(
        s.query("update public.listings set moderation_status = 'ok' where id = $1", [IDS.listing]),
        /permission denied/,
      );
    });
  });

  it("Admin sieht Plattformstatistiken, Audit-Log wird geschrieben und ist unveränderlich", async () => {
    await withSession(db, { ...as(IDS.admin), commit: true }, async (s) => {
      const stats = await s.query<{ s: { users_total: number } }>("select public.admin_platform_stats() as s");
      expect(stats[0]?.s.users_total).toBeGreaterThanOrEqual(7);
      await s.query("select public.admin_update_setting('maintenance', '{\"enabled\": false, \"message\": \"Test\"}')");
    });
    const logs = await db.query("select action from public.admin_audit_logs where action = 'setting.update'");
    expect(logs.rowCount).toBeGreaterThanOrEqual(1);
    await expect(db.query("update public.admin_audit_logs set action = 'x'")).rejects.toThrow(/unveränderlich/);
    await withSession(db, as(IDS.buyer), async (s) => {
      expect(await s.query("select id from public.admin_audit_logs")).toHaveLength(0);
    });
  });

  it("Gesperrte Inserate können vom Eigentümer nicht wieder veröffentlicht werden", async () => {
    await withSession(db, { ...as(IDS.admin), commit: true }, async (s) => {
      await s.query("select public.admin_moderate_listing($1, 'block', 'Test')", [IDS.orgListing]);
    });
    await withSession(db, as(IDS.orgOwner), async (s) => {
      await s.query("update public.listings set status = 'paused' where id = $1", [IDS.orgListing]);
      await expectError(s.query("update public.listings set status = 'published' where id = $1", [IDS.orgListing]), /listing_blocked/);
    });
    await withSession(db, anon, async (s) => {
      expect(await s.query("select id from public.listings where id = $1", [IDS.orgListing])).toHaveLength(0);
    });
    await withSession(db, { ...as(IDS.admin), commit: true }, async (s) => {
      await s.query("select public.admin_moderate_listing($1, 'unblock')", [IDS.orgListing]);
    });
  });
});

describe("Szenario D: Nachrichten und Leads", () => {
  it("Fremde Personen können Konversationen weder lesen noch hineinschreiben", async () => {
    const conv = await withSession(db, as(IDS.buyer), async (s) => {
      const rows = await s.query<{ conversation_id: string }>("select conversation_id from public.get_my_conversations()");
      return rows[0]?.conversation_id;
    });
    expect(conv).toBeTruthy();
    await withSession(db, as(IDS.stranger), async (s) => {
      expect(await s.query("select id from public.messages where conversation_id = $1", [conv])).toHaveLength(0);
      expect(await s.query("select id from public.conversations where id = $1", [conv])).toHaveLength(0);
      expect(await s.query("select conversation_id from public.get_my_conversations()")).toHaveLength(0);
    });
    await withSession(db, as(IDS.stranger), async (s) => {
      await expectError(
        s.query("insert into public.messages (conversation_id, body) values ($1, 'Hallo')", [conv]),
        /row-level security/,
      );
    });
  });

  it("Interessenten sehen keine Leads und keine internen Notizen", async () => {
    const lead = await withSession(db, as(IDS.seller), async (s) => {
      const rows = await s.query<{ id: string; status: string }>("select id, status from public.leads where listing_id = $1", [IDS.listing]);
      expect(rows).toHaveLength(1);
      return rows[0]?.id;
    });
    await withSession(db, { ...as(IDS.seller), commit: true }, async (s) => {
      await s.query("insert into public.lead_notes (lead_id, body) values ($1, 'Wirkt sehr interessiert, Finanzierung klären')", [lead]);
    });
    await withSession(db, as(IDS.buyer), async (s) => {
      expect(await s.query("select id from public.leads")).toHaveLength(0);
      expect(await s.query("select id from public.lead_notes")).toHaveLength(0);
    });
  });

  it("Blockierte Personen können keine Nachrichten mehr senden", async () => {
    const conv = await withSession(db, as(IDS.buyer), async (s) => {
      const rows = await s.query<{ conversation_id: string }>("select conversation_id from public.get_my_conversations()");
      return rows[0]?.conversation_id;
    });
    await withSession(db, as(IDS.seller), async (s) => {
      await s.query("insert into public.user_blocks (blocked_id) values ($1)", [IDS.buyer]);
      await s.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: IDS.buyer })]);
      await expectError(
        s.query("insert into public.messages (conversation_id, body) values ($1, 'Hallo?')", [conv]),
        /row-level security/,
      );
    });
  });

  it("Teammitglieder einer Firma verwalten Firmenobjekte, Aussenstehende nicht", async () => {
    await withSession(db, as(IDS.orgMember), async (s) => {
      expect(await s.query("select id from public.properties where id = $1", [IDS.orgProperty])).toHaveLength(1);
      expect(await s.query("select id from public.properties where id = $1", [IDS.property])).toHaveLength(0);
    });
    await withSession(db, as(IDS.stranger), async (s) => {
      expect(await s.query("select id from public.properties where id = $1", [IDS.orgProperty])).toHaveLength(0);
    });
  });
});

describe("Datenintegrität", () => {
  it("Bewertungen ohne Datengrundlage dürfen keine Zahl enthalten", async () => {
    await expect(
      db.query(
        `insert into public.property_valuations (property_id, status, method, provider, estimated_value, disclaimer)
         values ($1, 'insufficient_data', 'test', 'test', 500000, 'Test')`,
        [IDS.property],
      ),
    ).rejects.toThrow(/property_valuations_no_number_without_data/);
  });

  it("Benutzer können Bewertungen nicht selbst schreiben", async () => {
    await withSession(db, as(IDS.seller), async (s) => {
      await expectError(
        s.query(
          `insert into public.property_valuations (property_id, status, method, provider, estimated_value, disclaimer)
           values ($1, 'completed', 'fake', 'fake', 999999, 'x')`,
          [IDS.property],
        ),
        /permission denied/,
      );
    });
  });

  it("KI-Kennzeichnung von Bildern kann nicht entfernt werden", async () => {
    await withSession(db, as(IDS.seller), async (s) => {
      await expectError(
        s.query("insert into public.property_images (property_id, is_ai_visualization) values ($1, false)", [IDS.property]),
        /permission denied/,
      );
    });
  });
});

describe("Sicherheitsprüfung: Dossiers und Bildpfade", () => {
  const victimDossier = "60000000-0000-4000-8000-000000000001";
  const ownDossier = "60000000-0000-4000-8000-000000000002";

  beforeAll(async () => {
    // Wie der Hintergrundjob (privilegiert): je ein fertiges Dossier am vorgesehenen Ort
    await db.query(
      `insert into public.generated_dossiers (id, property_id, template_id, version, status, storage_path)
       values ($1::uuid, $2::uuid, 'modern', 1, 'ready', $5),
              ($3::uuid, $4::uuid, 'modern', 1, 'ready', $6)`,
      [
        victimDossier,
        IDS.orgProperty,
        ownDossier,
        IDS.property,
        `${IDS.orgProperty}/${victimDossier}.pdf`,
        `${IDS.property}/${ownDossier}.pdf`,
      ],
    );
    await db.query(`update public.listings set dossier_public = true where id = $1`, [IDS.listing]);
  });

  it("Verkäufer können keine Dossier-Datensätze anlegen", async () => {
    await withSession(db, as(IDS.seller), async (s) => {
      await expectError(
        s.query(
          `insert into public.generated_dossiers (property_id, template_id, version, status, storage_path, is_public)
           values ($1, 'modern', 9, 'ready', $2, true)`,
          [IDS.property, `${IDS.orgProperty}/${victimDossier}.pdf`],
        ),
        /permission denied/,
      );
    });
  });

  it("Verkäufer können Pfad und Status eines Dossiers nicht ändern, nur die Freigabe", async () => {
    await withSession(db, as(IDS.seller), async (s) => {
      await expectError(
        s.query(`update public.generated_dossiers set storage_path = $2 where id = $1`, [ownDossier, `${IDS.orgProperty}/${victimDossier}.pdf`]),
        /permission denied/,
      );
    });
    await withSession(db, as(IDS.seller), async (s) => {
      await expectError(s.query(`update public.generated_dossiers set status = 'ready' where id = $1`, [ownDossier]), /permission denied/);
    });
    await withSession(db, as(IDS.seller), async (s) => {
      const rows = await s.query<{ is_public: boolean }>(
        `update public.generated_dossiers set is_public = true where id = $1 returning is_public`,
        [ownDossier],
      );
      expect(rows[0]?.is_public).toBe(true);
    });
  });

  it("öffentliche Dossier-Dateien nur am vorgesehenen Ort", async () => {
    // Datensatz mit fremdem Pfad (z. B. aus der Zeit vor der Korrektur) macht die fremde Datei nicht öffentlich
    await db.query(`update public.generated_dossiers set is_public = true, storage_path = $2 where id = $1`, [
      ownDossier,
      `${IDS.orgProperty}/${victimDossier}.pdf`,
    ]);
    await withSession(db, anon, async (s) => {
      const foreign = await s.query<{ ok: boolean }>(`select public.is_public_dossier_object($1) as ok`, [`${IDS.orgProperty}/${victimDossier}.pdf`]);
      expect(foreign[0]?.ok).toBe(false);
    });
    await db.query(`update public.generated_dossiers set storage_path = $2 where id = $1`, [ownDossier, `${IDS.property}/${ownDossier}.pdf`]);
    await withSession(db, anon, async (s) => {
      const own = await s.query<{ ok: boolean }>(`select public.is_public_dossier_object($1) as ok`, [`${IDS.property}/${ownDossier}.pdf`]);
      expect(own[0]?.ok).toBe(true);
    });
  });

  it("Bilder können nicht auf Dateien einer fremden Immobilie zeigen", async () => {
    const imageId = "70000000-0000-4000-8000-000000000001";
    await withSession(db, as(IDS.seller), async (s) => {
      await expectError(
        s.query(
          `insert into public.property_images (id, property_id, original_path, base_path, display_path, status)
           values ($1, $2, $3, $4, $4, 'ready')`,
          [imageId, IDS.property, `${IDS.orgProperty}/80000000-0000-4000-8000-000000000001.jpg`, `${IDS.property}/${imageId}/base`],
        ),
        /invalid_path/,
      );
    });
    await withSession(db, as(IDS.seller), async (s) => {
      await expectError(
        s.query(
          `insert into public.property_images (id, property_id, original_path, base_path, display_path, status)
           values ($1, $2, $3, $4, $4, 'ready')`,
          [imageId, IDS.property, `${IDS.property}/${imageId}.jpg`, `${IDS.orgProperty}/irgendwas/base`],
        ),
        /invalid_path/,
      );
    });
    await withSession(db, as(IDS.seller), async (s) => {
      await s.query(
        `insert into public.property_images (id, property_id, original_path, base_path, display_path, status)
         values ($1, $2, $3, $4, $4, 'ready')`,
        [imageId, IDS.property, `${IDS.property}/${imageId}.jpg`, `${IDS.property}/${imageId}/base`],
      );
      // Zuschneiden: neuer Anzeigepfad im eigenen Ordner ist erlaubt, ein fremder nicht
      await s.query(`update public.property_images set display_path = $2 where id = $1`, [imageId, `${IDS.property}/${imageId}/crop-1`]);
      await expectError(
        s.query(`update public.property_images set display_path = $2 where id = $1`, [imageId, `${IDS.orgProperty}/x/base`]),
        /invalid_path/,
      );
    });
  });
});
