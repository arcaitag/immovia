-- =============================================================================
-- Immovia · Migration 7: API-Funktionen (RPC)
-- Kritische Abläufe laufen atomar in einer Transaktion.
-- Fehlercodes werden als Meldungstext geworfen (siehe src/lib/errors.ts).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Immobiliensuche
-- -----------------------------------------------------------------------------
create or replace function public.search_listings(
  p_offer_type public.offer_type default null,
  p_property_types public.property_type[] default null,
  p_canton text default null,
  p_municipality text default null,
  p_postal_code text default null,
  p_query text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km double precision default null,
  p_bbox double precision[] default null,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_rooms_min numeric default null,
  p_rooms_max numeric default null,
  p_area_min numeric default null,
  p_area_max numeric default null,
  p_plot_min numeric default null,
  p_year_min integer default null,
  p_conditions public.property_condition[] default null,
  p_balcony boolean default null,
  p_terrace boolean default null,
  p_garden boolean default null,
  p_parking boolean default null,
  p_garage boolean default null,
  p_elevator boolean default null,
  p_pets boolean default null,
  p_new_build boolean default null,
  p_wheelchair boolean default null,
  p_listing_ids uuid[] default null,
  p_sort text default 'newest',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  title text,
  search_summary text,
  offer_type public.offer_type,
  property_type public.property_type,
  status public.listing_status,
  price numeric,
  price_on_request boolean,
  additional_costs numeric,
  rooms numeric,
  living_area numeric,
  plot_area numeric,
  floor smallint,
  municipality text,
  postal_code text,
  canton text,
  public_address text,
  public_latitude double precision,
  public_longitude double precision,
  location_precision public.location_precision,
  has_balcony boolean,
  has_terrace boolean,
  has_garden boolean,
  has_elevator boolean,
  parking_spaces smallint,
  condition public.property_condition,
  year_built smallint,
  published_at timestamptz,
  is_demo boolean,
  cover_path text,
  cover_external_url text,
  image_count integer,
  distance_km double precision,
  total_count bigint
)
language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 24), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_lat_delta double precision;
  v_lng_delta double precision;
  v_query text := nullif(trim(coalesce(p_query, '')), '');
