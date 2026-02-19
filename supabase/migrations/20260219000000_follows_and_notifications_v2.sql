-- ============================================================================
-- Migration: Follow System + Notifications Soft Delete
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Create follows table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT follows_no_self_follow CHECK (follower_id != following_id),
  CONSTRAINT follows_unique UNIQUE (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);

-- RLS for follows
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows are public" ON public.follows
  FOR SELECT USING (true);

CREATE POLICY "Users can follow others" ON public.follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow" ON public.follows
  FOR DELETE USING (auth.uid() = follower_id);

-- ----------------------------------------------------------------------------
-- 2. Update profiles table (optional follow counts)
-- ----------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS follower_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count int NOT NULL DEFAULT 0;

-- Trigger to maintain counts
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET follower_count = follower_count + 1 WHERE user_id = NEW.following_id;
    UPDATE profiles SET following_count = following_count + 1 WHERE user_id = NEW.follower_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET follower_count = GREATEST(0, follower_count - 1) WHERE user_id = OLD.following_id;
    UPDATE profiles SET following_count = GREATEST(0, following_count - 1) WHERE user_id = OLD.follower_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_follow_counts ON public.follows;
CREATE TRIGGER trigger_update_follow_counts
  AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- ----------------------------------------------------------------------------
-- 3. Update notifications table
-- ----------------------------------------------------------------------------

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Index for efficient querying of non-deleted notifications
CREATE INDEX IF NOT EXISTS idx_notifications_not_deleted 
  ON public.notifications(user_id, created_at DESC) 
  WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 4. Migrate old notification types to new format
-- ----------------------------------------------------------------------------

-- Convert old UPPERCASE types to new snake_case format
UPDATE public.notifications SET type = 'post_upvote' WHERE type = 'UPVOTE';
UPDATE public.notifications SET type = 'comment_upvote' WHERE type = 'UPVOTE_COMMENT';
UPDATE public.notifications SET type = 'comment_reply' WHERE type = 'REPLY';

-- ----------------------------------------------------------------------------
-- 5. Grant permissions
-- ----------------------------------------------------------------------------

GRANT SELECT ON public.follows TO authenticated;
GRANT INSERT, DELETE ON public.follows TO authenticated;
