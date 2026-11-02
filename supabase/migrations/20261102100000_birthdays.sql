-- Birthday reminder mail (applied directly on 2 Nov 2026; kept here for the record). Day + month only.
create table if not exists public.birthdays (
  email text primary key check (email = lower(email)),
  name text not null,
  campus text not null check (campus in ('Mohali','Hyderabad')),
  month smallint not null check (month between 1 and 12),
  day smallint not null check (day between 1 and 31)
);
alter table public.birthdays enable row level security; -- no policies: server (service role) only
alter table public.email_unsubscribes drop constraint if exists email_unsubscribes_mail_check;
alter table public.email_unsubscribes add constraint email_unsubscribes_mail_check check (mail in ('jobs','birthday','hide_birthday'));
