-- Jordan & Rochelle Wedding Manager v0.6.3
-- Run ONCE in Supabase SQL Editor before deploying the website changes.

-- Track RSVP acknowledgement email delivery.
alter table public.rsvps
  add column if not exists confirmation_email_sent_at timestamptz;

-- Allow job assignments to point to a specific named RSVP attendee.
alter table public.job_assignments
  add column if not exists rsvp_person_id uuid references public.rsvp_people(id) on delete set null,
  add column if not exists contact_email text,
  add column if not exists requested_at timestamptz,
  add column if not exists responded_at timestamptz,
  add column if not exists response_method text;

create index if not exists job_assignments_rsvp_person_id_idx
  on public.job_assignments(rsvp_person_id);

-- Secure, one-time tokens used by guest Accept / Decline links.
create table if not exists public.job_assignment_tokens (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.job_assignments(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists job_assignment_tokens_assignment_id_idx
  on public.job_assignment_tokens(assignment_id);
create index if not exists job_assignment_tokens_token_hash_idx
  on public.job_assignment_tokens(token_hash);

alter table public.job_assignment_tokens enable row level security;

-- No public table policies are intentionally created for job_assignment_tokens.
-- Guest responses are handled only by the token-validating Edge Function.
revoke all on table public.job_assignment_tokens from anon, authenticated;

-- Existing admins continue to manage job_assignments through your current RLS policy.