begin
  if p_lat is not null and p_lng is not null and coalesce(p_radius_km, 0) > 0 then
    v_lat_delta := p_radius_km / 111.0;
    v_lng_delta := p_radius_km / (111.0 * cos(radians(p_lat)));
  end if;

  return query
  with base as (
    select l.*,
      case when p_lat is not null and p_lng is not null and l.public_latitude is not null then
        6371.0 * 2 * asin(sqrt(
          power(sin(radians(l.public_latitude - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(l.public_latitude))
          * power(sin(radians(l.public_longitude - p_lng) / 2), 2)))
      end as dist,
      case when l.offer_type = 'rent' then coalesce(l.price, 0) + coalesce(l.additional_costs, 0)
           else l.price end as effective_price
    from public.listings l
    where l.status in ('published', 'reserved')
      and l.moderation_status <> 'blocked'
      and l.deleted_at is null
      and (p_listing_ids is null or l.id = any (p_listing_ids))
      and (p_offer_type is null or l.offer_type = p_offer_type)
      and (p_property_types is null or cardinality(p_property_types) = 0 or l.property_type = any (p_property_types))
      and (p_canton is null or l.canton = upper(p_canton))
      and (p_municipality is null or lower(l.municipality) = lower(p_municipality))
      and (p_postal_code is null or l.postal_code = p_postal_code)
      and (v_query is null
           or l.municipality ilike v_query || '%'
           or l.postal_code like v_query || '%'
           or l.canton = upper(v_query)
           or l.title ilike '%' || v_query || '%')
      and (v_lat_delta is null or (
           l.public_latitude between p_lat - v_lat_delta and p_lat + v_lat_delta
           and l.public_longitude between p_lng - v_lng_delta and p_lng + v_lng_delta))
      and (p_bbox is null or cardinality(p_bbox) <> 4 or (
           l.public_latitude between p_bbox[1] and p_bbox[3]
           and l.public_longitude between p_bbox[2] and p_bbox[4]))
      and (p_rooms_min is null or l.rooms >= p_rooms_min)
      and (p_rooms_max is null or l.rooms <= p_rooms_max)
      and (p_area_min is null or coalesce(l.living_area, l.usable_area) >= p_area_min)
      and (p_area_max is null or coalesce(l.living_area, l.usable_area) <= p_area_max)
      and (p_plot_min is null or l.plot_area >= p_plot_min)
      and (p_year_min is null or l.year_built >= p_year_min)
      and (p_conditions is null or cardinality(p_conditions) = 0 or l.condition = any (p_conditions))
      and (p_balcony is not true or l.has_balcony)
      and (p_terrace is not true or l.has_terrace)
      and (p_garden is not true or l.has_garden)
      and (p_parking is not true or l.parking_spaces > 0 or l.has_garage)
      and (p_garage is not true or l.has_garage)
      and (p_elevator is not true or l.has_elevator)
      and (p_pets is not true or l.pets_allowed is true)
      and (p_new_build is not true or l.condition = 'new_build' or l.property_type = 'new_build_project')
      and (p_wheelchair is not true or l.is_wheelchair_accessible)
  ), filtered as (
    select b.* from base b
    where (p_price_min is null or (not b.price_on_request and b.effective_price >= p_price_min))
      and (p_price_max is null or (not b.price_on_request and b.effective_price <= p_price_max))
      and (v_lat_delta is null or b.dist <= p_radius_km)
  )
  select
    f.id, f.slug, f.title, f.search_summary, f.offer_type, f.property_type, f.status,
    f.price, f.price_on_request, f.additional_costs, f.rooms, f.living_area, f.plot_area, f.floor,
    f.municipality, f.postal_code, f.canton, f.public_address, f.public_latitude, f.public_longitude,
    f.location_precision, f.has_balcony, f.has_terrace, f.has_garden, f.has_elevator, f.parking_spaces,
    f.condition, f.year_built, f.published_at, f.is_demo,
    cover.display_path, cover.external_url,
    (select count(*)::int from public.property_images pi
      where pi.property_id = f.property_id and pi.status = 'ready'),
    f.dist,
    count(*) over ()
  from filtered f
  left join lateral (
    select pi.display_path, pi.external_url
    from public.property_images pi
    where pi.property_id = f.property_id and pi.status = 'ready' and not pi.is_floor_plan
    order by pi.is_cover desc, pi.sort_order asc, pi.created_at asc
    limit 1
  ) cover on true
  order by
    case when p_sort = 'price_asc' then f.effective_price end asc nulls last,
    case when p_sort = 'price_desc' then f.effective_price end desc nulls last,
    case when p_sort = 'area_desc' then coalesce(f.living_area, f.usable_area) end desc nulls last,
    case when p_sort = 'distance' then f.dist end asc nulls last,
    f.published_at desc nulls last,
    f.id
  limit v_limit offset v_offset;
end;
$$;

-- Prüft, ob ein Inserat zu gespeicherten Suchkriterien passt (gleiche Logik wie die Suche)
create or replace function public.saved_search_matches_listing(p_criteria jsonb, p_listing_id uuid)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_types public.property_type[];
  v_conditions public.property_condition[];
begin
  select array_agg(x::public.property_type) into v_types
  from jsonb_array_elements_text(coalesce(p_criteria -> 'types', '[]'::jsonb)) x;
  select array_agg(x::public.property_condition) into v_conditions
  from jsonb_array_elements_text(coalesce(p_criteria -> 'conditions', '[]'::jsonb)) x;

  return exists (
    select 1 from public.search_listings(
      p_offer_type => (p_criteria ->> 'offer')::public.offer_type,
      p_property_types => v_types,
      p_canton => p_criteria ->> 'canton',
      p_municipality => p_criteria ->> 'municipality',
      p_postal_code => p_criteria ->> 'postal_code',
      p_query => p_criteria ->> 'q',
      p_lat => (p_criteria ->> 'lat')::double precision,
      p_lng => (p_criteria ->> 'lng')::double precision,
      p_radius_km => (p_criteria ->> 'radius')::double precision,
      p_price_min => (p_criteria ->> 'price_min')::numeric,
      p_price_max => (p_criteria ->> 'price_max')::numeric,
      p_rooms_min => (p_criteria ->> 'rooms_min')::numeric,
      p_rooms_max => (p_criteria ->> 'rooms_max')::numeric,
      p_area_min => (p_criteria ->> 'area_min')::numeric,
      p_area_max => (p_criteria ->> 'area_max')::numeric,
      p_plot_min => (p_criteria ->> 'plot_min')::numeric,
      p_year_min => (p_criteria ->> 'year_min')::integer,
      p_conditions => v_conditions,
      p_balcony => (p_criteria ->> 'balcony')::boolean,
      p_terrace => (p_criteria ->> 'terrace')::boolean,
      p_garden => (p_criteria ->> 'garden')::boolean,
      p_parking => (p_criteria ->> 'parking')::boolean,
      p_garage => (p_criteria ->> 'garage')::boolean,
      p_elevator => (p_criteria ->> 'elevator')::boolean,
      p_pets => (p_criteria ->> 'pets')::boolean,
      p_new_build => (p_criteria ->> 'new_build')::boolean,
      p_wheelchair => (p_criteria ->> 'wheelchair')::boolean,
      p_listing_ids => array[p_listing_id],
      p_limit => 1
    )
  );
exception when invalid_text_representation or invalid_parameter_value then
  return false;
end;
$$;

-- Beim Veröffentlichen passende Suchabos benachrichtigen (je Suchabo und Inserat einmal)
create or replace function public.queue_search_alerts(p_listing_id uuid)
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_listing public.listings%rowtype;
  v_count integer := 0;
  r record;
begin
  select * into v_listing from public.listings where id = p_listing_id;
  if not found then
    return 0;
  end if;

  for r in
    select s.id, s.user_id, s.name, s.criteria, s.alert_frequency
    from public.saved_searches s
    join public.profiles p on p.id = s.user_id and p.status = 'active'
    where s.alert_enabled
      and s.user_id <> v_listing.owner_id
      and (s.criteria ->> 'offer' is null or s.criteria ->> 'offer' = v_listing.offer_type::text)
  loop
    if public.saved_search_matches_listing(r.criteria, p_listing_id) then
      insert into public.saved_search_matches (saved_search_id, listing_id)
      values (r.id, p_listing_id)
      on conflict do nothing;
      if found then
        v_count := v_count + 1;
        perform public.notify_user(r.user_id, 'search_alert',
          'Neues Inserat für «' || r.name || '»',
          coalesce(v_listing.title, 'Neues Inserat'),
          '/immobilien/' || v_listing.slug,
          jsonb_build_object('saved_search_id', r.id, 'listing_id', p_listing_id));
        if r.alert_frequency = 'instant' then
          perform public.queue_email(r.user_id, 'search_alert',
            jsonb_build_object('saved_search_id', r.id, 'search_name', r.name,
                               'listing_ids', jsonb_build_array(p_listing_id)),
            'email_search_alerts', 'search_alert:' || r.id || ':' || p_listing_id);
          update public.saved_search_matches set notified_at = now()
           where saved_search_id = r.id and listing_id = p_listing_id;
          update public.saved_searches set last_notified_at = now() where id = r.id;
        end if;
      end if;
    end if;
  end loop;
  return v_count;
end;
$$;

-- Verfügbarkeit eines nicht mehr öffentlichen Inserats (für freundliche Hinweise)
create or replace function public.get_listing_availability(p_slug text)
returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when l.id is null then 'not_found'
    when l.deleted_at is not null or l.moderation_status = 'blocked' then 'unavailable'
    when l.status in ('published', 'reserved') then 'available'
    when l.status = 'sold' then 'sold'
    when l.status = 'rented' then 'rented'
    else 'unavailable' end
  from (select 1) dummy
  left join public.listings l on l.slug = p_slug;
$$;

-- -----------------------------------------------------------------------------
-- Interne Hilfe: Konversation zu Inserat und Interessent holen oder anlegen
-- -----------------------------------------------------------------------------
create or replace function public.ensure_conversation(p_listing public.listings, p_interested uuid)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_conv uuid;
begin
  insert into public.conversations (listing_id, seller_id, interested_id, organization_id, subject)
  values (p_listing.id, p_listing.owner_id, p_interested, p_listing.organization_id, p_listing.title)
  on conflict (listing_id, interested_id) where listing_id is not null and interested_id is not null
  do update set updated_at = now()
  returning id into v_conv;

  insert into public.conversation_participants (conversation_id, user_id, role)
  values (v_conv, p_listing.owner_id, 'seller'), (v_conv, p_interested, 'interested')
  on conflict (conversation_id, user_id) do nothing;
  return v_conv;
end;
$$;
revoke execute on function public.ensure_conversation(public.listings, uuid) from public, anon, authenticated;

create or replace function public.post_system_message(p_conversation uuid, p_sender uuid, p_body text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform set_config('immovia.trusted_insert', 'on', true);
  perform set_config('immovia.suppress_message_notifications', 'on', true);
  insert into public.messages (conversation_id, sender_id, kind, body)
  values (p_conversation, p_sender, 'system', p_body);
  perform set_config('immovia.suppress_message_notifications', 'off', true);
  perform set_config('immovia.trusted_insert', 'off', true);
end;
$$;
revoke execute on function public.post_system_message(uuid, uuid, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Kontaktanfrage zu einem Inserat
-- -----------------------------------------------------------------------------
create or replace function public.create_inquiry(
  p_listing_id uuid,
  p_message text,
  p_phone text default null,
  p_wants_viewing boolean default false,
  p_wants_dossier boolean default false
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_listing public.listings%rowtype;
  v_conv uuid;
  v_message text := trim(coalesce(p_message, ''));
  v_name text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_active_user() then
    raise exception 'account_inactive';
  end if;
  select * into v_listing from public.listings
   where id = p_listing_id and status in ('published', 'reserved')
     and moderation_status <> 'blocked' and deleted_at is null;
  if not found then
    raise exception 'not_found';
  end if;
  if public.can_manage_owner_org(v_listing.owner_id, v_listing.organization_id) then
    raise exception 'own_listing';
  end if;
  if exists (select 1 from public.user_blocks b
             where (b.blocker_id = v_listing.owner_id and b.blocked_id = v_uid)
                or (b.blocker_id = v_uid and b.blocked_id = v_listing.owner_id)) then
    raise exception 'blocked';
  end if;
  if char_length(v_message) < 10 or char_length(v_message) > 3000 then
    raise exception 'invalid_message';
  end if;
  if p_phone is not null and p_phone !~ '^\+?[0-9 ()/-]{6,24}$' then
    raise exception 'invalid_phone';
  end if;
  perform public.enforce_rate_limit('inquiry_hour:' || v_uid, 10, 3600);
  perform public.enforce_rate_limit('inquiry_day:' || v_uid, 30, 86400);

  v_conv := public.ensure_conversation(v_listing, v_uid);

  perform set_config('immovia.suppress_message_notifications', 'on', true);
  perform set_config('immovia.trusted_insert', 'on', true);
  insert into public.messages (conversation_id, sender_id, kind, body)
  values (v_conv, v_uid, 'text', v_message);
  perform set_config('immovia.trusted_insert', 'off', true);
  perform set_config('immovia.suppress_message_notifications', 'off', true);

  insert into public.leads (listing_id, owner_id, organization_id, interested_id, conversation_id, status, source)
  values (v_listing.id, v_listing.owner_id, v_listing.organization_id, v_uid, v_conv, 'new', 'inquiry')
  on conflict (listing_id, interested_id) where interested_id is not null
  do update set last_activity_at = now(), conversation_id = excluded.conversation_id;

  insert into public.listing_inquiries (listing_id, sender_id, conversation_id, message, phone, wants_viewing, wants_dossier)
  values (v_listing.id, v_uid, v_conv, v_message, nullif(trim(p_phone), ''), coalesce(p_wants_viewing, false),
          coalesce(p_wants_dossier, false));

  select display_name into v_name from public.public_profiles where id = v_uid;

  perform public.notify_user(v_listing.owner_id, 'new_inquiry',
    'Neue Anfrage zu «' || coalesce(v_listing.title, 'Ihrem Inserat') || '»',
    left(v_message, 140),
    '/dashboard/nachrichten/' || v_conv,
    jsonb_build_object('conversation_id', v_conv, 'listing_id', v_listing.id));
  perform public.queue_email(v_listing.owner_id, 'new_inquiry',
    jsonb_build_object('conversation_id', v_conv, 'listing_id', v_listing.id, 'listing_title', v_listing.title,
                       'sender_name', coalesce(v_name, 'Ein Mitglied'), 'preview', left(v_message, 400),
                       'wants_viewing', coalesce(p_wants_viewing, false), 'wants_dossier', coalesce(p_wants_dossier, false)),
    'email_new_inquiry', null);
  return v_conv;
end;
$$;

-- -----------------------------------------------------------------------------
-- Besichtigungen
-- -----------------------------------------------------------------------------
create or replace function public.get_viewing_slots(p_listing_id uuid)
returns table (
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity smallint,
  booked integer,
  available integer,
  note text,
  my_appointment_id uuid,
  my_status public.appointment_status
)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.starts_at, s.ends_at, s.capacity,
         count(a.id) filter (where a.status in ('requested', 'confirmed', 'reschedule_requested'))::int as booked,
         greatest(s.capacity - count(a.id) filter (where a.status in ('requested', 'confirmed', 'reschedule_requested')), 0)::int,
         s.note,
         (array_agg(a.id) filter (where a.guest_id = (select auth.uid()) and a.status <> 'cancelled'))[1],
         (array_agg(a.status) filter (where a.guest_id = (select auth.uid()) and a.status <> 'cancelled'))[1]
  from public.viewing_slots s
  left join public.viewing_appointments a on a.slot_id = s.id
  where s.listing_id = p_listing_id
    and not s.is_cancelled
    and s.starts_at > now()
    and (public.is_listing_public(p_listing_id) or public.can_manage_listing(p_listing_id))
  group by s.id
  order by s.starts_at;
$$;

create or replace function public.book_viewing(p_slot_id uuid, p_message text default null)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_slot public.viewing_slots%rowtype;
  v_listing public.listings%rowtype;
  v_booked integer;
  v_conv uuid;
  v_appointment uuid;
  v_when text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_active_user() then
    raise exception 'account_inactive';
  end if;

  -- Zeilensperre verhindert parallele Überbuchung
  select * into v_slot from public.viewing_slots where id = p_slot_id for update;
  if not found or v_slot.is_cancelled then
    raise exception 'not_found';
  end if;
  if v_slot.starts_at < now() + interval '1 hour' then
    raise exception 'slot_too_soon';
  end if;

  select * into v_listing from public.listings
   where id = v_slot.listing_id and status in ('published', 'reserved')
     and moderation_status <> 'blocked' and deleted_at is null;
  if not found then
    raise exception 'not_found';
  end if;
  if public.can_manage_owner_org(v_listing.owner_id, v_listing.organization_id) then
    raise exception 'own_listing';
  end if;
  if exists (select 1 from public.user_blocks b
             where (b.blocker_id = v_listing.owner_id and b.blocked_id = v_uid)
                or (b.blocker_id = v_uid and b.blocked_id = v_listing.owner_id)) then
    raise exception 'blocked';
  end if;
  if p_message is not null and char_length(p_message) > 1000 then
    raise exception 'invalid_message';
  end if;
  perform public.enforce_rate_limit('booking_day:' || v_uid, 15, 86400);

  select count(*) into v_booked from public.viewing_appointments
   where slot_id = p_slot_id and status in ('requested', 'confirmed', 'reschedule_requested');
  if v_booked >= v_slot.capacity then
    raise exception 'slot_full';
  end if;

  v_conv := public.ensure_conversation(v_listing, v_uid);

  begin
    insert into public.viewing_appointments (slot_id, listing_id, owner_id, organization_id, guest_id, conversation_id,
                                             starts_at, ends_at, status, guest_message)
    values (v_slot.id, v_listing.id, v_listing.owner_id, v_listing.organization_id, v_uid, v_conv,
            v_slot.starts_at, v_slot.ends_at, 'requested', nullif(trim(p_message), ''))
    returning id into v_appointment;
  exception when unique_violation then
    raise exception 'already_booked';
  end;

  insert into public.leads as ld (listing_id, owner_id, organization_id, interested_id, conversation_id, status, source)
  values (v_listing.id, v_listing.owner_id, v_listing.organization_id, v_uid, v_conv, 'viewing_requested', 'viewing')
  on conflict (listing_id, interested_id) where interested_id is not null
  do update set
    last_activity_at = now(),
    conversation_id = excluded.conversation_id,
    status = case when ld.status in ('new', 'in_contact', 'dossier_sent')
                  then 'viewing_requested'::public.lead_status else ld.status end;

  v_when := public.format_ch_datetime(v_slot.starts_at) || '–' || to_char(v_slot.ends_at at time zone 'Europe/Zurich', 'HH24:MI');
  perform public.post_system_message(v_conv, v_uid, 'Besichtigung angefragt: ' || v_when
    || coalesce(E'\n' || nullif(trim(p_message), ''), ''));

  perform public.notify_user(v_listing.owner_id, 'viewing_requested',
    'Neue Besichtigungsanfrage', v_when || ' · ' || coalesce(v_listing.title, ''),
    '/dashboard/besichtigungen', jsonb_build_object('appointment_id', v_appointment));
  perform public.queue_email(v_listing.owner_id, 'viewing_requested',
    jsonb_build_object('appointment_id', v_appointment, 'listing_title', v_listing.title, 'when', v_when),
    'email_viewings', 'viewing_requested:' || v_appointment);
  return v_appointment;
end;
$$;

create or replace function public.update_viewing_status(p_appointment_id uuid, p_action text, p_reason text default null)
returns public.appointment_status
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_app public.viewing_appointments%rowtype;
  v_is_seller boolean;
  v_is_guest boolean;
  v_new public.appointment_status;
  v_title text;
  v_when text;
  v_other uuid;
  v_text text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_app from public.viewing_appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  v_is_seller := public.can_manage_owner_org(v_app.owner_id, v_app.organization_id);
  v_is_guest := v_app.guest_id = v_uid;
  if not v_is_seller and not v_is_guest then
    raise exception 'not_found';
  end if;
  if p_reason is not null and char_length(p_reason) > 500 then
    raise exception 'invalid_message';
  end if;

  if p_action = 'confirm' and v_is_seller and v_app.status in ('requested', 'reschedule_requested') then
    v_new := 'confirmed';
  elsif p_action = 'cancel' and v_app.status in ('requested', 'confirmed', 'reschedule_requested') then
    v_new := 'cancelled';
  elsif p_action = 'complete' and v_is_seller and v_app.status = 'confirmed' and v_app.starts_at <= now() then
    v_new := 'completed';
  elsif p_action = 'no_show' and v_is_seller and v_app.status = 'confirmed' and v_app.starts_at <= now() then
    v_new := 'no_show';
  elsif p_action = 'request_reschedule' and v_is_guest and v_app.status in ('requested', 'confirmed') then
    v_new := 'reschedule_requested';
  else
    raise exception 'invalid_status_transition';
  end if;

  update public.viewing_appointments
     set status = v_new,
         confirmed_at = case when v_new = 'confirmed' then now() else confirmed_at end,
         cancelled_at = case when v_new = 'cancelled' then now() else cancelled_at end,
         cancelled_by = case when v_new = 'cancelled' then v_uid else cancelled_by end,
         cancel_reason = case when v_new in ('cancelled', 'reschedule_requested') then nullif(trim(p_reason), '') else cancel_reason end,
         completed_at = case when v_new in ('completed', 'no_show') then now() else completed_at end
   where id = p_appointment_id;

  if v_new = 'confirmed' then
    update public.leads set status = 'viewing_confirmed', last_activity_at = now()
     where listing_id = v_app.listing_id and interested_id = v_app.guest_id
       and status in ('new', 'in_contact', 'dossier_sent', 'viewing_requested');
  elsif v_new = 'completed' then
    update public.leads set status = 'viewing_done', last_activity_at = now()
     where listing_id = v_app.listing_id and interested_id = v_app.guest_id
       and status in ('new', 'in_contact', 'dossier_sent', 'viewing_requested', 'viewing_confirmed');
  end if;

  select title into v_title from public.listings where id = v_app.listing_id;
  v_when := public.format_ch_datetime(v_app.starts_at);
  v_other := case when v_is_seller then v_app.guest_id else v_app.owner_id end;
  v_text := case v_new
    when 'confirmed' then 'Besichtigung bestätigt: ' || v_when
    when 'cancelled' then 'Besichtigung abgesagt: ' || v_when
    when 'reschedule_requested' then 'Terminänderung angefragt für ' || v_when
    when 'completed' then 'Besichtigung durchgeführt: ' || v_when
    else 'Besichtigung nicht wahrgenommen: ' || v_when end
    || coalesce(E'\n' || nullif(trim(p_reason), ''), '');

  if v_app.conversation_id is not null and v_new in ('confirmed', 'cancelled', 'reschedule_requested') then
    perform public.post_system_message(v_app.conversation_id, v_uid, v_text);
  end if;

  if v_new in ('confirmed', 'cancelled', 'reschedule_requested') then
    perform public.notify_user(v_other,
      case v_new when 'confirmed' then 'viewing_confirmed' when 'cancelled' then 'viewing_cancelled'
                 else 'viewing_reschedule' end,
      v_text, coalesce(v_title, ''),
      case when v_is_seller then '/dashboard/besichtigungen' else '/dashboard/besichtigungen' end,
      jsonb_build_object('appointment_id', p_appointment_id));
    perform public.queue_email(v_other,
      case v_new when 'confirmed' then 'viewing_confirmed' when 'cancelled' then 'viewing_cancelled'
                 else 'viewing_reschedule' end,
      jsonb_build_object('appointment_id', p_appointment_id, 'listing_title', v_title, 'when', v_when,
                         'reason', nullif(trim(p_reason), '')),
      'email_viewings', 'viewing_' || v_new || ':' || p_appointment_id || ':' || extract(epoch from now())::bigint);
  end if;
  return v_new;
end;
$$;

-- Verkäufer verschiebt einen Termin in ein anderes Zeitfenster
create or replace function public.move_viewing(p_appointment_id uuid, p_new_slot_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_app public.viewing_appointments%rowtype;
  v_slot public.viewing_slots%rowtype;
  v_booked integer;
  v_when text;
  v_title text;
begin
  select * into v_app from public.viewing_appointments where id = p_appointment_id for update;
  if not found or not public.can_manage_owner_org(v_app.owner_id, v_app.organization_id) then
    raise exception 'not_found';
  end if;
  if v_app.status not in ('requested', 'confirmed', 'reschedule_requested') then
    raise exception 'invalid_status_transition';
  end if;
  select * into v_slot from public.viewing_slots where id = p_new_slot_id for update;
  if not found or v_slot.listing_id <> v_app.listing_id or v_slot.is_cancelled or v_slot.starts_at < now() then
    raise exception 'not_found';
  end if;
  if v_slot.id = v_app.slot_id then
    return;
  end if;
  select count(*) into v_booked from public.viewing_appointments
   where slot_id = p_new_slot_id and status in ('requested', 'confirmed', 'reschedule_requested');
  if v_booked >= v_slot.capacity then
    raise exception 'slot_full';
  end if;

  update public.viewing_appointments
     set slot_id = v_slot.id, starts_at = v_slot.starts_at, ends_at = v_slot.ends_at,
         status = 'confirmed', confirmed_at = now(), reminder_sent_at = null
   where id = p_appointment_id;

  v_when := public.format_ch_datetime(v_slot.starts_at);
  select title into v_title from public.listings where id = v_app.listing_id;
  if v_app.conversation_id is not null then
    perform public.post_system_message(v_app.conversation_id, (select auth.uid()), 'Besichtigung verschoben auf ' || v_when);
  end if;
  perform public.notify_user(v_app.guest_id, 'viewing_rescheduled', 'Besichtigung verschoben auf ' || v_when,
    coalesce(v_title, ''), '/dashboard/besichtigungen', jsonb_build_object('appointment_id', p_appointment_id));
  perform public.queue_email(v_app.guest_id, 'viewing_rescheduled',
    jsonb_build_object('appointment_id', p_appointment_id, 'listing_title', v_title, 'when', v_when),
    'email_viewings', 'viewing_moved:' || p_appointment_id || ':' || v_slot.id);
end;
$$;

-- Zeitfenster absagen (inkl. aller Termine darin)
create or replace function public.cancel_viewing_slot(p_slot_id uuid, p_reason text default null)
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_slot public.viewing_slots%rowtype;
  v_count integer := 0;
  r record;
begin
  select * into v_slot from public.viewing_slots where id = p_slot_id for update;
  if not found or not public.can_manage_listing(v_slot.listing_id) then
    raise exception 'not_found';
  end if;
  for r in
    select id from public.viewing_appointments
    where slot_id = p_slot_id and status in ('requested', 'confirmed', 'reschedule_requested')
  loop
    perform public.update_viewing_status(r.id, 'cancel', coalesce(p_reason, 'Zeitfenster wurde abgesagt.'));
    v_count := v_count + 1;
  end loop;
  update public.viewing_slots set is_cancelled = true where id = p_slot_id;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Nachrichten-Übersicht und Zähler
-- -----------------------------------------------------------------------------
create or replace function public.get_my_conversations(p_archived boolean default false)
returns table (
  conversation_id uuid,
  listing_id uuid,
  listing_title text,
  listing_slug text,
  listing_status public.listing_status,
  cover_path text,
  cover_external_url text,
  other_user_id uuid,
  other_display_name text,
  other_avatar_path text,
  my_role text,
  last_message_at timestamptz,
  last_message_preview text,
  unread_count integer,
  is_archived boolean,
  lead_status public.lead_status
)
language sql stable security definer set search_path = ''
as $$
  select
    c.id,
    c.listing_id,
    coalesce(l.title, c.subject),
    l.slug,
    l.status,
    cover.display_path,
    cover.external_url,
    other.user_id,
    coalesce(pp.display_name, 'Gelöschtes Konto'),
    pp.avatar_path,
    coalesce(me.role, 'team'),
    c.last_message_at,
    c.last_message_preview,
    (select count(*)::int from public.messages m
      where m.conversation_id = c.id
        and m.sender_id is distinct from (select auth.uid())
        and m.deleted_at is null
        and m.created_at > coalesce(me.last_read_at, '-infinity'::timestamptz)),
    me.archived_at is not null,
    case when public.can_manage_owner_org(c.seller_id, c.organization_id) then ld.status end
  from public.conversations c
  left join public.conversation_participants me
    on me.conversation_id = c.id and me.user_id = (select auth.uid())
  left join public.listings l on l.id = c.listing_id
  left join lateral (
    select pi.display_path, pi.external_url from public.property_images pi
    where l.property_id is not null and pi.property_id = l.property_id and pi.status = 'ready'
    order by pi.is_cover desc, pi.sort_order limit 1
  ) cover on true
  left join lateral (
    select cp.user_id from public.conversation_participants cp
    where cp.conversation_id = c.id and cp.user_id <> (select auth.uid())
    order by (cp.role = 'interested') = (coalesce(me.role, 'team') <> 'interested') desc
    limit 1
  ) other on true
  left join public.public_profiles pp on pp.id = other.user_id
  left join public.leads ld on ld.conversation_id = c.id
  where (
      c.id in (select cp2.conversation_id from public.conversation_participants cp2
               where cp2.user_id = (select auth.uid()))
      or c.organization_id in (select m.organization_id from public.organization_members m
                               where m.user_id = (select auth.uid()))
    )
    and public.is_conversation_participant(c.id)
    and ((me.archived_at is not null) = coalesce(p_archived, false) or me.user_id is null)
  order by c.last_message_at desc nulls last;
$$;

create or replace function public.get_unread_counts()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'messages', (
      select count(*) from public.messages m
      join public.conversation_participants cp
        on cp.conversation_id = m.conversation_id and cp.user_id = (select auth.uid())
      where m.sender_id is distinct from (select auth.uid())
        and m.deleted_at is null
        and m.created_at > coalesce(cp.last_read_at, '-infinity'::timestamptz)
    ),
    'notifications', (
      select count(*) from public.notifications n
      where n.user_id = (select auth.uid()) and n.read_at is null
    )
  );
$$;

-- -----------------------------------------------------------------------------
-- Statistiken (nur echte Ereignisse)
-- -----------------------------------------------------------------------------
create or replace function public.get_listing_statistics(p_listing_id uuid, p_days integer default 30)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 7), 365);
  v_listing public.listings%rowtype;
  v_from date := ((now() at time zone 'Europe/Zurich')::date - (v_days - 1));
begin
  select * into v_listing from public.listings where id = p_listing_id;
  if not found or not public.can_manage_owner_org(v_listing.owner_id, v_listing.organization_id) then
    raise exception 'not_found';
  end if;
  return jsonb_build_object(
    'listing_id', v_listing.id,
    'published_at', v_listing.first_published_at,
    'views_total', v_listing.view_count,
    'favorites', (select count(*) from public.favorites f where f.listing_id = p_listing_id),
    'inquiries', (select count(*) from public.listing_inquiries i where i.listing_id = p_listing_id),
    'leads', (select count(*) from public.leads ld where ld.listing_id = p_listing_id),
    'viewings', (select count(*) from public.viewing_appointments a
                 where a.listing_id = p_listing_id and a.status in ('confirmed', 'completed')),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object('date', d::date, 'views', coalesce(v.cnt, 0),
                                                   'inquiries', coalesce(q.cnt, 0)) order by d), '[]'::jsonb)
      from generate_series(v_from, (now() at time zone 'Europe/Zurich')::date, interval '1 day') d
      left join (select view_date, count(*) cnt from public.listing_views
                 where listing_id = p_listing_id and view_date >= v_from group by view_date) v on v.view_date = d::date
      left join (select (created_at at time zone 'Europe/Zurich')::date dd, count(*) cnt from public.listing_inquiries
                 where listing_id = p_listing_id and created_at >= v_from group by 1) q on q.dd = d::date
    )
  );
