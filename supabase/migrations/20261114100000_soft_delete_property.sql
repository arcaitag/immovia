-- Immobilie löschen (Soft Delete) über eine Datenbankfunktion.
--
-- Bisher setzten Website und App «deleted_at» direkt mit dem Benutzer-Client. Das lehnt die
-- Zeilensicherheit ab: Nach dem Setzen von deleted_at ist die Zeile für die eigene Leseregel
-- (can_manage_property verlangt deleted_at is null) nicht mehr sichtbar, und Postgres weist
-- eine Änderung zurück, deren Ergebnis die ändernde Person nicht mehr lesen darf
-- («new row violates row-level security policy»). Eigene Immobilien liessen sich deshalb
-- gar nicht löschen.
--
-- Die Funktion prüft dieselbe Berechtigung wie bisher (verwaltbare Immobilie, aktives Konto)
-- und führt dann beide Schritte in einer Transaktion aus. Die Inserate werden wie bisher
-- über den Trigger archiviert. Rückgabe: Slugs der zuvor öffentlichen Inserate, damit die
-- Website deren Seiten aktualisieren kann.

create or replace function public.soft_delete_property(p_property uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_slugs text[];
begin
  if (select auth.uid()) is null
     or not public.is_active_user()
     or not public.can_manage_property(p_property) then
    raise exception 'forbidden';
  end if;

  select coalesce(array_agg(l.slug) filter (where l.status in ('published', 'reserved') and l.slug is not null), '{}')
    into v_slugs
    from public.listings l
   where l.property_id = p_property
     and l.deleted_at is null;

  update public.listings
     set deleted_at = v_now
   where property_id = p_property
     and deleted_at is null;

  update public.properties
     set deleted_at = v_now
   where id = p_property;

  return v_slugs;
end;
$$;

revoke all on function public.soft_delete_property(uuid) from public, anon;
grant execute on function public.soft_delete_property(uuid) to authenticated;
