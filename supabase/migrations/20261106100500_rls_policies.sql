-- =============================================================================
-- Immovia · Migration 6: Row Level Security, Spaltenrechte, Realtime
-- Grundsatz: Jede Tabelle hat RLS. Schreibrechte sind auf Spaltenebene
-- eingeschränkt, Systemspalten werden nur von Triggern/Service Role gesetzt.
-- =============================================================================

-- RLS auf allen Tabellen aktivieren
do $$
declare
  t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Spaltenrechte: zuerst schreibende Rechte entziehen, dann gezielt erlauben
-- -----------------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon;
revoke insert, update, truncate, references, trigger on all tables in schema public from authenticated;

grant update (first_name, last_name, display_name, phone, avatar_path, locale)
  on public.profiles to authenticated;

grant update (default_offer_type, default_location_label, analytics_consent, marketing_consent, ai_processing_consent)
  on public.user_preferences to authenticated;

grant update (email_new_message, email_new_inquiry, email_viewings, email_search_alerts,
              email_listing_updates, email_documents, email_product_news)
  on public.user_notification_settings to authenticated;

grant update (name, logo_path, description, street, postal_code, city, canton, phone, email, website, uid_number, is_public)
  on public.organizations to authenticated;

grant update (role) on public.organization_members to authenticated;

grant insert (id, organization_id, property_type, offer_type, internal_name, street, house_number, postal_code,
              municipality, canton, latitude, longitude, egid, rooms, living_area, gross_living_area, usable_area,
              plot_area, year_built, year_renovated, floor, floors_total, bathrooms, condition, heating_type,
              energy_label, energy_demand_kwh, has_balcony, has_terrace, has_garden, has_garage, has_elevator,
              has_cellar, has_attic, is_wheelchair_accessible, is_minergie, pets_allowed, garage_spaces,
              underground_parking_spaces, outdoor_parking_spaces, available_from, available_by_arrangement,
              service_charges, ownership_type, special_features, view_description, wizard_step)
  on public.properties to authenticated;
grant update (organization_id, property_type, offer_type, internal_name, street, house_number, postal_code,
              municipality, canton, latitude, longitude, egid, rooms, living_area, gross_living_area, usable_area,
              plot_area, year_built, year_renovated, floor, floors_total, bathrooms, condition, heating_type,
              energy_label, energy_demand_kwh, has_balcony, has_terrace, has_garden, has_garage, has_elevator,
              has_cellar, has_attic, is_wheelchair_accessible, is_minergie, pets_allowed, garage_spaces,
              underground_parking_spaces, outdoor_parking_spaces, available_from, available_by_arrangement,
              service_charges, ownership_type, special_features, view_description, wizard_step, deleted_at)
  on public.properties to authenticated;

grant insert (property_id, feature_key) on public.property_features to authenticated;
grant insert (id, property_id, year, category, description) on public.property_renovations to authenticated;
grant update (year, category, description) on public.property_renovations to authenticated;

grant insert (id, property_id, original_path, base_path, display_path, thumb_path, width, height, size_bytes,
              mime_type, sort_order, is_cover, caption, is_floor_plan, status)
  on public.property_images to authenticated;
grant update (display_path, thumb_path, width, height, size_bytes, sort_order, is_cover, caption,
              is_floor_plan, is_enhanced, status)
  on public.property_images to authenticated;

grant insert (id, property_id, title, short_description, description, location_description, equipment_description,
              highlights, search_summary, texts_confirmed_at, price, price_on_request, additional_costs,
              parking_price, location_precision, contact_name, contact_phone, contact_email, show_contact_phone,
              dossier_public)
  on public.listings to authenticated;
grant update (title, short_description, description, location_description, equipment_description, highlights,
              search_summary, texts_confirmed_at, price, price_on_request, additional_costs, parking_price,
              location_precision, contact_name, contact_phone, contact_email, show_contact_phone, dossier_public,
              status, deleted_at)
  on public.listings to authenticated;

grant insert (id, property_id, category, title, storage_path, file_name, mime_type, size_bytes, visibility,
              contains_personal_data)
  on public.property_documents to authenticated;
grant update (category, title, visibility, contains_personal_data, deleted_at)
  on public.property_documents to authenticated;

grant update (applied_at) on public.generated_descriptions to authenticated;

grant insert (id, image_id, provider, kind, operations, status, output_path, error_message)
  on public.image_transformations to authenticated;
grant update (status, output_path, error_message, accepted_at) on public.image_transformations to authenticated;