end;
$$;

create or replace function public.get_owner_overview()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with mine as (
    select l.* from public.listings l
    where l.deleted_at is null
      and (l.owner_id = (select auth.uid())
           or l.organization_id in (select m.organization_id from public.organization_members m
                                    where m.user_id = (select auth.uid())))
      and public.can_manage_owner_org(l.owner_id, l.organization_id)
  )
  select jsonb_build_object(
    'active_listings', (select count(*) from mine where status in ('published', 'reserved')),
    'draft_listings', (select count(*) from mine where status in ('draft', 'in_progress', 'ready', 'pending_review')),
    'total_views', (select coalesce(sum(view_count), 0) from mine),
    'views_last_7_days', (select count(*) from public.listing_views v join mine on mine.id = v.listing_id
                          where v.view_date > (now() at time zone 'Europe/Zurich')::date - 7),
    'favorites_on_my_listings', (select count(*) from public.favorites f join mine on mine.id = f.listing_id),
    'new_leads', (select count(*) from public.leads ld join mine on mine.id = ld.listing_id where ld.status = 'new'),
    'open_viewings', (select count(*) from public.viewing_appointments a join mine on mine.id = a.listing_id
                      where a.status in ('requested', 'confirmed', 'reschedule_requested') and a.starts_at > now()),
    'pending_viewing_requests', (select count(*) from public.viewing_appointments a join mine on mine.id = a.listing_id
                                 where a.status in ('requested', 'reschedule_requested') and a.starts_at > now()),
    'my_favorites', (select count(*) from public.favorites f where f.user_id = (select auth.uid())),
    'properties', (select count(*) from public.properties p
                   where p.deleted_at is null
                     and (p.owner_id = (select auth.uid())
                          or (p.organization_id is not null and public.is_org_member(p.organization_id))))
  );
