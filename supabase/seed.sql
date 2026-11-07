-- =============================================================================
-- Immovia · Demo-Datensatz (NUR Entwicklung / Preview)
--
-- Alle Inserate sind fiktiv und mit is_demo = true gekennzeichnet (Badge «Demo»,
-- von Bewertungen ausgeschlossen). Demo-Konten (Passwort für alle: ImmoviaDemo2026!):
--   demo-verkauf@immovia.test  Privatperson mit Inseraten
--   demo-kauf@immovia.test     Interessent («Martin Schmidt»)
--   demo-makler@immovia.test   Inhaberin «Demo Immobilien AG»
--   demo-team@immovia.test     Mitarbeiter «Demo Immobilien AG»
--   demo-admin@immovia.test    Administrator
-- Entfernen: supabase/demo-cleanup.sql
-- =============================================================================

do $$
begin
  if exists (select 1 from public.listings where not is_demo) then
    raise exception 'Abbruch: Es existieren echte Inserate. Demo-Daten nur in leere Entwicklungsdatenbanken einspielen.';
  end if;
  -- Echte Konten deuten auf eine Produktionsdatenbank hin (Demo- und Testkonten enden auf immovia.test)
  if exists (select 1 from auth.users where email is null or email not like '%@%immovia.test') then
    raise exception 'Abbruch: Es existieren echte Benutzerkonten. Demo-Daten (inkl. Demo-Administrator) nie in die Produktion einspielen.';
  end if;
  if exists (select 1 from auth.users where email like 'demo-%@immovia.test') then
    raise exception 'Demo-Daten sind bereits vorhanden.';
  end if;
end;
$$;

create or replace function pg_temp.demo_user(p_id uuid, p_email text, p_first text, p_last text, p_account text)
returns void
language plpgsql
as $$
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token,
                          email_change, email_change_token_new, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
          extensions.crypt('ImmoviaDemo2026!', extensions.gen_salt('bf')), now(),
          '{"provider": "email", "providers": ["email"]}'::jsonb,
          jsonb_build_object('first_name', p_first, 'last_name', p_last, 'account_type', p_account),
          '', '', '', '', now() - interval '30 days', now());
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (p_id::text, p_id, jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
          'email', now(), now(), now());
end;
$$;

select pg_temp.demo_user('d0000000-0000-4000-8000-000000000001', 'demo-verkauf@immovia.test', 'Sara', 'Muster', 'private');
select pg_temp.demo_user('d0000000-0000-4000-8000-000000000002', 'demo-kauf@immovia.test', 'Martin', 'Schmidt', 'private');
select pg_temp.demo_user('d0000000-0000-4000-8000-000000000003', 'demo-makler@immovia.test', 'Andrea', 'Keller', 'business');
select pg_temp.demo_user('d0000000-0000-4000-8000-000000000004', 'demo-team@immovia.test', 'Luca', 'Meier', 'business');
select pg_temp.demo_user('d0000000-0000-4000-8000-000000000005', 'demo-admin@immovia.test', 'Demo', 'Admin', 'private');

update public.profiles set phone = '+41 31 000 00 01' where id = 'd0000000-0000-4000-8000-000000000001';
insert into public.user_roles (user_id, role) values ('d0000000-0000-4000-8000-000000000005', 'admin');

insert into public.organizations (id, name, slug, description, street, postal_code, city, canton, phone, email, website, created_by)
values ('d1000000-0000-4000-8000-000000000001', 'Demo Immobilien AG', 'demo-immobilien',
        'Fiktive Immobilienfirma für die Entwicklungsumgebung von Immovia.', 'Musterstrasse 1', '8004', 'Zürich', 'ZH',
        '+41 44 000 00 00', 'kontakt@demo-immobilien.test', 'https://example.com', 'd0000000-0000-4000-8000-000000000003');
