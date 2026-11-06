/**
 * Kritische Abläufe: Besichtigungen ohne Doppelbuchung (auch parallel), Statusregeln
 * für Inserate, Suchabos ohne doppelte Benachrichtigung, Rate Limiting, Suche.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { connect, resetDatabase, TEST_URL, withSession } from "./harness";
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

describe("Besichtigungen", () => {
  it("bucht ein Zeitfenster und verhindert Überbuchung", async () => {
    await withSession(db, { ...as(IDS.buyer), commit: true }, async (s) => {
      await s.query("select public.book_viewing($1, 'Samstag wäre ideal')", [IDS.slot]);
    });
    await withSession(db, as(IDS.buyer2), async (s) => {
      await expect(s.query("select public.book_viewing($1)", [IDS.slot])).rejects.toThrow(/slot_full/);
    });
    await withSession(db, as(IDS.buyer), async (s) => {
      const slots = await s.query<{ booked: number; available: number; my_status: string }>(
        "select booked, available, my_status from public.get_viewing_slots($1)",
        [IDS.listing],
      );
      expect(slots[0]).toMatchObject({ booked: 1, available: 0, my_status: "requested" });
    });
  });

  it("verhindert Doppelbuchungen auch bei gleichzeitigen Anfragen", async () => {
    const slotId = "50000000-0000-4000-8000-0000000000aa";
    await db.query(
      `insert into public.viewing_slots (id, listing_id, starts_at, ends_at, capacity)
       values ($1, $2, now() + interval '5 days', now() + interval '5 days 30 minutes', 1)`,
      [slotId, IDS.orgListing],
    );
    const c1 = new Client({ connectionString: TEST_URL });
    const c2 = new Client({ connectionString: TEST_URL });
    await Promise.all([c1.connect(), c2.connect()]);
    try {
      const attempt = async (client: Client, userId: string) => {
        await client.query("begin");
        await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: userId })]);
        await client.query("set local role authenticated");
        try {
          await client.query("select public.book_viewing($1)", [slotId]);
          await new Promise((r) => setTimeout(r, 150));
          await client.query("commit");
          return "ok";
        } catch (error) {
          await client.query("rollback");
          return (error as Error).message;
        }
      };
      const results = await Promise.all([attempt(c1, IDS.buyer), attempt(c2, IDS.stranger)]);
      expect(results.filter((r) => r === "ok")).toHaveLength(1);
      expect(results.filter((r) => /slot_full/.test(r))).toHaveLength(1);
      const count = await db.query("select count(*)::int as n from public.viewing_appointments where slot_id = $1", [slotId]);
      expect(count.rows[0]?.n).toBe(1);
    } finally {
      await Promise.all([c1.end(), c2.end()]);
    }
  });

  it("überlappende Zeitfenster für dasselbe Inserat werden abgelehnt", async () => {
    await withSession(db, as(IDS.seller), async (s) => {
      await expect(
        s.query(
          `insert into public.viewing_slots (listing_id, starts_at, ends_at)
           select listing_id, starts_at + interval '10 minutes', ends_at + interval '10 minutes'
           from public.viewing_slots where id = $1`,
          [IDS.slot],
        ),
      ).rejects.toThrow(/viewing_slots_no_overlap/);
    });
  });

  it("Verkäufer bestätigt, Status und Lead werden aktualisiert, Interessent wird benachrichtigt", async () => {
    const appointment = await db.query<{ id: string }>(
      "select id from public.viewing_appointments where slot_id = $1 and guest_id = $2",
      [IDS.slot, IDS.buyer],
    );
    const id = appointment.rows[0]?.id;
    await withSession(db, as(IDS.buyer), async (s) => {
      await expect(s.query("select public.update_viewing_status($1, 'confirm')", [id])).rejects.toThrow(/invalid_status_transition/);
    });
    await withSession(db, { ...as(IDS.seller), commit: true }, async (s) => {
      const res = await s.query<{ s: string }>("select public.update_viewing_status($1, 'confirm') as s", [id]);
      expect(res[0]?.s).toBe("confirmed");
    });
    const lead = await db.query("select status from public.leads where listing_id = $1 and interested_id = $2", [IDS.listing, IDS.buyer]);
    expect(lead.rows[0]?.status).toBe("viewing_confirmed");
    const notes = await db.query("select type from public.notifications where user_id = $1 and type = 'viewing_confirmed'", [IDS.buyer]);
    expect(notes.rowCount).toBe(1);
  });
});

describe("Inserate: Statusregeln", () => {
  it("unvollständige Inserate können nicht veröffentlicht werden (mit Liste der fehlenden Angaben)", async () => {
    await withSession(db, as(IDS.seller), async (s) => {
      await expect(s.query("update public.listings set status = 'published' where id = $1", [IDS.draftListing])).rejects.toMatchObject({
        message: "listing_incomplete",
        detail: expect.stringContaining("description"),
      });
    });
  });

  it("ungültige Statusübergänge werden abgelehnt", async () => {
    await withSession(db, as(IDS.seller), async (s) => {
      await s.query("update public.listings set status = 'sold' where id = $1", [IDS.listing]);
      await expect(s.query("update public.listings set status = 'published' where id = $1", [IDS.listing])).rejects.toThrow(
        /invalid_status_transition/,
      );
    });
  });

  it("mit Prüfpflicht ist direktes Veröffentlichen gesperrt, Moderation gibt frei", async () => {
    await db.query(`update public.feature_settings set value = jsonb_set(value, '{require_review}', 'true') where key = 'publishing'`);
    try {
      await withSession(db, as(IDS.seller), async (s) => {
        await s.query(
          "update public.listings set description = 'Ein schönes Haus.', price = 990000, texts_confirmed_at = now() where id = $1",
          [IDS.draftListing],
        );
        await s.query("savepoint vor_veroeffentlichung");
        await expect(s.query("update public.listings set status = 'published' where id = $1", [IDS.draftListing])).rejects.toThrow(
          /review_required/,
        );
        await s.query("rollback to savepoint vor_veroeffentlichung");
        await s.query("update public.listings set status = 'pending_review' where id = $1", [IDS.draftListing]);
        await s.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: IDS.admin })]);
        await s.query("select public.admin_moderate_listing($1, 'approve')", [IDS.draftListing]);
        const rows = await s.query<{ status: string; slug: string }>("select status, slug from public.listings where id = $1", [
          IDS.draftListing,
        ]);
        expect(rows[0]?.status).toBe("published");
        expect(rows[0]?.slug).toMatch(/^einfamilienhaus-5-5-zimmer-thun-/);
      });
    } finally {
      await db.query(`update public.feature_settings set value = jsonb_set(value, '{require_review}', 'false') where key = 'publishing'`);
    }
  });

  it("Änderungen an der Immobilie erscheinen im Inserat", async () => {
    await withSession(db, as(IDS.orgMember), async (s) => {
      await s.query("update public.properties set rooms = 4 where id = $1", [IDS.orgProperty]);
      const rows = await s.query<{ rooms: string }>("select rooms from public.listings where id = $1", [IDS.orgListing]);
      expect(Number(rows[0]?.rooms)).toBe(4);
    });
  });
});

describe("Suche und Suchabos", () => {
  it("filtert nach Angebot, Zimmern, Preis und liefert die Trefferzahl", async () => {
    await withSession(db, { role: "anon" }, async (s) => {
      const all = await s.query<{ total_count: string }>("select total_count from public.search_listings()");
      expect(all.length).toBeGreaterThan(0);
      const rent = await s.query<{ offer_type: string }>("select offer_type from public.search_listings(p_offer_type => 'rent')");
      expect(rent.every((r) => r.offer_type === "rent")).toBe(true);
      const none = await s.query("select id from public.search_listings(p_rooms_min => 20)");
      expect(none).toHaveLength(0);
    });
  });

  it("Umkreissuche findet Inserate in der Nähe", async () => {
    await withSession(db, { role: "anon" }, async (s) => {
      const near = await s.query<{ municipality: string; distance_km: number }>(
        "select municipality, distance_km from public.search_listings(p_lat => 47.37, p_lng => 8.54, p_radius_km => 5)",
      );
      expect(near.map((r) => r.municipality)).toContain("Zürich");
      expect(near.every((r) => r.distance_km <= 5)).toBe(true);
    });
  });

  it("benachrichtigt passende Suchabos genau einmal pro Inserat", async () => {
    await withSession(db, { ...as(IDS.buyer2), commit: true }, async (s) => {
      await s.query(
        `insert into public.saved_searches (name, criteria) values ('Wohnung Zürich', '{"offer":"rent","municipality":"Zürich"}')`,
      );
    });
    await withSession(db, { ...as(IDS.orgOwner), commit: true }, async (s) => {
      await s.query("update public.listings set status = 'paused' where id = $1", [IDS.orgListing]);
      await s.query("update public.listings set status = 'published' where id = $1", [IDS.orgListing]);
      await s.query("update public.listings set status = 'paused' where id = $1", [IDS.orgListing]);
      await s.query("update public.listings set status = 'published' where id = $1", [IDS.orgListing]);
    });
    const matches = await db.query("select * from public.saved_search_matches where listing_id = $1", [IDS.orgListing]);
    expect(matches.rowCount).toBe(1);
    const notifications = await db.query("select id from public.notifications where user_id = $1 and type = 'search_alert'", [IDS.buyer2]);
    expect(notifications.rowCount).toBe(1);
  });
});

describe("Missbrauchsschutz", () => {
  it("begrenzt die Anzahl Nachrichten pro Minute", async () => {
    const conv = await withSession(db, as(IDS.buyer), async (s) => {
      const rows = await s.query<{ conversation_id: string }>("select conversation_id from public.get_my_conversations()");
      return rows[0]?.conversation_id;
    });
    await withSession(db, as(IDS.buyer), async (s) => {
      let error: Error | null = null;
      for (let i = 0; i < 25 && !error; i++) {
        try {
          await s.query("insert into public.messages (conversation_id, body) values ($1, $2)", [conv, `Nachricht ${i}`]);
        } catch (e) {
          error = e as Error;
        }
      }
      expect(error?.message).toMatch(/rate_limited/);
    });
  });
});
