import type { Client } from "pg";
import { createUser } from "./harness";

/** Feste IDs für reproduzierbare Tests */
export const IDS = {
  seller: "00000000-0000-4000-8000-0000000000a1",
  buyer: "00000000-0000-4000-8000-0000000000b1",
  buyer2: "00000000-0000-4000-8000-0000000000b2",
  stranger: "00000000-0000-4000-8000-0000000000c1",
  admin: "00000000-0000-4000-8000-0000000000d1",
  orgOwner: "00000000-0000-4000-8000-0000000000e1",
  orgMember: "00000000-0000-4000-8000-0000000000e2",
  property: "10000000-0000-4000-8000-000000000001",
  privateProperty: "10000000-0000-4000-8000-000000000002",
  orgProperty: "10000000-0000-4000-8000-000000000003",
  listing: "20000000-0000-4000-8000-000000000001",
  draftListing: "20000000-0000-4000-8000-000000000002",
  orgListing: "20000000-0000-4000-8000-000000000003",
  org: "30000000-0000-4000-8000-000000000001",
  privateDoc: "40000000-0000-4000-8000-000000000001",
  publicDoc: "40000000-0000-4000-8000-000000000002",
  slot: "50000000-0000-4000-8000-000000000001",
} as const;

/**
 * Legt eine vollständige Ausgangslage an (als Superuser, d. h. privilegierter Kontext):
 * Verkäufer mit veröffentlichtem Inserat (Standort nur Ort), privatem Dokument,
 * öffentlichem Dokument und Besichtigungsfenster; Käufer; Fremder; Admin; Firma.
 */
export async function seedFixtures(db: Client): Promise<void> {
  await createUser(db, { id: IDS.seller, email: "verkaeufer@test.ch", firstName: "Sara", lastName: "Verkauf" });
  await createUser(db, { id: IDS.buyer, email: "kaeufer@test.ch", firstName: "Bruno", lastName: "Kauf" });
  await createUser(db, { id: IDS.buyer2, email: "kaeufer2@test.ch", firstName: "Lena", lastName: "Zwei" });
  await createUser(db, { id: IDS.stranger, email: "fremd@test.ch", firstName: "Felix", lastName: "Fremd" });
  await createUser(db, { id: IDS.admin, email: "admin@test.ch", firstName: "Ada", lastName: "Admin" });
  await createUser(db, { id: IDS.orgOwner, email: "inhaber@makler.ch", firstName: "Marc", lastName: "Makler" });
  await createUser(db, { id: IDS.orgMember, email: "team@makler.ch", firstName: "Tina", lastName: "Team" });
  await db.query(`insert into public.user_roles (user_id, role) values ($1, 'admin')`, [IDS.admin]);

  await db.query(
    `insert into public.organizations (id, name, slug, created_by) values ($1, 'Muster Immobilien AG', 'muster-immobilien', $2)`,
    [IDS.org, IDS.orgOwner],
  );
  await db.query(
    `insert into public.organization_members (organization_id, user_id, role) values ($1, $2, 'owner'), ($1, $3, 'member')`,
    [IDS.org, IDS.orgOwner, IDS.orgMember],
  );

  await db.query(
    `insert into public.properties (id, owner_id, property_type, offer_type, street, house_number, postal_code, municipality,
       canton, latitude, longitude, rooms, living_area, year_built, has_balcony, has_elevator)
     values ($1, $2, 'apartment', 'sale', 'Geheimweg', '7', '3072', 'Ostermundigen', 'BE', 46.95612, 7.48745, 4.5, 112, 2012, true, true),
            ($3, $2, 'single_family_house', 'sale', 'Privatstrasse', '1', '3600', 'Thun', 'BE', 46.7579, 7.6280, 5.5, 160, 1995, false, false),
            ($4, $5, 'apartment', 'rent', 'Firmengasse', '3', '8004', 'Zürich', 'ZH', 47.3769, 8.5417, 3.5, 80, 2018, true, true)`,
    [IDS.property, IDS.seller, IDS.privateProperty, IDS.orgProperty, IDS.orgOwner],
  );
  await db.query(`update public.properties set organization_id = $1 where id = $2`, [IDS.org, IDS.orgProperty]);

  await db.query(
    `insert into public.property_images (property_id, base_path, display_path, status, is_cover)
     values ($1::uuid, $1::text || '/img/base', $1::text || '/img/base', 'ready', true),
            ($2::uuid, $2::text || '/img/base', $2::text || '/img/base', 'ready', true),
            ($3::uuid, $3::text || '/img/base', $3::text || '/img/base', 'ready', true)`,
    [IDS.property, IDS.privateProperty, IDS.orgProperty],
  );

  await db.query(
    `insert into public.listings (id, property_id, title, description, price, location_precision, texts_confirmed_at, status)
     values ($1, $2, 'Helle 4.5-Zimmer-Wohnung', 'Schöne Wohnung mit Balkon und Lift.', 765000, 'area', now(), 'published'),
            ($3, $4, 'Entwurf Haus', null, null, 'exact', null, 'draft'),
            ($5, $6, 'Stadtwohnung', 'Moderne Wohnung.', 2400, 'street', now(), 'published')`,
    [IDS.listing, IDS.property, IDS.draftListing, IDS.privateProperty, IDS.orgListing, IDS.orgProperty],
  );

  await db.query(
    `insert into public.property_documents (id, property_id, uploaded_by, category, title, storage_path, mime_type, size_bytes, visibility, contains_personal_data)
     values ($1::uuid, $2::uuid, $3::uuid, 'land_register', 'Grundbuchauszug', $2::text || '/' || $1::text || '.pdf', 'application/pdf', 1000, 'owner', true),
            ($4::uuid, $2::uuid, $3::uuid, 'floor_plan', 'Grundriss', $2::text || '/' || $4::text || '.pdf', 'application/pdf', 1000, 'public', false)`,
    [IDS.privateDoc, IDS.property, IDS.seller, IDS.publicDoc],
  );
  await db.query(
    `insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict do nothing`,
  );
  await db.query(
    `insert into storage.objects (bucket_id, name, metadata) values
       ('documents', $1::text || '/' || $2::text || '.pdf', '{"size": 1000}'),
       ('documents', $1::text || '/' || $3::text || '.pdf', '{"size": 1000}')`,
    [IDS.property, IDS.privateDoc, IDS.publicDoc],
  );

  await db.query(
    `insert into public.viewing_slots (id, listing_id, starts_at, ends_at, capacity)
     values ($1, $2, now() + interval '3 days', now() + interval '3 days 30 minutes', 1)`,
    [IDS.slot, IDS.listing],
  );
}
