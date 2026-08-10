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

