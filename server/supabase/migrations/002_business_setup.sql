-- ============================================================
-- Business Setup Flow — Schema Changes
-- ============================================================

-- ── New columns on businesses ──
alter table businesses
  add column description text,
  add column business_prompt_context text,
  add column owner_id uuid references auth.users(id) on delete set null;

create index idx_businesses_owner on businesses (owner_id);

-- ── Notifications table (new customer alerts for business owners) ──
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  type        text not null default 'new_customer',
  payload     jsonb not null default '{}'::jsonb,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index idx_notifications_business_read
  on notifications (business_id, read, created_at desc);

alter table notifications enable row level security;

-- Owners can read/update their own notifications
create policy "owners_manage_notifications"
  on notifications for all
  using (
    business_id in (
      select id from businesses where owner_id = auth.uid()
    )
  )
  with check (
    business_id in (
      select id from businesses where owner_id = auth.uid()
    )
  );

-- ── Business setup sessions table ──
create table business_setup_sessions (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users(id) on delete cascade,
  business_id      uuid references businesses(id) on delete set null,
  collected_config jsonb not null default '{}'::jsonb,
  state            text not null default 'in_progress'
    check (state in ('in_progress', 'completed', 'abandoned')),
  started_at       timestamptz not null default now(),
  completed_at     timestamptz
);

create index idx_setup_sessions_owner
  on business_setup_sessions (owner_id, state);

alter table business_setup_sessions enable row level security;

-- Owners can manage their own setup sessions
create policy "owners_manage_setup_sessions"
  on business_setup_sessions for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ── Setup conversation log ──
create table setup_conversation_log (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references business_setup_sessions(id) on delete cascade,
  role        text not null check (role in ('user', 'model')),
  content     text not null,
  function_calls jsonb,
  sent_at     timestamptz not null default now()
);

create index idx_setup_conversation_session_sent
  on setup_conversation_log (session_id, sent_at);

alter table setup_conversation_log enable row level security;

-- Owners can manage conversation logs for their own setup sessions
create policy "owners_manage_setup_conversation"
  on setup_conversation_log for all
  using (
    session_id in (
      select id from business_setup_sessions where owner_id = auth.uid()
    )
  )
  with check (
    session_id in (
      select id from business_setup_sessions where owner_id = auth.uid()
    )
  );

-- ── Update businesses RLS: owners access via owner_id ──

-- Add owner-based policy for businesses (alongside existing app_metadata policy)
create policy "owners_manage_own_business"
  on businesses for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Owners can manage schema for their own businesses
create policy "owners_manage_own_schema"
  on onboarding_schema for all
  using (
    business_id in (
      select id from businesses where owner_id = auth.uid()
    )
  )
  with check (
    business_id in (
      select id from businesses where owner_id = auth.uid()
    )
  );

-- Owners can view customers for their own businesses
create policy "owners_read_own_customers"
  on customers for select
  using (
    business_id in (
      select id from businesses where owner_id = auth.uid()
    )
  );

-- Owners can view sessions for their own businesses
create policy "owners_read_own_sessions"
  on onboarding_sessions for select
  using (
    business_id in (
      select id from businesses where owner_id = auth.uid()
    )
  );
