-- =============================================================================
-- Immovia · Migration 2: Immobilien, Inserate, Bilder, Dokumente
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Immobilien: vollständige, private Objektdaten (inkl. exakter Adresse)
-- -----------------------------------------------------------------------------
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  property_type public.property_type not null default 'apartment',
  offer_type public.offer_type not null default 'sale',
  internal_name text check (char_length(internal_name) <= 120),

  -- Adresse (privat; öffentlich nur gemäss listings.location_precision)
  street text check (char_length(street) <= 120),
  house_number text check (char_length(house_number) <= 12),
  postal_code text check (postal_code is null or postal_code ~ '^[1-9][0-9]{3}$'),
  municipality text check (char_length(municipality) <= 80),
  canton text check (canton is null or canton in (
    'AG','AI','AR','BE','BL','BS','FR','GE','GL','GR','JU','LU','NE','NW','OW','SG','SH','SO','SZ','TG','TI','UR','VD','VS','ZG','ZH')),
  latitude double precision check (latitude is null or latitude between 45.7 and 47.9),
  longitude double precision check (longitude is null or longitude between 5.8 and 10.6),
  egid bigint check (egid is null or egid > 0),

  -- Eckdaten
  rooms numeric(3, 1) check (rooms is null or (rooms >= 0.5 and rooms <= 50 and rooms * 2 = floor(rooms * 2))),
  living_area numeric(8, 1) check (living_area is null or (living_area > 0 and living_area < 20000)),
  gross_living_area numeric(8, 1) check (gross_living_area is null or (gross_living_area > 0 and gross_living_area < 30000)),
  usable_area numeric(9, 1) check (usable_area is null or (usable_area > 0 and usable_area < 200000)),
  plot_area numeric(10, 1) check (plot_area is null or (plot_area > 0 and plot_area < 10000000)),
  year_built smallint check (year_built is null or year_built between 1000 and 2100),
  year_renovated smallint check (year_renovated is null or year_renovated between 1000 and 2100),
  floor smallint check (floor is null or floor between -5 and 100),
  floors_total smallint check (floors_total is null or floors_total between 1 and 120),
  bathrooms smallint check (bathrooms is null or bathrooms between 0 and 50),
  condition public.property_condition,
  heating_type public.heating_type,
  energy_label text check (energy_label is null or energy_label in ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
  energy_demand_kwh numeric(7, 1) check (energy_demand_kwh is null or energy_demand_kwh between 0 and 2000),

  -- Ausstattung (häufig gefilterte Merkmale als eigene Spalten)
  has_balcony boolean not null default false,
  has_terrace boolean not null default false,
  has_garden boolean not null default false,
  has_garage boolean not null default false,
  has_elevator boolean not null default false,
  has_cellar boolean not null default false,
  has_attic boolean not null default false,
  is_wheelchair_accessible boolean not null default false,
  is_minergie boolean not null default false,
  pets_allowed boolean,
  garage_spaces smallint not null default 0 check (garage_spaces between 0 and 500),
  underground_parking_spaces smallint not null default 0 check (underground_parking_spaces between 0 and 500),
  outdoor_parking_spaces smallint not null default 0 check (outdoor_parking_spaces between 0 and 500),

  -- Verfügbarkeit und Kosten
  available_from date,
  available_by_arrangement boolean not null default false,
  service_charges numeric(8, 2) check (service_charges is null or service_charges between 0 and 100000),
  ownership_type public.ownership_type,
  special_features text check (char_length(special_features) <= 4000),
  view_description text check (char_length(view_description) <= 300),

  -- Assistent
  wizard_step smallint not null default 1 check (wizard_step between 1 and 8),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint properties_renovation_after_build check (
    year_renovated is null or year_built is null or year_renovated >= year_built
  )
);
comment on table public.properties is 'Private Objektdaten. Öffentlich ist nur der Ausschnitt in listings.';
create index properties_owner_idx on public.properties (owner_id) where deleted_at is null;
create index properties_org_idx on public.properties (organization_id) where organization_id is not null;
create trigger properties_set_updated_at before update on public.properties
  for each row execute function public.set_updated_at();

