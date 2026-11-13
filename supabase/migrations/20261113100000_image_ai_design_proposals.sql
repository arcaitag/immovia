-- Bild-KI: Designvorschläge («Aufräumen», «Neu einrichten») über einen externen Bildmodell-Anbieter
--
-- 1. property_images.status 'review': KI-Ergebnisse warten auf die Prüfung durch den Inserenten.
--    Öffentlich sind nur Bilder mit status = 'ready' (RLS property_images_select, Suche, Covers,
--    Dossiers, Mindestzahl Bilder beim Veröffentlichen). Ein Vorschlag erscheint deshalb erst,
--    wenn der Inserent bestätigt, dass Raum und feste Ausstattung dem Originalfoto entsprechen.
-- 2. image_transformations.kind 'declutter' für «Aufräumen».
-- 3. user_preferences.ai_image_consent: eigene Einwilligung für die Bild-KI. Dabei werden Fotos der
--    Immobilie an einen anderen Anbieter übermittelt als bei den KI-Texten (Anthropic); die bestehende
--    Einwilligung ai_processing_consent deckt das nicht ab. Standard: aus.

-- 1. Prüfstatus für KI-Bilder -------------------------------------------------------------
alter table public.property_images drop constraint property_images_status_check;
alter table public.property_images
  add constraint property_images_status_check check (status in ('processing', 'ready', 'failed', 'review'));
comment on column public.property_images.status is
  'processing/failed: Upload-Verarbeitung; review: KI-Visualisierung wartet auf die Prüfung durch den Inserenten (nicht öffentlich); ready: fertig.';

-- 2. Art der Bearbeitung ------------------------------------------------------------------
alter table public.image_transformations drop constraint image_transformations_kind_check;
alter table public.image_transformations
  add constraint image_transformations_kind_check check (kind in ('enhance', 'virtual_staging', 'perspective', 'crop', 'declutter'));

-- 3. Einwilligung Bild-KI -----------------------------------------------------------------
alter table public.user_preferences add column ai_image_consent boolean not null default false;
comment on column public.user_preferences.ai_image_consent is
  'Einwilligung zur Übermittlung von Fotos an den Bild-KI-Anbieter (Designvorschläge im Bilderstudio).';
grant update (ai_image_consent) on public.user_preferences to authenticated;
