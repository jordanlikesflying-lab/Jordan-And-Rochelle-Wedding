-- Jordan & Rochelle Wedding Manager v1.0.5
-- Household people editor + persistent "Not a duplicate" decisions
-- Run once in Supabase SQL Editor BEFORE deploying v1.0.5.

-- ============================================================
-- Invitation people: make them fully editable household members
-- ============================================================

alter table public.invitation_people
  add column if not exists person_type text not null default 'adult';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invitation_people_person_type_check'
      and conrelid = 'public.invitation_people'::regclass
  ) then
    alter table public.invitation_people
      add constraint invitation_people_person_type_check
      check (person_type in ('adult','child'));
  end if;
end;
$$;

-- Existing invited people were adults unless changed by an admin later.
update public.invitation_people
set person_type = 'adult'
where person_type is null
   or person_type not in ('adult','child');

-- Keep automatic household-name parsing for NEW invitations only.
-- After creation, the people list is intentionally managed by the admin
-- and should not be overwritten when household/contact fields are edited.
drop trigger if exists invitations_sync_people on public.invitations;

create or replace function public.sync_invitation_people_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_order integer := 0;
begin
  foreach v_name in array public.invitation_people_names(
    new.household_name,
    new.primary_first_name,
    new.primary_last_name
  )
  loop
    if btrim(coalesce(v_name, '')) <> '' then
      insert into public.invitation_people(
        invitation_id, person_name, person_type, sort_order
      )
      values (
        new.id, btrim(v_name), 'adult', v_order
      )
      on conflict (invitation_id, person_name) do nothing;
      v_order := v_order + 1;
    end if;
  end loop;

  return new;
end;
$$;

create trigger invitations_sync_people
after insert
on public.invitations
for each row
execute function public.sync_invitation_people_on_insert();

-- ============================================================
-- Persistent duplicate review decisions
-- ============================================================

create table if not exists public.duplicate_dismissals (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('invitation','rsvp','job','registry')),
  left_id uuid not null,
  right_id uuid not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (left_id <> right_id)
);

create unique index if not exists duplicate_dismissals_unique_pair
on public.duplicate_dismissals(
  entity_type,
  least(left_id, right_id),
  greatest(left_id, right_id)
);

alter table public.duplicate_dismissals enable row level security;

drop policy if exists "admins manage duplicate dismissals" on public.duplicate_dismissals;
create policy "admins manage duplicate dismissals"
on public.duplicate_dismissals
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, insert, delete
on public.duplicate_dismissals
to authenticated;

create or replace function public.dismiss_duplicate_pair(
  p_entity_type text,
  p_left_id uuid,
  p_right_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_left uuid;
  v_right uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;

  if p_entity_type not in ('invitation','rsvp','job','registry') then
    raise exception 'Invalid duplicate type.';
  end if;

  if p_left_id is null or p_right_id is null or p_left_id = p_right_id then
    raise exception 'Choose two different records.';
  end if;

  v_left := least(p_left_id, p_right_id);
  v_right := greatest(p_left_id, p_right_id);

  insert into public.duplicate_dismissals(
    entity_type, left_id, right_id, created_by
  )
  values (p_entity_type, v_left, v_right, auth.uid())
  on conflict do nothing;

  return true;
end;
$$;

revoke all on function public.dismiss_duplicate_pair(text,uuid,uuid) from public;
grant execute on function public.dismiss_duplicate_pair(text,uuid,uuid) to authenticated;

create or replace function public.restore_duplicate_pair(
  p_entity_type text,
  p_left_id uuid,
  p_right_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;

  delete from public.duplicate_dismissals
  where entity_type = p_entity_type
    and least(left_id, right_id) = least(p_left_id, p_right_id)
    and greatest(left_id, right_id) = greatest(p_left_id, p_right_id);

  return true;
end;
$$;

revoke all on function public.restore_duplicate_pair(text,uuid,uuid) from public;
grant execute on function public.restore_duplicate_pair(text,uuid,uuid) to authenticated;
