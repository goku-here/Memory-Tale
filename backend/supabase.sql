-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Bucket `Originals` must already exist (private).

-- Limit what the bucket accepts: images only, max 20 MB each.
update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = array['image/*']
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
