-- Suchfilter erweitert (neue Filteransicht in App und Website):
--   p_with_price  – nur Inserate mit Preis (ohne «Preis auf Anfrage»)
--   p_minergie    – nur Minergie-zertifizierte Objekte
--   p_plot_max    – Grundstücksfläche bis
-- Die Signatur ändert sich. Damit keine zweite Überladung entsteht (PostgREST könnte sie bei benannten
-- Argumenten nicht unterscheiden), wird die bisherige Funktion entfernt und neu angelegt.

drop function if exists public.search_listings(
  public.offer_type, public.property_type[], text, text, text, text,
  double precision, double precision, double precision, double precision[],
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, integer,
  public.property_condition[],
  boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean,
  uuid[], text, integer, integer
);

create function public.search_listings(
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
  p_minergie boolean default null,
  p_with_price boolean default null,
  p_plot_max numeric default null,
  p_listing_ids uuid[] default null,
  p_sort text default 'newest',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid, slug text, title text, search_summary text, offer_type public.offer_type,
  property_type public.property_type, status public.listing_status, price numeric,
  price_on_request boolean, additional_costs numeric, rooms numeric, living_area numeric,
  plot_area numeric, floor smallint, municipality text, postal_code text, canton text,
  public_address text, public_latitude double precision, public_longitude double precision,
  location_precision public.location_precision, has_balcony boolean, has_terrace boolean,
  has_garden boolean, has_elevator boolean, parking_spaces smallint,
  condition public.property_condition, year_built smallint, published_at timestamptz,
  is_demo boolean, cover_path text, cover_external_url text, image_count integer,
  distance_km double precision, total_count bigint
)
language plpgsql
stable
set search_path = ''
as $function$
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
      and (p_plot_max is null or l.plot_area <= p_plot_max)
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
      and (p_minergie is not true or l.is_minergie)
      and (p_with_price is not true or (not l.price_on_request and l.price is not null))
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
$function$;

-- Rechte wie bisher: öffentliche Suche für anon und angemeldete Personen
revoke execute on function public.search_listings(
  public.offer_type, public.property_type[], text, text, text, text,
  double precision, double precision, double precision, double precision[],
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, integer,
  public.property_condition[],
  boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean,
  boolean, boolean, numeric,
  uuid[], text, integer, integer
) from public;
grant execute on function public.search_listings(
  public.offer_type, public.property_type[], text, text, text, text,
  double precision, double precision, double precision, double precision[],
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, integer,
  public.property_condition[],
  boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean,
  boolean, boolean, numeric,
  uuid[], text, integer, integer
) to anon, authenticated, service_role;

-- Suchabos: die neuen Kriterien (minergie, with_price, plot_max) bei Benachrichtigungen berücksichtigen.
-- Ausserdem wie die Suche selbst (toRpcArgs der Website): mit Umkreis zählen Gemeinde, PLZ und Kanton nicht,
-- und der Freitext gilt nur ohne Ort – sonst fänden Benachrichtigungen weniger als die Trefferliste.
create or replace function public.saved_search_matches_listing(p_criteria jsonb, p_listing_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_types public.property_type[];
  v_conditions public.property_condition[];
  v_radius boolean := (p_criteria ->> 'lat') is not null and (p_criteria ->> 'lng') is not null and (p_criteria ->> 'radius') is not null;
  v_place boolean := v_radius or (p_criteria ->> 'canton') is not null or (p_criteria ->> 'municipality') is not null
    or (p_criteria ->> 'postal_code') is not null;
begin
  select array_agg(x::public.property_type) into v_types
  from jsonb_array_elements_text(coalesce(p_criteria -> 'types', '[]'::jsonb)) x;
  select array_agg(x::public.property_condition) into v_conditions
  from jsonb_array_elements_text(coalesce(p_criteria -> 'conditions', '[]'::jsonb)) x;
  return exists (
    select 1 from public.search_listings(
      p_offer_type => (p_criteria ->> 'offer')::public.offer_type,
      p_property_types => v_types,
      p_canton => case when v_radius then null else p_criteria ->> 'canton' end,
      p_municipality => case when v_radius then null else p_criteria ->> 'municipality' end,
      p_postal_code => case when v_radius then null else p_criteria ->> 'postal_code' end,
      p_query => case when v_place then null else p_criteria ->> 'q' end,
      p_lat => (p_criteria ->> 'lat')::double precision,
      p_lng => (p_criteria ->> 'lng')::double precision,
      p_radius_km => case when v_radius then (p_criteria ->> 'radius')::double precision end,
      p_price_min => (p_criteria ->> 'price_min')::numeric,
      p_price_max => (p_criteria ->> 'price_max')::numeric,
      p_rooms_min => (p_criteria ->> 'rooms_min')::numeric,
      p_rooms_max => (p_criteria ->> 'rooms_max')::numeric,
      p_area_min => (p_criteria ->> 'area_min')::numeric,
      p_area_max => (p_criteria ->> 'area_max')::numeric,
      p_plot_min => (p_criteria ->> 'plot_min')::numeric,
      p_plot_max => (p_criteria ->> 'plot_max')::numeric,
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
      p_minergie => (p_criteria ->> 'minergie')::boolean,
      p_with_price => (p_criteria ->> 'with_price')::boolean,
      p_listing_ids => array[p_listing_id],
      p_limit => 1
    )
  );
exception when invalid_text_representation or invalid_parameter_value then
  return false;
end;
$function$;
