create extension if not exists pgcrypto;

create type public.connection_status as enum ('connected', 'syncing', 'partial', 'attention', 'disconnected');
create type public.sync_trigger as enum ('first_connect', 'manual', 'scheduled', 'webhook');
create type public.sync_outcome as enum ('running', 'success', 'partial', 'failed');

create or replace function public.is_allowed_isb_user()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) ~ '^[^@]+@isb\.edu$';
$$;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'Asia/Kolkata',
  sort_order text not null default 'latest_first' check (sort_order in ('latest_first', 'soonest_first')),
  explicit_deadline_marker_only boolean not null default false,
  hidden_course_ids bigint[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.elearn_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'moodle' check (provider = 'moodle'),
  connection_mode text not null default 'manual_token' check (connection_mode in ('manual_token', 'isb_approved')),
  base_url text not null,
  external_user_id bigint,
  external_full_name text,
  token_ciphertext text not null,
  token_iv text not null,
  token_key_version integer not null,
  exposed_functions text[] not null default '{}',
  status public.connection_status not null default 'connected',
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_manual_sync_at timestamptz,
  next_sync_at timestamptz not null default now(),
  consecutive_failures integer not null default 0,
  safe_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (base_url ~ '^https://')
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  moodle_course_id bigint not null,
  short_name text,
  full_name text not null,
  visible boolean not null default true,
  raw_updated_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, moodle_course_id)
);

create table public.deadline_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_key text not null,
  moodle_course_id bigint not null,
  activity_id bigint,
  kind text not null check (kind in ('assignment', 'quiz', 'forum', 'calendar', 'text')),
  deadline_type text not null,
  title text not null,
  due_at timestamptz,
  deadline_status text not null default 'dated' check (deadline_status in ('dated', 'dated_from_text', 'TBD')),
  submission_status text not null default 'unknown',
  source_primary text not null,
  source_evidence jsonb not null default '[]'::jsonb,
  text_evidence text,
  text_precision text,
  conflict boolean not null default false,
  active boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, external_key),
  check ((deadline_status = 'TBD' and due_at is null) or deadline_status <> 'TBD')
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trigger public.sync_trigger not null,
  outcome public.sync_outcome not null default 'running',
  source_status jsonb not null default '{}'::jsonb,
  item_count integer not null default 0,
  safe_error_code text,
  duration_ms integer,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.sync_queue (
  user_id uuid primary key references auth.users(id) on delete cascade,
  run_after timestamptz not null default now(),
  priority smallint not null default 0,
  attempts integer not null default 0,
  locked_at timestamptz,
  locked_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deadline_items_user_due_idx on public.deadline_items (user_id, active, due_at desc nulls last);
create index deadline_items_user_course_idx on public.deadline_items (user_id, moodle_course_id);
create index sync_runs_user_started_idx on public.sync_runs (user_id, started_at desc);
create index connections_due_idx on public.elearn_connections (next_sync_at) where status <> 'disconnected';
create index sync_queue_due_idx on public.sync_queue (run_after, priority desc) where locked_at is null;

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger settings_updated before update on public.user_settings for each row execute function public.set_updated_at();
create trigger connections_updated before update on public.elearn_connections for each row execute function public.set_updated_at();
create trigger courses_updated before update on public.courses for each row execute function public.set_updated_at();
create trigger deadlines_updated before update on public.deadline_items for each row execute function public.set_updated_at();
create trigger queue_updated before update on public.sync_queue for each row execute function public.set_updated_at();

create or replace function public.ensure_current_user_bootstrapped()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_name text := coalesce(
    auth.jwt() -> 'user_metadata' ->> 'full_name',
    auth.jwt() -> 'user_metadata' ->> 'name',
    split_part(v_email, '@', 1)
  );
begin
  if v_user is null or v_email !~ '^[^@]+@isb\.edu$' then
    return;
  end if;
  insert into public.profiles (user_id, display_name)
  values (v_user, v_name)
  on conflict (user_id) do update set display_name = coalesce(public.profiles.display_name, excluded.display_name);
  insert into public.user_settings (user_id) values (v_user)
  on conflict (user_id) do nothing;
end;
$$;

create or replace function public.claim_sync_queue(p_worker uuid, p_batch integer default 20)
returns setof public.sync_queue
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select q.user_id
    from public.sync_queue q
    where q.run_after <= now()
      and (q.locked_at is null or q.locked_at < now() - interval '10 minutes')
    order by q.priority desc, q.run_after
    for update skip locked
    limit least(greatest(p_batch, 1), 100)
  )
  update public.sync_queue q
  set locked_at = now(), locked_by = p_worker, attempts = q.attempts + 1, updated_at = now()
  from due
  where q.user_id = due.user_id
  returning q.*;
end;
$$;

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.elearn_connections enable row level security;
alter table public.courses enable row level security;
alter table public.deadline_items enable row level security;
alter table public.sync_runs enable row level security;
alter table public.sync_queue enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = user_id and public.is_allowed_isb_user());
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = user_id and public.is_allowed_isb_user()) with check ((select auth.uid()) = user_id and public.is_allowed_isb_user() and is_admin = false);
create policy settings_select_own on public.user_settings for select to authenticated using ((select auth.uid()) = user_id and public.is_allowed_isb_user());
create policy settings_update_own on public.user_settings for update to authenticated using ((select auth.uid()) = user_id and public.is_allowed_isb_user()) with check ((select auth.uid()) = user_id and public.is_allowed_isb_user());
create policy courses_select_own on public.courses for select to authenticated using ((select auth.uid()) = user_id and public.is_allowed_isb_user());
create policy deadlines_select_own on public.deadline_items for select to authenticated using ((select auth.uid()) = user_id and public.is_allowed_isb_user());
create policy sync_runs_select_own on public.sync_runs for select to authenticated using ((select auth.uid()) = user_id and public.is_allowed_isb_user());

revoke all on public.elearn_connections from anon, authenticated;
revoke all on public.sync_queue from anon, authenticated;
revoke all on function public.claim_sync_queue(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_sync_queue(uuid, integer) to service_role;
grant all on public.elearn_connections to service_role;
grant all on public.sync_queue to service_role;
grant all on public.profiles to service_role;
grant all on public.user_settings to service_role;
grant all on public.courses to service_role;
grant all on public.deadline_items to service_role;
grant all on public.sync_runs to service_role;
grant select, update on public.profiles to authenticated;
grant select, update on public.user_settings to authenticated;
grant select on public.courses, public.deadline_items, public.sync_runs to authenticated;
grant execute on function public.is_allowed_isb_user() to authenticated;
grant execute on function public.ensure_current_user_bootstrapped() to authenticated;