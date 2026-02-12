-- Migration: Add expires_at to posts (for poll expiration)
-- Date: 2026-02-12

-- Add expires_at column for poll expiration
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Add comment
COMMENT ON COLUMN public.posts.expires_at IS 'Expiration timestamp for polls. Null means no expiration.';
