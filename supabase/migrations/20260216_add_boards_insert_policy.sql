-- Migration: Add UPDATE policy for boards table
-- Date: 2026-02-16
-- Description: Allow board owners to update their boards
-- Note: Board creation and deletion use admin client (no INSERT/DELETE policies)

-- Add policy to allow board owners to update their boards
-- (Owner is determined by checking board_moderators table with role='owner')
CREATE POLICY "Board owners can update boards" ON public.boards
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.board_moderators
      WHERE board_moderators.board_id = boards.id
        AND board_moderators.user_id = auth.uid()
        AND board_moderators.role = 'owner'
    )
  );
