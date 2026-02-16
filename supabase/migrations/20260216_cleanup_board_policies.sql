-- Migration: Cleanup board policies
-- Date: 2026-02-16
-- Description: Remove INSERT policy if it was previously created
--              Board creation uses admin client, so INSERT policy is not needed

-- Drop INSERT policy if it exists
DROP POLICY IF EXISTS "Authenticated users can create boards" ON public.boards;

-- Drop DELETE policy if it exists
DROP POLICY IF EXISTS "Board owners can delete boards" ON public.boards;

-- The following policies should remain:
-- ✓ "Boards are viewable by everyone" (SELECT)
-- ✓ "Board owners can update boards" (UPDATE)
