-- Jordan & Rochelle Wedding Manager v0.7.2
-- Run ONCE in Supabase SQL Editor.

-- ============================================================
-- Permanent v0.7.1 merge fix:
-- invitation.status is an invitation_status enum, so use a typed variable.
-- ============================================================

create or replace function public.merge_rsvp_into_invitation(
  p_rsvp_id uuid,
  p_invitation_id uuid,
  p_contact_source text default 'rsvp'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rsvp public.rsvps%rowtype;
  v_inv public.invitations%rowtype;
  v_party_count int;
  v_new_status public.invitation_status;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;

  select *
  into v_rsvp
  from public.rsvps
  where id = p_rsvp_id
  for update;

  if not found then
    raise exception 'RSVP not found.';
  end if;

  select *
  into v_inv
  from public.invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception 'Invitation not found.';
  end if;

  v_party_count :=
    greatest(
      0,
      coalesce(v_rsvp.adult_count, 0)
      + coalesce(v_rsvp.child_count, 0)
    );

  if v_rsvp.attendance = 'declined' then
    v_new_status := 'declined'::public.invitation_status;
  else
    v_new_status := 'responded'::public.invitation_status;
  end if;

  if p_contact_source = 'rsvp' then
    update public.invitations
    set
      street_address =
        coalesce(nullif(trim(v_rsvp.street_address), ''), street_address),
      city =
        coalesce(nullif(trim(v_rsvp.city), ''), city),
      state =
        coalesce(nullif(trim(v_rsvp.state), ''), state),
      zip_code =
        coalesce(nullif(trim(v_rsvp.zip_code), ''), zip_code),
      phone =
        coalesce(nullif(trim(v_rsvp.phone), ''), phone),
      email =
        coalesce(nullif(trim(coalesce(v_rsvp.email, '')), ''), email),
      max_guests =
        greatest(coalesce(max_guests, 0), v_party_count),
      status = v_new_status,
      updated_at = now()
    where id = p_invitation_id;
  else
    update public.invitations
    set
      max_guests =
        greatest(coalesce(max_guests, 0), v_party_count),
      status = v_new_status,
      updated_at = now()
    where id = p_invitation_id;
  end if;

  update public.rsvps
  set
    invitation_id = p_invitation_id,
    verification_status = 'verified',
    updated_at = now()
  where id = p_rsvp_id;

  update public.job_assignments
  set invitation_id = p_invitation_id
  where rsvp_id = p_rsvp_id;

  return jsonb_build_object(
    'success', true,
    'rsvp_id', p_rsvp_id,
    'invitation_id', p_invitation_id
  );
end;
$$;

revoke all
on function public.merge_rsvp_into_invitation(uuid, uuid, text)
from public;

grant execute
on function public.merge_rsvp_into_invitation(uuid, uuid, text)
to authenticated;

-- ============================================================
-- Safe duplicate-RSVP deletion
-- ============================================================

create or replace function public.admin_delete_duplicate_rsvp(
  p_rsvp_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rsvp public.rsvps%rowtype;
  v_invitation_id uuid;
  v_remaining_count int;
  v_attending_count int;
  v_declined_count int;
  v_new_status public.invitation_status;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;

  select *
  into v_rsvp
  from public.rsvps
  where id = p_rsvp_id
  for update;

  if not found then
    raise exception 'RSVP not found.';
  end if;

  -- Do not silently destroy wedding-job relationships.
  if exists (
    select 1
    from public.job_assignments
    where rsvp_id = p_rsvp_id
  ) then
    raise exception
      'This RSVP has wedding-job assignments attached. Move or remove those assignments before deleting the duplicate RSVP.';
  end if;

  v_invitation_id := v_rsvp.invitation_id;

  -- rsvp_people rows are removed by their ON DELETE CASCADE FK.
  delete from public.rsvps
  where id = p_rsvp_id;

  if v_invitation_id is not null then
    select
      count(*),
      count(*) filter (where attendance = 'attending'),
      count(*) filter (where attendance = 'declined')
    into
      v_remaining_count,
      v_attending_count,
      v_declined_count
    from public.rsvps
    where invitation_id = v_invitation_id
      and verification_status <> 'rejected';

    if v_attending_count > 0 then
      v_new_status := 'responded'::public.invitation_status;
    elsif v_remaining_count > 0 and v_declined_count = v_remaining_count then
      v_new_status := 'declined'::public.invitation_status;
    else
      v_new_status := 'invited'::public.invitation_status;
    end if;

    -- Never reactivate a household that was intentionally cancelled.
    update public.invitations
    set
      status = case
        when status = 'cancelled'::public.invitation_status then status
        else v_new_status
      end,
      updated_at = now()
    where id = v_invitation_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Duplicate RSVP deleted safely.',
    'deleted_rsvp_id', p_rsvp_id,
    'invitation_id', v_invitation_id
  );
end;
$$;

revoke all
on function public.admin_delete_duplicate_rsvp(uuid)
from public;

grant execute
on function public.admin_delete_duplicate_rsvp(uuid)
to authenticated;
