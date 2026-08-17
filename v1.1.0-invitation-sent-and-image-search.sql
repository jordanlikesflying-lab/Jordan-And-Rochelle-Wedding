-- Jordan & Rochelle Wedding Manager v1.1.0
-- Run once in Supabase SQL Editor BEFORE deploying v1.1.0.

-- Track whether the physical/digital invitation has actually been sent.
alter table public.invitations
  add column if not exists invitation_sent boolean not null default false;

-- Store optional attribution for photos selected through Pexels search.
alter table public.registry_items
  add column if not exists image_credit text;

alter table public.registry_items
  add column if not exists image_source_url text;
