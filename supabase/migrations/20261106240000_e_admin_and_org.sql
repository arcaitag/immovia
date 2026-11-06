-- =============================================================================
-- Immovia · Agent E: Firmenkonten (Einladungen, Mitglieder, Inhaberwechsel)
-- und Administration (Benutzersuche, Kontaktanfragen, Zeitreihen, KI-Nutzung).
-- Alle Funktionen: SECURITY DEFINER, leerer search_path, Berechtigungsprüfung
-- in der Funktion. Admin-Aktionen schreiben das Audit-Log.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Firmeneinladung: Vorschau per Token (auch ohne Anmeldung)
--    Gibt keine vollständige E-Mail-Adresse preis (nur einen Hinweis).
-- -----------------------------------------------------------------------------
create or replace function public.get_organization_invitation(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_inv public.organization_invitations%rowtype;
  v_org public.organizations%rowtype;
  v_my_email text;
  v_status text;
begin
  if p_token is null or char_length(p_token) < 32 or char_length(p_token) > 128 then
    return jsonb_build_object('status', 'invalid');
  end if;
  select * into v_inv from public.organization_invitations
   where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;
  select * into v_org from public.organizations where id = v_inv.organization_id;
  if not found or v_org.deleted_at is not null or v_org.status <> 'active' then
    return jsonb_build_object('status', 'invalid');
  end if;

  v_status := case
    when v_inv.accepted_at is not null then 'accepted'
    when v_inv.revoked_at is not null then 'revoked'
    when v_inv.expires_at < now() then 'expired'
    else 'open' end;

  if v_uid is not null then
    select email into v_my_email from public.profiles where id = v_uid;
  end if;

  return jsonb_build_object(
    'status', v_status,
    'organization_name', v_org.name,
    'organization_slug', case when v_org.is_public then v_org.slug end,
    'logo_path', v_org.logo_path,
    'role', v_inv.role,
    'expires_at', v_inv.expires_at,
    'email_hint', regexp_replace(v_inv.email, '^(.)[^@]*(@.*)$', '\1***\2'),
    'email_matches', case when v_uid is null then null
                          else lower(coalesce(v_my_email, '')) = lower(v_inv.email) end,
    'already_member', case when v_uid is null then false
                           else exists (select 1 from public.organization_members m
                                        where m.organization_id = v_org.id and m.user_id = v_uid) end,
    'invited_by', (select pp.display_name from public.public_profiles pp where pp.id = v_inv.invited_by)
  );
end;
$$;
grant execute on function public.get_organization_invitation(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Einladung widerrufen (Inhaber/Admin der Organisation)
-- -----------------------------------------------------------------------------
create or replace function public.revoke_organization_invitation(p_invitation_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_inv public.organization_invitations%rowtype;
begin
  select * into v_inv from public.organization_invitations where id = p_invitation_id for update;
  if not found or not public.is_org_admin(v_inv.organization_id) then
    raise exception 'not_found';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'invalid_status_transition';
  end if;
  if v_inv.revoked_at is null then
    update public.organization_invitations set revoked_at = now() where id = p_invitation_id;
  end if;
end;
$$;
revoke execute on function public.revoke_organization_invitation(uuid) from public, anon;
grant execute on function public.revoke_organization_invitation(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Mitglieder einer Organisation inkl. Anzeigename
--    (public_profiles sind für nicht öffentliche Firmen sonst nicht lesbar).
--    E-Mail nur für Inhaber/Admins, Moderatoren und die Person selbst.
-- -----------------------------------------------------------------------------
create or replace function public.get_organization_members(p_org uuid)
returns table (
  user_id uuid,
  role public.org_role,
  display_name text,
  avatar_path text,
  email text,
  joined_at timestamptz,
  is_me boolean
)
language sql stable security definer set search_path = ''
as $$
  select m.user_id,
         m.role,
         p.display_name,
         p.avatar_path,
         case when public.is_org_admin(p_org) or public.is_moderator() or m.user_id = (select auth.uid())
              then p.email end,
         m.created_at,
         m.user_id = (select auth.uid())
  from public.organization_members m
  join public.profiles p on p.id = m.user_id
  where m.organization_id = p_org
    and (public.is_org_member(p_org) or public.is_moderator())
  order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, p.display_name, m.user_id;
$$;
revoke execute on function public.get_organization_members(uuid) from public, anon;
grant execute on function public.get_organization_members(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Inhaberschaft übertragen (nur Inhaber; neue Person muss aktives Mitglied sein)
--    Der bisherige Inhaber wird Administrator.
-- -----------------------------------------------------------------------------
create or replace function public.transfer_organization_ownership(p_org uuid, p_new_owner uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org_name text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_active_user() then raise exception 'account_inactive'; end if;
  select o.name into v_org_name
    from public.organizations o
    join public.organization_members m on m.organization_id = o.id
   where o.id = p_org and m.user_id = v_uid and m.role = 'owner'
     and o.status = 'active' and o.deleted_at is null;
  if not found then raise exception 'forbidden'; end if;
  if p_new_owner is null or p_new_owner = v_uid then raise exception 'cannot_modify_self'; end if;
  if not exists (select 1 from public.organization_members where organization_id = p_org and user_id = p_new_owner) then
    raise exception 'not_found';
  end if;
  if not exists (select 1 from public.profiles where id = p_new_owner and status = 'active') then
    raise exception 'member_inactive';
  end if;
  if exists (select 1 from public.organization_members
             where user_id = p_new_owner and role = 'owner' and organization_id <> p_org) then
    raise exception 'member_already_owner';
  end if;

  -- Reihenfolge wichtig: höchstens ein Inhaber pro Organisation (eindeutiger Index)
  update public.organization_members set role = 'admin' where organization_id = p_org and user_id = v_uid;
  update public.organization_members set role = 'owner' where organization_id = p_org and user_id = p_new_owner;
  update public.profiles set account_type = 'business' where id = p_new_owner and account_type <> 'business';

  perform public.notify_user(p_new_owner, 'org_ownership',
    'Sie sind neu Inhaber/in von «' || v_org_name || '»',
    'Die Inhaberschaft des Firmenkontos wurde an Sie übertragen.',
    '/dashboard/firma', jsonb_build_object('organization_id', p_org));
end;
$$;
revoke execute on function public.transfer_organization_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_organization_ownership(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Öffentliche Firmenzuordnung beim Austritt nachführen
--    (create_organization/accept_organization_invitation setzen sie beim Eintritt)
-- -----------------------------------------------------------------------------
create or replace function public.organization_members_after_delete()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.public_profiles pp
     set organization_id = (
           select m.organization_id from public.organization_members m
           where m.user_id = old.user_id and m.organization_id <> old.organization_id
           order by (m.role = 'owner') desc, m.created_at
           limit 1),
         updated_at = now()
   where pp.id = old.user_id
     and pp.organization_id = old.organization_id;
  return null;
end;
$$;
revoke execute on function public.organization_members_after_delete() from public, anon, authenticated;

drop trigger if exists organization_members_after_delete on public.organization_members;
create trigger organization_members_after_delete
  after delete on public.organization_members
  for each row execute function public.organization_members_after_delete();

-- -----------------------------------------------------------------------------
-- 6. Verifizierungen: genau ein gültiger Eintrag pro Subjekt und Art.
--    Neue Entscheidung widerruft frühere «verified»-Einträge, damit ein
--    widerrufener Status nirgends mehr als geprüft erscheint (Spez. 22).
--    Signatur unverändert gegenüber Migration 7.
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_verification(
  p_subject_type text, p_subject_id uuid, p_kind public.verification_kind,
  p_status public.verification_status, p_method text default null, p_notes text default null
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_subject_type is null or p_subject_type not in ('user', 'property', 'organization') then
    raise exception 'invalid_subject';
  end if;
  if (p_subject_type = 'user' and p_kind <> 'identity')
     or (p_subject_type = 'property' and p_kind not in ('ownership', 'documentation_complete'))
     or (p_subject_type = 'organization' and p_kind <> 'organization') then
    raise exception 'invalid_kind';
  end if;
  if (p_subject_type = 'user' and not exists (select 1 from public.profiles where id = p_subject_id))
     or (p_subject_type = 'property' and not exists (select 1 from public.properties where id = p_subject_id))
     or (p_subject_type = 'organization' and not exists (select 1 from public.organizations where id = p_subject_id)) then
    raise exception 'not_found';
  end if;

  update public.verifications
     set status = 'revoked'
   where subject_type = p_subject_type and subject_id = p_subject_id and kind = p_kind and status = 'verified';

  insert into public.verifications (subject_type, subject_id, kind, status, method, notes, verified_by, verified_at)
  values (p_subject_type, p_subject_id, p_kind, p_status, nullif(trim(p_method), ''), nullif(trim(p_notes), ''),
          (select auth.uid()), case when p_status = 'verified' then now() end)
  returning id into v_id;

  perform public.write_audit_log('verification.' || p_status::text, p_subject_type, p_subject_id::text,
    jsonb_build_object('kind', p_kind, 'method', nullif(trim(p_method), '')));
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Kontaktanfragen: Status setzen (Moderatoren)
-- -----------------------------------------------------------------------------
create or replace function public.admin_update_contact_request(p_request_id uuid, p_status text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_old text;
begin
  if not public.is_moderator() then raise exception 'forbidden'; end if;
  if p_status is null or p_status not in ('open', 'answered', 'closed', 'spam') then
    raise exception 'invalid_status';
  end if;
  select status into v_old from public.contact_requests where id = p_request_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_old = p_status then
    return;
  end if;
  update public.contact_requests set status = p_status where id = p_request_id;
  perform public.write_audit_log('contact_request.' || p_status, 'contact_request', p_request_id::text,
    jsonb_build_object('from', v_old, 'to', p_status));
end;
$$;
revoke execute on function public.admin_update_contact_request(uuid, text) from public, anon;
grant execute on function public.admin_update_contact_request(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 8. Benutzersuche für die Administration (Moderatoren)
--    Rollen nur für Admins (wie RLS auf user_roles).
-- -----------------------------------------------------------------------------
create or replace function public.admin_search_users(
  p_query text default null,
  p_status public.user_status default null,
  p_role public.app_role default null,
  p_user_id uuid default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  email text,
  display_name text,
  first_name text,
  last_name text,
  phone text,
  account_type public.account_type,
  status public.user_status,
  status_reason text,
  status_changed_at timestamptz,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed boolean,
  roles public.app_role[],
  identity_verified boolean,
  listing_count integer,
  total_count bigint
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_is_admin boolean := public.is_admin();
  v_q text := nullif(trim(coalesce(p_query, '')), '');
  v_pattern text;
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.is_moderator() then raise exception 'forbidden'; end if;
  if p_role is not null and not v_is_admin then raise exception 'forbidden'; end if;
  if v_q is not null then
    v_pattern := '%' || replace(replace(replace(left(v_q, 120), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  select p.id, p.email, p.display_name, p.first_name, p.last_name, p.phone, p.account_type, p.status,
         p.status_reason, p.status_changed_at, p.created_at,
         u.last_sign_in_at,
         u.email_confirmed_at is not null,
         case when v_is_admin then coalesce(
           (select array_agg(r.role order by r.role) from public.user_roles r where r.user_id = p.id),
           '{}'::public.app_role[]) end,
         coalesce(pp.identity_verified, false),
         (select count(*)::int from public.listings l where l.owner_id = p.id and l.deleted_at is null),
         count(*) over ()
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join public.public_profiles pp on pp.id = p.id
  where (p_user_id is null or p.id = p_user_id)
    and (p_status is null or p.status = p_status)
    and (v_pattern is null
         or p.email ilike v_pattern
         or p.display_name ilike v_pattern
         or concat_ws(' ', p.first_name, p.last_name) ilike v_pattern
         or p.id::text = v_q)
    and (p_role is null or exists (select 1 from public.user_roles r where r.user_id = p.id and r.role = p_role))
  order by p.created_at desc, p.id
  limit v_limit offset v_offset;
end;
$$;
revoke execute on function public.admin_search_users(text, public.user_status, public.app_role, uuid, integer, integer) from public, anon;
grant execute on function public.admin_search_users(text, public.user_status, public.app_role, uuid, integer, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- 9. Zeitreihen für die Plattformstatistik (Moderatoren)
--    Tage in Europe/Zurich, Demo-Inserate ausgeschlossen.
-- -----------------------------------------------------------------------------
create or replace function public.admin_timeseries(p_days integer default 30)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 7), 365);
  v_today date := (now() at time zone 'Europe/Zurich')::date;
  v_from date := v_today - (v_days - 1);
  v_from_ts timestamptz := v_from::timestamp at time zone 'Europe/Zurich';
  v_prev_ts timestamptz := (v_from - v_days)::timestamp at time zone 'Europe/Zurich';
begin
  if not public.is_moderator() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'days', v_days,
    'from', v_from,
    'to', v_today,
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'date', d::date,
               'registrations', coalesce(r.cnt, 0),
               'listings_published', coalesce(l.cnt, 0),
               'inquiries', coalesce(i.cnt, 0),
               'valuations', coalesce(v.cnt, 0),
               'dossiers', coalesce(ds.cnt, 0)) order by d), '[]'::jsonb)
      from generate_series(v_from::timestamp, v_today::timestamp, interval '1 day') d
      left join (select (created_at at time zone 'Europe/Zurich')::date dd, count(*) cnt
                 from public.profiles where created_at >= v_from_ts group by 1) r on r.dd = d::date
      left join (select (first_published_at at time zone 'Europe/Zurich')::date dd, count(*) cnt
                 from public.listings where first_published_at >= v_from_ts and not is_demo group by 1) l on l.dd = d::date
      left join (select (created_at at time zone 'Europe/Zurich')::date dd, count(*) cnt
                 from public.listing_inquiries where created_at >= v_from_ts group by 1) i on i.dd = d::date
      left join (select (created_at at time zone 'Europe/Zurich')::date dd, count(*) cnt
                 from public.property_valuations where created_at >= v_from_ts group by 1) v on v.dd = d::date
      left join (select (created_at at time zone 'Europe/Zurich')::date dd, count(*) cnt
                 from public.generated_dossiers where created_at >= v_from_ts and status = 'ready' group by 1) ds
             on ds.dd = d::date
    ),
    'previous', jsonb_build_object(
      'registrations', (select count(*) from public.profiles where created_at >= v_prev_ts and created_at < v_from_ts),
      'listings_published', (select count(*) from public.listings
                              where first_published_at >= v_prev_ts and first_published_at < v_from_ts and not is_demo),
      'inquiries', (select count(*) from public.listing_inquiries where created_at >= v_prev_ts and created_at < v_from_ts),
      'valuations', (select count(*) from public.property_valuations where created_at >= v_prev_ts and created_at < v_from_ts),
      'dossiers', (select count(*) from public.generated_dossiers
                    where created_at >= v_prev_ts and created_at < v_from_ts and status = 'ready')
    )
  );
end;
$$;
revoke execute on function public.admin_timeseries(integer) from public, anon;
grant execute on function public.admin_timeseries(integer) to authenticated;

-- -----------------------------------------------------------------------------
-- 10. KI-Nutzung aggregiert (nur Admins, wie RLS auf ai_usage_events)
--     Kosten sind die beim Aufruf erfassten Schätzwerte (cost_usd).
-- -----------------------------------------------------------------------------
create or replace function public.admin_ai_usage_summary(p_days integer default 30)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 365);
  v_today date := (now() at time zone 'Europe/Zurich')::date;
  v_from date := v_today - (v_days - 1);
  v_from_ts timestamptz := v_from::timestamp at time zone 'Europe/Zurich';
  v_prev_ts timestamptz := (v_from - v_days)::timestamp at time zone 'Europe/Zurich';
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'days', v_days,
    'from', v_from,
    'to', v_today,
    'totals', (
      select jsonb_build_object(
        'events', count(*),
        'failed', count(*) filter (where not e.success),
        'input_tokens', coalesce(sum(e.input_tokens), 0),
        'output_tokens', coalesce(sum(e.output_tokens), 0),
        'images', coalesce(sum(e.image_count), 0),
        'cost_usd', coalesce(sum(e.cost_usd), 0),
        'users', count(distinct e.user_id))
      from public.ai_usage_events e where e.created_at >= v_from_ts
    ),
    'previous', (
      select jsonb_build_object('events', count(*), 'cost_usd', coalesce(sum(e.cost_usd), 0))
      from public.ai_usage_events e where e.created_at >= v_prev_ts and e.created_at < v_from_ts
    ),
    'by_day', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'date', d::date, 'events', coalesce(x.events, 0), 'cost_usd', coalesce(x.cost, 0)) order by d), '[]'::jsonb)
      from generate_series(v_from::timestamp, v_today::timestamp, interval '1 day') d
      left join (select (e.created_at at time zone 'Europe/Zurich')::date dd, count(*) events, sum(e.cost_usd) cost
                 from public.ai_usage_events e where e.created_at >= v_from_ts group by 1) x on x.dd = d::date
    ),
    'by_feature', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'feature', f.feature, 'events', f.events, 'failed', f.failed, 'cost_usd', f.cost,
               'input_tokens', f.tin, 'output_tokens', f.tout, 'images', f.imgs) order by f.cost desc, f.events desc), '[]'::jsonb)
      from (select e.feature, count(*) events, count(*) filter (where not e.success) failed,
                   coalesce(sum(e.cost_usd), 0) cost, coalesce(sum(e.input_tokens), 0) tin,
                   coalesce(sum(e.output_tokens), 0) tout, coalesce(sum(e.image_count), 0) imgs
            from public.ai_usage_events e where e.created_at >= v_from_ts group by e.feature) f
    ),
    'by_model', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'provider', m.provider, 'model', m.model, 'events', m.events, 'cost_usd', m.cost,
               'input_tokens', m.tin, 'output_tokens', m.tout) order by m.cost desc, m.events desc), '[]'::jsonb)
      from (select e.provider, coalesce(e.model, '') model, count(*) events, coalesce(sum(e.cost_usd), 0) cost,
                   coalesce(sum(e.input_tokens), 0) tin, coalesce(sum(e.output_tokens), 0) tout
            from public.ai_usage_events e where e.created_at >= v_from_ts group by 1, 2) m
    ),
    'top_users', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'user_id', t.user_id, 'display_name', p.display_name, 'email', p.email,
               'events', t.events, 'cost_usd', t.cost) order by t.cost desc, t.events desc), '[]'::jsonb)
      from (select e.user_id, count(*) events, coalesce(sum(e.cost_usd), 0) cost
            from public.ai_usage_events e
            where e.created_at >= v_from_ts and e.user_id is not null
            group by e.user_id
            order by cost desc, events desc
            limit 10) t
      left join public.profiles p on p.id = t.user_id
    )
  );
end;
$$;
revoke execute on function public.admin_ai_usage_summary(integer) from public, anon;
grant execute on function public.admin_ai_usage_summary(integer) to authenticated;
