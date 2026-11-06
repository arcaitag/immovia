-- Sicherheits-Härtung – läuft als letzte Migration.
--
-- Supabase vergibt für Objekte, die die Rolle postgres im Schema public anlegt, standardmässig
-- volle Rechte an anon und authenticated (Tabellen: arwdDxtm, Funktionen: EXECUTE). Diese
-- Migration stellt unabhängig davon einen eindeutigen Zustand her:
--   * anon: nur Lesen auf Tabellen (Zeilen weiterhin per RLS) und nur die Funktionen, die
--     öffentliche Seiten und RLS-Policies brauchen.
--   * authenticated: keine Tabellenrechte zum Leeren/Warten; Schreibrechte nur über die
--     ausdrücklich vergebenen Spaltenrechte; Löschen nur auf freigegebenen Tabellen; keine
--     internen Funktionen und keine Trigger-Funktionen.
--   * Künftige Tabellen/Sequenzen erhalten für anon/authenticated nur noch SELECT.
-- Die Invarianten prüft tests/db/privileges.test.ts. Neue Funktionen für anon gehören in die
-- Allowlist unten (und in den Test), interne Funktionen in die Liste «internal».

-- 1. Standardrechte für künftige Objekte ------------------------------------------------------
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public grant select on tables to anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;

-- 2. Tabellen- und Sequenzrechte --------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon;
-- Für authenticated INSERT/UPDATE nicht pauschal entziehen: das würde auch die Spaltenrechte löschen.
revoke truncate, references, trigger on all tables in schema public from authenticated;
do $$
begin
  if current_setting('server_version_num')::int >= 170000 then
    execute 'revoke maintain on all tables in schema public from anon, authenticated';
  end if;
end;
$$;
revoke all on all sequences in schema public from anon, authenticated;

do $$
declare
  t record;
  delete_allowed text[] := array[
    'properties', 'property_features', 'property_renovations', 'property_images', 'favorites',
    'saved_searches', 'user_blocks', 'lead_notes', 'viewing_slots', 'viewing_appointment_notes',
    'notifications', 'assistant_threads', 'organization_members'
  ];
begin
  for t in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not (c.relname = any (delete_allowed))
  loop
    execute format('revoke delete on public.%I from authenticated', t.relname);
  end loop;
end;
$$;

-- 3. Funktionsrechte --------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

do $$
declare
  f record;
  -- Für öffentliche Seiten (anon) und für Policies, die auch für anon gelten
  anon_allowed text[] := array[
    'is_property_public', 'is_listing_public', 'can_manage_property', 'can_manage_listing',
    'can_read_document', 'can_read_document_object', 'is_public_dossier_object', 'is_moderator',
    'is_org_member', 'shares_conversation_with', 'try_uuid',
    'search_listings', 'get_listing_availability', 'get_viewing_slots', 'submit_contact_request',
    'feature_setting', 'get_listing_public_contact', 'get_public_verifications',
    'get_organization_invitation'
  ];
  -- Nur für Service Role bzw. intern (aus Definer-Funktionen und Triggern aufgerufen)
  internal text[] := array[
    'check_rate_limit', 'enforce_rate_limit', 'notify_user', 'queue_email', 'ensure_conversation',
    'post_system_message', 'write_audit_log', 'record_listing_view', 'claim_jobs', 'claim_job',
    'claim_emails', 'cleanup_rate_limits', 'queue_search_alerts', 'saved_search_matches_listing',
    'cleanup_email_outbox', 'storage_cleanup_candidates', 'purge_deleted_properties',
    'is_privileged_context'
  ];
begin
  for f in
    select p.oid::regprocedure as signature,
           p.proname,
           p.prorettype = 'trigger'::regtype as is_trigger
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    if not f.is_trigger and not (f.proname = any (internal)) then
      execute format('grant execute on function %s to authenticated', f.signature);
    end if;
    if f.proname = any (anon_allowed) then
      execute format('grant execute on function %s to anon', f.signature);
    end if;
  end loop;
end;
$$;

-- 4. Policies -----------------------------------------------------------------------------------
-- listings: je eine Policy pro Rolle statt zwei permissiver Policies für authenticated
drop policy listings_select_public on public.listings;
drop policy listings_select_manage on public.listings;
create policy listings_select_public on public.listings for select to anon
  using (status in ('published', 'reserved') and moderation_status <> 'blocked' and deleted_at is null);
create policy listings_select_authenticated on public.listings for select to authenticated
  using (
    (status in ('published', 'reserved') and moderation_status <> 'blocked' and deleted_at is null)
    or owner_id = (select auth.uid())
    or (organization_id is not null and public.is_org_member(organization_id))
    or public.is_moderator()
  );

-- properties: Bedingung direkt auf der Zeile, damit INSERT … RETURNING die neue Zeile sieht
drop policy properties_select on public.properties;
create policy properties_select on public.properties for select to authenticated
  using (
    (deleted_at is null and (
      owner_id = (select auth.uid())
      or (organization_id is not null and public.is_org_member(organization_id))))
    or public.is_moderator()
  );

-- 5. Indizes für Fremdschlüssel auf häufigen Lösch- und Abfragepfaden -------------------------
create index if not exists leads_interested_idx on public.leads (interested_id);
create index if not exists leads_conversation_idx on public.leads (conversation_id);
create index if not exists saved_search_matches_listing_idx on public.saved_search_matches (listing_id);
create index if not exists listing_status_history_changed_by_idx on public.listing_status_history (changed_by);
create index if not exists property_images_uploaded_by_idx on public.property_images (uploaded_by);
create index if not exists property_documents_uploaded_by_idx on public.property_documents (uploaded_by);
create index if not exists lead_notes_author_idx on public.lead_notes (author_id);
create index if not exists listing_inquiries_conversation_idx on public.listing_inquiries (conversation_id);
create index if not exists viewing_appointments_conversation_idx on public.viewing_appointments (conversation_id);
create index if not exists ai_generation_jobs_property_idx on public.ai_generation_jobs (property_id);
create index if not exists ai_usage_events_job_idx on public.ai_usage_events (job_id);
create index if not exists generated_descriptions_listing_idx on public.generated_descriptions (listing_id);
create index if not exists valuation_comparables_listing_idx on public.valuation_comparables (listing_id);
