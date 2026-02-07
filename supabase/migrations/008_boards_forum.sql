-- Migration 008: Board forum features
-- Adds extended board functionality: moderators, members, polls, post types

-- ============================================================================
-- STEP 1: Extend boards table with additional columns
-- ============================================================================

ALTER TABLE public.boards
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS icon_url text,
  ADD COLUMN IF NOT EXISTS rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS member_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS post_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ============================================================================
-- STEP 2: Extend posts table with post_type and link_url
-- ============================================================================

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS post_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS link_url text;

-- Add constraint for valid post types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'posts_post_type_check'
  ) THEN
    ALTER TABLE public.posts
      ADD CONSTRAINT posts_post_type_check
      CHECK (post_type IN ('text', 'image', 'link', 'poll'));
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Create poll_options table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  text text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  vote_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- STEP 4: Create board_moderators table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.board_moderators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'moderator',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE (board_id, user_id)
);

-- ============================================================================
-- STEP 5: Create board_members table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.board_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE (user_id, board_id)
);

-- ============================================================================
-- STEP 6: Enable RLS on new tables
-- ============================================================================

ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_moderators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 7: Create RLS policies
-- ============================================================================

-- Poll options are viewable by everyone
DROP POLICY IF EXISTS "Poll options are viewable by everyone" ON public.poll_options;
CREATE POLICY "Poll options are viewable by everyone" ON public.poll_options
  FOR SELECT USING (true);

-- Users can vote (insert poll responses handled separately)
DROP POLICY IF EXISTS "Post authors can manage poll options" ON public.poll_options;
CREATE POLICY "Post authors can manage poll options" ON public.poll_options
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = poll_options.post_id
        AND posts.author_id = auth.uid()
    )
  );

-- Board moderators are viewable by everyone
DROP POLICY IF EXISTS "Board moderators are viewable by everyone" ON public.board_moderators;
CREATE POLICY "Board moderators are viewable by everyone" ON public.board_moderators
  FOR SELECT USING (true);

-- Board members are viewable by everyone
DROP POLICY IF EXISTS "Board members are viewable by everyone" ON public.board_members;
CREATE POLICY "Board members are viewable by everyone" ON public.board_members
  FOR SELECT USING (true);

-- Users can join boards
DROP POLICY IF EXISTS "Users can join boards" ON public.board_members;
CREATE POLICY "Users can join boards" ON public.board_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can leave boards
DROP POLICY IF EXISTS "Users can leave boards" ON public.board_members;
CREATE POLICY "Users can leave boards" ON public.board_members
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- STEP 8: Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_poll_options_post ON public.poll_options(post_id);
CREATE INDEX IF NOT EXISTS idx_board_moderators_board ON public.board_moderators(board_id);
CREATE INDEX IF NOT EXISTS idx_board_moderators_user ON public.board_moderators(user_id);
CREATE INDEX IF NOT EXISTS idx_board_members_board ON public.board_members(board_id);
CREATE INDEX IF NOT EXISTS idx_board_members_user ON public.board_members(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_board ON public.posts(board_id);
CREATE INDEX IF NOT EXISTS idx_posts_type ON public.posts(post_type);
