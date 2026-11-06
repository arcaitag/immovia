-- =============================================================================
-- Immovia · Migration 3: Bewertungen, KI-Jobs, Texte, Bildbearbeitung, Dossiers
-- Schreibzugriffe auf Bewertungen, Jobs und KI-Verbrauch erfolgen ausschliesslich
-- serverseitig (Service Role). Benutzer können ihre Daten nur lesen.
-- =============================================================================

create table public.property_valuations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  requested_by uuid references public.profiles (id) on delete set null,
  status public.valuation_status not null,
  method text not null check (char_length(method) <= 80),
  provider text not null check (char_length(provider) <= 80),
  price_basis text not null default 'none' check (price_basis in ('offer_prices', 'transaction_prices', 'model', 'none')),
  estimated_value numeric(14, 2) check (estimated_value is null or estimated_value > 0),
  value_low numeric(14, 2) check (value_low is null or value_low > 0),
  value_high numeric(14, 2) check (value_high is null or value_high > 0),
  suggested_list_price numeric(14, 2) check (suggested_list_price is null or suggested_list_price > 0),
  currency text not null default 'CHF' check (currency = 'CHF'),
  confidence public.confidence_level not null default 'none',
  confidence_explanation text,
  data_quality jsonb not null default '{}'::jsonb,
  positive_factors jsonb not null default '[]'::jsonb,
  negative_factors jsonb not null default '[]'::jsonb,
  explanation text,
  ai_model text,
  input_snapshot jsonb not null default '{}'::jsonb,
  disclaimer text not null,
  created_at timestamptz not null default now(),
  constraint property_valuations_range check (
    value_low is null or value_high is null or value_low <= value_high
  ),
  constraint property_valuations_no_number_without_data check (
    status in ('completed', 'limited') or (estimated_value is null and value_low is null and value_high is null)
  )
);
comment on constraint property_valuations_no_number_without_data on public.property_valuations
  is 'Ohne ausreichende Daten darf keine Zahl gespeichert werden.';
create index property_valuations_property_idx on public.property_valuations (property_id, created_at desc);

create table public.valuation_sources (
  id uuid primary key default gen_random_uuid(),
  valuation_id uuid not null references public.property_valuations (id) on delete cascade,
  source_type text not null check (source_type in (
    'platform_offers', 'transaction_data', 'statistical_index', 'external_model', 'owner_input')),
  name text not null check (char_length(name) <= 160),
  description text check (char_length(description) <= 1000),
  data_as_of date,
  record_count integer check (record_count is null or record_count >= 0),
  license_note text check (char_length(license_note) <= 500),
  url text,
  created_at timestamptz not null default now()
);
create index valuation_sources_valuation_idx on public.valuation_sources (valuation_id);

create table public.valuation_comparables (
  id uuid primary key default gen_random_uuid(),
  valuation_id uuid not null references public.property_valuations (id) on delete cascade,
  kind text not null check (kind in ('offer', 'transaction')),
  listing_id uuid references public.listings (id) on delete set null,
  external_ref text,
  property_type public.property_type,
  municipality text,
  postal_code text,
  rooms numeric(3, 1),
  living_area numeric(8, 1),
  price numeric(14, 2) not null check (price > 0),
  price_per_sqm numeric(10, 2),
  observed_at date not null,
  distance_km numeric(6, 2),
  similarity numeric(4, 3) check (similarity is null or similarity between 0 and 1),
  created_at timestamptz not null default now()
);
create index valuation_comparables_valuation_idx on public.valuation_comparables (valuation_id);

-- -----------------------------------------------------------------------------
-- Job-Warteschlange (KI, Bilder, PDFs)
-- -----------------------------------------------------------------------------
create table public.ai_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  job_type public.job_type not null,
  status public.job_status not null default 'queued',
  property_id uuid references public.properties (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  input jsonb not null default '{}'::jsonb,
  result jsonb,
  error_message text,
  attempts smallint not null default 0,
  max_attempts smallint not null default 3 check (max_attempts between 1 and 10),
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  started_at timestamptz,
  finished_at timestamptz,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_generation_jobs_user_idx on public.ai_generation_jobs (user_id, created_at desc);
create index ai_generation_jobs_pending_idx on public.ai_generation_jobs (run_after) where status in ('queued', 'running');
create trigger ai_generation_jobs_set_updated_at before update on public.ai_generation_jobs
  for each row execute function public.set_updated_at();

create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  job_id uuid references public.ai_generation_jobs (id) on delete set null,
  feature text not null check (feature in (
    'description', 'valuation_explanation', 'assistant', 'image_enhance', 'virtual_staging', 'perspective')),
  provider text not null,
  model text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  image_count integer not null default 0 check (image_count >= 0),
  cost_usd numeric(10, 5) not null default 0 check (cost_usd >= 0),
  success boolean not null default true,
  created_at timestamptz not null default now()
);
create index ai_usage_events_user_feature_idx on public.ai_usage_events (user_id, feature, created_at desc);
create index ai_usage_events_created_idx on public.ai_usage_events (created_at desc);

create table public.generated_descriptions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  user_id uuid references public.profiles (id) on delete set null,
  style public.description_style not null,
  content jsonb not null,
  model text,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);
create index generated_descriptions_property_idx on public.generated_descriptions (property_id, created_at desc);

create table public.image_transformations (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null references public.property_images (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  provider text not null,
  kind text not null default 'enhance' check (kind in ('enhance', 'virtual_staging', 'perspective', 'crop')),
  operations jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed', 'accepted', 'discarded')),
  output_path text,
  error_message text,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index image_transformations_image_idx on public.image_transformations (image_id, created_at desc);
create trigger image_transformations_set_updated_at before update on public.image_transformations
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Verkaufsdossiers
-- -----------------------------------------------------------------------------
create table public.dossier_templates (
  id text primary key check (id ~ '^[a-z0-9_]{2,40}$'),
  name text not null,
  description text,
  is_premium boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.generated_dossiers (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  template_id text not null references public.dossier_templates (id),
  version integer not null check (version >= 1),
  status text not null default 'ready' check (status in ('generating', 'ready', 'failed')),
  storage_path text,
  file_size integer,
  page_count integer,
  options jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  error_message text,
  created_at timestamptz not null default now(),
  unique (property_id, version)
);
create index generated_dossiers_property_idx on public.generated_dossiers (property_id, version desc);
create unique index generated_dossiers_one_public on public.generated_dossiers (property_id) where is_public;
