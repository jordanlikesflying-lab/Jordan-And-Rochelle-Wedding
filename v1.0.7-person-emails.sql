-- Jordan & Rochelle Wedding Manager v1.0.7
-- Run once in Supabase SQL Editor before deploying v1.0.7.

-- Each named person on an invitation can now have their own email address.
alter table public.invitation_people
  add column if not exists email text;

-- Existing invitation_people RLS/admin policy already protects this field.
-- No public read policy is added. Individual contact details remain admin-only.
