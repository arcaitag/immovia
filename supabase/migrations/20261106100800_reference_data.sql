-- =============================================================================
-- Immovia · Migration 9: Referenzdaten (keine Demodaten)
-- =============================================================================

insert into public.dossier_templates (id, name, description, is_premium, sort_order, config) values
  ('modern', 'Modern', 'Weiss und Hellgrün, viel Freiraum, klare Kacheln für die Eckdaten.', false, 1,
   '{"accent": "#5A8A30", "background": "#FFFFFF", "surface": "#F8FAF6", "heading": "#274B32"}'),
  ('premium', 'Premium', 'Grossflächige Fotografie, reduzierte Typografie, dunkles Grün als Akzent.', false, 2,
   '{"accent": "#274B32", "background": "#FFFFFF", "surface": "#F3F5F1", "heading": "#192820"}'),
  ('classic', 'Klassisch', 'Sachlich und besonders übersichtlich mit Tabellen für alle Angaben.', false, 3,
   '{"accent": "#5A8A30", "background": "#FFFFFF", "surface": "#FFFFFF", "heading": "#192820"}')
on conflict (id) do nothing;

insert into public.feature_settings (key, value, description) values
  ('platform', '{"name": "Immovia", "contact_email": null, "contact_phone": null, "address": null}',
   'Plattformname und Kontaktdaten'),
  ('maintenance', '{"enabled": false, "message": "Wir führen gerade Wartungsarbeiten durch. Bitte versuchen Sie es später erneut."}',
   'Wartungsmodus für öffentliche Seiten und Dashboard'),
  ('publishing', '{"require_review": false, "min_images": 1, "max_images": 40}',
   'Veröffentlichungsvorgaben für Inserate'),
  ('ai_quotas', '{"description_per_month": 30, "valuation_per_month": 10, "image_enhance_per_month": 200, "virtual_staging_per_month": 0, "assistant_messages_per_day": 40}',
   'Freikontingente pro Benutzer für kostenintensive Funktionen'),
  ('features', '{"valuation": true, "ai_descriptions": true, "image_ai": true, "assistant": true, "dossiers": true, "search_alerts": true, "business_accounts": true, "registration": true}',
   'Aktivierung einzelner Funktionen'),
  ('valuation', '{"min_comparables": 5, "max_age_days": 365, "radius_km": 15, "area_tolerance": 0.35}',
   'Parameter der Vergleichsbewertung auf Basis von Angebotspreisen')
on conflict (key) do nothing;

insert into public.plans (id, name, audience, price_chf_monthly, limits) values
  ('private_free', 'Privat – kostenlos', 'private', 0, '{"active_listings": 3}'),
  ('business_free', 'Firma – Startphase', 'business', 0, '{"active_listings": 25, "members": 5}')
on conflict (id) do nothing;