grant insert (id, property_id, listing_id, template_id, version, status, storage_path, file_size, page_count,
              options, is_public, error_message)
  on public.generated_dossiers to authenticated;
grant update (status, storage_path, file_size, page_count, is_public, error_message)
  on public.generated_dossiers to authenticated;

grant insert (listing_id) on public.favorites to authenticated;

grant insert (id, name, criteria, alert_enabled, alert_frequency) on public.saved_searches to authenticated;
grant update (name, criteria, alert_enabled, alert_frequency) on public.saved_searches to authenticated;

grant update (last_read_at, archived_at) on public.conversation_participants to authenticated;

grant insert (id, conversation_id, body, attachment_path, attachment_name, attachment_mime, attachment_size)
  on public.messages to authenticated;
grant update (deleted_at) on public.messages to authenticated;

grant insert (blocked_id) on public.user_blocks to authenticated;

grant update (status, rating) on public.leads to authenticated;

grant insert (id, lead_id, body) on public.lead_notes to authenticated;
grant update (body) on public.lead_notes to authenticated;

grant insert (id, listing_id, starts_at, ends_at, capacity, note) on public.viewing_slots to authenticated;
grant update (starts_at, ends_at, capacity, note) on public.viewing_slots to authenticated;

grant insert (id, appointment_id, body) on public.viewing_appointment_notes to authenticated;

grant update (read_at) on public.notifications to authenticated;

grant insert (target_type, target_id, reason, details) on public.user_reports to authenticated;

grant insert (id, property_id, title) on public.assistant_threads to authenticated;
grant update (title, property_id) on public.assistant_threads to authenticated;

-- Löschrechte nur dort, wo Benutzer selbst löschen dürfen (RLS grenzt weiter ein)
revoke delete on all tables in schema public from authenticated;
grant delete on public.properties, public.property_features, public.property_renovations, public.property_images,
  public.favorites, public.saved_searches, public.user_blocks, public.lead_notes, public.viewing_slots,
  public.viewing_appointment_notes, public.notifications, public.assistant_threads, public.organization_members
  to authenticated;

-- -----------------------------------------------------------------------------
-- Policies: Benutzer
-- -----------------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_moderator());
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy public_profiles_select on public.public_profiles for select to anon, authenticated
  using (
    has_public_listings
    or id = (select auth.uid())
    or (organization_id is not null and exists (
          select 1 from public.organizations o
          where o.id = organization_id and o.is_public and o.status = 'active' and o.deleted_at is null))
    or public.shares_conversation_with(id)
    or public.is_moderator()
  );

create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy user_preferences_all on public.user_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_preferences_update on public.user_preferences for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy user_notification_settings_select on public.user_notification_settings for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_notification_settings_update on public.user_notification_settings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Organisationen
-- -----------------------------------------------------------------------------
create policy organizations_select on public.organizations for select to anon, authenticated
  using (
    (is_public and status = 'active' and deleted_at is null)
    or public.is_org_member(id)
    or public.is_moderator()
  );
create policy organizations_update on public.organizations for update to authenticated
  using (public.is_org_admin(id)) with check (public.is_org_admin(id));

create policy organization_members_select on public.organization_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_org_member(organization_id) or public.is_moderator());
create policy organization_members_update on public.organization_members for update to authenticated
  using (public.is_org_admin(organization_id) and role <> 'owner')
  with check (public.is_org_admin(organization_id) and role <> 'owner');
create policy organization_members_delete on public.organization_members for delete to authenticated
  using (role <> 'owner' and (user_id = (select auth.uid()) or public.is_org_admin(organization_id)));

create policy organization_invitations_select on public.organization_invitations for select to authenticated
  using (public.is_org_admin(organization_id));

-- -----------------------------------------------------------------------------
-- Immobilien
-- -----------------------------------------------------------------------------
create policy properties_select on public.properties for select to authenticated
  using (public.can_manage_property(id) or public.is_moderator());
create policy properties_insert on public.properties for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and public.is_active_user()
    and (organization_id is null or public.is_org_member(organization_id))
  );
create policy properties_update on public.properties for update to authenticated
  using (public.can_manage_property(id) and public.is_active_user())
  with check (organization_id is null or public.is_org_member(organization_id) or owner_id = (select auth.uid()));
create policy properties_delete on public.properties for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy property_features_select on public.property_features for select to anon, authenticated
  using (public.is_property_public(property_id) or public.can_manage_property(property_id));