$$;

-- -----------------------------------------------------------------------------
-- Organisationen
-- -----------------------------------------------------------------------------
create or replace function public.create_organization(p_name text, p_email text default null, p_phone text default null)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_slug text;
  v_base text := public.slugify(p_name);
  v_i integer := 1;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_active_user() then raise exception 'account_inactive'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'invalid_name'; end if;
  if exists (select 1 from public.organization_members where user_id = v_uid and role = 'owner') then
    raise exception 'already_owner';
  end if;
  perform public.enforce_rate_limit('org_create:' || v_uid, 3, 86400);
  if v_base = '' then v_base := 'firma'; end if;
  v_slug := v_base;
  while exists (select 1 from public.organizations where slug = v_slug) loop
    v_i := v_i + 1;
    v_slug := v_base || '-' || v_i;
  end loop;
  insert into public.organizations (name, slug, email, phone, created_by)
  values (trim(p_name), v_slug, nullif(trim(p_email), ''), nullif(trim(p_phone), ''), v_uid)
  returning id into v_org;
  insert into public.organization_members (organization_id, user_id, role) values (v_org, v_uid, 'owner');
  update public.profiles set account_type = 'business' where id = v_uid;
  update public.public_profiles set organization_id = v_org where id = v_uid;
  return v_org;
