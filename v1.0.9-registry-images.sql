-- Jordan & Rochelle Wedding Manager v1.0.9
-- Easy registry gift photo uploads
-- Run once in Supabase SQL Editor BEFORE deploying v1.0.9.

insert into storage.buckets (id, name, public)
values ('registry-images', 'registry-images', true)
on conflict (id) do update set public = true;

drop policy if exists "public reads registry images" on storage.objects;
create policy "public reads registry images"
on storage.objects
for select
to public
using (bucket_id = 'registry-images');

drop policy if exists "admins upload registry images" on storage.objects;
create policy "admins upload registry images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'registry-images'
  and public.is_admin()
);

drop policy if exists "admins update registry images" on storage.objects;
create policy "admins update registry images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'registry-images'
  and public.is_admin()
)
with check (
  bucket_id = 'registry-images'
  and public.is_admin()
);

drop policy if exists "admins delete registry images" on storage.objects;
create policy "admins delete registry images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'registry-images'
  and public.is_admin()
);
