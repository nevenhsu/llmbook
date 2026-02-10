-- ============================================
-- Storage Bucket: media
-- Purpose: Store user-uploaded images and persona-generated images
-- Created: 2026-02-10
-- 
-- Structure:
--   - {user_id}/posts/*.webp    (user post images)
--   - {user_id}/avatars/*.webp  (user avatars)
--   - {user_id}/boards/*.webp   (board banners)
--   - personas/avatars/*.webp   (persona avatars)
--   - personas/posts/{persona_id}/*.webp (persona post images)
-- ============================================

-- Enable storage extension (if not already enabled)
create extension if not exists "uuid-ossp";

-- Create bucket (if not exists via dashboard)
-- Note: You should create this bucket via the Supabase Dashboard first
-- This is just a safety check
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 
  'media', 
  true,
  10485760, -- 10 MB in bytes
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set 
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[];

-- Drop existing policies (for clean migration)
drop policy if exists "Public read access" on storage.objects;
drop policy if exists "Authenticated users can upload" on storage.objects;
drop policy if exists "Users can update own images" on storage.objects;
drop policy if exists "Users can delete own images" on storage.objects;
drop policy if exists "Service role can upload persona images" on storage.objects;
drop policy if exists "Service role can update any image" on storage.objects;
drop policy if exists "Service role can delete any image" on storage.objects;

-- ============================================
-- Public Policies
-- ============================================

-- Policy 1: Public read access
-- Allow anyone to view images in the media bucket
create policy "Public read access"
on storage.objects for select
to public
using (bucket_id = 'media');

-- ============================================
-- Authenticated User Policies
-- ============================================

-- Policy 2: Authenticated users can upload to their own folder
-- Users can only upload to folders named with their user ID
-- Example: {user_id}/posts/image.webp
create policy "Authenticated users can upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'media' 
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Users can update own images
-- Users can only update images in folders named with their user ID
create policy "Users can update own images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'media' 
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'media' 
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 4: Users can delete own images
-- Users can only delete images in folders named with their user ID
create policy "Users can delete own images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'media' 
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- Service Role Policies (for Persona Engine)
-- ============================================

-- Policy 5: Service role can upload persona images
-- The Persona Engine uses service role key to upload AI-generated images
-- These go to the personas/ folder
create policy "Service role can upload persona images"
on storage.objects for insert
to service_role
with check (bucket_id = 'media');

-- Policy 6: Service role can update any image
-- Service role has full update access (for cleanup, optimization, etc.)
create policy "Service role can update any image"
on storage.objects for update
to service_role
using (bucket_id = 'media')
with check (bucket_id = 'media');

-- Policy 7: Service role can delete any image
-- Service role has full delete access (for cleanup, moderation, etc.)
create policy "Service role can delete any image"
on storage.objects for delete
to service_role
using (bucket_id = 'media');

-- ============================================
-- Add helpful comments
-- ============================================

comment on policy "Public read access" on storage.objects is 
  'Allow anyone to view images in the media bucket';
  
comment on policy "Authenticated users can upload" on storage.objects is 
  'Allow authenticated users to upload images to their own folder: {user_id}/subfolder/file.ext';
  
comment on policy "Users can update own images" on storage.objects is 
  'Allow users to update only their own images (in folders named with their user ID)';
  
comment on policy "Users can delete own images" on storage.objects is 
  'Allow users to delete only their own images (in folders named with their user ID)';
  
comment on policy "Service role can upload persona images" on storage.objects is 
  'Allow persona engine (using service role key) to upload AI-generated images to personas/ folder';
  
comment on policy "Service role can update any image" on storage.objects is 
  'Allow persona engine to update any image (for optimization, cleanup, etc.)';
  
comment on policy "Service role can delete any image" on storage.objects is 
  'Allow persona engine to delete any image (for cleanup, moderation, etc.)';

-- ============================================
-- Storage Helper Functions
-- ============================================

-- Function to validate image file extensions
create or replace function storage.validate_image_extension(filename text)
returns boolean
language plpgsql
security definer
as $$
begin
  return lower(filename) ~* '\.(jpg|jpeg|png|webp|gif)$';
end;
$$;

comment on function storage.validate_image_extension(text) is 
  'Check if filename has a valid image extension (.jpg, .jpeg, .png, .webp, .gif)';

-- ============================================
-- Verification Query
-- ============================================

-- Run this to verify all policies are created:
-- 
-- select 
--   schemaname,
--   tablename,
--   policyname,
--   permissive,
--   roles,
--   cmd
-- from pg_policies
-- where schemaname = 'storage' 
--   and tablename = 'objects'
--   and policyname like '%media%' or policyname like '%Public%' or policyname like '%Authenticated%' or policyname like '%Service%'
-- order by policyname;
