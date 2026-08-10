-- Jordan & Rochelle wedding backend
-- Run this entire file in Supabase SQL Editor.

create extension if not exists pgcrypto;

create type public.attendance_status as enum ('attending','declined');
create type public.verification_status as enum ('verified','needs_review','rejected');
create type public.invitation_status as enum ('invited','responded','declined','cancelled');

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  household_name text not null,
  primary_first_name text not null default '',
  primary_last_name text not null default '',
  street_address text,
  city text,
  state text,
  zip_code text,
  phone text,
  email text,
  max_guests integer not null default 1 check (max_guests between 1 and 30),
  status public.invitation_status not null default 'invited',
  private_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid references public.invitations(id) on delete set null,
  first_name text not null,
  last_name text not null,
  street_address text not null,
  city text not null,
  state text not null,
  zip_code text not null,
  phone text not null,
  email text,
  attendance public.attendance_status not null,
  adult_count integer not null default 0 check (adult_count between 0 and 30),
  child_count integer not null default 0 check (child_count between 0 and 30),
  additional_guests text,
  notes text,
  verification_status public.verification_status not null default 'needs_review',
  submitted_by_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wedding_jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  starts_at timestamptz,
  openings integer not null default 1 check (openings between 1 and 50),
  allow_volunteers boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.job_assignments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.wedding_jobs(id) on delete cascade,
  rsvp_id uuid references public.rsvps(id) on delete cascade,
  invitation_id uuid references public.invitations(id) on delete cascade,
  person_name text not null,
  status text not null default 'confirmed' check (status in ('volunteered','confirmed','declined')),
  instructions text,
  created_at timestamptz not null default now(),
  check (rsvp_id is not null or invitation_id is not null)
);

create table public.registry_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  store_name text,
  item_url text,
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  caption text,
  show_in_guest_album boolean not null default false,
  sort_order integer not null default 0,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.admin_users where user_id=auth.uid()); $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
create trigger invitations_updated before update on public.invitations for each row execute function public.set_updated_at();
create trigger rsvps_updated before update on public.rsvps for each row execute function public.set_updated_at();
create trigger jobs_updated before update on public.wedding_jobs for each row execute function public.set_updated_at();

-- Public RSVP entry point. It writes one record but reveals no guest data.
create or replace function public.submit_public_rsvp(
  p_first_name text, p_last_name text, p_street_address text, p_city text, p_state text,
  p_zip_code text, p_phone text, p_email text, p_attendance text, p_adult_count integer,
  p_child_count integer, p_additional_guests text, p_notes text
) returns uuid
language plpgsql security definer set search_path=public
as $$
declare
  new_id uuid;
  matched_invitation uuid;
  matched_status public.verification_status := 'needs_review';
begin
  if trim(coalesce(p_first_name,''))='' or trim(coalesce(p_last_name,''))='' or trim(coalesce(p_phone,''))='' then
    raise exception 'Name and phone number are required';
  end if;
  if p_attendance not in ('attending','declined') then raise exception 'Invalid attendance status'; end if;
  select id into matched_invitation from public.invitations
    where lower(trim(primary_first_name))=lower(trim(p_first_name))
      and lower(trim(primary_last_name))=lower(trim(p_last_name))
    limit 1;
  if matched_invitation is not null then matched_status := 'verified'; end if;
  insert into public.rsvps(invitation_id,first_name,last_name,street_address,city,state,zip_code,phone,email,attendance,adult_count,child_count,additional_guests,notes,verification_status)
  values(matched_invitation,trim(p_first_name),trim(p_last_name),trim(p_street_address),trim(p_city),trim(p_state),trim(p_zip_code),trim(p_phone),nullif(trim(coalesce(p_email,'')),''),p_attendance::public.attendance_status,greatest(coalesce(p_adult_count,0),0),greatest(coalesce(p_child_count,0),0),nullif(trim(coalesce(p_additional_guests,'')),''),nullif(trim(coalesce(p_notes,'')),''),matched_status)
  returning id into new_id;
  if matched_invitation is not null then update public.invitations set status=case when p_attendance='attending' then 'responded'::public.invitation_status else 'declined'::public.invitation_status end where id=matched_invitation; end if;
  return new_id;
