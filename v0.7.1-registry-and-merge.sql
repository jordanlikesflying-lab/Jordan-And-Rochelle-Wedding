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