end;
$$;

create or replace function public.invite_organization_member(p_org uuid, p_email text, p_role public.org_role default 'member')
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_id uuid;
  v_org_name text;
begin
  if not public.is_org_admin(p_org) then raise exception 'forbidden'; end if;
  if p_role = 'owner' then raise exception 'invalid_role'; end if;
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  perform public.enforce_rate_limit('org_invite:' || p_org, 30, 86400);
  update public.organization_invitations set revoked_at = now()
   where organization_id = p_org and lower(email) = lower(p_email) and accepted_at is null and revoked_at is null;
  insert into public.organization_invitations (organization_id, email, role, token_hash, invited_by)
  values (p_org, lower(trim(p_email)), p_role, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), (select auth.uid()))
  returning id into v_id;
  select name into v_org_name from public.organizations where id = p_org;
  insert into public.email_outbox (to_email, template, payload)
  values (lower(trim(p_email)), 'org_invitation',
          jsonb_build_object('organization_name', v_org_name, 'token', v_token, 'role', p_role));
  return v_id;
end;
$$;

create or replace function public.accept_organization_invitation(p_token text)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_inv public.organization_invitations%rowtype;
  v_email text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_inv from public.organization_invitations
   where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
   for update;
  if not found or v_inv.revoked_at is not null or v_inv.accepted_at is not null or v_inv.expires_at < now() then
    raise exception 'invitation_invalid';
  end if;
  select email into v_email from public.profiles where id = v_uid;
  if lower(coalesce(v_email, '')) <> lower(v_inv.email) then
    raise exception 'invitation_email_mismatch';
  end if;
  insert into public.organization_members (organization_id, user_id, role, invited_by)
  values (v_inv.organization_id, v_uid, v_inv.role, v_inv.invited_by)
  on conflict (organization_id, user_id) do nothing;
  update public.organization_invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  update public.public_profiles set organization_id = coalesce(organization_id, v_inv.organization_id) where id = v_uid;
  return v_inv.organization_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Dokumentenfreigaben (nur an Personen mit Kontakt zum Inserat)
