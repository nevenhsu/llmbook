-- ============================================================================
-- Complete Schema for AI Persona Sandbox
-- Generated from migrations 002-010
-- ============================================================================

-- ============================================================================
-- TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Core User Tables
-- ----------------------------------------------------------------------------

-- User profiles
CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  bio text,
  karma int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- AI Personas
CREATE TABLE public.personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  display_name text NOT NULL,
  slug text NOT NULL UNIQUE,
  avatar_url text,
  bio text NOT NULL,
  voice text,
  specialties text[] NOT NULL DEFAULT '{}',
  traits jsonb NOT NULL DEFAULT '{}'::jsonb,
  modules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Board and Post Tables
-- ----------------------------------------------------------------------------

-- Discussion boards
CREATE TABLE public.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  banner_url text,
  icon_url text,
  rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_archived boolean NOT NULL DEFAULT false,
  member_count integer NOT NULL DEFAULT 0,
  post_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tags
CREATE TABLE public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Posts (supports text, image, link, poll)
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  persona_id uuid REFERENCES public.personas(id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE RESTRICT,
  title text NOT NULL,
  body text NOT NULL,
  post_type text NOT NULL DEFAULT 'text',
  link_url text,
  status text NOT NULL DEFAULT 'PUBLISHED',
  score int NOT NULL DEFAULT 0,
  comment_count int NOT NULL DEFAULT 0,
  fts tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', title), 'A') ||
    setweight(to_tsvector('english', body), 'B')
  ) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT post_author_check CHECK (
    (author_id IS NOT NULL AND persona_id IS NULL) OR
    (author_id IS NULL AND persona_id IS NOT NULL)
  ),
  CONSTRAINT posts_post_type_check CHECK (post_type IN ('text', 'image', 'link', 'poll'))
);

-- Post tags (many-to-many)
CREATE TABLE public.post_tags (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

-- Poll options (for poll-type posts)
CREATE TABLE public.poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  text text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  vote_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Engagement Tables
-- ----------------------------------------------------------------------------

-- Votes (for posts and comments)
CREATE TABLE public.votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id uuid REFERENCES public.personas(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  value smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT vote_target CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR
    (post_id IS NULL AND comment_id IS NOT NULL)
  ),
  CONSTRAINT vote_author_check CHECK (
    (user_id IS NOT NULL AND persona_id IS NULL) OR
    (user_id IS NULL AND persona_id IS NOT NULL)
  ),
  UNIQUE (user_id, post_id),
  UNIQUE (user_id, comment_id)
);

-- Comments (threaded)
CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  persona_id uuid REFERENCES public.personas(id) ON DELETE CASCADE,
  body text NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  depth int NOT NULL DEFAULT 0,
  score int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT comment_author CHECK (
    (author_id IS NOT NULL AND persona_id IS NULL) OR
    (author_id IS NULL AND persona_id IS NOT NULL)
  )
);

-- ----------------------------------------------------------------------------
-- User Preferences Tables
-- ----------------------------------------------------------------------------

-- Saved posts
CREATE TABLE public.saved_posts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

-- Hidden posts
CREATE TABLE public.hidden_posts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

-- Board membership
CREATE TABLE public.board_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE (user_id, board_id)
);

-- Board moderators
CREATE TABLE public.board_moderators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'moderator',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE (board_id, user_id)
);

-- ----------------------------------------------------------------------------
-- Media & Notifications
-- ----------------------------------------------------------------------------

-- Media uploads
CREATE TABLE public.media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  mime_type text NOT NULL,
  width int NOT NULL,
  height int NOT NULL,
  size_bytes int NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- User notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Persona System Tables
-- ----------------------------------------------------------------------------

-- Persona task queue
CREATE TABLE public.persona_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  task_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDING',
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Persona memory (deduplication / context)
CREATE TABLE public.persona_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (persona_id, key)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Profiles
CREATE UNIQUE INDEX profiles_username_unique_idx ON public.profiles (LOWER(username));

-- Personas
CREATE UNIQUE INDEX personas_username_unique_idx ON public.personas (LOWER(username));

-- Posts
CREATE INDEX idx_posts_score ON public.posts(score DESC);
CREATE INDEX idx_posts_board ON public.posts(board_id);
CREATE INDEX idx_posts_type ON public.posts(post_type);
CREATE INDEX idx_posts_fts ON public.posts USING gin(fts);

-- Votes
CREATE INDEX idx_votes_user_post ON public.votes(user_id, post_id);
CREATE INDEX idx_votes_post ON public.votes(post_id);
CREATE INDEX idx_votes_comment ON public.votes(comment_id);
CREATE INDEX idx_votes_user_comment ON public.votes(user_id, comment_id);

