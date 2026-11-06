-- Datenschutz-Korrekturen nach dem Review der Fachbereiche
--
-- 1. Kontakt-E-Mail und -Telefon eines Inserats waren über die öffentliche SELECT-Policy von
--    listings für alle lesbar (auch wenn das Telefon nicht angezeigt werden soll). Sie liegen
--    neu in listing_contacts (nur Verwaltende). Öffentlich ist nur, was get_listing_public_contact
--    liefert: Name und – falls freigegeben – Telefon.
-- 2. Prüfvermerke (verifications) waren bei öffentlichen Objekten inkl. Notizen, Methode und
--    prüfender Person für alle lesbar. Öffentlich gibt es nur noch Art und Datum über
--    get_public_verifications.
-- 3. KI-Verarbeitung erst nach ausdrücklicher Einwilligung (Standard aus).
-- 4. Aufräumfunktion für den E-Mail-Ausgang (Nachrichtenauszüge nicht unbegrenzt speichern).
-- 5. Hochladende Personen dürfen eigene Dokumentdateien auch ohne Datensatz lesen und löschen
--    (verwaiste Uploads nach abgebrochenem Speichern).

-- 1. Private Kontaktangaben -----------------------------------------------------------------
create table public.listing_contacts (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  contact_email text check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  contact_phone text check (contact_phone is null or contact_phone ~ '^\+?[0-9 ()/-]{6,24}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.listing_contacts is
  'Private Kontaktangaben eines Inserats. Öffentlich nur Name und freigegebenes Telefon über get_listing_public_contact.';
create trigger listing_contacts_set_updated_at before update on public.listing_contacts
  for each row execute function public.set_updated_at();

alter table public.listing_contacts enable row level security;
revoke all on public.listing_contacts from anon, authenticated;
grant select on public.listing_contacts to authenticated;
grant insert (listing_id, contact_email, contact_phone) on public.listing_contacts to authenticated;
grant update (contact_email, contact_phone) on public.listing_contacts to authenticated;
grant all on public.listing_contacts to service_role;

create policy listing_contacts_select on public.listing_contacts for select to authenticated
  using (public.can_manage_listing(listing_id) or public.is_moderator());
create policy listing_contacts_insert on public.listing_contacts for insert to authenticated
  with check (public.can_manage_listing(listing_id) and public.is_active_user());
create policy listing_contacts_update on public.listing_contacts for update to authenticated
  using (public.can_manage_listing(listing_id) and public.is_active_user())
  with check (public.can_manage_listing(listing_id));

insert into public.listing_contacts (listing_id, contact_email, contact_phone)
select id, contact_email, contact_phone
from public.listings
where contact_email is not null or contact_phone is not null
on conflict (listing_id) do nothing;

alter table public.listings drop column contact_email, drop column contact_phone;

create or replace function public.get_listing_public_contact(p_listing_id uuid)
returns table (contact_name text, contact_phone text)
language sql stable security definer set search_path = ''
as $$
  select l.contact_name,
         case when l.show_contact_phone then c.contact_phone end
  from public.listings l
  left join public.listing_contacts c on c.listing_id = l.id
  where l.id = p_listing_id
    and l.status in ('published', 'reserved')
    and l.moderation_status <> 'blocked'
    and l.deleted_at is null;
$$;
grant execute on function public.get_listing_public_contact(uuid) to anon, authenticated, service_role;

-- 2. Öffentliche Prüfvermerke ohne interne Angaben -------------------------------------------
drop policy verifications_select on public.verifications;
create policy verifications_select on public.verifications for select to authenticated
  using (
    public.is_moderator()
    or (subject_type = 'user' and subject_id = (select auth.uid()))
    or (subject_type = 'property' and public.can_manage_property(subject_id))
    or (subject_type = 'organization' and public.is_org_member(subject_id))
  );

create or replace function public.get_public_verifications(p_subject_type text, p_subject_id uuid)
returns table (kind public.verification_kind, verified_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select distinct on (v.kind) v.kind, v.verified_at
  from public.verifications v
  where v.subject_type = p_subject_type
    and v.subject_id = p_subject_id
    and v.status = 'verified'
    and (
      (p_subject_type = 'property' and public.is_property_public(p_subject_id))
      or (p_subject_type = 'organization' and exists (
        select 1 from public.organizations o
        where o.id = p_subject_id and o.is_public and o.status = 'active' and o.deleted_at is null))
    )
  order by v.kind, v.verified_at desc nulls last;
$$;
grant execute on function public.get_public_verifications(text, uuid) to anon, authenticated, service_role;

-- 3. KI nur mit Einwilligung ----------------------------------------------------------------
alter table public.user_preferences alter column ai_processing_consent set default false;
comment on column public.user_preferences.ai_processing_consent is
  'Einwilligung zur Übermittlung von Objekt- und Textdaten an den KI-Anbieter. Standard: aus; Abfrage bei der ersten Nutzung.';

-- 4. E-Mail-Ausgang aufräumen ---------------------------------------------------------------
create or replace function public.cleanup_email_outbox()
returns integer
language sql volatile security definer set search_path = ''
as $$
  with d as (
    delete from public.email_outbox
    where (status in ('sent', 'skipped') and created_at < now() - interval '30 days')
       or (status = 'failed' and created_at < now() - interval '90 days')
    returning 1
  )
  select count(*)::int from d;
$$;
revoke execute on function public.cleanup_email_outbox() from public, anon, authenticated;
grant execute on function public.cleanup_email_outbox() to service_role;

-- 5. Eigene Dokument-Uploads ohne Datensatz lesbar (für Aufräumen nach Abbruch) ----------------
drop policy "immovia documents read" on storage.objects;
create policy "immovia documents read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'documents'
    and (public.can_read_document_object(name) or owner_id = (select auth.uid())::text));