-- -----------------------------------------------------------------------------
create or replace function public.grant_document_access(p_document_id uuid, p_grantee_id uuid, p_expires_at timestamptz default null)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_doc public.property_documents%rowtype;
  v_grant uuid;
begin
  select * into v_doc from public.property_documents where id = p_document_id and deleted_at is null;
  if not found or not public.can_manage_document(p_document_id) then
    raise exception 'not_found';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'invalid_expiry';
  end if;
  if not exists (
    select 1 from public.conversations c
    join public.listings l on l.id = c.listing_id
    where l.property_id = v_doc.property_id and c.interested_id = p_grantee_id
  ) then
    raise exception 'grantee_not_in_contact';
  end if;
  insert into public.document_access_grants (document_id, grantee_id, granted_by, expires_at)
  values (p_document_id, p_grantee_id, (select auth.uid()), p_expires_at)
  on conflict (document_id, grantee_id) where revoked_at is null
  do update set expires_at = excluded.expires_at
  returning id into v_grant;

  update public.leads ld set status = 'dossier_sent', last_activity_at = now()
   from public.listings l
   where l.id = ld.listing_id and l.property_id = v_doc.property_id and ld.interested_id = p_grantee_id
     and ld.status in ('new', 'in_contact');

  perform public.notify_user(p_grantee_id, 'document_shared', 'Neues Dokument freigegeben', v_doc.title,
    '/dashboard/dokumente', jsonb_build_object('document_id', p_document_id));
  perform public.queue_email(p_grantee_id, 'document_shared',
    jsonb_build_object('document_title', v_doc.title), 'email_documents', 'doc_shared:' || v_grant);
  return v_grant;
end;
$$;

create or replace function public.revoke_document_access(p_grant_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_doc uuid;
begin
  select document_id into v_doc from public.document_access_grants where id = p_grant_id;
  if v_doc is null or not public.can_manage_document(v_doc) then
    raise exception 'not_found';
  end if;
  update public.document_access_grants set revoked_at = now() where id = p_grant_id and revoked_at is null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Kontaktformular (auch ohne Konto)
-- -----------------------------------------------------------------------------
create or replace function public.submit_contact_request(p_name text, p_email text, p_subject text, p_message text)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.enforce_rate_limit('contact_email:' || lower(coalesce(p_email, '')), 3, 3600);
  perform public.enforce_rate_limit('contact_global', 200, 3600);
  insert into public.contact_requests (name, email, subject, message, user_id)
  values (trim(p_name), lower(trim(p_email)), trim(p_subject), trim(p_message), (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Datenschutz: Datenexport und Kontolöschung
-- -----------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = (select auth.uid())),
    'preferences', (select to_jsonb(x) from public.user_preferences x where x.user_id = (select auth.uid())),
    'notification_settings', (select to_jsonb(x) from public.user_notification_settings x where x.user_id = (select auth.uid())),
    'properties', (select coalesce(jsonb_agg(to_jsonb(p)), '[]') from public.properties p where p.owner_id = (select auth.uid())),
    'listings', (select coalesce(jsonb_agg(to_jsonb(l)), '[]') from public.listings l where l.owner_id = (select auth.uid())),
    'favorites', (select coalesce(jsonb_agg(to_jsonb(f)), '[]') from public.favorites f where f.user_id = (select auth.uid())),
    'saved_searches', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from public.saved_searches s where s.user_id = (select auth.uid())),
    'messages_sent', (select coalesce(jsonb_agg(jsonb_build_object('conversation_id', m.conversation_id, 'body', m.body,
                        'created_at', m.created_at)), '[]') from public.messages m where m.sender_id = (select auth.uid())),
    'inquiries', (select coalesce(jsonb_agg(to_jsonb(i)), '[]') from public.listing_inquiries i where i.sender_id = (select auth.uid())),
    'viewings_as_guest', (select coalesce(jsonb_agg(jsonb_build_object('listing_id', a.listing_id, 'starts_at', a.starts_at,
                            'status', a.status)), '[]') from public.viewing_appointments a where a.guest_id = (select auth.uid())),
    'valuations', (select coalesce(jsonb_agg(to_jsonb(v)), '[]') from public.property_valuations v
                   join public.properties p on p.id = v.property_id where p.owner_id = (select auth.uid())),
    'ai_usage', (select coalesce(jsonb_agg(jsonb_build_object('feature', u.feature, 'created_at', u.created_at)), '[]')
                 from public.ai_usage_events u where u.user_id = (select auth.uid()))
  )
  where (select auth.uid()) is not null;
