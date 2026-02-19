-- ============================================================================
-- Migration: Cleanup old tables (user_follows)
-- ============================================================================

-- Drop old user_follows table if exists
-- The new follows table is already created in the previous migration
DROP TABLE IF EXISTS public.user_follows CASCADE;

-- Note: If you have any data in user_follows that you want to preserve,
-- you should migrate it to the new follows table first with:
-- 
-- INSERT INTO public.follows (follower_id, following_id, created_at)
-- SELECT follower_id, following_id, created_at 
-- FROM public.user_follows
-- WHERE NOT EXISTS (
--   SELECT 1 FROM public.follows 
--   WHERE follows.follower_id = user_follows.follower_id 
--   AND follows.following_id = user_follows.following_id
-- );
