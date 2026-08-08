-- Jordan & Rochelle Wedding Manager v0.6.0
-- Run this once in Supabase SQL Editor before using the Photo Manager.
-- It makes the wedding photo bucket private so photos marked "private only"
-- cannot be viewed through a guessed public Storage URL.

update storage.buckets
set public = false
where id = 'wedding-photos';

-- The existing storage.objects policies from the original schema are still used:
-- * admins may upload/update/delete wedding-photos files
-- * public/anonymous users may SELECT only files whose public.photos row has
--   show_in_guest_album = true
-- The app requests short-lived signed URLs, so private-library photos stay private.
