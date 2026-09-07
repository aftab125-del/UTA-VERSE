-- Migration: Create public avatars bucket in Supabase Storage with user-scoped RLS policies.
--
-- Enables avatar uploads from the Profile page for both email/password and OAuth users.
-- Single source of truth is public.profiles.avatar_url.

-- 1. Insert avatars bucket into storage.buckets if not already existing
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB limit
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- 2. Enable RLS on storage.objects (if not already enabled)
alter table storage.objects enable row level security;

-- 3. Drop any conflicting existing policies on avatars bucket
drop policy if exists "Public Avatars are readable by all" on storage.objects;
drop policy if exists "Users can upload their own avatar" on storage.objects;
drop policy if exists "Users can update their own avatar" on storage.objects;
drop policy if exists "Users can delete their own avatar" on storage.objects;

-- 4. Storage Policies for avatars bucket

-- Public read access: anyone can view avatar images
create policy "Public Avatars are readable by all"
  on storage.objects
  for select
  using (bucket_id = 'avatars');

-- Authenticated upload: users can upload to their own user-scoped directory (avatars/<user_id>/...)
create policy "Users can upload their own avatar"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated update: users can update/overwrite their own avatar
create policy "Users can update their own avatar"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated delete: users can delete their own avatar
create policy "Users can delete their own avatar"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5. Explicit table-level GRANTs for storage schema
grant select on table storage.objects to anon, authenticated;
grant insert, update, delete on table storage.objects to authenticated;
grant all on table storage.objects to service_role;
grant select on table storage.buckets to anon, authenticated, service_role;
grant all on table storage.buckets to service_role;
