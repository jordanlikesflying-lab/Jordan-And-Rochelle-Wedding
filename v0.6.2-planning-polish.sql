-- Jordan & Rochelle Wedding Manager v0.6.2
-- Run once in Supabase SQL Editor.

create table if not exists public.rsvp_people (
  id uuid primary key default gen_random_uuid(),
  rsvp_id uuid not null references public.rsvps(id) on delete cascade,
  person_name text not null,
  person_type text not null check (person_type in ('adult','child')),
  sort_order int4 not null default 0,
  created_at timestamptz not null default now()
);
alter table public.rsvp_people enable row level security;
grant insert on public.rsvp_people to anon, authenticated;
grant select, insert, update, delete on public.rsvp_people to authenticated;

drop policy if exists "public submits rsvp people" on public.rsvp_people;
create policy "public submits rsvp people" on public.rsvp_people
for insert to anon, authenticated
with check (length(trim(person_name)) > 0 and person_type in ('adult','child'));

drop policy if exists "admins manage rsvp people" on public.rsvp_people;
create policy "admins manage rsvp people" on public.rsvp_people
for all to authenticated using (is_admin()) with check (is_admin());

create table if not exists public.wedding_settings (
  id int4 primary key default 1 check (id = 1),
  venue_name text,
  venue_address text,
  map_query text,
  wedding_date_label text,
  ceremony_time_label text,
  details_text text,
  parking_text text,
  amazon_registry_url text,
  other_registry_url text,
  updated_at timestamptz not null default now()
);
alter table public.wedding_settings enable row level security;
grant select on public.wedding_settings to anon, authenticated;
grant insert, update, delete on public.wedding_settings to authenticated;

drop policy if exists "public reads wedding settings" on public.wedding_settings;
create policy "public reads wedding settings" on public.wedding_settings
for select to anon, authenticated using (true);

drop policy if exists "admins manage wedding settings" on public.wedding_settings;
create policy "admins manage wedding settings" on public.wedding_settings
for all to authenticated using (is_admin()) with check (is_admin());

insert into public.wedding_settings
(id, venue_name, venue_address, map_query, wedding_date_label, ceremony_time_label)
values (1, '4-H Building', 'Milbank, South Dakota', '4-H Building Milbank South Dakota',
        'Saturday, November 14, 2026', 'The ceremony begins at 10:00 AM.')
on conflict (id) do nothing;
