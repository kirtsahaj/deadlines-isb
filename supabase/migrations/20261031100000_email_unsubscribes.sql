-- Opt-outs for Kirt's daily batch mails (applied directly on 31 Oct 2026; kept here for the record).
create table if not exists public.email_unsubscribes (
  email text not null check (email = lower(email)),
  mail text not null check (mail in ('jobs','birthday')),
  created_at timestamptz not null default now(),
  primary key (email, mail)
);
alter table public.email_unsubscribes enable row level security;
create policy email_unsubscribes_select_own on public.email_unsubscribes for select to authenticated
  using (email = lower(coalesce((select auth.jwt()) ->> 'email', '')) and public.is_allowed_isb_user());
create policy email_unsubscribes_insert_own on public.email_unsubscribes for insert to authenticated
  with check (email = lower(coalesce((select auth.jwt()) ->> 'email', '')) and public.is_allowed_isb_user());
create policy email_unsubscribes_delete_own on public.email_unsubscribes for delete to authenticated
  using (email = lower(coalesce((select auth.jwt()) ->> 'email', '')) and public.is_allowed_isb_user());
grant select, insert, delete on public.email_unsubscribes to authenticated;
