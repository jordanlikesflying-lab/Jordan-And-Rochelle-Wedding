-- Jordan & Rochelle Wedding Manager v1.1.1
-- Combined v1.1.0 + v1.1.1 migration.
-- Safe to run even if v1.1.0 was already run.

-- v1.1.0 fields
alter table public.invitations
  add column if not exists invitation_sent boolean not null default false;

alter table public.registry_items
  add column if not exists image_credit text;

alter table public.registry_items
  add column if not exists image_source_url text;

-- v1.1.1 public RSVP behavior:
-- Phone/address are encouraged but not required.
-- Every public submission starts in Needs Review so no new response is
-- hidden from the admin just because its name matched an invitation.
create or replace function public.submit_public_rsvp(
  p_first_name text,
  p_last_name text,
  p_street_address text,
  p_city text,
  p_state text,
  p_zip_code text,
  p_phone text,
  p_email text,
  p_attendance text,
  p_adult_count integer,
  p_child_count integer,
  p_additional_guests text,
  p_notes text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  matched_invitation uuid;
begin
  if trim(coalesce(p_first_name, '')) = ''
     or trim(coalesce(p_last_name, '')) = '' then
    raise exception 'First and last name are required';
  end if;

  if p_attendance not in ('attending', 'declined') then
    raise exception 'Invalid attendance status';
  end if;

  select id
  into matched_invitation
  from public.invitations
  where lower(trim(primary_first_name)) = lower(trim(p_first_name))
    and lower(trim(primary_last_name)) = lower(trim(p_last_name))
    and status <> 'cancelled'::public.invitation_status
  limit 1;

  insert into public.rsvps(
    invitation_id,
    first_name,
    last_name,
    street_address,
    city,
    state,
    zip_code,
    phone,
    email,
    attendance,
    adult_count,
    child_count,
    additional_guests,
    notes,
    verification_status,
    submitted_by_admin
  )
  values(
    matched_invitation,
    trim(p_first_name),
    trim(p_last_name),
    trim(coalesce(p_street_address, '')),
    trim(coalesce(p_city, '')),
    trim(coalesce(p_state, '')),
    trim(coalesce(p_zip_code, '')),
    trim(coalesce(p_phone, '')),
    nullif(trim(coalesce(p_email, '')), ''),
    p_attendance::public.attendance_status,
    case when p_attendance = 'attending' then greatest(coalesce(p_adult_count, 1), 1) else 0 end,
    case when p_attendance = 'attending' then greatest(coalesce(p_child_count, 0), 0) else 0 end,
    nullif(trim(coalesce(p_additional_guests, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    'needs_review'::public.verification_status,
    false
  )
  returning id into new_id;

  -- Matching a household is useful, but it no longer skips review.
  if matched_invitation is not null then
    update public.invitations
    set status = case
      when p_attendance = 'attending' then 'responded'::public.invitation_status
      else 'declined'::public.invitation_status
    end
    where id = matched_invitation;
  end if;

  return new_id;
end;
$$;

revoke all
on function public.submit_public_rsvp(
  text,text,text,text,text,text,text,text,text,integer,integer,text,text
)
from public;

grant execute
on function public.submit_public_rsvp(
  text,text,text,text,text,text,text,text,text,integer,integer,text,text
)
to anon, authenticated;
