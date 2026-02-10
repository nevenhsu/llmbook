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
-- This is just a safety check.
-- In restricted environments, the migration role may not have access to schema storage.
do $$
begin
  if not has_schema_privilege(current_user, 'storage', 'USAGE') then
    raise warning 'Skipping storage.buckets upsert: role % has no USAGE on schema storage', current_user;
    return;
  end if;

  execute $sql$
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'media',
      'media',
      true,
      10485760,
      array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
    )
    on conflict (id) do update
    set
      public = true,
      file_size_limit = 10485760,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
  $sql$;
end
$$;

-- storage.objects policy DDL requires table owner privileges.
-- In some Supabase environments the migration role is not the owner,
-- which raises: ERROR 42501 must be owner of relation objects.
-- We only manage policies when the current role is owner (or superuser).
do $$
declare
  can_manage_policies boolean;
begin
  if not has_schema_privilege(current_user, 'storage', 'USAGE') then
    raise warning 'Skipping storage.objects policy management: role % has no USAGE on schema storage', current_user;
    return;
  end if;

  select
    coalesce(c.relowner = current_user::regrole, false)
    or coalesce(r.rolsuper, false)
  into can_manage_policies
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_roles r on r.rolname = current_user
  where n.nspname = 'storage'
    and c.relname = 'objects';

  if not coalesce(can_manage_policies, false) then
    raise warning 'Skipping storage.objects policy management: role % is not table owner', current_user;
    return;
  end if;

  -- Drop existing policies (for clean migration)
  execute 'drop policy if exists "Public read access" on storage.objects';
  execute 'drop policy if exists "Authenticated users can upload" on storage.objects';
  execute 'drop policy if exists "Users can update own images" on storage.objects';
  execute 'drop policy if exists "Users can delete own images" on storage.objects';
  execute 'drop policy if exists "Service role can upload persona images" on storage.objects';
  execute 'drop policy if exists "Service role can update any image" on storage.objects';
  execute 'drop policy if exists "Service role can delete any image" on storage.objects';

  -- Policy 1: Public read access
  execute $sql$
    create policy "Public read access"
    on storage.objects for select
    to public
    using (bucket_id = 'media')
  $sql$;

  -- Policy 2: Authenticated users can upload to their own folder
  execute $sql$
    create policy "Authenticated users can upload"
    on storage.objects for insert
    to authenticated
    with check (
      bucket_id = 'media'
      and (storage.foldername(name))[1] = auth.uid()::text
    )
  $sql$;

  -- Policy 3: Users can update own images
  execute $sql$
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
    )
  $sql$;

  -- Policy 4: Users can delete own images
  execute $sql$
    create policy "Users can delete own images"
    on storage.objects for delete
    to authenticated
    using (
      bucket_id = 'media'
      and (storage.foldername(name))[1] = auth.uid()::text
    )
  $sql$;

  -- Policy 5: Service role can upload persona images
  execute $sql$
    create policy "Service role can upload persona images"
    on storage.objects for insert
    to service_role
    with check (bucket_id = 'media')
  $sql$;

  -- Policy 6: Service role can update any image
  execute $sql$
    create policy "Service role can update any image"
    on storage.objects for update
    to service_role
    using (bucket_id = 'media')
    with check (bucket_id = 'media')
  $sql$;

  -- Policy 7: Service role can delete any image
  execute $sql$
    create policy "Service role can delete any image"
    on storage.objects for delete
    to service_role
    using (bucket_id = 'media')
  $sql$;

  -- Add helpful comments
  execute $sql$
    comment on policy "Public read access" on storage.objects is
    'Allow anyone to view images in the media bucket'
  $sql$;

  execute $sql$
    comment on policy "Authenticated users can upload" on storage.objects is
    'Allow authenticated users to upload images to their own folder: {user_id}/subfolder/file.ext'
  $sql$;

  execute $sql$
    comment on policy "Users can update own images" on storage.objects is
    'Allow users to update only their own images (in folders named with their user ID)'
  $sql$;

  execute $sql$
    comment on policy "Users can delete own images" on storage.objects is
    'Allow users to delete only their own images (in folders named with their user ID)'
  $sql$;

  execute $sql$
    comment on policy "Service role can upload persona images" on storage.objects is
    'Allow persona engine (using service role key) to upload AI-generated images to personas/ folder'
  $sql$;

  execute $sql$
    comment on policy "Service role can update any image" on storage.objects is
    'Allow persona engine to update any image (for optimization, cleanup, etc.)'
  $sql$;

  execute $sql$
    comment on policy "Service role can delete any image" on storage.objects is
    'Allow persona engine to delete any image (for cleanup, moderation, etc.)'
  $sql$;
end
$$;

-- ============================================
-- Storage Helper Functions
-- ============================================

-- Function to validate image file extensions
create or replace function public.validate_image_extension(filename text)
returns boolean
language plpgsql
security definer
as $$
begin
  return lower(filename) ~* '\.(jpg|jpeg|png|webp|gif)$';
end;
$$;

comment on function public.validate_image_extension(text) is 
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
