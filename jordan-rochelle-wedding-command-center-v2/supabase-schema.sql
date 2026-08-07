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
