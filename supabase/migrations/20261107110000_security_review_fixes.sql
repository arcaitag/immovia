-- Befunde der unabhängigen Sicherheitsprüfung (7. November 2026)
--
-- 1. generated_dossiers: Benutzer durften Datensätze anlegen sowie storage_path und status ändern.
--    Ein Verkäufer hätte ein öffentliches Dossier auf die PDF-Datei einer anderen Immobilie zeigen
--    lassen können, weil is_public_dossier_object dem Pfad im Datensatz vertraute. Dossiers legt nur
--    der Hintergrundjob (Service Role) an; Benutzer ändern nur noch die Freigabe (is_public) und dürfen
--    Versionen löschen. Die bestehenden Policies bleiben; ohne Spaltenrechte greifen insert/update nicht.
-- 2. is_public_dossier_object: nur Dateien am vorgesehenen Ort {property_id}/{dossier_id}.pdf.
-- 3. property_images: Pfade müssen im Ordner des Bildes liegen ({property_id}/{image_id}…), beim
--    Anlegen alle Pfade, beim Ändern die Anzeigepfade. Sonst könnte ein Datensatz auf das private
--    Original einer fremden Immobilie zeigen (relevant für Hintergrundjobs mit Service Role).

-- 1. Dossiers ------------------------------------------------------------------------------
revoke insert, update on public.generated_dossiers from authenticated;
grant update (is_public) on public.generated_dossiers to authenticated;

-- 2. Öffentliche Dossier-Dateien -----------------------------------------------------------
create or replace function public.is_public_dossier_object(p_path text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.generated_dossiers d
    join public.listings l on l.property_id = d.property_id
    where d.storage_path = p_path
      and d.storage_path = d.property_id::text || '/' || d.id::text || '.pdf'
      and d.is_public
      and d.status = 'ready'
      and l.dossier_public
      and l.status in ('published', 'reserved')
      and l.moderation_status <> 'blocked'
      and l.deleted_at is null
  );
$$;

-- 3. Bildpfade -----------------------------------------------------------------------------
create or replace function public.property_images_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_folder text;
begin
  if not public.is_privileged_context() then
    if tg_op = 'INSERT' then
      new.is_ai_visualization := false;
      new.external_url := null;
      new.source_image_id := null;
      new.uploaded_by := (select auth.uid());
    else
      new.is_ai_visualization := old.is_ai_visualization;
      new.external_url := old.external_url;
      new.source_image_id := old.source_image_id;
      new.property_id := old.property_id;
      new.original_path := old.original_path;
      new.base_path := old.base_path;
    end if;
    v_folder := new.property_id::text || '/' || new.id::text;
    if tg_op = 'INSERT' and (
         (new.original_path is not null and new.original_path not like v_folder || '.%')
      or (new.base_path is not null and new.base_path not like v_folder || '/%')
    ) then
      raise exception 'invalid_path' using detail = 'original_path/base_path';
    end if;
    if (new.display_path is not null and new.display_path not like v_folder || '/%')
       or (new.thumb_path is not null and new.thumb_path not like v_folder || '/%') then
      raise exception 'invalid_path' using detail = 'display_path/thumb_path';
    end if;
  end if;
  if new.is_cover and (tg_op = 'INSERT' or not old.is_cover) then
    update public.property_images
       set is_cover = false
     where property_id = new.property_id and id <> new.id and is_cover;
  end if;
  return new;
end;
$$;