-- Zusätzliche Merkmale aus einem festen Katalog (siehe src/lib/constants.ts)
create table public.property_features (
  property_id uuid not null references public.properties (id) on delete cascade,
  feature_key text not null check (feature_key ~ '^[a-z0-9_]{2,40}$'),
  created_at timestamptz not null default now(),
  primary key (property_id, feature_key)
);
create index property_features_key_idx on public.property_features (feature_key);

create table public.property_renovations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  year smallint not null check (year between 1900 and 2100),
  category text not null default 'other' check (category in (
    'kitchen', 'bathroom', 'roof', 'facade', 'windows', 'heating', 'electrical', 'flooring', 'interior', 'other')),
  description text not null check (char_length(description) between 2 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index property_renovations_property_idx on public.property_renovations (property_id, year desc);
create trigger property_renovations_set_updated_at before update on public.property_renovations
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Bilder
--   original_path: privater Bucket property-originals (Original-Upload)
--   base_path:     öffentlicher Bucket property-images (unverändert, skaliert, ohne EXIF)
--   display_path:  angezeigte Version (base oder optimiert)
-- -----------------------------------------------------------------------------
create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  uploaded_by uuid default auth.uid() references public.profiles (id) on delete set null,
  original_path text,
  base_path text,
  display_path text,
  thumb_path text,
  external_url text check (external_url is null or external_url ~ '^https://images\.unsplash\.com/'),
  width integer check (width is null or width between 1 and 20000),
  height integer check (height is null or height between 1 and 20000),
  size_bytes integer check (size_bytes is null or size_bytes >= 0),
  mime_type text,
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  caption text check (char_length(caption) <= 300),
  is_floor_plan boolean not null default false,
  is_enhanced boolean not null default false,
  is_ai_visualization boolean not null default false,
  source_image_id uuid references public.property_images (id) on delete set null,
  status text not null default 'ready' check (status in ('processing', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.property_images.is_ai_visualization is 'Substanziell veränderte Bilder (z. B. virtuelle Möblierung). Wird öffentlich als KI-Visualisierung gekennzeichnet.';
create index property_images_property_idx on public.property_images (property_id, sort_order);
create unique index property_images_one_cover on public.property_images (property_id) where is_cover;
create trigger property_images_set_updated_at before update on public.property_images
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Inserate: öffentlicher Ausschnitt einer Immobilie
-- Die mit "sync:" markierten Spalten werden per Trigger aus properties gepflegt.
-- -----------------------------------------------------------------------------
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  slug text unique check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  offer_type public.offer_type not null,
  status public.listing_status not null default 'draft',
  moderation_status public.moderation_status not null default 'ok',
  moderation_reason text check (char_length(moderation_reason) <= 1000),
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,

  -- Texte (vom Benutzer bestätigt)
  title text check (char_length(title) <= 140),
  short_description text check (char_length(short_description) <= 400),
  description text check (char_length(description) <= 12000),
  location_description text check (char_length(location_description) <= 6000),
  equipment_description text check (char_length(equipment_description) <= 6000),
  highlights text[] not null default '{}' check (cardinality(highlights) <= 12),
  search_summary text check (char_length(search_summary) <= 300),
  texts_confirmed_at timestamptz,

  -- Preise in CHF
  price numeric(12, 2) check (price is null or price >= 0),
  price_on_request boolean not null default false,
  additional_costs numeric(10, 2) check (additional_costs is null or additional_costs >= 0),
  parking_price numeric(10, 2) check (parking_price is null or parking_price >= 0),

  -- Standortanzeige
  location_precision public.location_precision not null default 'area',
  public_address text,
  public_latitude double precision,
  public_longitude double precision,

  -- Kontakt
  contact_name text check (char_length(contact_name) <= 120),
  contact_phone text check (contact_phone is null or contact_phone ~ '^\+?[0-9 ()/-]{6,24}$'),
  contact_email text check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  show_contact_phone boolean not null default false,
  dossier_public boolean not null default false,

  -- sync: öffentliche Objektdaten
  property_type public.property_type not null default 'apartment',
  postal_code text,
  municipality text,
  canton text,
  rooms numeric(3, 1),
  living_area numeric(8, 1),
  usable_area numeric(9, 1),
  plot_area numeric(10, 1),
  year_built smallint,
  year_renovated smallint,
  floor smallint,
  floors_total smallint,
  bathrooms smallint,
  condition public.property_condition,
  heating_type public.heating_type,
  energy_label text,
  has_balcony boolean not null default false,
  has_terrace boolean not null default false,
  has_garden boolean not null default false,
  has_garage boolean not null default false,
  has_elevator boolean not null default false,
  has_cellar boolean not null default false,
  has_attic boolean not null default false,
  is_wheelchair_accessible boolean not null default false,
  is_minergie boolean not null default false,
  pets_allowed boolean,
  parking_spaces smallint not null default 0,
  available_from date,
  available_by_arrangement boolean not null default false,
  ownership_type public.ownership_type,

  -- Zähler und Daten
  view_count integer not null default 0,
  published_at timestamptz,
  first_published_at timestamptz,
  closed_at timestamptz,
  status_changed_at timestamptz not null default now(),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
comment on table public.listings is 'Inserate. Enthalten nur öffentlich zulässige Objektdaten; exakte Adresse nur bei location_precision = exact.';
create unique index listings_one_open_per_property on public.listings (property_id)
  where status <> 'archived' and deleted_at is null;
create index listings_owner_idx on public.listings (owner_id) where deleted_at is null;
create index listings_org_idx on public.listings (organization_id) where organization_id is not null;
create index listings_public_search_idx on public.listings (offer_type, status, published_at desc)
  where moderation_status <> 'blocked' and deleted_at is null;
create index listings_public_location_idx on public.listings (canton, municipality, postal_code)
  where status in ('published', 'reserved');
create index listings_public_geo_idx on public.listings (public_latitude, public_longitude)
  where status in ('published', 'reserved');
create index listings_price_idx on public.listings (offer_type, price) where status in ('published', 'reserved');
create trigger listings_set_updated_at before update on public.listings
  for each row execute function public.set_updated_at();

create table public.listing_status_history (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  from_status public.listing_status,
  to_status public.listing_status not null,
  changed_by uuid references public.profiles (id) on delete set null,
  reason text check (char_length(reason) <= 500),
  created_at timestamptz not null default now()
);
create index listing_status_history_listing_idx on public.listing_status_history (listing_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Dokumente
-- -----------------------------------------------------------------------------
create table public.property_documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  uploaded_by uuid default auth.uid() references public.profiles (id) on delete set null,
  category public.document_category not null default 'other',
  title text not null check (char_length(title) between 1 and 160),
  storage_path text not null unique,
  file_name text check (char_length(file_name) <= 200),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 26214400),
  visibility public.document_visibility not null default 'owner',
  contains_personal_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint property_documents_personal_not_public check (not (contains_personal_data and visibility = 'public'))
);
create index property_documents_property_idx on public.property_documents (property_id) where deleted_at is null;
create trigger property_documents_set_updated_at before update on public.property_documents
  for each row execute function public.set_updated_at();

create table public.document_access_grants (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.property_documents (id) on delete cascade,
  grantee_id uuid not null references public.profiles (id) on delete cascade,
  granted_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index document_access_grants_active on public.document_access_grants (document_id, grantee_id)
  where revoked_at is null;
create index document_access_grants_grantee_idx on public.document_access_grants (grantee_id) where revoked_at is null;
