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

-- 2. Storage Policies for avatars bucket (wrapped safely so no ownership error occurs)
DO $$ BEGIN
  drop policy if exists "Public Avatars are readable by all" on storage.objects;
  drop policy if exists "Users can upload their own avatar" on storage.objects;
  drop policy if exists "Users can update their own avatar" on storage.objects;
  drop policy if exists "Users can delete their own avatar" on storage.objects;

  create policy "Public Avatars are readable by all"
    on storage.objects
    for select
    using (bucket_id = 'avatars');

  create policy "Users can upload their own avatar"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'avatars' and
      (storage.foldername(name))[1] = auth.uid()::text
    );

  create policy "Users can update their own avatar"
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'avatars' and
      (storage.foldername(name))[1] = auth.uid()::text
    );

  create policy "Users can delete their own avatar"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'avatars' and
      (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
