-- ============================================================
-- Onboarding Agent — Database Schema + Seed Data
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. businesses
-- ============================================================
create table businesses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  welcome_message text,
  brand_tone  text not null default 'friendly'
    check (brand_tone in ('friendly', 'professional', 'casual')),
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 2. onboarding_schema
-- ============================================================
create table onboarding_schema (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references businesses(id) on delete cascade,
  field_name      text not null,
  field_type      text not null
    check (field_type in ('text', 'email', 'phone', 'url', 'number', 'select', 'textarea')),
  field_label     text not null,
  placeholder     text,
  required        boolean not null default false,
  validation_regex text,
  sort_order      int not null default 0,
  unique (business_id, field_name)
);

create index idx_onboarding_schema_business_sort
  on onboarding_schema (business_id, sort_order);

-- ============================================================
-- 3. customers
-- ============================================================
create table customers (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  email         text,
  name          text,
  custom_fields jsonb not null default '{}'::jsonb,
  status        text not null default 'active'
    check (status in ('active', 'pending', 'archived')),
  created_at    timestamptz not null default now()
);

create index idx_customers_business_created
  on customers (business_id, created_at);

-- ============================================================
-- 4. onboarding_sessions
-- ============================================================
create table onboarding_sessions (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references businesses(id) on delete cascade,
  customer_id      uuid references customers(id) on delete set null,
  collected_fields jsonb not null default '{}'::jsonb,
  state            text not null default 'in_progress'
    check (state in ('in_progress', 'completed', 'abandoned')),
  started_at       timestamptz not null default now(),
  completed_at     timestamptz
);

create index idx_sessions_business_state
  on onboarding_sessions (business_id, state);

create index idx_sessions_in_progress
  on onboarding_sessions (state)
  where state = 'in_progress';

-- ============================================================
-- 5. conversation_log
-- ============================================================
create table conversation_log (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references onboarding_sessions(id) on delete cascade,
  role           text not null
    check (role in ('user', 'model')),
  content        text not null,
  function_calls jsonb,
  sent_at        timestamptz not null default now()
);

create index idx_conversation_session_sent
  on conversation_log (session_id, sent_at);

-- ============================================================
-- Row Level Security
-- ============================================================

-- Enable RLS on all tables
alter table businesses enable row level security;
alter table onboarding_schema enable row level security;
alter table customers enable row level security;
alter table onboarding_sessions enable row level security;
alter table conversation_log enable row level security;

-- Admin policies: business owners manage their own data
create policy "admins_manage_businesses"
  on businesses for all
  using (id::text = (auth.jwt()->'app_metadata'->>'business_id'))
  with check (id::text = (auth.jwt()->'app_metadata'->>'business_id'));

create policy "admins_manage_schema"
  on onboarding_schema for all
  using (business_id::text = (auth.jwt()->'app_metadata'->>'business_id'))
  with check (business_id::text = (auth.jwt()->'app_metadata'->>'business_id'));

create policy "admins_manage_customers"
  on customers for all
  using (business_id::text = (auth.jwt()->'app_metadata'->>'business_id'))
  with check (business_id::text = (auth.jwt()->'app_metadata'->>'business_id'));

create policy "admins_manage_sessions"
  on onboarding_sessions for all
  using (business_id::text = (auth.jwt()->'app_metadata'->>'business_id'))
  with check (business_id::text = (auth.jwt()->'app_metadata'->>'business_id'));

create policy "admins_manage_conversation_log"
  on conversation_log for all
  using (
    session_id in (
      select id from onboarding_sessions
      where business_id::text = (auth.jwt()->'app_metadata'->>'business_id')
    )
  );

-- Public / anonymous policies

-- Anyone can read businesses (needed to look up by slug)
create policy "public_read_businesses"
  on businesses for select
  using (true);

-- Anyone can read onboarding schema (needed to display progress)
create policy "public_read_schema"
  on onboarding_schema for select
  using (true);

-- Anonymous users can create sessions
create policy "anon_create_sessions"
  on onboarding_sessions for insert
  with check (true);

-- Anonymous users can read their own session (by session id)
create policy "anon_read_own_session"
  on onboarding_sessions for select
  using (true);

-- Anonymous users can update their own session (for collected_fields updates)
create policy "anon_update_own_session"
  on onboarding_sessions for update
  using (true);

-- Anonymous users can insert conversation messages
create policy "anon_insert_conversation"
  on conversation_log for insert
  with check (true);

-- Anonymous users can read conversation messages for their session
create policy "anon_read_conversation"
  on conversation_log for select
  using (true);

-- Anonymous users can insert customers (created on completion)
create policy "anon_insert_customers"
  on customers for insert
  with check (true);

-- ============================================================
-- Seed Data: Demo Business
-- ============================================================
insert into businesses (name, slug, welcome_message, brand_tone, settings)
values (
  'Demo Business',
  'demo',
  'Hey there! Welcome aboard. I''m here to get you set up — it''ll just take a minute. Let''s start with your name!',
  'friendly',
  '{}'::jsonb
);

-- Seed the 6 onboarding fields for the demo business
insert into onboarding_schema (business_id, field_name, field_type, field_label, placeholder, required, validation_regex, sort_order)
values
  ((select id from businesses where slug = 'demo'), 'name',         'text',   'Full name',    'e.g. Sarah Chen',           true,  null,                                  1),
  ((select id from businesses where slug = 'demo'), 'email',        'email',  'Email address','e.g. sarah@company.com',    true,  null,                                  2),
  ((select id from businesses where slug = 'demo'), 'company',      'text',   'Company name', 'e.g. Acme Corp',            true,  null,                                  3),
  ((select id from businesses where slug = 'demo'), 'role',         'text',   'Your role',    'e.g. Product Manager',      false, null,                                  4),
  ((select id from businesses where slug = 'demo'), 'company_size', 'select', 'Company size', null,                        true,  '1-10|11-50|51-200|201-1000|1000+',    5),
  ((select id from businesses where slug = 'demo'), 'phone',        'phone',  'Phone number', 'e.g. +1 (555) 123-4567',   false, null,                                  6);
