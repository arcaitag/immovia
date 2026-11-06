-- =============================================================================
-- Immovia · Migration 8: Storage-Buckets und Zugriffsregeln
-- Pfadkonventionen (erster Ordner bestimmt die Berechtigung):
--   property-originals/{property_id}/{image_id}.{ext}         privat
--   property-images/{property_id}/{image_id}/{variante}.webp  öffentlich lesbar (nur per URL)
--   documents/{property_id}/{document_id}.{ext}               privat, Freigaben
--   dossiers/{property_id}/{dossier_id}.pdf                   privat, optional öffentlich
--   avatars/{user_id}/{datei}                                 öffentlich lesbar
--   org-logos/{organization_id}/{datei}                       öffentlich lesbar
--   message-attachments/{conversation_id}/{datei}             nur Teilnehmende
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('property-originals', 'property-originals', false, 26214400,
     array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('property-images', 'property-images', true, 10485760, array['image/webp', 'image/jpeg', 'image/png']),
  ('documents', 'documents', false, 26214400, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('dossiers', 'dossiers', false, 52428800, array['application/pdf']),
  ('avatars', 'avatars', true, 5242880, array['image/webp', 'image/jpeg', 'image/png']),
  ('org-logos', 'org-logos', true, 5242880, array['image/webp', 'image/jpeg', 'image/png']),
  ('message-attachments', 'message-attachments', false, 10485760,
     array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Originalbilder
create policy "immovia originals read" on storage.objects for select to authenticated
  using (bucket_id = 'property-originals'
         and public.can_manage_property(public.try_uuid((storage.foldername(name))[1])));
create policy "immovia originals insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'property-originals'
              and public.can_manage_property(public.try_uuid((storage.foldername(name))[1]))
              and public.is_active_user());
create policy "immovia originals update" on storage.objects for update to authenticated
  using (bucket_id = 'property-originals'
         and public.can_manage_property(public.try_uuid((storage.foldername(name))[1])));
create policy "immovia originals delete" on storage.objects for delete to authenticated
  using (bucket_id = 'property-originals'
         and public.can_manage_property(public.try_uuid((storage.foldername(name))[1])));

-- Öffentliche Bildversionen (Lesen über öffentliche URL, Auflisten nur für Verwaltende)
create policy "immovia images read" on storage.objects for select to authenticated
  using (bucket_id = 'property-images'
         and public.can_manage_property(public.try_uuid((storage.foldername(name))[1])));
create policy "immovia images insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'property-images'
              and public.can_manage_property(public.try_uuid((storage.foldername(name))[1]))
              and public.is_active_user());
create policy "immovia images update" on storage.objects for update to authenticated
  using (bucket_id = 'property-images'
         and public.can_manage_property(public.try_uuid((storage.foldername(name))[1])));
create policy "immovia images delete" on storage.objects for delete to authenticated
  using (bucket_id = 'property-images'
         and public.can_manage_property(public.try_uuid((storage.foldername(name))[1])));

-- Dokumente
create policy "immovia documents read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'documents' and public.can_read_document_object(name));
create policy "immovia documents insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents'
              and public.can_manage_property(public.try_uuid((storage.foldername(name))[1]))
              and public.is_active_user());
create policy "immovia documents delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents'
         and public.can_manage_property(public.try_uuid((storage.foldername(name))[1])));

-- Dossiers
create policy "immovia dossiers read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'dossiers'
         and (public.can_manage_property(public.try_uuid((storage.foldername(name))[1]))
              or public.is_public_dossier_object(name)));
create policy "immovia dossiers insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'dossiers'
              and public.can_manage_property(public.try_uuid((storage.foldername(name))[1]))
              and public.is_active_user());
create policy "immovia dossiers update" on storage.objects for update to authenticated
  using (bucket_id = 'dossiers'
         and public.can_manage_property(public.try_uuid((storage.foldername(name))[1])));
create policy "immovia dossiers delete" on storage.objects for delete to authenticated
  using (bucket_id = 'dossiers'
         and public.can_manage_property(public.try_uuid((storage.foldername(name))[1])));

-- Profilbilder
create policy "immovia avatars read own" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "immovia avatars insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "immovia avatars update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "immovia avatars delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Firmenlogos
create policy "immovia logos read own" on storage.objects for select to authenticated
  using (bucket_id = 'org-logos' and public.is_org_member(public.try_uuid((storage.foldername(name))[1])));
create policy "immovia logos insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'org-logos' and public.is_org_admin(public.try_uuid((storage.foldername(name))[1])));
create policy "immovia logos update" on storage.objects for update to authenticated
  using (bucket_id = 'org-logos' and public.is_org_admin(public.try_uuid((storage.foldername(name))[1])));
create policy "immovia logos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'org-logos' and public.is_org_admin(public.try_uuid((storage.foldername(name))[1])));

-- Nachrichtenanhänge
create policy "immovia attachments read" on storage.objects for select to authenticated
  using (bucket_id = 'message-attachments'
         and public.is_conversation_participant(public.try_uuid((storage.foldername(name))[1])));
create policy "immovia attachments insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'message-attachments'
              and public.can_post_in_conversation(public.try_uuid((storage.foldername(name))[1])));
