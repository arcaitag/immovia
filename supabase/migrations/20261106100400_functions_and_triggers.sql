-- =============================================================================
-- Immovia · Migration 5: Berechtigungsfunktionen und Trigger
-- Alle SECURITY DEFINER Funktionen haben einen leeren search_path und verwenden
-- vollqualifizierte Namen.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Rollen und Berechtigungen
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = (select auth.uid()) and r.role = 'admin'
  );
$$;

create or replace function public.is_moderator()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = (select auth.uid()) and r.role in ('admin', 'moderator')
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status = 'active'
  );
$$;

-- Privilegierter Kontext: Moderatoren, Service Role oder direkte DB-Verbindung (Migration/Seed)
create or replace function public.is_privileged_context()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select auth.role()), '') = 'service_role'
      or (select auth.role()) is null
      or public.is_moderator();
$$;

create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and o.status = 'active'
      and o.deleted_at is null
  );
$$;

create or replace function public.is_org_admin(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
      and o.status = 'active'
      and o.deleted_at is null
  );
$$;

create or replace function public.can_manage_property(p_property uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.properties p
    where p.id = p_property
      and p.deleted_at is null
      and (
        p.owner_id = (select auth.uid())
        or (p.organization_id is not null and public.is_org_member(p.organization_id))
      )
  );
$$;

