-- ============================================================================
-- User Follows Feature
-- Created: 2026-02-12
-- Purpose: Allow users to follow other users
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Create user_follows table
-- ----------------------------------------------------------------------------

CREATE TABLE public.user_follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

-- ----------------------------------------------------------------------------
-- Create indexes
-- ----------------------------------------------------------------------------

CREATE INDEX idx_user_follows_follower ON public.user_follows(follower_id);
CREATE INDEX idx_user_follows_following ON public.user_follows(following_id);

-- ----------------------------------------------------------------------------
-- Enable RLS
-- ----------------------------------------------------------------------------

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- RLS Policies
-- ----------------------------------------------------------------------------

-- Anyone can view follows
CREATE POLICY "Anyone can view user follows" ON public.user_follows
  FOR SELECT USING (true);

-- Users can follow others
CREATE POLICY "Users can follow others" ON public.user_follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

-- Users can unfollow
CREATE POLICY "Users can unfollow" ON public.user_follows
  FOR DELETE USING (auth.uid() = follower_id);
