-- Aufrufstatistik ist keine Bearbeitung
--
-- listing_views_after_insert erhöht listings.view_count bei jedem (täglich eindeutigen) Aufruf.
-- Der generische Trigger set_updated_at setzte dabei auch updated_at neu: Ein Inserat galt nach
-- jedem Aufruf als «zuletzt geändert» (Sitemap lastModified, Admin-Liste, Exporte).
-- Neu bleibt updated_at unverändert, wenn sich ausschliesslich view_count ändert.
-- CREATE OR REPLACE TRIGGER (PostgreSQL 14+) ersetzt den bestehenden Trigger ohne DROP.

create or replace function public.listings_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.view_count is distinct from old.view_count
     and new.updated_at is not distinct from old.updated_at
     and (to_jsonb(new) - 'view_count') = (to_jsonb(old) - 'view_count') then
    return new;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
comment on function public.listings_set_updated_at() is
  'Wie set_updated_at, lässt updated_at aber unverändert, wenn nur die Aufrufstatistik (view_count) steigt.';
revoke execute on function public.listings_set_updated_at() from public, anon, authenticated;
grant execute on function public.listings_set_updated_at() to service_role;

create or replace trigger listings_set_updated_at before update on public.listings
  for each row execute function public.listings_set_updated_at();