$$;

create or replace function public.delete_my_account()
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.organization_members m where m.user_id = v_uid and m.role = 'owner'
             and exists (select 1 from public.organization_members o where o.organization_id = m.organization_id and o.user_id <> v_uid)) then
    raise exception 'transfer_ownership_first';
  end if;
  delete from public.organizations o
   where exists (select 1 from public.organization_members m where m.organization_id = o.id and m.user_id = v_uid and m.role = 'owner');
  delete from auth.users where id = v_uid;
end;
$$;

-- -----------------------------------------------------------------------------
-- Administration (immer mit Audit-Log)
-- -----------------------------------------------------------------------------
create or replace function public.write_audit_log(p_action text, p_entity_type text, p_entity_id text, p_details jsonb default '{}'::jsonb)
returns void
language sql volatile security definer set search_path = ''
as $$
  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;
revoke execute on function public.write_audit_log(text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.admin_set_user_status(p_user_id uuid, p_status public.user_status, p_reason text default null)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_user_id = (select auth.uid()) then raise exception 'cannot_modify_self'; end if;
  if p_status = 'deleted' then raise exception 'invalid_status'; end if;
  update public.profiles
     set status = p_status, status_reason = nullif(trim(p_reason), ''), status_changed_at = now()
   where id = p_user_id;
  if not found then raise exception 'not_found'; end if;
  if p_status = 'suspended' then
    update public.listings set status = 'paused'
     where owner_id = p_user_id and status in ('published', 'reserved');
  end if;
  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason)
  values ((select auth.uid()), 'user_' || p_status::text, 'user', p_user_id, p_reason);
  perform public.write_audit_log('user.set_status', 'user', p_user_id::text,
    jsonb_build_object('status', p_status, 'reason', p_reason));
end;
$$;

create or replace function public.admin_set_role(p_user_id uuid, p_role public.app_role, p_grant boolean)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_user_id = (select auth.uid()) and not p_grant then raise exception 'cannot_modify_self'; end if;
  if p_grant then
    insert into public.user_roles (user_id, role, granted_by) values (p_user_id, p_role, (select auth.uid()))
    on conflict do nothing;
  else
    delete from public.user_roles where user_id = p_user_id and role = p_role;
  end if;
  perform public.write_audit_log(case when p_grant then 'role.grant' else 'role.revoke' end, 'user', p_user_id::text,
    jsonb_build_object('role', p_role));
end;
$$;

create or replace function public.admin_moderate_listing(p_listing_id uuid, p_action text, p_reason text default null)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_listing public.listings%rowtype;
begin
  if not public.is_moderator() then raise exception 'forbidden'; end if;
  select * into v_listing from public.listings where id = p_listing_id for update;
  if not found then raise exception 'not_found'; end if;

  if p_action = 'block' then
    update public.listings set moderation_status = 'blocked', moderation_reason = p_reason where id = p_listing_id;
    perform public.notify_user(v_listing.owner_id, 'listing_blocked', 'Ihr Inserat wurde deaktiviert',
      coalesce(p_reason, 'Bitte kontaktieren Sie den Support.'), '/dashboard/immobilien', jsonb_build_object('listing_id', p_listing_id));
    perform public.queue_email(v_listing.owner_id, 'listing_moderated',
      jsonb_build_object('listing_title', v_listing.title, 'action', 'block', 'reason', p_reason), null, null);
  elsif p_action = 'unblock' then
    update public.listings set moderation_status = 'ok', moderation_reason = null where id = p_listing_id;
  elsif p_action = 'flag' then
    update public.listings set moderation_status = 'flagged', moderation_reason = p_reason where id = p_listing_id;
  elsif p_action = 'approve' then
    if v_listing.status <> 'pending_review' then raise exception 'invalid_status_transition'; end if;
    update public.listings
       set status = 'published', approved_at = now(), approved_by = (select auth.uid()), moderation_status = 'ok'
     where id = p_listing_id;
  elsif p_action = 'reject' then
    if v_listing.status <> 'pending_review' then raise exception 'invalid_status_transition'; end if;
    update public.listings set status = 'in_progress', moderation_reason = p_reason where id = p_listing_id;
    perform public.notify_user(v_listing.owner_id, 'listing_rejected', 'Inserat nicht freigegeben',
      coalesce(p_reason, 'Bitte überarbeiten Sie Ihr Inserat.'), '/dashboard/immobilien', jsonb_build_object('listing_id', p_listing_id));
    perform public.queue_email(v_listing.owner_id, 'listing_moderated',
      jsonb_build_object('listing_title', v_listing.title, 'action', 'reject', 'reason', p_reason), null, null);
  else
    raise exception 'invalid_action';
  end if;

  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason)
  values ((select auth.uid()), 'listing_' || p_action, 'listing', p_listing_id, p_reason);
  perform public.write_audit_log('listing.' || p_action, 'listing', p_listing_id::text, jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.admin_update_report(p_report_id uuid, p_status public.report_status, p_note text default null)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.is_moderator() then raise exception 'forbidden'; end if;
  update public.user_reports
     set status = p_status, resolution_note = nullif(trim(p_note), ''), handled_by = (select auth.uid()), handled_at = now()
   where id = p_report_id;
  if not found then raise exception 'not_found'; end if;
  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason, report_id)
  select (select auth.uid()), 'report_' || p_status::text, r.target_type, r.target_id, p_note, r.id
  from public.user_reports r where r.id = p_report_id;
  perform public.write_audit_log('report.' || p_status::text, 'report', p_report_id::text, jsonb_build_object('note', p_note));
end;
$$;

