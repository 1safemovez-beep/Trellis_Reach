-- Elevate tweaks (Nov 16 2026): ad results tracking, client approval, brand memory,
-- lead-to-ad attribution and contest winner tests.
-- Run once in Supabase -> SQL Editor. Safe to run again: everything skips what already exists.
-- Nothing here changes or removes existing data.

-- 1. New columns on existing tables --------------------------------------------------
alter table content add column if not exists requires_approval boolean not null default false;
alter table content add column if not exists source_entry_id uuid references challenge_entries(id) on delete set null;
alter table leads   add column if not exists content_id uuid references content(id) on delete set null;
create index if not exists leads_content_idx on leads (content_id);

-- 2. Results tracking: one row per view or click on a shared ad ----------------------
create table if not exists ad_events (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references content(id) on delete cascade,
  kind text not null check (kind in ('view','click')),
  created_at timestamptz not null default now()
);
create index if not exists ad_events_content_idx on ad_events (content_id, kind);

-- 3. Client approval: one row per approval request ----------------------------------
create table if not exists ad_approvals (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references content(id) on delete cascade,
  client_name text,
  client_email text,
  status text not null default 'Pending' check (status in ('Pending','Approved','Changes requested')),
  feedback text,
  decided_at timestamptz,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists ad_approvals_content_idx on ad_approvals (content_id);

-- 4. Brand memory: what we remember per client business -------------------------------
create table if not exists brand_memory (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  kind text not null check (kind in ('voice','do','dont','approved_ad','client_feedback')),
  note text not null,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists brand_memory_biz_idx on brand_memory (lower(business_name));

alter table ad_events    enable row level security;
alter table ad_approvals enable row level security;
alter table brand_memory enable row level security;

-- Events and approvals are written by the server (service role). The team can read them.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ad_events' and policyname = 'ad_events_read') then
    create policy ad_events_read on ad_events for select using (is_team());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ad_approvals' and policyname = 'ad_approvals_read') then
    create policy ad_approvals_read on ad_approvals for select using (is_team());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'brand_memory' and policyname = 'brand_memory_team') then
    create policy brand_memory_team on brand_memory for all using (is_team()) with check (is_team());
  end if;
end $$;

-- 5. Per-ad results the dashboard reads -------------------------------------------------
create or replace view ad_stats with (security_invoker = true) as
select c.id as content_id,
  (select count(*) from ad_events e where e.content_id = c.id and e.kind = 'view')::int  as views,
  (select count(*) from ad_events e where e.content_id = c.id and e.kind = 'click')::int as clicks,
  (select count(*) from leads l where l.content_id = c.id)::int                          as leads,
  (select count(*) from leads l where l.content_id = c.id and l.stage = 'Won')::int      as won,
  coalesce((select sum(l.value) from leads l where l.content_id = c.id and l.stage = 'Won'), 0) as won_value
from content c;

-- 6. Nothing goes live or scheduled without client approval, when approval was asked for.
create or replace function enforce_client_approval() returns trigger language plpgsql as $$
begin
  if new.requires_approval and new.status in ('Live','Scheduled') and old.status is distinct from new.status then
    if not exists (select 1 from ad_approvals a where a.content_id = new.id and a.status = 'Approved') then
      raise exception 'Waiting for client approval. Send the approval link and wait for "Approved" before this goes live.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists content_requires_approval on content;
create trigger content_requires_approval before update of status on content
  for each row execute function enforce_client_approval();