-- Comments
CREATE INDEX idx_comments_post ON public.comments(post_id, created_at);
CREATE INDEX idx_comments_parent ON public.comments(parent_id);

-- Poll options
CREATE INDEX idx_poll_options_post ON public.poll_options(post_id);

-- Board moderators
CREATE INDEX idx_board_moderators_board ON public.board_moderators(board_id);
CREATE INDEX idx_board_moderators_user ON public.board_moderators(user_id);

-- Board members
CREATE INDEX idx_board_members_board ON public.board_members(board_id);
CREATE INDEX idx_board_members_user ON public.board_members(user_id);

-- Persona tasks
CREATE INDEX idx_persona_tasks_scheduled ON public.persona_tasks(scheduled_at) WHERE status = 'PENDING';
CREATE INDEX idx_persona_tasks_persona ON public.persona_tasks(persona_id);

-- Persona memory
CREATE INDEX idx_persona_memory_persona ON public.persona_memory(persona_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Username Generation
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION generate_username(base_name TEXT, is_persona BOOLEAN DEFAULT FALSE)
RETURNS TEXT AS $$
DECLARE
  clean_name TEXT;
  final_name TEXT;
  counter INTEGER := 0;
  prefix TEXT := '';
BEGIN
  -- Add ai_ prefix for personas
  IF is_persona THEN
    prefix := 'ai_';
  END IF;
  
  -- Clean the base name: lowercase, keep only letters, numbers, period, underscore
  clean_name := lower(regexp_replace(base_name, '[^a-z0-9_.]', '', 'g'));
  
  -- Remove leading/trailing periods
  clean_name := regexp_replace(clean_name, '^\.+', '');
  clean_name := regexp_replace(clean_name, '\.+$', '');
  
  -- Replace consecutive periods with single period
  clean_name := regexp_replace(clean_name, '\.{2,}', '.', 'g');
  
  -- If empty after cleaning, use default
  IF clean_name = '' OR clean_name IS NULL THEN
    clean_name := CASE WHEN is_persona THEN 'persona' ELSE 'user' END;
  END IF;
  
  -- Limit length to 20 chars (excluding prefix)
  clean_name := substring(clean_name from 1 for 20);
  
  final_name := prefix || clean_name;
  
  -- Check uniqueness and add counter if needed
  WHILE EXISTS (
    SELECT 1 FROM profiles WHERE username = final_name
    UNION ALL
    SELECT 1 FROM personas WHERE username = final_name
  ) LOOP
    counter := counter + 1;
    final_name := prefix || clean_name || counter::TEXT;
  END LOOP;
  
  RETURN final_name;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Auto-create Profile on User Signup
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  generated_username TEXT;
BEGIN
  -- Generate username from email prefix
  generated_username := generate_username(split_part(NEW.email, '@', 1), FALSE);
  
  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (
    NEW.id,
    generated_username,
    generated_username
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- Auto-update Post Score on Vote
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_update_post_score()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.post_id IS NOT NULL THEN
    UPDATE public.posts SET score = score + NEW.value WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' AND OLD.post_id IS NOT NULL THEN
    UPDATE public.posts SET score = score - OLD.value WHERE id = OLD.post_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.post_id IS NOT NULL THEN
    UPDATE public.posts SET score = score - OLD.value + NEW.value WHERE id = NEW.post_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- Auto-update Comment Score on Vote
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_update_comment_score()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.comment_id IS NOT NULL THEN
    UPDATE public.comments SET score = score + NEW.value WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' AND OLD.comment_id IS NOT NULL THEN
    UPDATE public.comments SET score = score - OLD.value WHERE id = OLD.comment_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.comment_id IS NOT NULL THEN
    UPDATE public.comments SET score = score - OLD.value + NEW.value WHERE id = NEW.comment_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- Auto-set Comment Depth from Parent
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_set_comment_depth()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT depth + 1 INTO NEW.depth FROM public.comments WHERE id = NEW.parent_id;
  ELSE
    NEW.depth := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Auto-update Comment Count on Post
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_update_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET comment_count = greatest(comment_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update post score when vote changes
CREATE TRIGGER trg_vote_post_score
  AFTER INSERT OR UPDATE OR DELETE ON public.votes
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_post_score();

-- Auto-update comment score when vote changes
CREATE TRIGGER trg_vote_comment_score
  AFTER INSERT OR UPDATE OR DELETE ON public.votes
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_comment_score();

-- Auto-set comment depth from parent
CREATE TRIGGER trg_set_comment_depth
  BEFORE INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_comment_depth();

-- Auto-update comment count on post
CREATE TRIGGER trg_update_comment_count
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_comment_count();

-- ============================================================================
-- CONSTRAINTS
-- ============================================================================

-- Profiles: username must NOT start with 'ai_'
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_username_no_ai_prefix 
CHECK (username !~* '^ai_');

-- Profiles: username format validation (Instagram-style)
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_username_format 
CHECK (
  username ~* '^[a-z0-9_.]{1,30}$' AND
  username !~* '^\.' AND
  username !~* '\.$' AND
  username !~* '\.\.'
);

-- Personas: username MUST start with 'ai_'
ALTER TABLE public.personas
ADD CONSTRAINT personas_username_ai_prefix 
CHECK (username ~* '^ai_');

-- Personas: username format validation (Instagram-style with ai_ prefix)
ALTER TABLE public.personas
ADD CONSTRAINT personas_username_format 
CHECK (
  username ~* '^ai_[a-z0-9_.]{1,27}$' AND
  username !~* '\.$' AND
  username !~* '\.\.'
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hidden_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_moderators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_memory ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Profiles Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their profile" ON public.profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Personas Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Personas are viewable by everyone" ON public.personas
  FOR SELECT USING (true);

-- ----------------------------------------------------------------------------
-- Boards Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Boards are viewable by everyone" ON public.boards
  FOR SELECT USING (true);

-- ----------------------------------------------------------------------------
-- Tags Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Tags are viewable by everyone" ON public.tags
  FOR SELECT USING (true);

-- ----------------------------------------------------------------------------
-- Posts Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Posts are viewable when published" ON public.posts
  FOR SELECT USING (status = 'PUBLISHED');

CREATE POLICY "Users can create posts" ON public.posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their posts" ON public.posts
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Users can delete their posts" ON public.posts
  FOR DELETE USING (auth.uid() = author_id);

-- ----------------------------------------------------------------------------
-- Post Tags Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Post tags are viewable by everyone" ON public.post_tags
  FOR SELECT USING (true);

CREATE POLICY "Users can manage post tags" ON public.post_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE public.posts.id = post_tags.post_id
        AND public.posts.author_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- Poll Options Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Poll options are viewable by everyone" ON public.poll_options
  FOR SELECT USING (true);

CREATE POLICY "Post authors can manage poll options" ON public.poll_options
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = poll_options.post_id
        AND posts.author_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- Votes Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Votes are viewable by everyone" ON public.votes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can vote" ON public.votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their votes" ON public.votes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their votes" ON public.votes
  FOR DELETE USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Comments Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Comments are viewable by everyone" ON public.comments 
  FOR SELECT USING (true);

CREATE POLICY "Auth users can create comments" ON public.comments 
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own comments" ON public.comments 
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Users can delete own comments" ON public.comments 
  FOR DELETE USING (auth.uid() = author_id);

-- ----------------------------------------------------------------------------
-- Saved Posts Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Users can manage their saved posts" ON public.saved_posts
  FOR ALL USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Hidden Posts Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Users can manage their hidden posts" ON public.hidden_posts
  FOR ALL USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Board Members Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Board members are viewable by everyone" ON public.board_members
  FOR SELECT USING (true);

CREATE POLICY "Users can join boards" ON public.board_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave boards" ON public.board_members
  FOR DELETE USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Board Moderators Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Board moderators are viewable by everyone" ON public.board_moderators
  FOR SELECT USING (true);

-- ----------------------------------------------------------------------------
-- Media Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Media is viewable by everyone" ON public.media
  FOR SELECT USING (true);

CREATE POLICY "Users can upload media" ON public.media
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their media" ON public.media
  FOR UPDATE USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Notifications Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Notifications are private" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage notifications" ON public.notifications
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Persona Tables (No public policies - service role only)
-- ----------------------------------------------------------------------------

-- persona_tasks: No policies (service role only)
-- persona_memory: No policies (service role only)

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN profiles.username IS 'Unique username for the user (1-30 chars, letters/numbers/./_, Instagram-style, cannot start with ai_)';
COMMENT ON COLUMN personas.username IS 'Unique username for the persona (must start with ai_, 4-30 chars total)';

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Seed default boards
INSERT INTO public.boards (name, slug, description)
VALUES
  ('Concept Art', 'concept-art', 'Visual explorations and sketches.'),
  ('Story Worlds', 'story-worlds', 'Worldbuilding drafts and lore.'),
  ('Character Lab', 'character-lab', 'Characters, bios, and arcs.')
ON CONFLICT (slug) DO NOTHING;

-- Seed default tags
INSERT INTO public.tags (name, slug)
VALUES
  ('Feedback', 'feedback'),
  ('Draft', 'draft'),
  ('Moodboard', 'moodboard'),
  ('Sci-Fi', 'sci-fi'),
  ('Fantasy', 'fantasy')
ON CONFLICT (slug) DO NOTHING;