-- Inhalt einer Meldung für Moderatoren (nur der gemeldete Datensatz, keine ganzen Chats)
create or replace function public.admin_get_report_target(p_report_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_report public.user_reports%rowtype;
begin
  if not public.is_moderator() then raise exception 'forbidden'; end if;
  select * into v_report from public.user_reports where id = p_report_id;
  if not found then raise exception 'not_found'; end if;
  return case v_report.target_type
    when 'listing' then (select jsonb_build_object('type', 'listing', 'id', l.id, 'title', l.title, 'slug', l.slug,
                          'status', l.status, 'moderation_status', l.moderation_status, 'owner_id', l.owner_id,
                          'description', left(l.description, 2000))
                         from public.listings l where l.id = v_report.target_id)
    when 'message' then (select jsonb_build_object('type', 'message', 'id', m.id, 'body', m.body, 'sender_id', m.sender_id,
                          'created_at', m.created_at)
                         from public.messages m where m.id = v_report.target_id)
    when 'user' then (select jsonb_build_object('type', 'user', 'id', p.id, 'display_name', p.display_name,
                       'status', p.status, 'created_at', p.created_at)
                      from public.profiles p where p.id = v_report.target_id)
    when 'organization' then (select jsonb_build_object('type', 'organization', 'id', o.id, 'name', o.name, 'status', o.status)
                              from public.organizations o where o.id = v_report.target_id)
    else jsonb_build_object('type', v_report.target_type, 'id', v_report.target_id)
  end;
end;
$$;

create or replace function public.admin_update_setting(p_key text, p_value jsonb)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  insert into public.feature_settings (key, value, updated_by, updated_at)
  values (p_key, p_value, (select auth.uid()), now())
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();
  perform public.write_audit_log('setting.update', 'feature_setting', p_key, jsonb_build_object('value', p_value));
end;
$$;

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
  insert into public.verifications (subject_type, subject_id, kind, status, method, notes, verified_by, verified_at)
  values (p_subject_type, p_subject_id, p_kind, p_status, p_method, p_notes, (select auth.uid()),
          case when p_status = 'verified' then now() end)
  returning id into v_id;
  perform public.write_audit_log('verification.' || p_status::text, p_subject_type, p_subject_id::text,
    jsonb_build_object('kind', p_kind, 'method', p_method));
  return v_id;
end;
$$;

create or replace function public.admin_set_org_status(p_org_id uuid, p_status text, p_reason text default null)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_status not in ('active', 'suspended') then raise exception 'invalid_status'; end if;
  update public.organizations set status = p_status where id = p_org_id;
  if not found then raise exception 'not_found'; end if;
  perform public.write_audit_log('organization.set_status', 'organization', p_org_id::text,
    jsonb_build_object('status', p_status, 'reason', p_reason));
end;
$$;

create or replace function public.admin_platform_stats()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_moderator() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'users_total', (select count(*) from public.profiles),
    'users_active_30d', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
    'users_new_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'users_suspended', (select count(*) from public.profiles where status = 'suspended'),
    'organizations', (select count(*) from public.organizations where deleted_at is null),
    'properties', (select count(*) from public.properties where deleted_at is null and not is_demo),
    'listings_active', (select count(*) from public.listings where status in ('published', 'reserved')
                         and moderation_status <> 'blocked' and deleted_at is null and not is_demo),
    'listings_new_7d', (select count(*) from public.listings where first_published_at > now() - interval '7 days' and not is_demo),
    'listings_pending_review', (select count(*) from public.listings where status = 'pending_review'),
    'listings_blocked', (select count(*) from public.listings where moderation_status = 'blocked'),
    'inquiries_7d', (select count(*) from public.listing_inquiries where created_at > now() - interval '7 days'),
    'inquiries_total', (select count(*) from public.listing_inquiries),
    'valuations_total', (select count(*) from public.property_valuations),
    'dossiers_total', (select count(*) from public.generated_dossiers where status = 'ready'),
    'image_ai_total', (select count(*) from public.image_transformations where status in ('ready', 'accepted')),
    'reports_open', (select count(*) from public.user_reports where status in ('open', 'in_review')),
    'jobs_failed_7d', (select count(*) from public.ai_generation_jobs where status = 'failed' and updated_at > now() - interval '7 days'),
    'jobs_pending', (select count(*) from public.ai_generation_jobs where status in ('queued', 'running')),
    'emails_failed_7d', (select count(*) from public.email_outbox where status = 'failed' and created_at > now() - interval '7 days'),
    'emails_pending', (select count(*) from public.email_outbox where status = 'pending'),
    'ai_cost_usd_30d', (select coalesce(sum(cost_usd), 0) from public.ai_usage_events where created_at > now() - interval '30 days'),
    'storage_bytes', (select coalesce(sum((o.metadata ->> 'size')::bigint), 0) from storage.objects o)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Systemfunktionen (nur Service Role)
-- -----------------------------------------------------------------------------
create or replace function public.record_listing_view(p_listing_id uuid, p_viewer_hash text, p_authenticated boolean default false)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.is_listing_public(p_listing_id) then
    return false;
  end if;
  insert into public.listing_views (listing_id, viewer_hash, is_authenticated)
  values (p_listing_id, p_viewer_hash, coalesce(p_authenticated, false))
  on conflict (listing_id, viewer_hash, view_date) do nothing;
  return found;
end;
$$;

create or replace function public.claim_jobs(p_limit integer, p_worker text)
returns setof public.ai_generation_jobs
language plpgsql volatile security definer set search_path = ''
as $$
begin
  return query
  update public.ai_generation_jobs j
     set status = 'running', locked_at = now(), locked_by = p_worker,
         attempts = j.attempts + 1, started_at = coalesce(j.started_at, now())
   where j.id in (
     select id from public.ai_generation_jobs
     where (status = 'queued' and run_after <= now())
        or (status = 'running' and locked_at < now() - interval '10 minutes')
     order by run_after
     limit greatest(1, least(p_limit, 25))
     for update skip locked
   )
     and j.attempts < j.max_attempts
  returning j.*;
end;
$$;

create or replace function public.claim_job(p_job_id uuid, p_worker text)
returns setof public.ai_generation_jobs
language plpgsql volatile security definer set search_path = ''
as $$
begin
  return query
  update public.ai_generation_jobs j
     set status = 'running', locked_at = now(), locked_by = p_worker,
         attempts = j.attempts + 1, started_at = coalesce(j.started_at, now())
   where j.id = (
     select id from public.ai_generation_jobs
     where id = p_job_id and status = 'queued'
     for update skip locked
   )
  returning j.*;
end;
$$;

create or replace function public.claim_emails(p_limit integer)
returns setof public.email_outbox
language plpgsql volatile security definer set search_path = ''
as $$
begin
  return query
  update public.email_outbox e
     set status = 'sending', locked_at = now(), attempts = e.attempts + 1
   where e.id in (
     select id from public.email_outbox
     where (status = 'pending' and scheduled_at <= now())
        or (status = 'sending' and locked_at < now() - interval '10 minutes')
     order by scheduled_at
     limit greatest(1, least(p_limit, 50))
     for update skip locked
   )
  returning e.*;
end;
$$;

create or replace function public.cleanup_rate_limits()
returns integer
language sql volatile security definer set search_path = ''
as $$
  with d as (delete from public.rate_limit_buckets where window_start < now() - interval '2 days' returning 1)
  select count(*)::int from d;
$$;

-- Aufrufrechte
revoke execute on function public.record_listing_view(uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.claim_jobs(integer, text) from public, anon, authenticated;
revoke execute on function public.claim_job(uuid, text) from public, anon, authenticated;
revoke execute on function public.claim_emails(integer) from public, anon, authenticated;
revoke execute on function public.cleanup_rate_limits() from public, anon, authenticated;
revoke execute on function public.queue_search_alerts(uuid) from public, anon, authenticated;
revoke execute on function public.saved_search_matches_listing(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.record_listing_view(uuid, text, boolean) to service_role;
grant execute on function public.claim_jobs(integer, text) to service_role;
grant execute on function public.claim_job(uuid, text) to service_role;
grant execute on function public.claim_emails(integer) to service_role;
grant execute on function public.cleanup_rate_limits() to service_role;
grant execute on function public.queue_search_alerts(uuid) to service_role;