create policy property_features_insert on public.property_features for insert to authenticated
  with check (public.can_manage_property(property_id) and public.is_active_user());
create policy property_features_delete on public.property_features for delete to authenticated
  using (public.can_manage_property(property_id));

create policy property_renovations_select on public.property_renovations for select to anon, authenticated
  using (public.is_property_public(property_id) or public.can_manage_property(property_id));
create policy property_renovations_insert on public.property_renovations for insert to authenticated
  with check (public.can_manage_property(property_id) and public.is_active_user());
create policy property_renovations_update on public.property_renovations for update to authenticated
  using (public.can_manage_property(property_id)) with check (public.can_manage_property(property_id));
create policy property_renovations_delete on public.property_renovations for delete to authenticated
  using (public.can_manage_property(property_id));

create policy property_images_select on public.property_images for select to anon, authenticated
  using (
    (status = 'ready' and public.is_property_public(property_id))
    or public.can_manage_property(property_id)
    or public.is_moderator()
  );
create policy property_images_insert on public.property_images for insert to authenticated
  with check (public.can_manage_property(property_id) and public.is_active_user());
create policy property_images_update on public.property_images for update to authenticated
  using (public.can_manage_property(property_id)) with check (public.can_manage_property(property_id));
create policy property_images_delete on public.property_images for delete to authenticated
  using (public.can_manage_property(property_id));

-- -----------------------------------------------------------------------------
-- Inserate
-- -----------------------------------------------------------------------------
create policy listings_select_public on public.listings for select to anon, authenticated
  using (status in ('published', 'reserved') and moderation_status <> 'blocked' and deleted_at is null);
create policy listings_select_manage on public.listings for select to authenticated
  using ((owner_id = (select auth.uid()) or (organization_id is not null and public.is_org_member(organization_id))) or public.is_moderator());
create policy listings_insert on public.listings for insert to authenticated
  with check (public.can_manage_property(property_id) and public.is_active_user());
create policy listings_update on public.listings for update to authenticated
  using ((owner_id = (select auth.uid()) or (organization_id is not null and public.is_org_member(organization_id))) and public.is_active_user())
  with check ((owner_id = (select auth.uid()) or (organization_id is not null and public.is_org_member(organization_id))));

create policy listing_status_history_select on public.listing_status_history for select to authenticated
  using (public.can_manage_listing(listing_id) or public.is_moderator());

-- -----------------------------------------------------------------------------
-- Dokumente
-- -----------------------------------------------------------------------------
create policy property_documents_select on public.property_documents for select to anon, authenticated
  using (public.can_read_document(id));
create policy property_documents_insert on public.property_documents for insert to authenticated
  with check (
    public.can_manage_property(property_id)
    and public.is_active_user()
    and split_part(storage_path, '/', 1) = property_id::text
  );
create policy property_documents_update on public.property_documents for update to authenticated
  using (public.can_manage_document(id)) with check (public.can_manage_property(property_id));

create policy document_access_grants_select on public.document_access_grants for select to authenticated
  using (grantee_id = (select auth.uid()) or public.can_manage_document(document_id));

-- -----------------------------------------------------------------------------
-- Bewertungen, KI, Dossiers (Schreiben nur Service Role)
-- -----------------------------------------------------------------------------
create policy property_valuations_select on public.property_valuations for select to authenticated
  using (public.can_manage_property(property_id));
create policy valuation_sources_select on public.valuation_sources for select to authenticated
  using (exists (select 1 from public.property_valuations v
                 where v.id = valuation_id and public.can_manage_property(v.property_id)));
create policy valuation_comparables_select on public.valuation_comparables for select to authenticated
  using (exists (select 1 from public.property_valuations v
                 where v.id = valuation_id and public.can_manage_property(v.property_id)));

create policy ai_generation_jobs_select on public.ai_generation_jobs for select to authenticated
  using (
    user_id = (select auth.uid())
    or (property_id is not null and public.can_manage_property(property_id))
    or public.is_admin()
  );
create policy ai_usage_events_select on public.ai_usage_events for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy generated_descriptions_select on public.generated_descriptions for select to authenticated
  using (public.can_manage_property(property_id));
create policy generated_descriptions_update on public.generated_descriptions for update to authenticated
  using (public.can_manage_property(property_id)) with check (public.can_manage_property(property_id));

create policy image_transformations_select on public.image_transformations for select to authenticated
  using (exists (select 1 from public.property_images i
                 where i.id = image_id and public.can_manage_property(i.property_id)));
