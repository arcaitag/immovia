-- =============================================================================
-- Immovia · Migration 1: Extensions, Typen, Benutzer, Organisationen
-- =============================================================================

create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

-- -----------------------------------------------------------------------------
-- Aufzählungstypen
-- -----------------------------------------------------------------------------
create type public.account_type as enum ('private', 'business');
create type public.user_status as enum ('active', 'suspended', 'deleted');
create type public.app_role as enum ('admin', 'moderator');
create type public.org_role as enum ('owner', 'admin', 'member');

create type public.property_type as enum (
  'apartment', 'single_family_house', 'semi_detached_house', 'terraced_house',
  'multi_family_house', 'plot', 'commercial', 'office', 'new_build_project', 'other'
);
create type public.offer_type as enum ('sale', 'rent');
create type public.ownership_type as enum ('condominium', 'sole', 'co_ownership', 'building_right', 'other');
create type public.property_condition as enum ('new_build', 'as_new', 'good', 'needs_refresh', 'needs_renovation');
create type public.heating_type as enum (
  'heat_pump', 'district_heating', 'gas', 'oil', 'wood', 'pellets', 'electric', 'solar', 'other'
);
create type public.location_precision as enum ('exact', 'street', 'area');
create type public.listing_status as enum (
  'draft', 'in_progress', 'ready', 'pending_review', 'published',
  'paused', 'reserved', 'sold', 'rented', 'archived'
);
create type public.moderation_status as enum ('ok', 'flagged', 'blocked');
create type public.lead_status as enum (
  'new', 'in_contact', 'dossier_sent', 'viewing_requested', 'viewing_confirmed',
  'viewing_done', 'highly_interested', 'financing_check', 'offer_received', 'declined', 'closed'
);
create type public.appointment_status as enum (
  'requested', 'confirmed', 'reschedule_requested', 'cancelled', 'completed', 'no_show'
);
create type public.document_category as enum (
  'floor_plan', 'land_register', 'renovation_receipt', 'service_charges', 'regulations',
  'minutes', 'building_insurance', 'energy_certificate', 'sales_dossier', 'other'
);
create type public.document_visibility as enum ('owner', 'organization', 'public');
create type public.job_type as enum (
  'valuation', 'description', 'image_enhance', 'virtual_staging', 'dossier_pdf'
);
create type public.job_status as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');
create type public.valuation_status as enum ('completed', 'limited', 'insufficient_data', 'failed');
create type public.confidence_level as enum ('none', 'low', 'medium', 'high');
create type public.report_status as enum ('open', 'in_review', 'resolved', 'dismissed');
create type public.verification_kind as enum ('identity', 'ownership', 'documentation_complete', 'organization');
create type public.verification_status as enum ('pending', 'verified', 'rejected', 'revoked');
create type public.description_style as enum ('factual', 'modern', 'elegant', 'emotional', 'premium');

-- -----------------------------------------------------------------------------
-- Generische Hilfsfunktionen
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Wandelt Text in einen URL-tauglichen Slug (Schweizer Umlaute: ä -> ae usw.)
create or replace function public.slugify(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    translate(
      replace(replace(replace(replace(lower(coalesce(p_value, '')), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'),
      'àáâãåèéêëìíîïòóôõùúûýÿçñ',
      'aaaaaeeeeiiiiooooouuuyycn'
    ),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

-- Sicheres Umwandeln von Text in UUID (für Storage-Pfade), liefert NULL statt Fehler
create or replace function public.try_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_value::uuid;
exception when others then
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Benutzer
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  email_verified_at timestamptz,
  first_name text check (char_length(first_name) <= 80),
  last_name text check (char_length(last_name) <= 80),
  display_name text not null default 'Immovia-Mitglied' check (char_length(display_name) between 1 and 80),
  phone text check (phone is null or phone ~ '^\+?[0-9 ()/-]{6,24}$'),
  avatar_path text,
  account_type public.account_type not null default 'private',
  status public.user_status not null default 'active',
  status_reason text check (char_length(status_reason) <= 500),
  status_changed_at timestamptz,
  locale text not null default 'de-CH' check (locale in ('de-CH', 'fr-CH', 'it-CH', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
comment on table public.profiles is 'Private Profildaten. Nur für den Benutzer selbst und Moderatoren lesbar.';
create index profiles_status_idx on public.profiles (status);
create index profiles_email_idx on public.profiles (lower(email));
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Öffentlich sichtbare Minimalangaben (keine Kontaktdaten)
create table public.public_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  display_name text not null,
  avatar_path text,
  account_type public.account_type not null default 'private',
  organization_id uuid,
  member_since timestamptz not null default now(),
  email_verified boolean not null default false,
  identity_verified boolean not null default false,
  has_public_listings boolean not null default false,
  updated_at timestamptz not null default now()
);
comment on table public.public_profiles is 'Öffentliche Visitenkarte. Wird per Trigger aus profiles/verifications gepflegt.';

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  default_offer_type public.offer_type,
  default_location_label text check (char_length(default_location_label) <= 120),
  analytics_consent boolean not null default false,
  marketing_consent boolean not null default false,
  ai_processing_consent boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger user_preferences_set_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();

create table public.user_notification_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email_new_message boolean not null default true,
  email_new_inquiry boolean not null default true,
  email_viewings boolean not null default true,
  email_search_alerts boolean not null default true,
  email_listing_updates boolean not null default true,
  email_documents boolean not null default true,
  email_product_news boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger user_notification_settings_set_updated_at before update on public.user_notification_settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Organisationen (Immobilienfirmen, Makler, Verwaltungen)
-- -----------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  logo_path text,
  description text check (char_length(description) <= 4000),
  street text check (char_length(street) <= 120),
  postal_code text check (postal_code is null or postal_code ~ '^[1-9][0-9]{3}$'),
  city text check (char_length(city) <= 80),
  canton text check (canton is null or canton in (
    'AG','AI','AR','BE','BL','BS','FR','GE','GL','GR','JU','LU','NE','NW','OW','SG','SH','SO','SZ','TG','TI','UR','VD','VS','ZG','ZH')),
  phone text check (phone is null or phone ~ '^\+?[0-9 ()/-]{6,24}$'),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  website text check (website is null or website ~* '^https?://'),
  uid_number text check (uid_number is null or uid_number ~ '^CHE-?[0-9]{3}\.?[0-9]{3}\.?[0-9]{3}$'),
  is_public boolean not null default true,
  status text not null default 'active' check (status in ('active', 'suspended')),
  plan_id text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create trigger organizations_set_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();

alter table public.public_profiles
  add constraint public_profiles_organization_fk
  foreign key (organization_id) references public.organizations (id) on delete set null;
create index public_profiles_organization_idx on public.public_profiles (organization_id);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.org_role not null default 'member',
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);
create unique index organization_members_one_owner on public.organization_members (organization_id) where role = 'owner';

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.org_role not null default 'member' check (role <> 'owner'),
  token_hash text not null unique,
  invited_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index organization_invitations_org_idx on public.organization_invitations (organization_id);
create unique index organization_invitations_open_email on public.organization_invitations (organization_id, lower(email))
  where accepted_at is null and revoked_at is null;
