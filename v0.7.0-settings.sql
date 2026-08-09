-- Jordan & Rochelle Wedding Manager v0.7.0 Settings
-- Run ONCE in Supabase SQL Editor before deploying v0.7.0.

alter table public.wedding_settings
  add column if not exists partner_one_name text,
  add column if not exists partner_two_name text,
  add column if not exists wedding_date date,
  add column if not exists ceremony_time time,
  add column if not exists venue_city text,
  add column if not exists venue_state text,
  add column if not exists welcome_heading text,
  add column if not exists welcome_message text,
  add column if not exists rsvp_open boolean not null default true,
  add column if not exists rsvp_closed_message text,
  add column if not exists registry_visible boolean not null default true,
  add column if not exists guest_album_visible boolean not null default true;

update public.wedding_settings
set partner_one_name = coalesce(partner_one_name, 'Jordan'),
    partner_two_name = coalesce(partner_two_name, 'Rochelle'),
    wedding_date = coalesce(wedding_date, date '2026-11-14'),
    ceremony_time = coalesce(ceremony_time, time '10:00'),
    venue_city = coalesce(venue_city, 'Milbank'),
    venue_state = coalesce(venue_state, 'South Dakota'),
    welcome_heading = coalesce(welcome_heading, 'Celebrate with us'),
    welcome_message = coalesce(welcome_message, 'We are excited to celebrate our wedding with our family and friends. Please RSVP and find the details for our special day below.'),
    rsvp_closed_message = coalesce(rsvp_closed_message, 'Please contact Jordan or Rochelle if you need to make or change an RSVP.'),
    rsvp_open = coalesce(rsvp_open, true),
    registry_visible = coalesce(registry_visible, true),
    guest_album_visible = coalesce(guest_album_visible, true)
where id = 1;

-- Make the RSVP open/closed setting enforceable at the database layer, not just hidden in the browser.
create or replace function public.enforce_rsvp_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  accepting boolean;
begin
  if auth.role() = 'service_role' or coalesce(public.is_admin(), false) then
    return new;
  end if;

  select coalesce(rsvp_open, true) into accepting
  from public.wedding_settings
  where id = 1;

  if accepting is false then
    raise exception 'RSVPs are currently closed.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_rsvp_open_before_insert on public.rsvps;
create trigger enforce_rsvp_open_before_insert
before insert on public.rsvps
for each row execute function public.enforce_rsvp_open();

-- Carry forward the status fix discovered while testing v0.6.3.
alter table public.job_assignments drop constraint if exists job_assignments_status_check;
alter table public.job_assignments
  add constraint job_assignments_status_check
  check (status in ('volunteered','confirmed','declined','assigned','awaiting_response','accepted','cancelled'));