create policy image_transformations_insert on public.image_transformations for insert to authenticated
  with check (exists (select 1 from public.property_images i
                      where i.id = image_id and public.can_manage_property(i.property_id)));
create policy image_transformations_update on public.image_transformations for update to authenticated
  using (exists (select 1 from public.property_images i
                 where i.id = image_id and public.can_manage_property(i.property_id)));

create policy dossier_templates_select on public.dossier_templates for select to anon, authenticated
  using (is_active);

create policy generated_dossiers_select on public.generated_dossiers for select to anon, authenticated
  using (
    public.can_manage_property(property_id)
    or (is_public and status = 'ready' and exists (
          select 1 from public.listings l
          where l.property_id = generated_dossiers.property_id
            and l.dossier_public
            and l.status in ('published', 'reserved')
            and l.moderation_status <> 'blocked'
            and l.deleted_at is null))
  );
create policy generated_dossiers_insert on public.generated_dossiers for insert to authenticated
  with check (public.can_manage_property(property_id) and public.is_active_user()
              and (storage_path is null or split_part(storage_path, '/', 1) = property_id::text));
create policy generated_dossiers_update on public.generated_dossiers for update to authenticated
  using (public.can_manage_property(property_id)) with check (public.can_manage_property(property_id));

-- -----------------------------------------------------------------------------
-- Merkliste, Suchabos, Statistik
-- -----------------------------------------------------------------------------
create policy favorites_select on public.favorites for select to authenticated
  using (user_id = (select auth.uid()));
create policy favorites_insert on public.favorites for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_listing_public(listing_id));
create policy favorites_delete on public.favorites for delete to authenticated
  using (user_id = (select auth.uid()));

create policy saved_searches_select on public.saved_searches for select to authenticated
  using (user_id = (select auth.uid()));
create or replace function public.my_saved_search_count()
returns integer
language sql stable security definer set search_path = ''
as $$
  select count(*)::int from public.saved_searches where user_id = (select auth.uid());
$$;

create policy saved_searches_insert on public.saved_searches for insert to authenticated
  with check (user_id = (select auth.uid()) and public.my_saved_search_count() < 25);
create policy saved_searches_update on public.saved_searches for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy saved_searches_delete on public.saved_searches for delete to authenticated
  using (user_id = (select auth.uid()));

create policy saved_search_matches_select on public.saved_search_matches for select to authenticated
  using (exists (select 1 from public.saved_searches s
                 where s.id = saved_search_id and s.user_id = (select auth.uid())));

-- listing_views: kein Zugriff für Benutzer (Auswertung über get_listing_statistics)

create policy listing_inquiries_select on public.listing_inquiries for select to authenticated
  using (sender_id = (select auth.uid()) or public.can_manage_listing(listing_id));

-- -----------------------------------------------------------------------------
-- Kommunikation
-- -----------------------------------------------------------------------------
create policy conversations_select on public.conversations for select to authenticated
  using (public.is_conversation_participant(id));

create policy conversation_participants_select on public.conversation_participants for select to authenticated
  using (user_id = (select auth.uid()) or public.is_conversation_participant(conversation_id));
create policy conversation_participants_update on public.conversation_participants for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy messages_select on public.messages for select to authenticated
  using (public.is_conversation_participant(conversation_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and kind = 'text'
    and public.can_post_in_conversation(conversation_id)
  );
create policy messages_update on public.messages for update to authenticated
  using (sender_id = (select auth.uid())) with check (sender_id = (select auth.uid()));

create policy user_blocks_select on public.user_blocks for select to authenticated
  using (blocker_id = (select auth.uid()));
create policy user_blocks_insert on public.user_blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()));
create policy user_blocks_delete on public.user_blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

create policy leads_select on public.leads for select to authenticated
  using ((owner_id = (select auth.uid()) or (organization_id is not null and public.is_org_member(organization_id))));
create policy leads_update on public.leads for update to authenticated
  using ((owner_id = (select auth.uid()) or (organization_id is not null and public.is_org_member(organization_id))))
  with check ((owner_id = (select auth.uid()) or (organization_id is not null and public.is_org_member(organization_id))));

create policy lead_notes_select on public.lead_notes for select to authenticated
  using (exists (select 1 from public.leads l
                 where l.id = lead_id and public.can_manage_owner_org(l.owner_id, l.organization_id)));
create policy lead_notes_insert on public.lead_notes for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (
    select 1 from public.leads l where l.id = lead_id and public.can_manage_owner_org(l.owner_id, l.organization_id)));
