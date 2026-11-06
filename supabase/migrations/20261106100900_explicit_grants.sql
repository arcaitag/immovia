-- =============================================================================
-- Immovia · Migration 10: Explizite Rechte
-- Neuere Supabase-Projekte vergeben Tabellenrechte nicht mehr automatisch an
-- anon/authenticated. RLS bleibt die eigentliche Zugriffskontrolle; schreibende
-- Rechte sind spaltengenau in Migration 6 festgelegt.
-- =============================================================================

grant usage on schema public to anon, authenticated, service_role;

grant select on all tables in schema public to anon, authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

-- Interne Funktionen wieder entziehen (nur intern bzw. über Service Role)
revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.enforce_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.notify_user(uuid, text, text, text, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.queue_email(uuid, text, jsonb, text, text, interval) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_auth_user_updated() from public, anon, authenticated;
revoke execute on function public.ensure_conversation(public.listings, uuid) from public, anon, authenticated;
revoke execute on function public.post_system_message(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.write_audit_log(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.record_listing_view(uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.claim_jobs(integer, text) from public, anon, authenticated;
revoke execute on function public.claim_job(uuid, text) from public, anon, authenticated;
revoke execute on function public.claim_emails(integer) from public, anon, authenticated;
revoke execute on function public.cleanup_rate_limits() from public, anon, authenticated;
revoke execute on function public.queue_search_alerts(uuid) from public, anon, authenticated;
revoke execute on function public.saved_search_matches_listing(jsonb, uuid) from public, anon, authenticated;

-- Künftige Objekte (spätere Migrationen) erhalten dieselben Grundrechte
alter default privileges in schema public grant select on tables to anon, authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
