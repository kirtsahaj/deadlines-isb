-- Daily portal check (8 PM + 9 PM IST): keeps upcoming jobs in line with the placement portal's active list.
-- portal_id: the portal's application_id once matched; hidden_at: hidden (never deleted) when it left the portal.
alter table public.jobs
  add column if not exists portal_id text unique,
  add column if not exists hidden_at timestamptz,
  add column if not exists portal_seen_at timestamptz;

-- One row per reading attempt. snapshot = the active list (portal id, company, role, deadline only).
create table if not exists public.portal_check_runs (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  slot text not null check (slot in ('8pm', '9pm')),
  ran_at timestamptz not null default now(),
  ok boolean not null,
  error text,
  active_count integer,
  snapshot jsonb
);
create unique index if not exists portal_check_runs_one_ok_per_slot on public.portal_check_runs (day, slot) where ok;
alter table public.portal_check_runs enable row level security;

-- Change log shown on Admin → Portal check.
create table if not exists public.portal_job_changes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  action text not null check (action in ('added', 'deadline', 'hidden', 'unhidden', 'skipped', 'failed')),
  job_id uuid references public.jobs(id) on delete set null,
  portal_id text,
  company text,
  role text,
  old_deadline text,
  new_deadline text,
  note text
);
create index if not exists portal_job_changes_created on public.portal_job_changes (created_at desc);
alter table public.portal_job_changes enable row level security;
