-- Jordan & Rochelle Wedding Manager v0.6.1
-- Run once in Supabase SQL Editor.
-- Adds one separately selected homepage engagement photo without forcing it
-- to appear in the public guest album.

alter table public.photos
  add column if not exists is_favorite_engagement boolean not null default false;

-- Keep at most one favorite engagement photo.
create unique index if not exists photos_one_favorite_engagement
  on public.photos ((is_favorite_engagement))
  where is_favorite_engagement = true;

-- Public visitors may read metadata for guest-album photos OR the homepage favorite.
drop policy if exists "public reads selected photos" on public.photos;
create policy "public reads selected photos"
on public.photos for select to anon, authenticated
using (show_in_guest_album or is_favorite_engagement or public.is_admin());

-- Public visitors may request the file for guest-album photos OR the homepage favorite.
drop policy if exists "public sees selected wedding photo files" on storage.objects;
create policy "public sees selected wedding photo files"
on storage.objects for select to public
using (
  bucket_id = 'wedding-photos'
  and exists (
    select 1 from public.photos p
    where p.storage_path = name
      and (p.show_in_guest_album or p.is_favorite_engagement)
  )
);