end; $$;

revoke all on function public.submit_public_rsvp(text,text,text,text,text,text,text,text,text,integer,integer,text,text) from public;
grant execute on function public.submit_public_rsvp(text,text,text,text,text,text,text,text,text,integer,integer,text,text) to anon, authenticated;

alter table public.admin_users enable row level security;
alter table public.invitations enable row level security;
alter table public.rsvps enable row level security;
alter table public.wedding_jobs enable row level security;
alter table public.job_assignments enable row level security;
alter table public.registry_items enable row level security;
alter table public.photos enable row level security;

create policy "admins manage admin users" on public.admin_users for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage invitations" on public.invitations for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage rsvps" on public.rsvps for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage jobs" on public.wedding_jobs for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage assignments" on public.job_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage registry" on public.registry_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "public reads active registry" on public.registry_items for select to anon, authenticated using (is_active or public.is_admin());
create policy "admins manage photos" on public.photos for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "public reads selected photos" on public.photos for select to anon, authenticated using (show_in_guest_album or public.is_admin());

grant select,insert,update,delete on public.invitations,public.rsvps,public.wedding_jobs,public.job_assignments,public.registry_items,public.photos to authenticated;
grant select,insert,update,delete on public.admin_users to authenticated;
grant select on public.registry_items,public.photos to anon;

insert into storage.buckets(id,name,public) values('wedding-photos','wedding-photos',true) on conflict(id) do nothing;
create policy "public sees selected wedding photo files" on storage.objects for select to public using (bucket_id='wedding-photos' and exists(select 1 from public.photos p where p.storage_path=name and p.show_in_guest_album));
create policy "admins upload wedding photos" on storage.objects for insert to authenticated with check (bucket_id='wedding-photos' and public.is_admin());
create policy "admins update wedding photos" on storage.objects for update to authenticated using (bucket_id='wedding-photos' and public.is_admin()) with check (bucket_id='wedding-photos' and public.is_admin());
create policy "admins delete wedding photos" on storage.objects for delete to authenticated using (bucket_id='wedding-photos' and public.is_admin());


-- ===== v0.7.1 additions =====
-- Jordan & Rochelle Wedding Manager v0.7.1
-- Run ONCE in Supabase SQL Editor before deploying v0.7.1.

-- ============================================================
-- Claim-a-gift registry
-- ============================================================

alter table public.registry_items
  add column if not exists claimed_at timestamptz;

create table if not exists public.registry_claims (
  id uuid primary key default gen_random_uuid(),
  registry_item_id uuid not null references public.registry_items(id) on delete cascade,
  claimant_name text not null,
  claimant_email text,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  email_sent_at timestamptz,
  released_at timestamptz
);

create unique index if not exists registry_claims_one_active_per_item
  on public.registry_claims(registry_item_id)
  where released_at is null;

alter table public.registry_claims enable row level security;

grant select, insert, update, delete on public.registry_claims to authenticated;