create or replace function public.can_manage_owner_org(p_owner uuid, p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_owner = (select auth.uid())
      or (p_org is not null and public.is_org_member(p_org));
$$;

create or replace function public.can_manage_listing(p_listing uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.listings l
    where l.id = p_listing
      and (l.owner_id = (select auth.uid())
           or (l.organization_id is not null and public.is_org_member(l.organization_id)))
  );
$$;

create or replace function public.is_listing_public(p_listing uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.listings l
    where l.id = p_listing
      and l.status in ('published', 'reserved')
      and l.moderation_status <> 'blocked'
      and l.deleted_at is null
  );
$$;

create or replace function public.is_property_public(p_property uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.listings l
    where l.property_id = p_property
      and l.status in ('published', 'reserved')
      and l.moderation_status <> 'blocked'
      and l.deleted_at is null
  );
$$;

create or replace function public.is_conversation_participant(p_conversation uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = p_conversation and cp.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.conversations c
      where c.id = p_conversation
        and c.organization_id is not null
        and public.is_org_member(c.organization_id)
    );
$$;

create or replace function public.can_post_in_conversation(p_conversation uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_conversation_participant(p_conversation)
    and public.is_active_user()
    and not exists (
      select 1
      from public.conversation_participants cp
      join public.user_blocks b
        on (b.blocker_id = cp.user_id and b.blocked_id = (select auth.uid()))
        or (b.blocker_id = (select auth.uid()) and b.blocked_id = cp.user_id)
      where cp.conversation_id = p_conversation
        and cp.user_id <> (select auth.uid())
    );
$$;

create or replace function public.shares_conversation_with(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_participants a
    join public.conversation_participants b on b.conversation_id = a.conversation_id
    where a.user_id = (select auth.uid()) and b.user_id = p_user
  );
$$;

create or replace function public.can_read_document(p_document uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.property_documents d
    join public.properties p on p.id = d.property_id
    where d.id = p_document
      and d.deleted_at is null
      and (
        p.owner_id = (select auth.uid())
        or (d.visibility in ('organization', 'public') and p.organization_id is not null
            and public.is_org_member(p.organization_id))
        or (d.visibility = 'public' and public.is_property_public(p.id))
        or exists (
          select 1 from public.document_access_grants g
          where g.document_id = d.id
            and g.grantee_id = (select auth.uid())
            and g.revoked_at is null
            and (g.expires_at is null or g.expires_at > now())
        )
      )
  );
$$;

create or replace function public.can_manage_document(p_document uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.property_documents d
    join public.properties p on p.id = d.property_id
    where d.id = p_document
      and p.deleted_at is null
      and (
        p.owner_id = (select auth.uid())
        or d.uploaded_by = (select auth.uid())
        or (d.visibility <> 'owner' and p.organization_id is not null and public.is_org_member(p.organization_id))
      )
  );
$$;

create or replace function public.can_read_document_object(p_path text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.property_documents d
    where d.storage_path = p_path and public.can_read_document(d.id)
  );
$$;

create or replace function public.is_public_dossier_object(p_path text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.generated_dossiers d
    join public.listings l on l.property_id = d.property_id
    where d.storage_path = p_path
      and d.is_public
      and d.status = 'ready'
      and l.dossier_public
      and l.status in ('published', 'reserved')
      and l.moderation_status <> 'blocked'
      and l.deleted_at is null
  );
$$;

create or replace function public.feature_setting(p_key text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select value from public.feature_settings where key = p_key;
$$;

-- -----------------------------------------------------------------------------
-- Rate Limiting (Fixed Window). Nur intern bzw. über Service Role aufrufbar.
-- -----------------------------------------------------------------------------
create or replace function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.rate_limit_buckets as b (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = b.hits + 1
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;

create or replace function public.enforce_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.check_rate_limit(p_key, p_limit, p_window_seconds) then
    raise exception 'rate_limited' using hint = 'Zu viele Anfragen. Bitte später erneut versuchen.';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Benachrichtigungen (intern)
-- -----------------------------------------------------------------------------
create or replace function public.notify_user(
  p_user uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link text,
  p_data jsonb default '{}'::jsonb,
  p_group_key text default null
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if p_user is null then
    return;
  end if;
  if p_group_key is not null then
    update public.notifications
       set title = left(p_title, 160),
           body = left(p_body, 500),
           link = p_link,
           data = p_data || jsonb_build_object('count', coalesce((data ->> 'count')::int, 1) + 1),
           created_at = now()
     where user_id = p_user and group_key = p_group_key and read_at is null;
    if found then
      return;
    end if;
  end if;
  insert into public.notifications (user_id, type, title, body, link, data, group_key)
  values (p_user, p_type, left(p_title, 160), left(p_body, 500), p_link, p_data, p_group_key);
end;
$$;

-- E-Mail in die Outbox legen, sofern der Empfänger diese Kategorie nicht abbestellt hat
create or replace function public.queue_email(
  p_user uuid,
  p_template text,
  p_payload jsonb,
  p_setting text default null,
  p_dedupe_key text default null,
  p_delay interval default interval '0 seconds'
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_enabled boolean := true;
begin
  if p_user is null then
    return;
  end if;
  if p_setting is not null then
    execute format('select %I from public.user_notification_settings where user_id = $1', p_setting)
      into v_enabled using p_user;
  end if;
  if coalesce(v_enabled, true) then
    insert into public.email_outbox (user_id, template, payload, dedupe_key, scheduled_at)
    values (p_user, p_template, p_payload, p_dedupe_key, now() + p_delay)
    on conflict (dedupe_key) do nothing;
  end if;
end;
$$;

-- Wochentag und Zeit in Schweizer Schreibweise, z. B. «Sa, 14.11.2026, 10:00»
create or replace function public.format_ch_datetime(p_ts timestamptz)
returns text
language sql stable set search_path = ''
as $$
  select (array['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'])[extract(dow from p_ts at time zone 'Europe/Zurich')::int + 1]
         || ', ' || to_char(p_ts at time zone 'Europe/Zurich', 'DD.MM.YYYY, HH24:MI');
$$;

-- -----------------------------------------------------------------------------
-- Auth: Profile anlegen und synchron halten
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_first text := left(nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''), 80);
  v_last text := left(nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''), 80);
  v_account public.account_type := case
    when new.raw_user_meta_data ->> 'account_type' = 'business' then 'business'::public.account_type
    else 'private'::public.account_type end;
  v_display text;
begin
  v_display := left(coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    case when v_first is not null then v_first || coalesce(' ' || left(v_last, 1) || '.', '') end,
    'Immovia-Mitglied'
  ), 80);

  insert into public.profiles (id, email, email_verified_at, first_name, last_name, display_name, account_type)
  values (new.id, new.email, new.email_confirmed_at, v_first, v_last, v_display, v_account);

  insert into public.public_profiles (id, display_name, account_type, member_since, email_verified)
  values (new.id, v_display, v_account, now(), new.email_confirmed_at is not null);

  insert into public.user_preferences (user_id) values (new.id);
  insert into public.user_notification_settings (user_id) values (new.id);

  if new.email_confirmed_at is not null then
    perform public.queue_email(new.id, 'welcome', '{}'::jsonb, null, 'welcome:' || new.id);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_auth_user_updated()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.email is distinct from old.email or new.email_confirmed_at is distinct from old.email_confirmed_at then
    update public.profiles
       set email = new.email, email_verified_at = new.email_confirmed_at
     where id = new.id;
    update public.public_profiles
       set email_verified = new.email_confirmed_at is not null
     where id = new.id;
  end if;

  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    perform public.queue_email(new.id, 'welcome', '{}'::jsonb, null, 'welcome:' || new.id);
  end if;

  if old.email is not null and new.email is distinct from old.email then
    insert into public.email_outbox (user_id, to_email, template, payload)
    values (new.id, old.email, 'account_change', jsonb_build_object('change', 'email'));
  end if;

  if new.encrypted_password is distinct from old.encrypted_password and old.encrypted_password is not null then
    insert into public.email_outbox (user_id, template, payload)
    values (new.id, 'account_change', jsonb_build_object('change', 'password'));
  end if;
  return new;
end;
$$;

create trigger on_auth_user_updated
  after update of email, email_confirmed_at, encrypted_password on auth.users
  for each row execute function public.handle_auth_user_updated();

create or replace function public.sync_public_profile()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.public_profiles
     set display_name = new.display_name,
         avatar_path = new.avatar_path,
         account_type = new.account_type,
         updated_at = now()
   where id = new.id;
  return new;
end;
$$;

create trigger profiles_sync_public
  after update of display_name, avatar_path, account_type on public.profiles
  for each row execute function public.sync_public_profile();

-- -----------------------------------------------------------------------------
-- Inserate: Synchronisation mit Immobilie, Statusprüfung, Historie
-- -----------------------------------------------------------------------------
create or replace function public.property_type_slug(p_type public.property_type)
returns text
language sql immutable set search_path = ''
as $$
  select case p_type
    when 'apartment' then 'wohnung'
    when 'single_family_house' then 'einfamilienhaus'
    when 'semi_detached_house' then 'doppeleinfamilienhaus'
    when 'terraced_house' then 'reihenhaus'
    when 'multi_family_house' then 'mehrfamilienhaus'
    when 'plot' then 'grundstueck'
    when 'commercial' then 'gewerbeobjekt'
    when 'office' then 'buero'
    when 'new_build_project' then 'neubauprojekt'
    else 'immobilie' end;
$$;

create or replace function public.assert_listing_transition(p_from public.listing_status, p_to public.listing_status)
returns void
language plpgsql immutable set search_path = ''
as $$
declare
  v_allowed public.listing_status[];
begin
  v_allowed := case p_from
    when 'draft' then array['in_progress', 'ready', 'pending_review', 'published', 'archived']
    when 'in_progress' then array['draft', 'ready', 'pending_review', 'published', 'archived']
    when 'ready' then array['draft', 'in_progress', 'pending_review', 'published', 'archived']
    when 'pending_review' then array['in_progress', 'ready', 'archived']
    when 'published' then array['paused', 'reserved', 'sold', 'rented', 'archived', 'in_progress']
    when 'paused' then array['published', 'pending_review', 'in_progress', 'archived', 'sold', 'rented']
    when 'reserved' then array['published', 'paused', 'sold', 'rented', 'archived']
    when 'sold' then array['archived']
    when 'rented' then array['archived', 'in_progress']
    when 'archived' then array[]::text[]
  end::public.listing_status[];
  if not (p_to = any (v_allowed)) then
    raise exception 'invalid_status_transition'
      using detail = format('%s -> %s', p_from, p_to);
  end if;
end;
$$;

create or replace function public.listings_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_prop public.properties%rowtype;
  v_privileged boolean := public.is_privileged_context();
  v_require_review boolean := coalesce((public.feature_setting('publishing') ->> 'require_review')::boolean, false);
  v_min_images integer := coalesce((public.feature_setting('publishing') ->> 'min_images')::int, 1);
  v_missing text[] := '{}';
begin
  select * into v_prop from public.properties where id = new.property_id;
  if not found then
    raise exception 'not_found' using detail = 'property';
  end if;

  if tg_op = 'INSERT' then
    if not v_privileged then
      new.status := 'draft';
      new.moderation_status := 'ok';
      new.moderation_reason := null;
      new.approved_at := null;
      new.approved_by := null;
      new.is_demo := false;
      new.view_count := 0;
      new.slug := null;
      new.published_at := null;
      new.first_published_at := null;
    end if;
  else
    new.property_id := old.property_id;
    if not v_privileged then
      new.moderation_status := old.moderation_status;
      new.moderation_reason := old.moderation_reason;
      new.approved_at := old.approved_at;
      new.approved_by := old.approved_by;
      new.is_demo := old.is_demo;
      new.view_count := old.view_count;
      new.published_at := old.published_at;
      new.first_published_at := old.first_published_at;
    end if;
    if old.slug is not null then
      new.slug := old.slug;
    end if;
    if new.deleted_at is not null and old.deleted_at is null then
      new.status := 'archived';
    end if;
    if old.deleted_at is not null and not v_privileged then
      raise exception 'not_found' using detail = 'listing deleted';
    end if;
  end if;

  -- Besitzverhältnisse immer aus der Immobilie
  new.owner_id := v_prop.owner_id;
  new.organization_id := v_prop.organization_id;

  -- Öffentlicher Ausschnitt der Objektdaten
  new.offer_type := v_prop.offer_type;
  new.property_type := v_prop.property_type;
  new.postal_code := v_prop.postal_code;
  new.municipality := v_prop.municipality;
  new.canton := v_prop.canton;
  new.rooms := v_prop.rooms;
  new.living_area := v_prop.living_area;
  new.usable_area := v_prop.usable_area;
  new.plot_area := v_prop.plot_area;
  new.year_built := v_prop.year_built;
  new.year_renovated := v_prop.year_renovated;
  new.floor := v_prop.floor;
  new.floors_total := v_prop.floors_total;
  new.bathrooms := v_prop.bathrooms;
  new.condition := v_prop.condition;
  new.heating_type := v_prop.heating_type;
  new.energy_label := v_prop.energy_label;
  new.has_balcony := v_prop.has_balcony;
  new.has_terrace := v_prop.has_terrace;
  new.has_garden := v_prop.has_garden;
  new.has_garage := v_prop.has_garage;
  new.has_elevator := v_prop.has_elevator;
  new.has_cellar := v_prop.has_cellar;
  new.has_attic := v_prop.has_attic;
  new.is_wheelchair_accessible := v_prop.is_wheelchair_accessible;
  new.is_minergie := v_prop.is_minergie;
  new.pets_allowed := v_prop.pets_allowed;
  new.parking_spaces := coalesce(v_prop.garage_spaces, 0) + coalesce(v_prop.underground_parking_spaces, 0)
                        + coalesce(v_prop.outdoor_parking_spaces, 0);
  new.available_from := v_prop.available_from;
  new.available_by_arrangement := v_prop.available_by_arrangement;
  new.ownership_type := v_prop.ownership_type;
  if not v_privileged or tg_op = 'UPDATE' then
    new.is_demo := coalesce(new.is_demo, false) and v_prop.is_demo;
  end if;

  -- Standortanzeige gemäss gewählter Genauigkeit
  new.public_address := case new.location_precision
    when 'exact' then nullif(concat_ws(', ',
      nullif(trim(concat_ws(' ', v_prop.street, v_prop.house_number)), ''),
      nullif(trim(concat_ws(' ', v_prop.postal_code, v_prop.municipality)), '')), '')
    when 'street' then nullif(concat_ws(', ',
      nullif(trim(coalesce(v_prop.street, '')), ''),
      nullif(trim(concat_ws(' ', v_prop.postal_code, v_prop.municipality)), '')), '')
    else nullif(trim(concat_ws(' ', v_prop.postal_code, v_prop.municipality)), '')
  end;
  new.public_latitude := case
    when v_prop.latitude is null then null
    when new.location_precision = 'exact' then v_prop.latitude
    when new.location_precision = 'street' then round(v_prop.latitude::numeric, 3)::double precision
    else round(v_prop.latitude::numeric, 2)::double precision end;
  new.public_longitude := case
    when v_prop.longitude is null then null
    when new.location_precision = 'exact' then v_prop.longitude
    when new.location_precision = 'street' then round(v_prop.longitude::numeric, 3)::double precision
    else round(v_prop.longitude::numeric, 2)::double precision end;

  -- Statuswechsel prüfen
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if not v_privileged then
      perform public.assert_listing_transition(old.status, new.status);
    end if;
    new.status_changed_at := now();
  end if;

  if (tg_op = 'INSERT' and new.status in ('published', 'pending_review'))
     or (tg_op = 'UPDATE' and new.status in ('published', 'pending_review') and new.status is distinct from old.status) then
    if new.moderation_status = 'blocked' then
      raise exception 'listing_blocked';
    end if;
    if exists (select 1 from public.profiles where id = new.owner_id and status <> 'active') then
      raise exception 'account_inactive';
    end if;
    if coalesce(trim(new.title), '') = '' then v_missing := v_missing || 'title'; end if;
    if coalesce(trim(new.description), '') = '' then v_missing := v_missing || 'description'; end if;
    if new.price is null and not new.price_on_request then v_missing := v_missing || 'price'; end if;
    if new.postal_code is null or new.municipality is null then v_missing := v_missing || 'location'; end if;
    if new.texts_confirmed_at is null then v_missing := v_missing || 'texts_confirmed'; end if;
    if (select count(*) from public.property_images i
         where i.property_id = new.property_id and i.status = 'ready') < v_min_images then
      v_missing := v_missing || 'images';
    end if;
    if cardinality(v_missing) > 0 then
      raise exception 'listing_incomplete' using detail = array_to_string(v_missing, ',');
    end if;
    if new.status = 'published' and v_require_review and new.approved_at is null and not v_privileged then
      raise exception 'review_required';
    end if;
  end if;

  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := now();
    new.first_published_at := coalesce(new.first_published_at, now());
    if new.slug is null then
      new.slug := left(public.slugify(concat_ws(' ',
          public.property_type_slug(new.property_type),
          case when new.rooms is null then null
               when new.rooms = trunc(new.rooms) then trunc(new.rooms)::int::text || ' zimmer'
               else trim(to_char(new.rooms, 'FM990.0')) || ' zimmer' end,
          new.municipality)), 80)
        || '-' || left(replace(new.id::text, '-', ''), 6);
      new.slug := trim(both '-' from new.slug);
    end if;
  end if;

  if new.status in ('sold', 'rented') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.closed_at := now();
  end if;
  return new;
end;
$$;

create trigger listings_before_write
  before insert or update on public.listings
  for each row execute function public.listings_before_write();

create or replace function public.listings_after_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_became_public boolean;
begin
  if tg_op = 'INSERT' then
    insert into public.listing_status_history (listing_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, (select auth.uid()));
  elsif new.status is distinct from old.status then
    insert into public.listing_status_history (listing_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, (select auth.uid()));
  end if;

  if tg_op = 'INSERT'
     or new.status is distinct from old.status
     or new.moderation_status is distinct from old.moderation_status
     or new.deleted_at is distinct from old.deleted_at then
    update public.public_profiles pp
       set has_public_listings = exists (
             select 1 from public.listings l
             where l.owner_id = new.owner_id
               and l.status in ('published', 'reserved')
               and l.moderation_status <> 'blocked'
               and l.deleted_at is null),
           updated_at = now()
     where pp.id = new.owner_id;
  end if;

  v_became_public := new.status = 'published'
    and new.moderation_status <> 'blocked'
    and new.deleted_at is null
    and (tg_op = 'INSERT' or old.status is distinct from 'published');

  if v_became_public then
    if new.first_published_at = new.published_at then
      perform public.notify_user(new.owner_id, 'listing_published',
        'Ihr Inserat ist online', coalesce(new.title, 'Inserat'),
        '/immobilien/' || new.slug, jsonb_build_object('listing_id', new.id));
      perform public.queue_email(new.owner_id, 'listing_published',
        jsonb_build_object('listing_id', new.id, 'title', new.title, 'slug', new.slug),
        'email_listing_updates', 'listing_published:' || new.id);
    end if;
    if not new.is_demo then
      perform public.queue_search_alerts(new.id);
    end if;
  end if;
  return null;
end;
$$;

create trigger listings_after_write
  after insert or update on public.listings
  for each row execute function public.listings_after_write();

-- Änderungen an der Immobilie in das Inserat übernehmen
create or replace function public.properties_sync_listings()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.listings
     set updated_at = now()
   where property_id = new.id
     and deleted_at is null
     and status <> 'archived';
  return null;
end;
$$;

create trigger properties_sync_listings
  after update on public.properties
  for each row execute function public.properties_sync_listings();

-- Organisationszuordnung nur zu eigenen Organisationen
create or replace function public.properties_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if public.is_privileged_context() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.owner_id := (select auth.uid());
    new.is_demo := false;
  else
    new.owner_id := old.owner_id;
    new.is_demo := old.is_demo;
  end if;
  if new.organization_id is not null
     and (tg_op = 'INSERT' or new.organization_id is distinct from old.organization_id)
     and not public.is_org_member(new.organization_id) then
    raise exception 'forbidden' using detail = 'organization';
  end if;
  return new;
end;
$$;

create trigger properties_before_write
  before insert or update on public.properties
  for each row execute function public.properties_before_write();

-- -----------------------------------------------------------------------------
-- Bilder: genau ein Titelbild, KI-Kennzeichnung geschützt
-- -----------------------------------------------------------------------------
create or replace function public.property_images_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
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
  end if;
  if new.is_cover and (tg_op = 'INSERT' or not old.is_cover) then
    update public.property_images
       set is_cover = false
     where property_id = new.property_id and id <> new.id and is_cover;
  end if;
  return new;
end;
$$;

create trigger property_images_before_write
  before insert or update on public.property_images
  for each row execute function public.property_images_before_write();

-- -----------------------------------------------------------------------------
-- Nachrichten: Rate Limit, Konversation aktualisieren, Empfänger benachrichtigen
-- -----------------------------------------------------------------------------
create or replace function public.messages_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.created_at := now();
  new.edited_at := null;
  new.deleted_at := null;
  -- Datenbankfunktionen (Anfrage, Besichtigung) markieren vertrauenswürdige Einträge
  if not public.is_privileged_context()
     and coalesce(current_setting('immovia.trusted_insert', true), 'off') <> 'on' then
    new.sender_id := (select auth.uid());
    new.kind := 'text';
    perform public.enforce_rate_limit('msg_min:' || new.sender_id, 20, 60);
    perform public.enforce_rate_limit('msg_day:' || new.sender_id, 400, 86400);
  end if;
  if new.attachment_path is not null
     and split_part(new.attachment_path, '/', 1) <> new.conversation_id::text then
    raise exception 'forbidden' using detail = 'attachment path';
  end if;
  return new;
end;
$$;

create trigger messages_before_insert
  before insert on public.messages
  for each row execute function public.messages_before_insert();

create or replace function public.messages_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_conv public.conversations%rowtype;
  v_sender_name text;
  v_listing_title text;
  r record;
begin
  select * into v_conv from public.conversations where id = new.conversation_id;

  update public.conversations
     set last_message_at = new.created_at,
         last_message_preview = left(regexp_replace(new.body, '\s+', ' ', 'g'), 140)
   where id = new.conversation_id;

  update public.conversation_participants
     set archived_at = null
   where conversation_id = new.conversation_id;

  if new.sender_id is not null then
    update public.conversation_participants
       set last_read_at = new.created_at
     where conversation_id = new.conversation_id and user_id = new.sender_id;
  end if;

  if coalesce(current_setting('immovia.suppress_message_notifications', true), 'off') = 'on' then
    return null;
  end if;

  select display_name into v_sender_name from public.public_profiles where id = new.sender_id;
  select title into v_listing_title from public.listings where id = v_conv.listing_id;

  for r in
    select cp.user_id
    from public.conversation_participants cp
    where cp.conversation_id = new.conversation_id
      and cp.user_id is distinct from new.sender_id
  loop
    if new.sender_id is not null and exists (
      select 1 from public.user_blocks b where b.blocker_id = r.user_id and b.blocked_id = new.sender_id
    ) then
      continue;
    end if;

    perform public.notify_user(
      r.user_id,
      'new_message',
      case when new.kind = 'system' then 'Neuigkeit zu Ihrer Konversation'
           else 'Neue Nachricht von ' || coalesce(v_sender_name, 'einem Mitglied') end,
      left(new.body, 140),
      '/dashboard/nachrichten/' || new.conversation_id,
      jsonb_build_object('conversation_id', new.conversation_id),
      'conv:' || new.conversation_id
    );

    if new.kind = 'text' then
      perform public.queue_email(
        r.user_id,
        'new_message',
        jsonb_build_object(
          'conversation_id', new.conversation_id,
          'message_id', new.id,
          'sender_name', coalesce(v_sender_name, 'Ein Mitglied'),
          'listing_title', v_listing_title,
          'preview', left(new.body, 400)
        ),
        'email_new_message',
        'msg:' || new.conversation_id || ':' || r.user_id || ':' || floor(extract(epoch from now()) / 900)::bigint,
        interval '3 minutes'
      );
    end if;
  end loop;
  return null;
end;
$$;

create trigger messages_after_insert
  after insert on public.messages
  for each row execute function public.messages_after_insert();

-- -----------------------------------------------------------------------------
-- Weitere Schutz-Trigger
-- -----------------------------------------------------------------------------
create or replace function public.user_reports_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_privileged_context() then
    new.reporter_id := (select auth.uid());
    new.status := 'open';
    new.handled_by := null;
    new.handled_at := null;
    new.resolution_note := null;
    perform public.enforce_rate_limit('report:' || new.reporter_id, 10, 3600);
  end if;
  return new;
end;
$$;

create trigger user_reports_before_insert
  before insert on public.user_reports
  for each row execute function public.user_reports_before_insert();

create or replace function public.audit_log_immutable()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'admin_audit_logs ist unveränderlich';
end;
$$;

create trigger admin_audit_logs_immutable
  before update or delete on public.admin_audit_logs
  for each row execute function public.audit_log_immutable();

-- Zeitfenster mit aktiven Terminen dürfen nicht gelöscht werden (stattdessen absagen)
create or replace function public.viewing_slots_before_delete()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.viewing_appointments a
    where a.slot_id = old.id and a.status in ('requested', 'confirmed', 'reschedule_requested')
  ) then
    raise exception 'slot_has_appointments';
  end if;
  return old;
end;
$$;

create trigger viewing_slots_before_delete
  before delete on public.viewing_slots
  for each row execute function public.viewing_slots_before_delete();

create or replace function public.viewing_slots_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_privileged_context() then
    if tg_op = 'INSERT' then
      new.created_by := (select auth.uid());
      if new.starts_at < now() then
        raise exception 'slot_in_past';
      end if;
    else
      new.listing_id := old.listing_id;
      if (new.starts_at, new.ends_at) is distinct from (old.starts_at, old.ends_at) and exists (
        select 1 from public.viewing_appointments a
        where a.slot_id = old.id and a.status in ('requested', 'confirmed', 'reschedule_requested')
      ) then
        raise exception 'slot_has_appointments';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger viewing_slots_before_write
  before insert or update on public.viewing_slots
  for each row execute function public.viewing_slots_before_write();

create or replace function public.listing_views_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.listings set view_count = view_count + 1 where id = new.listing_id;
  return null;
end;
$$;

create trigger listing_views_after_insert
  after insert on public.listing_views
  for each row execute function public.listing_views_after_insert();

-- Öffentliche Verifizierungsflags pflegen
create or replace function public.verifications_after_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.subject_type = 'user' and new.kind = 'identity' then
    update public.public_profiles
       set identity_verified = exists (
         select 1 from public.verifications v
         where v.subject_type = 'user' and v.subject_id = new.subject_id
           and v.kind = 'identity' and v.status = 'verified')
     where id = new.subject_id;
  end if;
  return null;
end;
$$;

create trigger verifications_after_write
  after insert or update on public.verifications
  for each row execute function public.verifications_after_write();
