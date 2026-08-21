-- ============================================================
-- IOS Field App — Database Schema
-- Supabase project: gdfbpvzatnqmzujagtqm
-- All tables use ios_ prefix for isolation.
-- Run this once to initialise the schema.
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- REFERENCE TABLES
-- ============================================================

create table if not exists ios_retailers (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists ios_brands (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  logo_url   text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists ios_stores (
  id                    uuid primary key default uuid_generate_v4(),
  retailer_id           uuid not null references ios_retailers(id),
  store_number          text,
  name                  text not null,
  address               text,
  suburb                text not null,
  state                 text not null,
  postcode              text,
  latitude              numeric(10,7),
  longitude             numeric(10,7),
  is_active             boolean not null default true,
  visit_frequency_days  int,
  created_at            timestamptz not null default now()
);

-- Which brands are sold at which stores (many-to-many)
create table if not exists ios_store_brands (
  store_id   uuid not null references ios_stores(id) on delete cascade,
  brand_id   uuid not null references ios_brands(id) on delete cascade,
  is_active  boolean not null default true,
  primary key (store_id, brand_id)
);

-- Internal store notes — NEVER flows to client reporting
create table if not exists ios_store_internal_notes (
  id         uuid primary key default uuid_generate_v4(),
  store_id   uuid not null references ios_stores(id) on delete cascade,
  author_id  uuid not null references auth.users(id),
  note       text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- REP PROFILES
-- ============================================================

create table if not exists ios_rep_profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text not null,
  full_name          text not null,
  role               text not null default 'rep' check (role in ('rep', 'manager', 'admin')),
  state_territory    text,
  headshot_url       text,
  is_active          boolean not null default false,  -- admin must activate
  terms_accepted_at  timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Which stores a rep is assigned to
create table if not exists ios_rep_stores (
  rep_id    uuid not null references ios_rep_profiles(id) on delete cascade,
  store_id  uuid not null references ios_stores(id) on delete cascade,
  primary key (rep_id, store_id)
);

-- Which brands a rep covers
create table if not exists ios_rep_brands (
  rep_id    uuid not null references ios_rep_profiles(id) on delete cascade,
  brand_id  uuid not null references ios_brands(id) on delete cascade,
  primary key (rep_id, brand_id)
);

-- ============================================================
-- VISITS
-- ============================================================

create table if not exists ios_visits (
  id                  uuid primary key,
  store_id            uuid not null references ios_stores(id),
  rep_id              uuid not null references ios_rep_profiles(id),
  visit_type          text not null default 'physical' check (visit_type in ('physical', 'remote')),
  checkin_at          timestamptz not null,
  checkin_gps_lat     numeric(10,7),
  checkin_gps_lng     numeric(10,7),
  checkout_at         timestamptz,
  checkout_gps_lat    numeric(10,7),
  checkout_gps_lng    numeric(10,7),
  duration_minutes    int,
  synced_from_offline boolean not null default false,
  created_at          timestamptz not null default now()
);

-- Brands serviced during a visit (one visit can cover multiple brands)
create table if not exists ios_visit_brands (
  visit_id  uuid not null references ios_visits(id) on delete cascade,
  brand_id  uuid not null references ios_brands(id) on delete cascade,
  primary key (visit_id, brand_id)
);

-- ============================================================
-- STORE FEEDBACK (per visit, per brand)
-- ============================================================

create table if not exists ios_visit_feedback (
  id                    uuid primary key default uuid_generate_v4(),
  visit_id              uuid not null references ios_visits(id) on delete cascade,
  brand_id              uuid references ios_brands(id),
  store_vibe            text,
  sales_sentiment       text,
  affecting_sales       text[],          -- array of selected options
  what_would_help       text[],
  store_changes         text[],
  store_changes_notes   text,
  relationship_rating   text,
  potential_issues      text[],
  follow_up_required    boolean not null default false,
  follow_up_notes       text,
  created_at            timestamptz not null default now()
);

-- ============================================================
-- PHOTOS
-- ============================================================

create table if not exists ios_photos (
  id                    uuid primary key,
  visit_id              uuid not null references ios_visits(id) on delete cascade,
  store_id              uuid not null references ios_stores(id),
  brand_id              uuid references ios_brands(id),
  rep_id                uuid not null references ios_rep_profiles(id),
  category              text not null,
  photo_url             text not null,
  is_before             boolean not null default false,
  is_after              boolean not null default false,
  before_after_group_id uuid,            -- links before/after pairs
  visit_date            date not null,   -- AEST business date
  retailer_id           uuid references ios_retailers(id),
  notes                 text,
  sync_status           text not null default 'synced',
  created_at            timestamptz not null default now()
);

-- ============================================================
-- SURVEYS (flexible key-value, supports custom brand forms)
-- ============================================================

create table if not exists ios_survey_responses (
  id          uuid primary key default uuid_generate_v4(),
  visit_id    uuid not null references ios_visits(id) on delete cascade,
  brand_id    uuid references ios_brands(id),
  survey_key  text not null,   -- e.g. "compliance_check", "display_audit"
  question    text not null,
  answer      text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- ACTION TRACKER
-- ============================================================

create table if not exists ios_actions (
  id           uuid primary key default uuid_generate_v4(),
  store_id     uuid not null references ios_stores(id),
  brand_id     uuid references ios_brands(id),
  visit_id     uuid references ios_visits(id),
  raised_by    uuid not null references ios_rep_profiles(id),
  assigned_to  uuid references ios_rep_profiles(id),
  title        text not null,
  description  text,
  status       text not null default 'identified'
               check (status in ('identified', 'assigned', 'in_progress', 'resolved')),
  resolved_at  timestamptz,
  due_date     date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table ios_retailers            enable row level security;
alter table ios_brands               enable row level security;
alter table ios_stores               enable row level security;
alter table ios_store_brands         enable row level security;
alter table ios_store_internal_notes enable row level security;
alter table ios_rep_profiles         enable row level security;
alter table ios_rep_stores           enable row level security;
alter table ios_rep_brands           enable row level security;
alter table ios_visits               enable row level security;
alter table ios_visit_brands         enable row level security;
alter table ios_visit_feedback       enable row level security;
alter table ios_photos               enable row level security;
alter table ios_survey_responses     enable row level security;
alter table ios_actions              enable row level security;

-- Helper: is the current user an active IOS rep?
create or replace function ios_is_active_rep()
returns boolean language sql security definer as $$
  select exists (
    select 1 from ios_rep_profiles
    where id = auth.uid() and is_active = true
  )
$$;

-- Helper: is the current user a manager or admin?
create or replace function ios_is_manager()
returns boolean language sql security definer as $$
  select exists (
    select 1 from ios_rep_profiles
    where id = auth.uid() and is_active = true
      and role in ('manager', 'admin')
  )
$$;

-- Reference tables: any active rep can read
create policy "active reps can read retailers" on ios_retailers
  for select using (ios_is_active_rep());

create policy "active reps can read brands" on ios_brands
  for select using (ios_is_active_rep());

create policy "active reps can read stores" on ios_stores
  for select using (ios_is_active_rep());

create policy "active reps can read store_brands" on ios_store_brands
  for select using (ios_is_active_rep());

-- Internal notes: managers/admins only
create policy "managers can read internal notes" on ios_store_internal_notes
  for select using (ios_is_manager());

create policy "managers can insert internal notes" on ios_store_internal_notes
  for insert with check (ios_is_manager() and author_id = auth.uid());

-- Rep profiles: reps can read their own; managers can read all active
create policy "reps read own profile" on ios_rep_profiles
  for select using (id = auth.uid());

create policy "managers read all active profiles" on ios_rep_profiles
  for select using (ios_is_manager() and is_active = true);

create policy "reps update own profile" on ios_rep_profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- Rep-store and rep-brand assignments
create policy "reps read own store assignments" on ios_rep_stores
  for select using (rep_id = auth.uid());

create policy "managers read all store assignments" on ios_rep_stores
  for select using (ios_is_manager());

create policy "reps read own brand assignments" on ios_rep_brands
  for select using (rep_id = auth.uid());

create policy "managers read all brand assignments" on ios_rep_brands
  for select using (ios_is_manager());

-- Visits: reps see own visits; managers see all
create policy "reps insert own visits" on ios_visits
  for insert with check (rep_id = auth.uid() and ios_is_active_rep());

create policy "reps read own visits" on ios_visits
  for select using (rep_id = auth.uid());

create policy "managers read all visits" on ios_visits
  for select using (ios_is_manager());

-- Visit brands
create policy "reps insert visit brands" on ios_visit_brands
  for insert with check (
    ios_is_active_rep() and
    exists (select 1 from ios_visits where id = visit_id and rep_id = auth.uid())
  );

create policy "reps read own visit brands" on ios_visit_brands
  for select using (
    exists (select 1 from ios_visits where id = visit_id and rep_id = auth.uid())
  );

create policy "managers read all visit brands" on ios_visit_brands
  for select using (ios_is_manager());

-- Visit feedback
create policy "reps insert own feedback" on ios_visit_feedback
  for insert with check (
    ios_is_active_rep() and
    exists (select 1 from ios_visits where id = visit_id and rep_id = auth.uid())
  );

create policy "reps read own feedback" on ios_visit_feedback
  for select using (
    exists (select 1 from ios_visits where id = visit_id and rep_id = auth.uid())
  );

create policy "managers read all feedback" on ios_visit_feedback
  for select using (ios_is_manager());

-- Photos
create policy "reps insert own photos" on ios_photos
  for insert with check (rep_id = auth.uid() and ios_is_active_rep());

create policy "reps read own photos" on ios_photos
  for select using (rep_id = auth.uid());

create policy "managers read all photos" on ios_photos
  for select using (ios_is_manager());

-- Survey responses
create policy "reps insert survey responses" on ios_survey_responses
  for insert with check (
    ios_is_active_rep() and
    exists (select 1 from ios_visits where id = visit_id and rep_id = auth.uid())
  );

create policy "reps read own survey responses" on ios_survey_responses
  for select using (
    exists (select 1 from ios_visits where id = visit_id and rep_id = auth.uid())
  );

create policy "managers read all survey responses" on ios_survey_responses
  for select using (ios_is_manager());

-- Actions
create policy "reps insert actions" on ios_actions
  for insert with check (raised_by = auth.uid() and ios_is_active_rep());

create policy "reps read own actions" on ios_actions
  for select using (raised_by = auth.uid() or assigned_to = auth.uid());

create policy "managers read all actions" on ios_actions
  for select using (ios_is_manager());

create policy "managers update actions" on ios_actions
  for update using (ios_is_manager());

-- ============================================================
-- STORAGE BUCKET
-- Run in Supabase dashboard Storage section if not already created.
-- Bucket name: ios-photos | Public: false | File size limit: 5MB
-- ============================================================

-- ============================================================
-- SEED DATA
-- Update with real brand and retailer names once confirmed.
-- ============================================================

insert into ios_retailers (name) values
  ('Harvey Norman'),
  ('The Good Guys'),
  ('JB Hi-Fi'),
  ('Bing Lee'),
  ('Joyce Mayne')
on conflict do nothing;

-- Placeholder brands — replace with actual IOS client brands
insert into ios_brands (name) values
  ('Brand A'),
  ('Brand B'),
  ('Brand C'),
  ('Brand D'),
  ('Brand E')
on conflict do nothing;
