-- Entfernt alle Demo-Daten (Demo-Konten, deren Immobilien, Inserate, Gespräche und die Demo-Firma).
-- Echte Daten bleiben unberührt.
delete from public.organizations where slug = 'demo-immobilien';
delete from auth.users where email like 'demo-%@immovia.test';
delete from public.properties where is_demo;
