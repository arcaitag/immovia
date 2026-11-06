-- =============================================================================
-- Immovia · Migration 4: Merkliste, Suchabos, Aufrufe, Anfragen, Chat, Leads,
-- Besichtigungen, Benachrichtigungen, Betrieb
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Suche und Interaktionen
-- -----------------------------------------------------------------------------
create table public.favorites (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index favorites_listing_idx on public.favorites (listing_id);

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  criteria jsonb not null default '{}'::jsonb,
  alert_enabled boolean not null default true,
  alert_frequency text not null default 'instant' check (alert_frequency in ('instant', 'daily', 'weekly')),
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index saved_searches_user_idx on public.saved_searches (user_id);
create index saved_searches_alert_idx on public.saved_searches ((criteria ->> 'offer')) where alert_enabled;
create trigger saved_searches_set_updated_at before update on public.saved_searches
  for each row execute function public.set_updated_at();

-- Verhindert doppelte Benachrichtigungen: pro Suchabo und Inserat genau ein Treffer
create table public.saved_search_matches (
  saved_search_id uuid not null references public.saved_searches (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  matched_at timestamptz not null default now(),
  notified_at timestamptz,
  primary key (saved_search_id, listing_id)
);
create index saved_search_matches_pending_idx on public.saved_search_matches (matched_at) where notified_at is null;

-- Datenschutzfreundliche Aufrufstatistik: gehashte Besucherkennung, pro Tag einmal
create table public.listing_views (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  viewer_hash text not null check (char_length(viewer_hash) between 16 and 128),
  view_date date not null default (now() at time zone 'Europe/Zurich')::date,
  is_authenticated boolean not null default false,
  created_at timestamptz not null default now(),
  unique (listing_id, viewer_hash, view_date)
);
create index listing_views_listing_date_idx on public.listing_views (listing_id, view_date);

-- -----------------------------------------------------------------------------
-- Kommunikation
-- -----------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings (id) on delete set null,
  seller_id uuid references public.profiles (id) on delete set null,
  interested_id uuid references public.profiles (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  subject text check (char_length(subject) <= 200),
  last_message_at timestamptz,
  last_message_preview text check (char_length(last_message_preview) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index conversations_listing_interested_key on public.conversations (listing_id, interested_id)
  where listing_id is not null and interested_id is not null;
create index conversations_seller_idx on public.conversations (seller_id, last_message_at desc);
create index conversations_interested_idx on public.conversations (interested_id, last_message_at desc);
create index conversations_org_idx on public.conversations (organization_id) where organization_id is not null;
create trigger conversations_set_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('seller', 'interested', 'team')),
  last_read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_participants_user_idx on public.conversation_participants (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid default auth.uid() references public.profiles (id) on delete set null,
  kind text not null default 'text' check (kind in ('text', 'system')),
  body text not null check (char_length(body) between 1 and 5000),
  attachment_path text,
  attachment_name text check (char_length(attachment_name) <= 200),
  attachment_mime text check (attachment_mime is null or attachment_mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  attachment_size integer check (attachment_size is null or attachment_size between 1 and 10485760),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index messages_conversation_idx on public.messages (conversation_id, created_at desc);
create index messages_sender_idx on public.messages (sender_id, created_at desc);

create table public.user_blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index user_blocks_blocked_idx on public.user_blocks (blocked_id);

create table public.listing_inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  message text not null check (char_length(message) between 10 and 3000),
  phone text check (phone is null or phone ~ '^\+?[0-9 ()/-]{6,24}$'),
  wants_viewing boolean not null default false,
  wants_dossier boolean not null default false,
  created_at timestamptz not null default now()
);
create index listing_inquiries_listing_idx on public.listing_inquiries (listing_id, created_at desc);
create index listing_inquiries_sender_idx on public.listing_inquiries (sender_id);

-- Leads: ausschliesslich für die Verkäuferseite sichtbar
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  interested_id uuid references public.profiles (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  status public.lead_status not null default 'new',
  source text not null default 'inquiry' check (source in ('inquiry', 'viewing', 'manual')),
  rating smallint check (rating is null or rating between 1 and 5),
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index leads_listing_interested_key on public.leads (listing_id, interested_id) where interested_id is not null;
create index leads_owner_idx on public.leads (owner_id, last_activity_at desc);
create index leads_org_idx on public.leads (organization_id) where organization_id is not null;
create trigger leads_set_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

create table public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  author_id uuid default auth.uid() references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lead_notes_lead_idx on public.lead_notes (lead_id, created_at desc);
create trigger lead_notes_set_updated_at before update on public.lead_notes
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Besichtigungen (Zeitfenster und Termine). Zeiten als timestamptz,
-- Anzeige immer in Europe/Zurich.
-- -----------------------------------------------------------------------------
create table public.viewing_slots (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity smallint not null default 1 check (capacity between 1 and 50),
  note text check (char_length(note) <= 300),
  is_cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint viewing_slots_time_check check (ends_at > starts_at and ends_at - starts_at <= interval '8 hours'),
  constraint viewing_slots_no_overlap exclude using gist (
    listing_id extensions.gist_uuid_ops with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (not is_cancelled)
);
create index viewing_slots_listing_idx on public.viewing_slots (listing_id, starts_at);
create trigger viewing_slots_set_updated_at before update on public.viewing_slots
  for each row execute function public.set_updated_at();

create table public.viewing_appointments (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid references public.viewing_slots (id) on delete set null,
  listing_id uuid not null references public.listings (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  guest_id uuid references public.profiles (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'requested',
  guest_message text check (char_length(guest_message) <= 1000),
  cancel_reason text check (char_length(cancel_reason) <= 500),
  cancelled_by uuid references public.profiles (id) on delete set null,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create unique index viewing_appointments_one_active_per_guest on public.viewing_appointments (listing_id, guest_id)
  where status in ('requested', 'confirmed', 'reschedule_requested') and guest_id is not null;
create index viewing_appointments_slot_idx on public.viewing_appointments (slot_id)
  where status in ('requested', 'confirmed', 'reschedule_requested');
create index viewing_appointments_owner_idx on public.viewing_appointments (owner_id, starts_at);
create index viewing_appointments_guest_idx on public.viewing_appointments (guest_id, starts_at);
create trigger viewing_appointments_set_updated_at before update on public.viewing_appointments
  for each row execute function public.set_updated_at();

-- Private Verkäufernotizen zu Terminen (für Gäste nie lesbar)
create table public.viewing_appointment_notes (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.viewing_appointments (id) on delete cascade,
  author_id uuid default auth.uid() references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index viewing_appointment_notes_appointment_idx on public.viewing_appointment_notes (appointment_id);

-- -----------------------------------------------------------------------------
-- Benachrichtigungen und E-Mail-Versand
-- -----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type ~ '^[a-z_]{3,40}$'),
  title text not null check (char_length(title) <= 160),
  body text check (char_length(body) <= 500),
  link text check (link is null or link ~ '^/'),
  data jsonb not null default '{}'::jsonb,
  group_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_group_idx on public.notifications (user_id, group_key) where read_at is null and group_key is not null;

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  to_email text,
  template text not null check (template ~ '^[a-z_]{3,40}$'),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts smallint not null default 0,
  last_error text,
  dedupe_key text unique,
  scheduled_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  created_at timestamptz not null default now(),
  check (user_id is not null or to_email is not null)
);
create index email_outbox_pending_idx on public.email_outbox (scheduled_at) where status in ('pending', 'sending');

-- -----------------------------------------------------------------------------
-- Moderation, Administration, Konfiguration
-- -----------------------------------------------------------------------------
create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid default auth.uid() references public.profiles (id) on delete set null,
  target_type text not null check (target_type in ('listing', 'user', 'message', 'conversation', 'organization')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'fraud', 'inappropriate', 'wrong_information', 'discrimination', 'duplicate', 'other')),
  details text check (char_length(details) <= 2000),
  status public.report_status not null default 'open',
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  resolution_note text check (char_length(resolution_note) <= 2000),
  created_at timestamptz not null default now()
);
create index user_reports_status_idx on public.user_reports (status, created_at desc);
create index user_reports_target_idx on public.user_reports (target_type, target_id);
create unique index user_reports_one_open_per_reporter on public.user_reports (reporter_id, target_type, target_id)
  where status in ('open', 'in_review');

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (char_length(action) <= 60),
  target_type text not null,
  target_id uuid not null,
  reason text check (char_length(reason) <= 1000),
  report_id uuid references public.user_reports (id) on delete set null,
  created_at timestamptz not null default now()
);
create index moderation_actions_target_idx on public.moderation_actions (target_type, target_id);

create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (char_length(action) <= 80),
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);
create index admin_audit_logs_entity_idx on public.admin_audit_logs (entity_type, entity_id);

create table public.feature_settings (
  key text primary key check (key ~ '^[a-z_]{2,60}$'),
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('user', 'property', 'organization')),
  subject_id uuid not null,
  kind public.verification_kind not null,
  status public.verification_status not null default 'pending',
  method text check (char_length(method) <= 200),
  notes text check (char_length(notes) <= 2000),
  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index verifications_subject_idx on public.verifications (subject_type, subject_id, kind);
create trigger verifications_set_updated_at before update on public.verifications
  for each row execute function public.set_updated_at();

create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  subject text not null check (char_length(subject) between 2 and 160),
  message text not null check (char_length(message) between 10 and 4000),
  user_id uuid references public.profiles (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'answered', 'closed', 'spam')),
  created_at timestamptz not null default now()
);
create index contact_requests_status_idx on public.contact_requests (status, created_at desc);

create table public.rate_limit_buckets (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

create table public.assistant_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  property_id uuid references public.properties (id) on delete set null,
  title text not null default 'Neue Unterhaltung' check (char_length(title) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assistant_threads_user_idx on public.assistant_threads (user_id, updated_at desc);
create trigger assistant_threads_set_updated_at before update on public.assistant_threads
  for each row execute function public.set_updated_at();

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.assistant_threads (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 20000),
  created_at timestamptz not null default now()
);
create index assistant_messages_thread_idx on public.assistant_messages (thread_id, created_at);

-- -----------------------------------------------------------------------------
-- Vorbereitet für spätere Monetarisierung (noch ohne Bezahlprozess)
-- -----------------------------------------------------------------------------
create table public.plans (
  id text primary key check (id ~ '^[a-z0-9_]{2,40}$'),
  name text not null,
  audience text not null check (audience in ('private', 'business')),
  price_chf_monthly numeric(10, 2) not null default 0 check (price_chf_monthly >= 0),
  limits jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  plan_id text not null references public.plans (id),
  status text not null check (status in ('trialing', 'active', 'past_due', 'cancelled')),
  provider text,
  provider_reference text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or organization_id is not null)
);
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions (id) on delete set null,
  amount numeric(10, 2) not null check (amount >= 0),
  currency text not null default 'CHF',
  status text not null check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  provider text,
  provider_reference text,
  created_at timestamptz not null default now()
);
