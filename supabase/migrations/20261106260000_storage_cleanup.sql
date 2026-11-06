-- Aufräumen von Speicher und gelöschten Objekten (nur Service Role, über den geplanten Lauf)
--
-- * Dateien gelöschter Immobilien: Sobald eine Immobilie gelöscht ist (deleted_at), werden ihre
--   Bilder, Originale, Dokumente und Dossiers beim nächsten Lauf entfernt (nach 1 Stunde, damit
--   laufende Vorgänge abschliessen können). Öffentliche Bild-URLs sind danach nicht mehr erreichbar.
-- * Verwaiste Uploads: Dateien ohne zugehörigen Datensatz (z. B. abgebrochener Upload) werden nach
--   24 Stunden entfernt.
-- * Gelöschte Immobilien werden 30 Tage nach dem Löschen endgültig entfernt (inkl. abhängiger
--   Datensätze per ON DELETE CASCADE).

create or replace function public.storage_cleanup_candidates(p_limit integer default 500)
returns table (bucket_id text, name text, reason text)
language sql stable security definer set search_path = ''
as $$
  with objs as (
    select o.bucket_id,
           o.name,
           o.created_at,
           public.try_uuid((storage.foldername(o.name))[1]) as folder_id,
           public.try_uuid((storage.foldername(o.name))[2]) as sub_id
    from storage.objects o
    where o.bucket_id in ('property-originals', 'property-images', 'documents', 'dossiers', 'message-attachments')
  ),
  candidates as (
    select o.bucket_id, o.name, 'property_deleted'::text as reason
    from objs o
    where o.bucket_id in ('property-originals', 'property-images', 'documents', 'dossiers')
      and o.created_at < now() - interval '1 hour'
      and not exists (
        select 1 from public.properties p
        where p.id = o.folder_id
          and (p.deleted_at is null or p.deleted_at > now() - interval '1 hour')
      )
    union all
    select o.bucket_id, o.name, 'orphan'
    from objs o
    where o.bucket_id = 'property-originals' and o.created_at < now() - interval '1 day'
      and not exists (select 1 from public.property_images i where i.original_path = o.name)
    union all
    select o.bucket_id, o.name, 'orphan'
    from objs o
    where o.bucket_id = 'property-images' and o.created_at < now() - interval '1 day'
      and not exists (select 1 from public.property_images i where i.id = o.sub_id)
    union all
    select o.bucket_id, o.name, 'orphan'
    from objs o
    where o.bucket_id = 'documents' and o.created_at < now() - interval '1 day'
      and not exists (select 1 from public.property_documents d where d.storage_path = o.name)
    union all
    select o.bucket_id, o.name, 'orphan'
    from objs o
    where o.bucket_id = 'dossiers' and o.created_at < now() - interval '1 day'
      and not exists (select 1 from public.generated_dossiers d where d.storage_path = o.name)
    union all
    select o.bucket_id, o.name, 'orphan'
    from objs o
    where o.bucket_id = 'message-attachments' and o.created_at < now() - interval '1 day'
      and not exists (select 1 from public.messages m where m.attachment_path = o.name)
  )
  select distinct on (c.bucket_id, c.name) c.bucket_id, c.name, c.reason
  from candidates c
  order by c.bucket_id, c.name, c.reason desc
  limit greatest(1, least(coalesce(p_limit, 500), 1000));
$$;
revoke execute on function public.storage_cleanup_candidates(integer) from public, anon, authenticated;
grant execute on function public.storage_cleanup_candidates(integer) to service_role;

create or replace function public.purge_deleted_properties()
returns integer
language sql volatile security definer set search_path = ''
as $$
  with d as (
    delete from public.properties
    where deleted_at is not null and deleted_at < now() - interval '30 days'
    returning 1
  )
  select count(*)::int from d;
$$;
revoke execute on function public.purge_deleted_properties() from public, anon, authenticated;
grant execute on function public.purge_deleted_properties() to service_role;