insert into public.organization_members (organization_id, user_id, role) values
  ('d1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 'owner'),
  ('d1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000004', 'member');
update public.public_profiles set organization_id = 'd1000000-0000-4000-8000-000000000001'
 where id in ('d0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000004');

-- -----------------------------------------------------------------------------
-- Immobilien (fiktiv)
-- -----------------------------------------------------------------------------
insert into public.properties (
  id, owner_id, organization_id, property_type, offer_type, internal_name, street, house_number, postal_code, municipality,
  canton, latitude, longitude, rooms, living_area, usable_area, plot_area, year_built, year_renovated, floor, floors_total,
  bathrooms, condition, heating_type, energy_label, has_balcony, has_terrace, has_garden, has_garage, has_elevator,
  has_cellar, has_attic, is_minergie, pets_allowed, garage_spaces, underground_parking_spaces, outdoor_parking_spaces,
  available_from, available_by_arrangement, service_charges, ownership_type, special_features, view_description,
  wizard_step, is_demo
) values
  ('d2000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', null, 'apartment', 'sale',
   'Wohnung Ostermundigen', 'Bernstrasse', '120', '3072', 'Ostermundigen', 'BE', 46.95631, 7.48751, 4.5, 112, null, null,
   2012, null, 2, 5, 2, 'as_new', 'heat_pump', 'B', true, false, false, false, true, true, false, false, null, 0, 1, 0,
   null, true, 380, 'condominium', 'Eigener Waschturm, Cheminée im Wohnzimmer.', 'Weitsicht Richtung Alpen', 8, true),
  ('d2000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', null, 'apartment', 'rent',
   'Altbau Länggasse', 'Falkenweg', '5', '3012', 'Bern', 'BE', 46.95672, 7.43201, 3.5, 85, null, null,
   1910, 2019, 1, 4, 1, 'good', 'district_heating', 'D', true, false, false, false, false, true, true, false, true, 0, 0, 0,
   date '2027-01-01', false, null, null, 'Hohe Räume mit Stuckaturen, Parkett.', null, 8, true),
  ('d2000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', null, 'single_family_house', 'sale',
   'Haus Thun', 'Seestrasse', '44', '3600', 'Thun', 'BE', 46.75801, 7.62802, 5.5, 168, null, 640,
   1998, 2021, null, 2, 2, 'good', 'heat_pump', 'C', false, true, true, true, false, true, true, false, null, 2, 0, 1,
   null, true, null, 'sole', 'Grosser Garten mit Obstbäumen, Werkstatt im Untergeschoss.', 'Bergsicht auf Niesen und Stockhorn', 8, true),
  ('d2000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000001',
   'apartment', 'rent', 'Kreis 4 Wohnung', 'Langstrasse', '200', '8004', 'Zürich', 'ZH', 47.37801, 8.52502, 2.5, 64, null, null,
   2016, null, 4, 6, 1, 'as_new', 'district_heating', 'B', true, false, false, false, true, true, false, true, false, 0, 0, 0,
   date '2026-12-01', false, null, null, 'Moderne Küche mit Steamer.', null, 8, true),
  ('d2000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000001',
   'office', 'rent', 'Büro Oerlikon', 'Binzmühlestrasse', '80', '8050', 'Zürich', 'ZH', 47.41002, 8.54401, null, null, 180, null,
   2005, 2020, 3, 6, 2, 'good', 'district_heating', null, false, false, false, false, true, false, false, false, null, 0, 4, 0,
   null, true, null, null, 'Flexibel unterteilbar, Glasfaseranschluss.', null, 8, true),
  ('d2000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000001',
   'apartment', 'sale', 'St. Johann', 'Elsässerstrasse', '30', '4056', 'Basel', 'BS', 47.56802, 7.58003, 4.5, 105, null, null,
   2009, null, 3, 5, 2, 'good', 'gas', 'C', true, false, false, false, true, true, false, false, null, 0, 1, 0,
   null, true, 420, 'condominium', null, null, 8, true),
  ('d2000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000001',
   'apartment', 'sale', 'Attika Luzern', 'Haldenstrasse', '12', '6006', 'Luzern', 'LU', 47.05501, 8.32001, 3.5, 118, null, null,
   2019, null, 5, 5, 2, 'as_new', 'heat_pump', 'A', false, true, false, false, true, true, false, true, null, 0, 2, 0,
   null, true, 510, 'condominium', 'Grosse Dachterrasse.', 'Seesicht auf den Vierwaldstättersee', 8, true),
  ('d2000000-0000-4000-8000-000000000008', 'd0000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000001',
   'semi_detached_house', 'sale', 'DEFH Zug', 'Rötelstrasse', '9', '6300', 'Zug', 'ZG', 47.16622, 8.51553, 5.5, 175, null, 410,
   2015, null, null, 3, 3, 'as_new', 'heat_pump', 'B', true, true, true, true, false, true, false, true, null, 2, 0, 1,
   null, true, null, 'sole', null, null, 8, true),
  ('d2000000-0000-4000-8000-000000000009', 'd0000000-0000-4000-8000-000000000001', null, 'plot', 'sale',
   'Bauland Kriens', 'Schachenstrasse', null, '6010', 'Kriens', 'LU', 47.03302, 8.27803, null, null, null, 820,
   null, null, null, null, null, null, null, null, false, false, false, false, false, false, false, false, null, 0, 0, 0,
   null, true, null, 'sole', 'Erschlossenes Bauland in der Wohnzone.', null, 8, true),
  ('d2000000-0000-4000-8000-000000000010', 'd0000000-0000-4000-8000-000000000004', 'd1000000-0000-4000-8000-000000000001',
   'apartment', 'rent', 'Studio Breitenrain', 'Militärstrasse', '40', '3014', 'Bern', 'BE', 46.96001, 7.45002, 1.5, 34, null, null,
   1965, 2018, 2, 4, 1, 'good', 'oil', 'E', false, false, false, false, false, true, false, false, false, 0, 0, 0,
   date '2026-12-15', false, null, null, null, null, 8, true),
  ('d2000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000001',
   'commercial', 'rent', 'Ladenlokal Kleinbasel', 'Clarastrasse', '15', '4058', 'Basel', 'BS', 47.56201, 7.59502, null, null, 95, null,
   1960, 2017, 0, 5, 1, 'good', 'district_heating', null, false, false, false, false, false, true, false, false, null, 0, 0, 0,
   null, true, null, null, 'Grosse Schaufensterfront an Passantenlage.', null, 8, true),
  ('d2000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000001', null, 'terraced_house', 'sale',
   'Reihenhaus Thun', 'Bahnhofstrasse', '3', '3604', 'Thun', 'BE', 46.74001, 7.62503, 4.5, 132, null, 210,
   1988, 2016, null, 3, 2, 'good', 'gas', 'D', false, true, true, false, false, true, true, false, null, 1, 0, 1,
   null, true, null, 'sole', null, null, 8, true);

insert into public.property_features (property_id, feature_key) values
  ('d2000000-0000-4000-8000-000000000001', 'fireplace'), ('d2000000-0000-4000-8000-000000000001', 'own_washing_machine'),
  ('d2000000-0000-4000-8000-000000000001', 'mountain_view'), ('d2000000-0000-4000-8000-000000000001', 'parquet'),
  ('d2000000-0000-4000-8000-000000000002', 'parquet'), ('d2000000-0000-4000-8000-000000000002', 'near_public_transport'),
  ('d2000000-0000-4000-8000-000000000003', 'mountain_view'), ('d2000000-0000-4000-8000-000000000003', 'hobby_room'),
  ('d2000000-0000-4000-8000-000000000003', 'solar_panels'), ('d2000000-0000-4000-8000-000000000004', 'steamer'),
  ('d2000000-0000-4000-8000-000000000004', 'fiber_optic'), ('d2000000-0000-4000-8000-000000000005', 'fiber_optic'),
  ('d2000000-0000-4000-8000-000000000007', 'lake_view'), ('d2000000-0000-4000-8000-000000000007', 'floor_heating'),
  ('d2000000-0000-4000-8000-000000000008', 'ev_charging'), ('d2000000-0000-4000-8000-000000000008', 'guest_toilet');

insert into public.property_renovations (property_id, year, category, description) values
  ('d2000000-0000-4000-8000-000000000002', 2019, 'kitchen', 'Neue Küche mit Geschirrspüler'),
  ('d2000000-0000-4000-8000-000000000002', 2019, 'bathroom', 'Badezimmer komplett erneuert'),
  ('d2000000-0000-4000-8000-000000000003', 2021, 'heating', 'Ersatz der Ölheizung durch eine Wärmepumpe'),
  ('d2000000-0000-4000-8000-000000000003', 2018, 'windows', 'Dreifach verglaste Fenster'),
  ('d2000000-0000-4000-8000-000000000012', 2016, 'kitchen', 'Küche und Bad modernisiert');

-- Bilder: Unsplash-Lizenz (frei nutzbar), nur für Demo-Inserate
insert into public.property_images (property_id, external_url, sort_order, is_cover, caption, width, height, status)
select p.id, img.url, img.ord, img.ord = 0, img.caption, 2048, 1365, 'ready'
from (values
  ('d2000000-0000-4000-8000-000000000001'::uuid, 'https://images.unsplash.com/photo-1600494448850-6013c64ba722', 0, 'Wohnzimmer'),
  ('d2000000-0000-4000-8000-000000000001'::uuid, 'https://images.unsplash.com/photo-1484154218962-a197022b5858', 1, 'Küche'),
  ('d2000000-0000-4000-8000-000000000001'::uuid, 'https://images.unsplash.com/photo-1592276040264-e10344a6a10e', 2, 'Aussenansicht'),
  ('d2000000-0000-4000-8000-000000000002'::uuid, 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688', 0, 'Wohnbereich'),
  ('d2000000-0000-4000-8000-000000000002'::uuid, 'https://images.unsplash.com/photo-1638973140785-3b918e290682', 1, 'Haus'),
  ('d2000000-0000-4000-8000-000000000003'::uuid, 'https://images.unsplash.com/photo-1584098731526-e3924fad98db', 0, 'Haus mit Bergsicht'),
  ('d2000000-0000-4000-8000-000000000003'::uuid, 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92', 1, 'Wohnzimmer'),
  ('d2000000-0000-4000-8000-000000000003'::uuid, 'https://images.unsplash.com/photo-1484154218962-a197022b5858', 2, 'Küche'),
  ('d2000000-0000-4000-8000-000000000004'::uuid, 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267', 0, 'Wohnen und Essen'),
  ('d2000000-0000-4000-8000-000000000004'::uuid, 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00', 1, 'Gebäude'),
  ('d2000000-0000-4000-8000-000000000005'::uuid, 'https://images.unsplash.com/photo-1432297984334-707d34c4163a', 0, 'Bürogebäude'),
  ('d2000000-0000-4000-8000-000000000006'::uuid, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2', 0, 'Wohnzimmer'),
  ('d2000000-0000-4000-8000-000000000006'::uuid, 'https://images.unsplash.com/photo-1515263487990-61b07816b324', 1, 'Gebäude'),
  ('d2000000-0000-4000-8000-000000000007'::uuid, 'https://images.unsplash.com/photo-1564078516393-cf04bd966897', 0, 'Wohnraum'),
  ('d2000000-0000-4000-8000-000000000007'::uuid, 'https://images.unsplash.com/photo-1628012209120-d9db7abf7eab', 1, 'Gebäude'),
  ('d2000000-0000-4000-8000-000000000008'::uuid, 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9', 0, 'Aussenansicht'),
  ('d2000000-0000-4000-8000-000000000008'::uuid, 'https://images.unsplash.com/photo-1600494448850-6013c64ba722', 1, 'Wohnzimmer'),
  ('d2000000-0000-4000-8000-000000000009'::uuid, 'https://images.unsplash.com/photo-1593533613122-c2f067f1629e', 0, 'Umgebung'),
  ('d2000000-0000-4000-8000-000000000010'::uuid, 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688', 0, 'Studio'),
  ('d2000000-0000-4000-8000-000000000011'::uuid, 'https://images.unsplash.com/photo-1432297984334-707d34c4163a', 0, 'Gebäude'),
  ('d2000000-0000-4000-8000-000000000012'::uuid, 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914', 0, 'Aussenansicht'),
  ('d2000000-0000-4000-8000-000000000012'::uuid, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2', 1, 'Wohnzimmer')
) as img(pid, url, ord, caption)
join public.properties p on p.id = img.pid;

-- -----------------------------------------------------------------------------
-- Inserate (privilegierter Kontext: direkt veröffentlicht, als Demo markiert)
-- -----------------------------------------------------------------------------
insert into public.listings (id, property_id, title, short_description, description, location_description,
  equipment_description, highlights, search_summary, texts_confirmed_at, price, additional_costs, price_on_request,
  location_precision, contact_name, show_contact_phone, status, is_demo)
values
  ('d3000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'Helle 4.5-Zimmer-Wohnung mit Balkon',
   'Neuwertige Eigentumswohnung im 2. OG mit Lift und Weitsicht.',
   E'Fiktives Demo-Inserat für die Entwicklungsumgebung.\n\nDie helle 4.5-Zimmer-Wohnung im 2. Obergeschoss bietet 112 m² Wohnfläche, zwei Badezimmer und einen Balkon mit Weitsicht. Das Gebäude von 2012 verfügt über einen Lift und eine Wärmepumpe.',
   'Ruhige Wohnlage in Ostermundigen.', 'Cheminée, eigener Waschturm, Parkett, zwei Badezimmer.',
   array['Balkon mit Weitsicht', 'Lift', 'Wärmepumpe', 'Tiefgaragenplatz'], 'Neuwertige 4.5-Zimmer-Wohnung mit Balkon und Lift',
   now(), 765000, null, false, 'street', 'Sara Muster', true, 'published', true),
  ('d3000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000002', 'Charmante Altbauwohnung in der Länggasse',
   'Renovierte 3.5-Zimmer-Wohnung mit hohen Räumen.',
   E'Fiktives Demo-Inserat für die Entwicklungsumgebung.\n\nDie 3.5-Zimmer-Wohnung im 1. OG eines Altbaus von 1910 wurde 2019 renoviert. Hohe Räume, Parkett und eine neue Küche prägen die Wohnung.',
   'Länggassquartier in Bern.', 'Neue Küche mit Geschirrspüler, renoviertes Bad, Parkett.',
   array['Altbaucharme', 'Renoviert 2019', 'Balkon'], 'Renovierte Altbauwohnung mit Balkon', now(), 2350, 250, false,
   'area', 'Sara Muster', false, 'published', true),
  ('d3000000-0000-4000-8000-000000000003', 'd2000000-0000-4000-8000-000000000003', 'Einfamilienhaus mit Garten und Bergsicht',
   'Gepflegtes Haus mit 640 m² Grundstück und Wärmepumpe.',
   E'Fiktives Demo-Inserat für die Entwicklungsumgebung.\n\nDas Einfamilienhaus von 1998 bietet 5.5 Zimmer auf 168 m² Wohnfläche. 2021 wurde die Heizung durch eine Wärmepumpe ersetzt.',
   'Wohnquartier in Thun.', 'Werkstatt, Bastelraum, Photovoltaik, Garage für zwei Autos.',
   array['640 m² Grundstück', 'Bergsicht', 'Wärmepumpe 2021', 'Doppelgarage'], 'Einfamilienhaus mit Garten und Bergsicht',
   now(), 1290000, null, false, 'area', 'Sara Muster', false, 'published', true),
  ('d3000000-0000-4000-8000-000000000004', 'd2000000-0000-4000-8000-000000000004', 'Moderne 2.5-Zimmer-Stadtwohnung',
   'Neuwertige Wohnung im 4. OG mit Balkon.', E'Fiktives Demo-Inserat für die Entwicklungsumgebung.\n\nModerne 2.5-Zimmer-Wohnung mit 64 m² im Kreis 4.',
   'Kreis 4, Zürich.', 'Küche mit Steamer, Glasfaser, Minergie-Standard.',
   array['Minergie', 'Balkon', 'Lift'], 'Moderne Stadtwohnung im Kreis 4', now(), 2480, 220, false, 'street',
   'Demo Immobilien AG', false, 'published', true),
  ('d3000000-0000-4000-8000-000000000005', 'd2000000-0000-4000-8000-000000000005', 'Helle Büroflächen in Oerlikon',
   '180 m² flexibel unterteilbar, 4 Tiefgaragenplätze.', E'Fiktives Demo-Inserat für die Entwicklungsumgebung.\n\nBürofläche mit 180 m² Nutzfläche im 3. OG.',
   'Zürich-Oerlikon.', 'Glasfaser, Lift, Teeküche.', array['180 m²', 'Glasfaser'], 'Büroflächen in Oerlikon', now(), 4800,
   600, false, 'exact', 'Demo Immobilien AG', false, 'published', true),
  ('d3000000-0000-4000-8000-000000000006', 'd2000000-0000-4000-8000-000000000006', 'Familienwohnung im St. Johann',
   '4.5 Zimmer, 105 m², Balkon und Lift.', E'Fiktives Demo-Inserat für die Entwicklungsumgebung.\n\nGepflegte 4.5-Zimmer-Wohnung im 3. OG.',
   'St. Johann, Basel.', 'Zwei Badezimmer, Keller, Tiefgarage.', array['Balkon', 'Lift', 'Tiefgarage'],
   'Familienwohnung mit Balkon', now(), 980000, null, false, 'area', 'Demo Immobilien AG', false, 'published', true),
  ('d3000000-0000-4000-8000-000000000007', 'd2000000-0000-4000-8000-000000000007', 'Attikawohnung mit Seesicht',
   'Grosse Dachterrasse, Minergie, 118 m².', E'Fiktives Demo-Inserat für die Entwicklungsumgebung.\n\nAttikawohnung von 2019 mit Dachterrasse.',
   'Luzern.', 'Bodenheizung, Minergie, zwei Tiefgaragenplätze.', array['Seesicht', 'Dachterrasse', 'Minergie'],
   'Attika mit Seesicht', now(), null, null, true, 'area', 'Demo Immobilien AG', false, 'published', true),
  ('d3000000-0000-4000-8000-000000000008', 'd2000000-0000-4000-8000-000000000008', 'Doppeleinfamilienhaus in Zug',
   '5.5 Zimmer, Garten, Garage, Minergie.', E'Fiktives Demo-Inserat für die Entwicklungsumgebung.\n\nModernes Doppeleinfamilienhaus von 2015.',
   'Zug.', 'E-Ladestation, Gäste-WC, Garage.', array['Garten', 'Minergie', 'Garage'], 'Doppeleinfamilienhaus mit Garten',
   now(), 2150000, null, false, 'area', 'Demo Immobilien AG', false, 'published', true),
  ('d3000000-0000-4000-8000-000000000009', 'd2000000-0000-4000-8000-000000000009', 'Erschlossenes Bauland in Kriens',
   '820 m² in der Wohnzone.', E'Fiktives Demo-Inserat für die Entwicklungsumgebung.\n\nErschlossenes Grundstück mit 820 m².',
   'Kriens.', null, array['820 m²', 'Erschlossen'], 'Bauland in Kriens', now(), 690000, null, false, 'area', 'Sara Muster',
   false, 'published', true),
  ('d3000000-0000-4000-8000-000000000010', 'd2000000-0000-4000-8000-000000000010', 'Studio im Breitenrain',
   'Renoviertes 1.5-Zimmer-Studio.', E'Fiktives Demo-Inserat für die Entwicklungsumgebung.\n\nRenoviertes Studio mit 34 m².',
   'Breitenrain, Bern.', 'Kompaktküche, Keller.', array['Renoviert 2018', 'Zentral'], 'Studio im Breitenrain', now(), 1190, 120,
   false, 'area', 'Demo Immobilien AG', false, 'published', true),
  ('d3000000-0000-4000-8000-000000000011', 'd2000000-0000-4000-8000-000000000011', 'Ladenlokal an Passantenlage',
   '95 m² mit grosser Schaufensterfront.', E'Fiktives Demo-Inserat für die Entwicklungsumgebung.\n\nLadenlokal im Erdgeschoss.',
   'Kleinbasel.', 'Schaufensterfront, Lagerraum.', array['Passantenlage', 'Schaufenster'], 'Ladenlokal in Kleinbasel', now(),
   3200, 350, false, 'exact', 'Demo Immobilien AG', false, 'published', true),
  ('d3000000-0000-4000-8000-000000000012', 'd2000000-0000-4000-8000-000000000012', 'Reihenhaus mit Gartensitzplatz',
   '4.5 Zimmer, 2016 modernisiert.', E'Fiktives Demo-Inserat für die Entwicklungsumgebung.\n\nReihenmittelhaus mit Garten.',
   'Thun.', 'Modernisierte Küche und Bad, Estrich, Keller.', array['Garten', 'Modernisiert'], 'Reihenhaus mit Garten', now(),
   895000, null, false, 'area', 'Sara Muster', false, 'published', true);

-- Besichtigungsfenster für die Demo-Wohnung in Ostermundigen
insert into public.viewing_slots (listing_id, starts_at, ends_at, capacity, note)
select 'd3000000-0000-4000-8000-000000000001',
       (date_trunc('day', now() at time zone 'Europe/Zurich') + make_interval(days => d, hours => h)) at time zone 'Europe/Zurich',
       (date_trunc('day', now() at time zone 'Europe/Zurich') + make_interval(days => d, hours => h, mins => 30)) at time zone 'Europe/Zurich',
       1, 'Treffpunkt beim Hauseingang'
from (values (3, 10), (3, 11), (5, 17), (6, 10)) as s(d, h);

-- Gespräch zwischen Interessent und Verkäuferin (über die regulären Datenbankfunktionen)
do $$
declare
  v_conv uuid;
begin
  perform set_config('request.jwt.claims', '{"role": "authenticated", "sub": "d0000000-0000-4000-8000-000000000002"}', true);
  v_conv := public.create_inquiry('d3000000-0000-4000-8000-000000000001',
    'Guten Tag Frau Muster, ist die Wohnung noch verfügbar? Wäre eine Besichtigung am Samstag möglich?', null, true, true);
  perform public.book_viewing((select id from public.viewing_slots
                                where listing_id = 'd3000000-0000-4000-8000-000000000001' order by starts_at limit 1),
                              'Ich komme mit meiner Partnerin.');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Keine E-Mails an Demo-Adressen versenden
update public.email_outbox set status = 'skipped', last_error = 'Demo-Konto'
 where user_id in (select id from auth.users where email like 'demo-%@immovia.test');