drop policy if exists "admins manage registry claims" on public.registry_claims;
create policy "admins manage registry claims"
on public.registry_claims
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Guests claim atomically. PII stays in registry_claims, which is not public-readable.
create or replace function public.claim_registry_item(
  p_item_id uuid,
  p_name text,
  p_email text default null
)
returns table(
  success boolean,
  message text,
  claim_token text,
  gift_title text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_title text;
  v_token text;
begin
  if length(trim(coalesce(p_name, ''))) = 0 then
    return query select false, 'Please enter your name.'::text, null::text, null::text;
    return;
  end if;

  update public.registry_items
  set claimed_at = now()
  where id = p_item_id
    and is_active = true
    and claimed_at is null
  returning title into v_title;

  if v_title is null then
    if exists (select 1 from public.registry_items where id = p_item_id and is_active = true) then
      return query select false, 'This gift was already claimed by another guest.'::text, null::text, null::text;
    else
      return query select false, 'This gift is no longer available.'::text, null::text, null::text;
    end if;
    return;
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.registry_claims (
    registry_item_id,
    claimant_name,
    claimant_email,
    token_hash
  ) values (
    p_item_id,
    trim(p_name),
    nullif(trim(coalesce(p_email, '')), ''),
    encode(digest(v_token, 'sha256'), 'hex')
  );

  return query select true, 'Gift claimed.'::text, v_token, v_title;
end;
$$;

revoke all on function public.claim_registry_item(uuid,text,text) from public;
grant execute on function public.claim_registry_item(uuid,text,text) to anon, authenticated;

create or replace function public.release_registry_claim(p_token text)
returns table(
  success boolean,
  message text,
  gift_title text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_claim_id uuid;
  v_item_id uuid;
  v_title text;
begin
  select c.id, c.registry_item_id, r.title
    into v_claim_id, v_item_id, v_title
  from public.registry_claims c
  join public.registry_items r on r.id = c.registry_item_id
  where c.token_hash = encode(digest(coalesce(p_token,''), 'sha256'), 'hex')
    and c.released_at is null
  for update of c;

  if v_claim_id is null then
    return query select false, 'This release link is invalid or has already been used.'::text, null::text;
    return;
  end if;

  update public.registry_claims
    set released_at = now()
    where id = v_claim_id;

  update public.registry_items
    set claimed_at = null
    where id = v_item_id;

  return query select true, 'Gift released.'::text, v_title;
end;
$$;

revoke all on function public.release_registry_claim(text) from public;
grant execute on function public.release_registry_claim(text) to anon, authenticated;

create or replace function public.admin_release_registry_item(p_item_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;

  update public.registry_claims
    set released_at = now()
    where registry_item_id = p_item_id
      and released_at is null;

  update public.registry_items
    set claimed_at = null
    where id = p_item_id;

  return true;
end;
$$;

revoke all on function public.admin_release_registry_item(uuid) from public;
grant execute on function public.admin_release_registry_item(uuid) to authenticated;

-- ============================================================
-- Safer RSVP / invitation merge tools
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
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;

  select * into v_rsvp from public.rsvps where id = p_rsvp_id for update;
  if not found then raise exception 'RSVP not found.'; end if;

  select * into v_inv from public.invitations where id = p_invitation_id for update;
  if not found then raise exception 'Invitation not found.'; end if;

  v_party_count := greatest(0, coalesce(v_rsvp.adult_count,0) + coalesce(v_rsvp.child_count,0));

  if p_contact_source = 'rsvp' then
    update public.invitations set
      street_address = coalesce(nullif(trim(v_rsvp.street_address),''), street_address),
      city = coalesce(nullif(trim(v_rsvp.city),''), city),
      state = coalesce(nullif(trim(v_rsvp.state),''), state),
      zip_code = coalesce(nullif(trim(v_rsvp.zip_code),''), zip_code),
      phone = coalesce(nullif(trim(v_rsvp.phone),''), phone),
      email = coalesce(nullif(trim(coalesce(v_rsvp.email,'')),''), email),
      max_guests = greatest(coalesce(max_guests,0), v_party_count),
      status = case when v_rsvp.attendance = 'declined' then 'declined' else 'responded' end,
      updated_at = now()
    where id = p_invitation_id;
  else
    update public.invitations set
      max_guests = greatest(coalesce(max_guests,0), v_party_count),
      status = case when v_rsvp.attendance = 'declined' then 'declined' else 'responded' end,
      updated_at = now()
    where id = p_invitation_id;
  end if;

  update public.rsvps set
    invitation_id = p_invitation_id,
    verification_status = 'verified',
    updated_at = now()
  where id = p_rsvp_id;

  update public.job_assignments
    set invitation_id = p_invitation_id
    where rsvp_id = p_rsvp_id;

  return jsonb_build_object('success',true,'rsvp_id',p_rsvp_id,'invitation_id',p_invitation_id);
end;
$$;

revoke all on function public.merge_rsvp_into_invitation(uuid,uuid,text) from public;
grant execute on function public.merge_rsvp_into_invitation(uuid,uuid,text) to authenticated;

create or replace function public.merge_invitations(
  p_source_id uuid,
  p_target_id uuid,
  p_contact_source text default 'target'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.invitations%rowtype;
  v_target public.invitations%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;
  if p_source_id = p_target_id then
    raise exception 'Choose two different invitations.';
  end if;

  select * into v_source from public.invitations where id = p_source_id for update;
  if not found then raise exception 'Duplicate invitation not found.'; end if;
  select * into v_target from public.invitations where id = p_target_id for update;
  if not found then raise exception 'Target invitation not found.'; end if;

  if p_contact_source = 'source' then
    update public.invitations set
      street_address = coalesce(v_source.street_address, street_address),
      city = coalesce(v_source.city, city),
      state = coalesce(v_source.state, state),
      zip_code = coalesce(v_source.zip_code, zip_code),
      phone = coalesce(v_source.phone, phone),
      email = coalesce(v_source.email, email)
    where id = p_target_id;
  else
    update public.invitations set
      street_address = coalesce(street_address, v_source.street_address),
      city = coalesce(city, v_source.city),
      state = coalesce(state, v_source.state),
      zip_code = coalesce(zip_code, v_source.zip_code),
      phone = coalesce(phone, v_source.phone),
      email = coalesce(email, v_source.email)
    where id = p_target_id;
  end if;

  update public.invitations set
    max_guests = greatest(coalesce(max_guests,0), coalesce(v_source.max_guests,0)),
    status = case
      when status = 'responded' or v_source.status = 'responded' then 'responded'
      when status = 'declined' or v_source.status = 'declined' then 'declined'
      when status = 'invited' or v_source.status = 'invited' then 'invited'
      else status
    end,
    private_notes = case
      when nullif(trim(coalesce(v_source.private_notes,'')),'') is null then private_notes
      when nullif(trim(coalesce(private_notes,'')),'') is null then v_source.private_notes
      when position(v_source.private_notes in private_notes) > 0 then private_notes
      else private_notes || E'\n\nMerged note: ' || v_source.private_notes
    end,
    updated_at = now()
  where id = p_target_id;

  update public.rsvps set invitation_id = p_target_id, updated_at = now()
    where invitation_id = p_source_id;

  update public.job_assignments set invitation_id = p_target_id
    where invitation_id = p_source_id;

  delete from public.invitations where id = p_source_id;

  return jsonb_build_object('success',true,'kept_invitation_id',p_target_id,'removed_invitation_id',p_source_id);
end;
$$;

revoke all on function public.merge_invitations(uuid,uuid,text) from public;
grant execute on function public.merge_invitations(uuid,uuid,text) to authenticated;


-- ===== v0.7.2 additions =====
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

-- ===== v1.0.1 invitation people =====
-- Jordan & Rochelle Wedding Manager v1.0.1
-- Invitation household -> individual invited people
-- Run once in Supabase SQL Editor BEFORE deploying the website files.

create table if not exists public.invitation_people (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  person_name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (invitation_id, person_name)
);

alter table public.invitation_people enable row level security;

drop policy if exists "admins manage invitation people" on public.invitation_people;
create policy "admins manage invitation people"
on public.invitation_people
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, insert, update, delete on public.invitation_people to authenticated;

create or replace function public.invitation_people_names(
  p_household text,
  p_primary_first text,
  p_primary_last text
)
returns text[]
language plpgsql
immutable
as $$
declare
  v_household text := btrim(regexp_replace(coalesce(p_household, ''), '\s+', ' ', 'g'));
  v_primary text := btrim(concat_ws(' ', nullif(btrim(coalesce(p_primary_first, '')), ''), nullif(btrim(coalesce(p_primary_last, '')), '')));
  v_normalized text;
  v_parts text[];
  v_left text;
  v_right text;
  v_left_tokens text[];
  v_right_tokens text[];
  v_shared_last text;
begin
  if v_household = '' then
    if v_primary = '' then return array[]::text[]; end if;
    return array[v_primary];
  end if;

  if lower(v_household) ~ '\s+(household|family)$' then
    if v_primary = '' then return array[v_household]; end if;
    return array[v_primary];
  end if;

  v_normalized := regexp_replace(v_household, '\s*&\s*', ' and ', 'gi');
  v_parts := regexp_split_to_array(v_normalized, '\s+and\s+', 'i');

  if cardinality(v_parts) = 2 then
    v_left := btrim(v_parts[1]);
    v_right := btrim(v_parts[2]);

    if v_left <> '' and v_right <> '' then
      v_left_tokens := regexp_split_to_array(v_left, '\s+');
      v_right_tokens := regexp_split_to_array(v_right, '\s+');

      if cardinality(v_left_tokens) = 1 and cardinality(v_right_tokens) >= 2 then
        v_shared_last := v_right_tokens[cardinality(v_right_tokens)];
        return array[btrim(v_left || ' ' || v_shared_last), v_right];
      end if;

      if cardinality(v_left_tokens) = 1
         and cardinality(v_right_tokens) = 1
         and btrim(coalesce(p_primary_last, '')) <> '' then
        return array[
          btrim(v_left || ' ' || btrim(p_primary_last)),
          btrim(v_right || ' ' || btrim(p_primary_last))
        ];
      end if;

      return array[v_left, v_right];
    end if;
  end if;

  return array[v_household];
end;
$$;

create or replace function public.sync_invitation_people()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_order integer := 0;
begin
  delete from public.invitation_people where invitation_id = new.id;

  foreach v_name in array public.invitation_people_names(
    new.household_name,
    new.primary_first_name,
    new.primary_last_name
  )
  loop
    if btrim(coalesce(v_name, '')) <> '' then
      insert into public.invitation_people(invitation_id, person_name, sort_order)
      values (new.id, btrim(v_name), v_order)
      on conflict (invitation_id, person_name) do nothing;
      v_order := v_order + 1;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists invitations_sync_people on public.invitations;
create trigger invitations_sync_people
after insert or update of household_name, primary_first_name, primary_last_name
on public.invitations
for each row
execute function public.sync_invitation_people();

insert into public.invitation_people(invitation_id, person_name, sort_order)
select i.id, btrim(p.person_name), (p.ordinality - 1)::integer
from public.invitations i
cross join lateral unnest(
  public.invitation_people_names(i.household_name, i.primary_first_name, i.primary_last_name)
) with ordinality as p(person_name, ordinality)
where btrim(coalesce(p.person_name, '')) <> ''
on conflict (invitation_id, person_name) do nothing;

-- ===== v1.0.1 registry quantities =====


-- ============================================================
-- v1.0.1 revised: registry quantities and multiple safe claims
-- ============================================================

alter table public.registry_items
  add column if not exists quantity_wanted integer not null default 1,
  add column if not exists claimed_quantity integer not null default 0;

-- Remove the original "only one active claim per gift item" rule.
drop index if exists public.registry_claims_one_active_per_item;
drop index if exists registry_claims_one_active_per_item;

-- Bring existing claim totals into the new quantity fields.
update public.registry_items r
set
  quantity_wanted = greatest(coalesce(r.quantity_wanted, 1), 1),
  claimed_quantity = least(
    greatest(coalesce(r.quantity_wanted, 1), 1),
    (
      select count(*)::integer
      from public.registry_claims c
      where c.registry_item_id = r.id
        and c.released_at is null
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'registry_items_quantity_wanted_check'
      and conrelid = 'public.registry_items'::regclass
  ) then
    alter table public.registry_items
      add constraint registry_items_quantity_wanted_check
      check (quantity_wanted between 1 and 100);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'registry_items_claimed_quantity_check'
      and conrelid = 'public.registry_items'::regclass
  ) then
    alter table public.registry_items
      add constraint registry_items_claimed_quantity_check
      check (claimed_quantity between 0 and quantity_wanted);
  end if;
end;
$$;

create or replace function public.sync_registry_item_claim_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.quantity_wanted := greatest(coalesce(new.quantity_wanted, 1), 1);
  new.claimed_quantity := greatest(coalesce(new.claimed_quantity, 0), 0);

  if new.claimed_quantity > new.quantity_wanted then
    raise exception 'Quantity wanted cannot be lower than the number already claimed.';
  end if;

  if new.claimed_quantity >= new.quantity_wanted then
    new.claimed_at := coalesce(new.claimed_at, now());
  else
    new.claimed_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists registry_items_sync_claim_status on public.registry_items;
create trigger registry_items_sync_claim_status
before insert or update of quantity_wanted, claimed_quantity
on public.registry_items
for each row
execute function public.sync_registry_item_claim_status();

-- Public guest claim: lock the gift row, claim one unit, and create
-- a separate private release token for that guest.
create or replace function public.claim_registry_item(
  p_item_id uuid,
  p_name text,
  p_email text default null
)
returns table(
  success boolean,
  message text,
  claim_token text,
  gift_title text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_title text;
  v_quantity integer;
  v_claimed integer;
  v_token text;
begin
  if length(trim(coalesce(p_name, ''))) = 0 then
    return query select false, 'Please enter your name.'::text, null::text, null::text;
    return;
  end if;

  select title, quantity_wanted, claimed_quantity
    into v_title, v_quantity, v_claimed
  from public.registry_items
  where id = p_item_id
    and is_active = true
  for update;

  if v_title is null then
    return query select false, 'This gift is no longer available.'::text, null::text, null::text;
    return;
  end if;

  if coalesce(v_claimed, 0) >= greatest(coalesce(v_quantity, 1), 1) then
    return query select false, 'All requested quantities of this gift have already been claimed.'::text, null::text, null::text;
    return;
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.registry_claims (
    registry_item_id,
    claimant_name,
    claimant_email,
    token_hash
  ) values (
    p_item_id,
    trim(p_name),
    nullif(trim(coalesce(p_email, '')), ''),
    encode(digest(v_token, 'sha256'), 'hex')
  );

  update public.registry_items
  set claimed_quantity = claimed_quantity + 1
  where id = p_item_id;

  return query select true, 'Gift claimed.'::text, v_token, v_title;
end;
$$;

revoke all on function public.claim_registry_item(uuid,text,text) from public;
grant execute on function public.claim_registry_item(uuid,text,text) to anon, authenticated;

-- Guest release link releases only that guest's one claim.
create or replace function public.release_registry_claim(p_token text)
returns table(
  success boolean,
  message text,
  gift_title text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_claim_id uuid;
  v_item_id uuid;
  v_title text;
begin
  select c.id, c.registry_item_id, r.title
    into v_claim_id, v_item_id, v_title
  from public.registry_claims c
  join public.registry_items r on r.id = c.registry_item_id
  where c.token_hash = encode(digest(coalesce(p_token,''), 'sha256'), 'hex')
    and c.released_at is null
  for update of c;

  if v_claim_id is null then
    return query select false, 'This release link is invalid or has already been used.'::text, null::text;
    return;
  end if;

  update public.registry_claims
  set released_at = now()
  where id = v_claim_id;

  update public.registry_items
  set claimed_quantity = greatest(claimed_quantity - 1, 0)
  where id = v_item_id;

  return query select true, 'Gift released.'::text, v_title;
end;
$$;

revoke all on function public.release_registry_claim(text) from public;
grant execute on function public.release_registry_claim(text) to anon, authenticated;

-- Admin can release one specific guest claim.
create or replace function public.admin_release_registry_claim(p_claim_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;

  select registry_item_id
  into v_item_id
  from public.registry_claims
  where id = p_claim_id
    and released_at is null
  for update;

  if v_item_id is null then
    raise exception 'Active gift claim not found.';
  end if;

  update public.registry_claims
  set released_at = now()
  where id = p_claim_id;

  update public.registry_items
  set claimed_quantity = greatest(claimed_quantity - 1, 0)
  where id = v_item_id;

  return true;
end;
$$;

revoke all on function public.admin_release_registry_claim(uuid) from public;
grant execute on function public.admin_release_registry_claim(uuid) to authenticated;

-- Keep the older admin helper for compatibility; it releases all units.
create or replace function public.admin_release_registry_item(p_item_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;

  update public.registry_claims
  set released_at = now()
  where registry_item_id = p_item_id
    and released_at is null;

  update public.registry_items
  set claimed_quantity = 0
  where id = p_item_id;

  return true;
end;
$$;

revoke all on function public.admin_release_registry_item(uuid) from public;
grant execute on function public.admin_release_registry_item(uuid) to authenticated;

