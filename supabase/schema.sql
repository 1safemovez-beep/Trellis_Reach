-- Trellis Reach database schema (Supabase / Postgres)
-- Run this once in Supabase → SQL Editor → New query → Run.
-- Security model:
--   * Only people listed in team_members can read or change anything.
--   * Public funnel visitors never touch the database directly. Their leads arrive through
--     the server route /api/leads, which validates input and uses the service role key.

create extension if not exists "pgcrypto";

-- Team allowlist ---------------------------------------------------------------
create table if not exists team_members (
  email text primary key check (email = lower(email)),
  role text not null default 'member' check (role in ('owner','admin','member','closer','creator','affiliate')),
  created_at timestamptz not null default now()
);

create or replace function is_team() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from team_members
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from team_members
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and role in ('owner','admin')
  );
$$;

-- Core tables ------------------------------------------------------------------
create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  app text, audience text, problem text, result text, proof text, offer text, cta text, mood text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  business text,
  path text,
  source text,
  stage text not null default 'New' check (stage in ('New','Nurture','Booked','Won','Lost')),
  value numeric(12,2) not null default 0,
  closer text,
  goal text,
  notes text,
  consent_email boolean not null default false,
  consent_sms_calls boolean not null default false,
  example boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_created_idx on leads (created_at desc);
create index if not exists leads_stage_idx on leads (stage);
create index if not exists leads_source_idx on leads (source);

create table if not exists content (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  type text,
  business text,
  video_mode text,
  status text not null default 'Draft' check (status in ('Draft','Scheduled','Live','Archived')),
  scheduled_for timestamptz,
  example boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Video columns (added Oct 2026). Safe to run again.
alter table content add column if not exists video_id text;
alter table content add column if not exists video_status text;
alter table content add column if not exists hivecast_path text;

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null default 'Booking call',
  starts_at timestamptz not null,
  who text,
  business text,
  lead_id uuid references leads(id) on delete set null,
  example boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists bookings_starts_idx on bookings (starts_at);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) <= 2000),
  author_id uuid references auth.users(id) default auth.uid(),
  author_email text default (auth.jwt() ->> 'email'),
  created_at timestamptz not null default now()
);

create table if not exists settings (
  id text primary key default 'brand',
  app_name text not null default 'Trellis Reach',
  tagline text not null default 'Marketing App · by QVTrellis',
  logo text not null default 'TR',
  support_email text,
  updated_at timestamptz not null default now()
);
insert into settings (id) values ('brand') on conflict do nothing;

-- Keep updated_at fresh on leads
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists leads_touch on leads;
create trigger leads_touch before update on leads for each row execute function touch_updated_at();

-- Row level security -------------------------------------------------------------
alter table team_members enable row level security;
alter table businesses   enable row level security;
alter table leads        enable row level security;
alter table content      enable row level security;
alter table bookings     enable row level security;
alter table posts        enable row level security;
alter table settings     enable row level security;

-- team_members: team can see the list, only admins change it
drop policy if exists team_read on team_members;
create policy team_read on team_members for select using (is_team());
drop policy if exists team_admin on team_members;
create policy team_admin on team_members for all using (is_admin()) with check (is_admin());

-- Shared working tables: whole team reads and writes
do $$
declare t text;
begin
  foreach t in array array['businesses','leads','content','bookings'] loop
    execute format('drop policy if exists %I_team on %I', t, t);
    execute format('create policy %I_team on %I for all using (is_team()) with check (is_team())', t, t);
  end loop;
end $$;

-- Posts: team reads all; each person writes and deletes only their own
drop policy if exists posts_read on posts;
create policy posts_read on posts for select using (is_team());
drop policy if exists posts_insert on posts;
create policy posts_insert on posts for insert with check (is_team() and author_id = auth.uid());
drop policy if exists posts_delete on posts;
create policy posts_delete on posts for delete using (author_id = auth.uid() or is_admin());

-- Settings: team reads, admins change
drop policy if exists settings_read on settings;
create policy settings_read on settings for select using (is_team());
drop policy if exists settings_write on settings;
create policy settings_write on settings for update using (is_admin()) with check (is_admin());

-- Live updates for the dashboard
alter publication supabase_realtime add table leads, content, bookings, posts, businesses, settings;

-- FIRST-TIME SETUP: add yourself as owner (change the email, then run this line)
-- insert into team_members (email, role) values ('you@example.com', 'owner');

-- Hive Challenge (added Oct 2026): monthly creator contest. Prize rules are editable by admins.
create table if not exists challenge_rules (
  id text primary key default 'rules', cash_pct numeric not null default 10, credit_pct numeric not null default 15,
  high_stakes_min numeric not null default 3000, both_over_min boolean not null default true, finalists int not null default 5,
  updated_at timestamptz not null default now());
insert into challenge_rules (id) values ('rules') on conflict do nothing;
create table if not exists challenges (
  id uuid primary key default gen_random_uuid(), month text not null, client text not null, business text, brief text not null,
  budget numeric not null default 0, status text not null default 'Open' check (status in ('Open','Judging','Winner picked','Closed')),
  winner_entry uuid, created_by uuid references auth.users(id) default auth.uid(), created_at timestamptz not null default now());
create table if not exists challenge_entries (
  id uuid primary key default gen_random_uuid(), challenge_id uuid not null references challenges(id) on delete cascade,
  creator_id uuid references auth.users(id) default auth.uid(), creator_email text default (auth.jwt() ->> 'email'),
  title text not null, copy text not null, content_id uuid references content(id) on delete set null,
  ai_score int, ai_notes text, safety_ok boolean,
  status text not null default 'Submitted' check (status in ('Submitted','Needs fixes','Finalist','Winner','Not picked')),
  payout_choice text check (payout_choice in ('cash','credits','both')), payout_cash numeric not null default 0,
  payout_credits numeric not null default 0, created_at timestamptz not null default now());
alter table challenge_rules enable row level security;
alter table challenges enable row level security;
alter table challenge_entries enable row level security;
drop policy if exists challenge_rules_read on challenge_rules;
create policy challenge_rules_read on challenge_rules for select using (is_team());
drop policy if exists challenge_rules_write on challenge_rules;
create policy challenge_rules_write on challenge_rules for update using (is_admin()) with check (is_admin());
drop policy if exists challenges_team on challenges;
create policy challenges_team on challenges for all using (is_team()) with check (is_team());
drop policy if exists challenge_entries_read on challenge_entries;
create policy challenge_entries_read on challenge_entries for select using (is_team());
drop policy if exists challenge_entries_insert on challenge_entries;
create policy challenge_entries_insert on challenge_entries for insert with check (is_team() and creator_id = (select auth.uid()));
drop policy if exists challenge_entries_update on challenge_entries;
create policy challenge_entries_update on challenge_entries for update using (creator_id = (select auth.uid()) or is_admin()) with check (creator_id = (select auth.uid()) or is_admin());
drop policy if exists challenge_entries_delete on challenge_entries;
create policy challenge_entries_delete on challenge_entries for delete using (creator_id = (select auth.uid()) or is_admin());
