-- Bereich C (KI, Bewertung, Dossier): Verwaltende dürfen eigene Dossier-Versionen löschen.
-- Bisher gab es für generated_dossiers kein DELETE-Recht; das Löschen hätte den Service-Role-Client
-- gebraucht, der laut Konventionen dafür nicht vorgesehen ist. Die PDF-Datei wird über die
-- bestehende Storage-Policy «immovia dossiers delete» entfernt.

grant delete on public.generated_dossiers to authenticated;

create policy generated_dossiers_delete on public.generated_dossiers for delete to authenticated
  using (public.can_manage_property(property_id) and public.is_active_user());