create policy lead_notes_update on public.lead_notes for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy lead_notes_delete on public.lead_notes for delete to authenticated
  using (author_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Besichtigungen
-- -----------------------------------------------------------------------------
create policy viewing_slots_select on public.viewing_slots for select to anon, authenticated
  using (public.is_listing_public(listing_id) or public.can_manage_listing(listing_id));
create policy viewing_slots_insert on public.viewing_slots for insert to authenticated
  with check (public.can_manage_listing(listing_id) and public.is_active_user());
create policy viewing_slots_update on public.viewing_slots for update to authenticated
  using (public.can_manage_listing(listing_id)) with check (public.can_manage_listing(listing_id));
create policy viewing_slots_delete on public.viewing_slots for delete to authenticated
  using (public.can_manage_listing(listing_id));

create policy viewing_appointments_select on public.viewing_appointments for select to authenticated
  using (guest_id = (select auth.uid()) or (owner_id = (select auth.uid()) or (organization_id is not null and public.is_org_member(organization_id))));

create policy viewing_appointment_notes_select on public.viewing_appointment_notes for select to authenticated
  using (exists (select 1 from public.viewing_appointments a
                 where a.id = appointment_id and public.can_manage_owner_org(a.owner_id, a.organization_id)));
create policy viewing_appointment_notes_insert on public.viewing_appointment_notes for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (
    select 1 from public.viewing_appointments a
    where a.id = appointment_id and public.can_manage_owner_org(a.owner_id, a.organization_id)));
create policy viewing_appointment_notes_delete on public.viewing_appointment_notes for delete to authenticated
  using (author_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Benachrichtigungen, Meldungen, Betrieb
-- -----------------------------------------------------------------------------
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- email_outbox, rate_limit_buckets, listing_views: keine Policies => nur Service Role

create policy user_reports_select on public.user_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_moderator());
create policy user_reports_insert on public.user_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and public.is_active_user());

create policy moderation_actions_select on public.moderation_actions for select to authenticated
  using (public.is_moderator());

create policy admin_audit_logs_select on public.admin_audit_logs for select to authenticated
  using (public.is_admin());

create policy feature_settings_select on public.feature_settings for select to anon, authenticated
  using (true);

create policy verifications_select on public.verifications for select to anon, authenticated
  using (
    public.is_moderator()
    or (subject_type = 'user' and subject_id = (select auth.uid()))
    or (subject_type = 'property' and public.can_manage_property(subject_id))
    or (subject_type = 'organization' and public.is_org_member(subject_id))
    or (status = 'verified' and subject_type = 'property' and public.is_property_public(subject_id))
  );

create policy contact_requests_select on public.contact_requests for select to authenticated
  using (public.is_moderator());

create policy assistant_threads_select on public.assistant_threads for select to authenticated
  using (user_id = (select auth.uid()));
create policy assistant_threads_insert on public.assistant_threads for insert to authenticated
  with check (user_id = (select auth.uid()) and (property_id is null or public.can_manage_property(property_id)));
create policy assistant_threads_update on public.assistant_threads for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (property_id is null or public.can_manage_property(property_id)));
create policy assistant_threads_delete on public.assistant_threads for delete to authenticated
  using (user_id = (select auth.uid()));

create policy assistant_messages_select on public.assistant_messages for select to authenticated
  using (exists (select 1 from public.assistant_threads t
                 where t.id = thread_id and t.user_id = (select auth.uid())));

create policy plans_select on public.plans for select to anon, authenticated using (is_active);
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or (organization_id is not null and public.is_org_admin(organization_id)));
create policy payment_transactions_select on public.payment_transactions for select to authenticated
  using (exists (select 1 from public.subscriptions s
                 where s.id = subscription_id
                   and (s.user_id = (select auth.uid())
                        or (s.organization_id is not null and public.is_org_admin(s.organization_id)))));

-- -----------------------------------------------------------------------------
-- Funktionsrechte: interne Funktionen nicht über die API aufrufbar
-- -----------------------------------------------------------------------------
revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.enforce_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.notify_user(uuid, text, text, text, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.queue_email(uuid, text, jsonb, text, text, interval) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_auth_user_updated() from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

-- -----------------------------------------------------------------------------
-- Realtime für Chat, Benachrichtigungen und Job-Status
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.notifications,
      public.conversation_participants, public.ai_generation_jobs;
  end if;
end;
$$;
