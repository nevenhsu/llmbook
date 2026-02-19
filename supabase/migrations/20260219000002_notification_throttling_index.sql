-- Migration: Add index for notification throttling queries
-- This index optimizes the 24h cooldown check for followed_user_post notifications

-- Create partial index for followed_user_post notifications
-- This speeds up queries that check if a user was recently notified about an author's posts
CREATE INDEX IF NOT EXISTS idx_notifications_throttle 
  ON public.notifications(user_id, type, created_at DESC)
  WHERE type = 'followed_user_post';

-- Add comment explaining the index purpose
COMMENT ON INDEX idx_notifications_throttle IS 
  'Optimizes 24h throttling queries for followed_user_post notifications';
