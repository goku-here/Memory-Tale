-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Bucket `Originals` must already exist (private).

-- Limit what the bucket accepts: images and locked files (private-book originals are locked on the phone first and
-- travel as application/octet-stream), max 20 MB each.
update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = array['image/*', 'application/octet-stream']
where id = 'Originals';

-- Firebase login is not a Supabase login, so the browser talks to Storage with the publishable (anon) key.
-- Files live under unguessable paths: {firebaseUid}/{memoryId}/{random-uuid}.ext
-- Anyone may upload and read inside this bucket; nobody may overwrite or delete.
drop policy if exists "originals_insert" on storage.objects;
drop policy if exists "originals_select" on storage.objects;

create policy "originals_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'Originals');

create policy "originals_select" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'Originals');

-- Private books (end-to-end encrypted): the app locks each original photo on the phone BEFORE uploading, so this bucket
-- only ever holds scrambled `.mtenc` files for them. The read policy above is therefore harmless for those files.
-- Older, readable files (from before a book was made private) can be deleted from the dashboard after the owner has made
-- the book private: the app shows the list of their paths.

-- From now on the app locks EVERY original before it reaches this bucket (private or not), so new files are scrambled
-- `.mtenc` files. Older readable files are converted by the members' phones when they open their books. When you are
-- confident everyone has opened their books on the new version, run this once to delete every file that is still readable:
--
--   delete from storage.objects where bucket_id = 'Originals' and name not like '%.mtenc';
--
-- (Check first with:  select count(*) from storage.objects where bucket_id = 'Originals' and name not like '%.mtenc';)
