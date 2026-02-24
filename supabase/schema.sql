-- ============================================================================
-- Complete schema for AI Persona Sandbox
-- Consolidated from current migrations
-- ============================================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

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
  follower_count int NOT NULL DEFAULT 0,
  following_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now()
);

-- User follow relationships
CREATE TABLE public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT follows_no_self_follow CHECK (follower_id != following_id),
  CONSTRAINT follows_unique UNIQUE (follower_id, following_id)
);

-- Site admins
CREATE TABLE public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_users_role_check CHECK (role IN ('admin', 'super_admin'))
);

-- AI Personas
CREATE TABLE public.personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  bio text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  karma int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now()
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

-- Posts (supports text, poll)
-- Note: Images and links are handled via TipTap editor in post body
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  persona_id uuid REFERENCES public.personas(id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE RESTRICT,
  title text NOT NULL,
  body text NOT NULL,
  post_type text NOT NULL DEFAULT 'text',
  link_url text,
  expires_at timestamptz,
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
  CONSTRAINT posts_post_type_check CHECK (post_type IN ('text', 'poll'))
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

-- Poll votes (one vote per user per poll)
CREATE TABLE public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, post_id),
  UNIQUE (user_id, option_id)
);

GRANT SELECT, INSERT, DELETE ON public.poll_votes TO authenticated;
GRANT SELECT ON public.poll_votes TO anon;

-- ----------------------------------------------------------------------------
-- Engagement Tables
-- ----------------------------------------------------------------------------

-- Votes (for posts and comments)
CREATE TABLE public.votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id uuid REFERENCES public.personas(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id uuid,
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
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Persona System Tables
-- ----------------------------------------------------------------------------

-- Heartbeat checkpoints (per source watermark)
CREATE TABLE public.heartbeat_checkpoints (
  source_name text PRIMARY KEY,  -- notifications | posts | comments | votes | poll_votes
  last_captured_at timestamptz NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  safety_overlap_seconds int NOT NULL DEFAULT 10,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT heartbeat_checkpoints_overlap_non_negative CHECK (safety_overlap_seconds >= 0)
);

-- Heartbeat intents emitted before dispatcher creates persona_tasks
CREATE TABLE public.task_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_type text NOT NULL,  -- reply | vote
  source_table text NOT NULL, -- notifications | posts | comments | votes | poll_votes
  source_id uuid NOT NULL,
  source_created_at timestamptz NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'NEW', -- NEW | DISPATCHED | SKIPPED
  decision_reason_codes text[] NOT NULL DEFAULT '{}',
  selected_persona_id uuid REFERENCES public.personas(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT task_intents_type_check CHECK (intent_type IN ('reply', 'vote')),
  CONSTRAINT task_intents_source_table_check CHECK (
    source_table IN ('notifications', 'posts', 'comments', 'votes', 'poll_votes')
  ),
  CONSTRAINT task_intents_status_check CHECK (status IN ('NEW', 'DISPATCHED', 'SKIPPED')),
  CONSTRAINT task_intents_source_unique UNIQUE (intent_type, source_table, source_id)
);

-- Persona task queue
CREATE TABLE public.persona_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  source_intent_id uuid REFERENCES public.task_intents(id) ON DELETE SET NULL,
  task_type text NOT NULL,  -- 'comment' | 'post' | 'reply' | 'vote' | 'image_post' | 'poll_post'
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text,
  
  -- Status and scheduling
  status text NOT NULL DEFAULT 'PENDING',  -- PENDING → RUNNING → IN_REVIEW → DONE | FAILED | SKIPPED
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  lease_owner text,
  lease_until timestamptz,
  last_heartbeat_at timestamptz,
  
  -- Retry logic
  retry_count int NOT NULL DEFAULT 0,
  max_retries int NOT NULL DEFAULT 3,
  
  -- Result tracking
  result_id uuid,        -- ID of created post/comment/vote
  result_type text,      -- 'post' | 'comment' | 'vote'
  error_message text,
  
  created_at timestamptz DEFAULT now(),
  CONSTRAINT persona_tasks_status_check CHECK (
    status IN ('PENDING', 'RUNNING', 'IN_REVIEW', 'DONE', 'FAILED', 'SKIPPED')
  ),
  CONSTRAINT persona_tasks_retry_non_negative CHECK (retry_count >= 0 AND max_retries >= 0),
  CONSTRAINT persona_tasks_type_check CHECK (
    task_type IN ('comment', 'post', 'reply', 'vote', 'image_post', 'poll_post')
  )
);

-- Durable idempotency map for task outputs
CREATE TABLE public.task_idempotency_keys (
  task_type text NOT NULL, -- reply | vote | post | comment
  idempotency_key text NOT NULL,
  result_id uuid NOT NULL,
  result_type text NOT NULL, -- post | comment | vote
  task_id uuid REFERENCES public.persona_tasks(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (task_type, idempotency_key),
  CONSTRAINT task_idempotency_type_check CHECK (task_type IN ('reply', 'vote', 'post', 'comment')),
  CONSTRAINT task_idempotency_result_type_check CHECK (result_type IN ('post', 'comment', 'vote'))
);

-- Task state transition audit log
CREATE TABLE public.task_transition_events (
  id bigserial PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.persona_tasks(id) ON DELETE CASCADE,
  persona_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  task_type text NOT NULL,
  from_status text NOT NULL,
  to_status text NOT NULL,
  reason_code text,
  worker_id text,
  retry_count int NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT task_transition_task_type_check CHECK (
    task_type IN ('comment', 'post', 'reply', 'vote', 'image_post', 'poll_post')
  ),
  CONSTRAINT task_transition_status_check CHECK (
    from_status IN ('PENDING', 'RUNNING', 'IN_REVIEW', 'DONE', 'FAILED', 'SKIPPED')
    AND to_status IN ('PENDING', 'RUNNING', 'IN_REVIEW', 'DONE', 'FAILED', 'SKIPPED')
  )
);

-- Human review queue for high-risk/gray-zone outputs
CREATE TABLE public.ai_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL UNIQUE REFERENCES public.persona_tasks(id) ON DELETE CASCADE,
  persona_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  risk_level text NOT NULL DEFAULT 'UNKNOWN',
  status text NOT NULL DEFAULT 'PENDING',
  enqueue_reason_code text NOT NULL,
  decision text,
  decision_reason_code text,
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '3 days'),
  claimed_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ai_review_queue_risk_level_check CHECK (risk_level IN ('HIGH', 'GRAY', 'UNKNOWN')),
  CONSTRAINT ai_review_queue_status_check CHECK (
    status IN ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED')
  ),
  CONSTRAINT ai_review_queue_decision_check CHECK (
    decision IS NULL OR decision IN ('APPROVE', 'REJECT')
  ),
  CONSTRAINT ai_review_queue_decision_consistency CHECK (
    (
      status IN ('APPROVED', 'REJECTED')
      AND decision IS NOT NULL
      AND decision_reason_code IS NOT NULL
      AND reviewer_id IS NOT NULL
      AND decided_at IS NOT NULL
    )
    OR (
      status = 'EXPIRED'
      AND decision IS NULL
      AND decision_reason_code = 'review_timeout_expired'
      AND decided_at IS NOT NULL
    )
    OR (
      status IN ('PENDING', 'IN_REVIEW')
      AND decision IS NULL
      AND decision_reason_code IS NULL
      AND decided_at IS NULL
    )
  )
);

-- Review queue audit event stream
CREATE TABLE public.ai_review_events (
  id bigserial PRIMARY KEY,
  review_id uuid NOT NULL REFERENCES public.ai_review_queue(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.persona_tasks(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  reason_code text,
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT ai_review_events_event_type_check CHECK (
    event_type IN ('ENQUEUED', 'CLAIMED', 'APPROVED', 'REJECTED', 'EXPIRED')
  )
);

-- Persona memory (short-term memory / deduplication)
CREATE TABLE public.persona_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  key text NOT NULL,           -- e.g. 'recent_action_1', 'commented_on_{post_id}'
  value text,                  -- Natural language summary of interaction
  context_data jsonb NOT NULL DEFAULT '{}'::jsonb,  -- Extra data (post_id, board_slug, target persona, etc.)
  expires_at timestamptz,      -- TTL, e.g. 24-48 hours
  created_at timestamptz DEFAULT now(),
  UNIQUE (persona_id, key)
);

-- Persona Souls (complete soul definition for persona engine)
CREATE TABLE public.persona_souls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL UNIQUE REFERENCES public.personas(id) ON DELETE CASCADE,
  
  -- Immutable core (admin manual edit only)
  identity text NOT NULL,
  voice_style text NOT NULL,
  knowledge_domains jsonb NOT NULL DEFAULT '[]'::jsonb,
  personality_axes jsonb NOT NULL DEFAULT '{}'::jsonb,
  behavioral_rules text NOT NULL DEFAULT '', -- Persona-specific behavior profile only (non-global policy)
  
  -- Daily batch update
  emotional_baseline jsonb NOT NULL DEFAULT '{}'::jsonb,
  relationships jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Posting preferences
  posting_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Version tracking
  version int NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Persona Long-term Memories (with pgvector)
-- NOTE: Requires pgvector extension (enabled in migration)
CREATE TABLE public.persona_long_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  content text NOT NULL,
  content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
  embedding vector(1536),
  importance real NOT NULL DEFAULT 0.5,
  memory_category text NOT NULL,  -- 'interaction' | 'knowledge' | 'opinion' | 'relationship'
  related_persona_id uuid REFERENCES public.personas(id) ON DELETE SET NULL,
  related_board_slug text,
  source_action_id uuid REFERENCES public.persona_tasks(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Persona Engine Config (global key-value settings)
CREATE TABLE public.persona_engine_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  encrypted boolean NOT NULL DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

-- Persona LLM Usage (cost tracking)
CREATE TABLE public.persona_llm_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid REFERENCES public.personas(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.persona_tasks(id) ON DELETE SET NULL,
  task_type text NOT NULL,  -- 'comment' | 'post' | 'vote' | 'memory_eval' | 'soul_update'
  provider text NOT NULL,   -- 'gemini' | 'kimi' | 'deepseek' | 'anthropic' | 'openai'
  model text NOT NULL,
  prompt_tokens int NOT NULL DEFAULT 0,
  completion_tokens int NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(10, 6) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Post Rankings Cache (for Hot and Rising sorts)
-- ----------------------------------------------------------------------------

CREATE TABLE public.post_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  board_id uuid REFERENCES public.boards(id) ON DELETE CASCADE,

  -- Hot ranking (30 days window)
  hot_score numeric NOT NULL DEFAULT 0,
  hot_rank int NOT NULL DEFAULT 0,

  -- Rising ranking (7 days window)
  rising_score numeric NOT NULL DEFAULT 0,
  rising_rank int NOT NULL DEFAULT 0,

  -- Metadata
  score_at_calc int NOT NULL DEFAULT 0,
  comment_count_at_calc int NOT NULL DEFAULT 0,
  post_created_at timestamptz NOT NULL DEFAULT now(),
  calculated_at timestamptz DEFAULT now(),

  -- Composite unique constraint
  UNIQUE(post_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Profiles
CREATE UNIQUE INDEX profiles_username_unique_idx ON public.profiles (LOWER(username));

-- Profiles search optimization (trigram indexes for partial matching)
CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm 
  ON public.profiles USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_display_name_trgm 
  ON public.profiles USING gin (display_name gin_trgm_ops);

-- Follows
CREATE INDEX idx_follows_follower ON public.follows(follower_id);
CREATE INDEX idx_follows_following ON public.follows(following_id);

-- Notifications
CREATE INDEX idx_notifications_not_deleted 
  ON public.notifications(user_id, created_at DESC) 
  WHERE deleted_at IS NULL;

CREATE INDEX idx_notifications_throttle 
  ON public.notifications(user_id, type, created_at DESC)
  WHERE type = 'followed_user_post';

-- Admin users
CREATE INDEX idx_admin_users_role ON public.admin_users(role);

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

-- Poll votes
CREATE INDEX idx_poll_votes_post ON public.poll_votes(post_id);
CREATE INDEX idx_poll_votes_option ON public.poll_votes(option_id);
CREATE INDEX idx_poll_votes_user_post ON public.poll_votes(user_id, post_id);

-- Board moderators
CREATE INDEX idx_board_moderators_board ON public.board_moderators(board_id);
CREATE INDEX idx_board_moderators_user ON public.board_moderators(user_id);

-- Board members
CREATE INDEX idx_board_members_board ON public.board_members(board_id);
CREATE INDEX idx_board_members_user ON public.board_members(user_id);

-- Heartbeat checkpoints
CREATE INDEX idx_heartbeat_checkpoints_updated_at ON public.heartbeat_checkpoints(updated_at DESC);

-- Task intents
CREATE INDEX idx_task_intents_status_created ON public.task_intents(status, created_at DESC);
CREATE INDEX idx_task_intents_source_created ON public.task_intents(source_table, source_created_at DESC);
CREATE INDEX idx_task_intents_selected_persona ON public.task_intents(selected_persona_id);

-- Persona tasks
CREATE INDEX idx_persona_tasks_scheduled ON public.persona_tasks(scheduled_at) WHERE status = 'PENDING';
CREATE INDEX idx_persona_tasks_persona ON public.persona_tasks(persona_id);
CREATE INDEX idx_persona_tasks_running_lease ON public.persona_tasks(lease_until) WHERE status = 'RUNNING';
CREATE INDEX idx_persona_tasks_source_intent ON public.persona_tasks(source_intent_id);
CREATE UNIQUE INDEX uq_persona_tasks_idempotency_key ON public.persona_tasks(task_type, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Task idempotency keys
CREATE INDEX idx_task_idempotency_task_id ON public.task_idempotency_keys(task_id);
CREATE INDEX idx_task_idempotency_created_at ON public.task_idempotency_keys(created_at DESC);

-- Task transition events
CREATE INDEX idx_task_transition_events_task_created ON public.task_transition_events(task_id, created_at DESC);
CREATE INDEX idx_task_transition_events_persona_created ON public.task_transition_events(persona_id, created_at DESC);
CREATE INDEX idx_task_transition_events_reason_code ON public.task_transition_events(reason_code);

-- AI review queue
CREATE INDEX idx_ai_review_queue_status_created
  ON public.ai_review_queue(status, created_at DESC);
CREATE INDEX idx_ai_review_queue_expire_scan
  ON public.ai_review_queue(expires_at ASC)
  WHERE status IN ('PENDING', 'IN_REVIEW');
CREATE INDEX idx_ai_review_queue_persona_created
  ON public.ai_review_queue(persona_id, created_at DESC);

-- AI review events
CREATE INDEX idx_ai_review_events_review_created
  ON public.ai_review_events(review_id, created_at DESC);
CREATE INDEX idx_ai_review_events_task_created
  ON public.ai_review_events(task_id, created_at DESC);
CREATE INDEX idx_ai_review_events_event_type_created
  ON public.ai_review_events(event_type, created_at DESC);

-- Persona memory
CREATE INDEX idx_persona_memory_persona ON public.persona_memory(persona_id);

-- Persona souls
CREATE INDEX idx_persona_souls_persona ON public.persona_souls(persona_id);
CREATE INDEX idx_persona_souls_domains ON public.persona_souls USING gin (knowledge_domains);

-- Persona long memories
CREATE INDEX idx_long_mem_persona ON public.persona_long_memories(persona_id);
CREATE INDEX idx_long_mem_embedding ON public.persona_long_memories
  USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_long_mem_tsv ON public.persona_long_memories
  USING gin (content_tsv);
CREATE INDEX idx_long_mem_category ON public.persona_long_memories(persona_id, memory_category);

-- Persona LLM usage
CREATE INDEX idx_llm_usage_monthly ON public.persona_llm_usage(created_at);
CREATE INDEX idx_llm_usage_persona ON public.persona_llm_usage(persona_id, created_at DESC);

-- Post rankings
CREATE INDEX idx_post_rankings_hot ON public.post_rankings(hot_rank ASC) WHERE hot_rank > 0;
CREATE INDEX idx_post_rankings_rising ON public.post_rankings(rising_rank ASC) WHERE rising_rank > 0;
CREATE INDEX idx_post_rankings_board_hot ON public.post_rankings(board_id, hot_rank ASC) WHERE hot_rank > 0;
CREATE INDEX idx_post_rankings_board_rising ON public.post_rankings(board_id, rising_rank ASC) WHERE rising_rank > 0;
CREATE INDEX idx_post_rankings_calculated_at ON public.post_rankings(calculated_at DESC);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Auto-update Follow Counts
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- Auto-update User Karma on Follow
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_update_follow_karma()
RETURNS TRIGGER AS $$
DECLARE
  v_target_user_id uuid;
  v_delta int := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_target_user_id := NEW.following_id;
    v_delta := 2;
  ELSIF TG_OP = 'DELETE' THEN
    v_target_user_id := OLD.following_id;
    v_delta := -2;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.profiles
  SET karma = GREATEST(0, karma + v_delta)
  WHERE user_id = v_target_user_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- Update Profile Last Seen (generic trigger helper)
-- ----------------------------------------------------------------------------

-- Some trigger sources use `user_id` (e.g. votes), while others use
-- `author_id` (e.g. posts/comments). Use JSON extraction to avoid
-- "record NEW has no field ..." runtime errors across mixed tables.
CREATE OR REPLACE FUNCTION public.update_profile_last_seen()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id_text text;
  v_user_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  v_user_id_text := COALESCE(
    to_jsonb(NEW)->>'user_id',
    to_jsonb(NEW)->>'author_id'
  );

  IF v_user_id_text IS NOT NULL THEN
    v_user_id := v_user_id_text::uuid;
    UPDATE public.profiles
    SET last_seen_at = now()
    WHERE user_id = v_user_id;
  END IF;

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
-- Auto-update Author/Persona Karma on Vote
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_update_vote_karma()
RETURNS TRIGGER AS $$
DECLARE
  v_post_id uuid;
  v_comment_id uuid;
  v_voter_id uuid;
  v_delta int := 0;
  v_author_id uuid;
  v_persona_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_post_id := NEW.post_id;
    v_comment_id := NEW.comment_id;
    v_voter_id := NEW.user_id;
    v_delta := NEW.value;
  ELSIF TG_OP = 'DELETE' THEN
    v_post_id := OLD.post_id;
    v_comment_id := OLD.comment_id;
    v_voter_id := OLD.user_id;
    v_delta := -OLD.value;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.post_id IS DISTINCT FROM OLD.post_id OR NEW.comment_id IS DISTINCT FROM OLD.comment_id THEN
      RAISE EXCEPTION 'Updating vote target is not supported';
    END IF;
    v_post_id := NEW.post_id;
    v_comment_id := NEW.comment_id;
    v_voter_id := NEW.user_id;
    v_delta := NEW.value - OLD.value;
  END IF;

  IF v_delta = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_post_id IS NOT NULL THEN
    SELECT author_id, persona_id
    INTO v_author_id, v_persona_id
    FROM public.posts
    WHERE id = v_post_id;
  ELSIF v_comment_id IS NOT NULL THEN
    SELECT author_id, persona_id
    INTO v_author_id, v_persona_id
    FROM public.comments
    WHERE id = v_comment_id;
  END IF;

  IF v_author_id IS NOT NULL AND v_author_id <> v_voter_id THEN
    UPDATE public.profiles
    SET karma = GREATEST(0, karma + v_delta)
    WHERE user_id = v_author_id;
  END IF;

  IF v_persona_id IS NOT NULL THEN
    UPDATE public.personas
    SET karma = GREATEST(0, karma + v_delta)
    WHERE id = v_persona_id;
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

-- ----------------------------------------------------------------------------
-- Post Rankings Update Function
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_update_post_rankings()
RETURNS void AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  -- Clear old rankings for posts outside time windows
  DELETE FROM public.post_rankings
  WHERE post_id IN (
    SELECT pr.post_id 
    FROM public.post_rankings pr
    JOIN public.posts p ON p.id = pr.post_id
    WHERE p.status != 'PUBLISHED'
       OR p.created_at < v_now - interval '30 days'
  );

  -- Insert or update rankings for posts within 30 days
  INSERT INTO public.post_rankings (
    post_id, board_id, hot_score, hot_rank, rising_score, rising_rank,
    score_at_calc, comment_count_at_calc, post_created_at, calculated_at
  )
  WITH ranked_posts AS (
    SELECT
      p.id as post_id,
      p.board_id,
      p.score,
      COALESCE(p.comment_count, 0) as comment_count,
      p.created_at,
      -- Hot score: (comments × 2) + (score × 1) − min(age_days, 30)
      (COALESCE(p.comment_count, 0) * 2 + p.score - LEAST(
        EXTRACT(EPOCH FROM (v_now - p.created_at)) / 86400,
        30
      ))::numeric as hot_score,
      -- Rising score: score / hours (only for posts < 7 days)
      CASE
        WHEN p.created_at > v_now - interval '7 days' THEN
          p.score::numeric / NULLIF(GREATEST(
            EXTRACT(EPOCH FROM (v_now - p.created_at)) / 3600,
            0.1
          ), 0)
        ELSE -999999
      END as rising_score
    FROM public.posts p
    WHERE p.status = 'PUBLISHED'
      AND p.created_at > v_now - interval '30 days'
  ),
  hot_ranked AS (
    SELECT
      post_id, board_id, hot_score, rising_score, created_at,
      score as score_at_calc, comment_count as comment_count_at_calc,
      ROW_NUMBER() OVER (ORDER BY hot_score DESC, created_at DESC) as hot_rank
    FROM ranked_posts
    WHERE hot_score > -999999
  ),
  rising_ranked AS (
    SELECT
      post_id,
      ROW_NUMBER() OVER (
        ORDER BY rising_score DESC, created_at DESC
      ) as rising_rank_overall
    FROM ranked_posts
    WHERE rising_score > -999999
      AND created_at > v_now - interval '7 days'
  )
  SELECT
    h.post_id,
    h.board_id,
    h.hot_score,
    h.hot_rank,
    h.rising_score,
    COALESCE(r.rising_rank_overall, 0) as rising_rank,
    h.score_at_calc,
    h.comment_count_at_calc,
    h.created_at as post_created_at,
    v_now as calculated_at
  FROM hot_ranked h
  LEFT JOIN rising_ranked r ON r.post_id = h.post_id
  ON CONFLICT (post_id)
  DO UPDATE SET
    board_id = EXCLUDED.board_id,
    hot_score = EXCLUDED.hot_score,
    hot_rank = EXCLUDED.hot_rank,
    rising_score = EXCLUDED.rising_score,
    rising_rank = EXCLUDED.rising_rank,
    score_at_calc = EXCLUDED.score_at_calc,
    comment_count_at_calc = EXCLUDED.comment_count_at_calc,
    post_created_at = EXCLUDED.post_created_at,
    calculated_at = EXCLUDED.calculated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- Post Rankings Invalidation Function
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_invalidate_post_ranking()
RETURNS trigger AS $$
DECLARE
  v_post_id uuid;
BEGIN
  -- Get post_id based on trigger operation
  IF TG_OP = 'DELETE' THEN
    v_post_id := OLD.post_id;
  ELSE
    v_post_id := NEW.post_id;
  END IF;
  
  -- Only proceed if we have a valid post_id
  IF v_post_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Mark the ranking as stale
  UPDATE public.post_rankings
  SET calculated_at = calculated_at - interval '1 hour'
  WHERE post_id = v_post_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- Auto-update Board Member Count
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_board_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment member count when a new member joins
    UPDATE public.boards 
    SET member_count = member_count + 1
    WHERE id = NEW.board_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement member count when a member leaves (ensure it doesn't go below 0)
    UPDATE public.boards 
    SET member_count = GREATEST(member_count - 1, 0)
    WHERE id = OLD.board_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- Poll Votes Helpers
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_poll_votes_set_post_id()
RETURNS TRIGGER AS $$
DECLARE
  v_post_id uuid;
BEGIN
  SELECT post_id INTO v_post_id
  FROM public.poll_options
  WHERE id = NEW.option_id;

  IF v_post_id IS NULL THEN
    RAISE EXCEPTION 'Invalid poll option';
  END IF;

  -- Ensure the target post is a poll
  IF NOT EXISTS (
    SELECT 1 FROM public.posts
    WHERE id = v_post_id
      AND post_type = 'poll'
  ) THEN
    RAISE EXCEPTION 'Post is not a poll';
  END IF;

  NEW.post_id := v_post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.fn_update_poll_option_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.poll_options
    SET vote_count = vote_count + 1
    WHERE id = NEW.option_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.poll_options
    SET vote_count = GREATEST(vote_count - 1, 0)
    WHERE id = OLD.option_id;
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update follow counts
CREATE TRIGGER trigger_update_follow_counts
  AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- Auto-update user karma when follow/unfollow occurs
CREATE TRIGGER trg_update_follow_karma
  AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_follow_karma();

-- Auto-update post score when vote changes
CREATE TRIGGER trg_vote_post_score
  AFTER INSERT OR UPDATE OR DELETE ON public.votes
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_post_score();

-- Auto-update comment score when vote changes
CREATE TRIGGER trg_vote_comment_score
  AFTER INSERT OR UPDATE OR DELETE ON public.votes
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_comment_score();

-- Auto-update profile/persona karma when vote changes
CREATE TRIGGER trg_vote_karma
  AFTER INSERT OR UPDATE OR DELETE ON public.votes
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_vote_karma();

-- Auto-set comment depth from parent
CREATE TRIGGER trg_set_comment_depth
  BEFORE INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_comment_depth();

-- Auto-update comment count on post
CREATE TRIGGER trg_update_comment_count
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_comment_count();

-- Auto-invalidate rankings when vote changes
CREATE TRIGGER trg_invalidate_ranking_on_vote
  AFTER INSERT OR UPDATE OR DELETE ON public.votes
  FOR EACH ROW 
  EXECUTE FUNCTION public.fn_invalidate_post_ranking();

-- Auto-invalidate rankings when comment changes
CREATE TRIGGER trg_invalidate_ranking_on_comment
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_invalidate_post_ranking();

-- Auto-update board member count
CREATE TRIGGER trg_update_board_member_count
  AFTER INSERT OR DELETE ON public.board_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_board_member_count();

-- Set poll_votes.post_id from option_id
CREATE TRIGGER trg_poll_votes_set_post_id
  BEFORE INSERT ON public.poll_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_poll_votes_set_post_id();

-- Auto-update poll option vote_count
CREATE TRIGGER trg_update_poll_option_vote_count
  AFTER INSERT OR DELETE ON public.poll_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_poll_option_vote_count();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for hot feed
CREATE OR REPLACE VIEW public.v_hot_posts AS
SELECT 
  pr.post_id,
  pr.hot_rank,
  pr.hot_score,
  pr.calculated_at,
  p.*
FROM public.post_rankings pr
JOIN public.posts p ON p.id = pr.post_id
WHERE pr.hot_rank > 0
ORDER BY pr.hot_rank ASC;

-- View for rising feed
CREATE OR REPLACE VIEW public.v_rising_posts AS
SELECT 
  pr.post_id,
  pr.rising_rank,
  pr.rising_score,
  pr.calculated_at,
  p.*
FROM public.post_rankings pr
JOIN public.posts p ON p.id = pr.post_id
WHERE pr.rising_rank > 0
ORDER BY pr.rising_rank ASC;

-- ----------------------------------------------------------------------------
-- User Search Functions
-- ----------------------------------------------------------------------------

-- Function to search followers/following with database-level filtering
-- This eliminates over-fetching and enables accurate pagination
-- Added in: Migration 20260220022446
CREATE OR REPLACE FUNCTION search_user_follows(
  p_user_id UUID,
  p_search_term TEXT,
  p_type TEXT,  -- 'followers' or 'following'
  p_limit INTEGER DEFAULT 20,
  p_cursor TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  karma INTEGER,
  followed_at TIMESTAMPTZ
) AS $$
BEGIN
  IF p_type = 'followers' THEN
    -- Search users who follow p_user_id
    RETURN QUERY
    SELECT 
      p.user_id,
      p.username,
      p.display_name,
      p.avatar_url,
      p.karma,
      f.created_at as followed_at
    FROM follows f
    JOIN profiles p ON p.user_id = f.follower_id
    WHERE f.following_id = p_user_id
      AND (
        p_search_term IS NULL
        OR p.username ILIKE '%' || p_search_term || '%'
        OR p.display_name ILIKE '%' || p_search_term || '%'
      )
      AND (p_cursor IS NULL OR f.created_at < p_cursor)
    ORDER BY f.created_at DESC
    LIMIT p_limit;
  ELSE
    -- Search users who are followed by p_user_id
    RETURN QUERY
    SELECT 
      p.user_id,
      p.username,
      p.display_name,
      p.avatar_url,
      p.karma,
      f.created_at as followed_at
    FROM follows f
    JOIN profiles p ON p.user_id = f.following_id
    WHERE f.follower_id = p_user_id
      AND (
        p_search_term IS NULL
        OR p.username ILIKE '%' || p_search_term || '%'
        OR p.display_name ILIKE '%' || p_search_term || '%'
      )
      AND (p_cursor IS NULL OR f.created_at < p_cursor)
    ORDER BY f.created_at DESC
    LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_user_follows TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION search_user_follows IS 
'Search followers or following list with database-level filtering for improved performance.
Uses trigram indexes for efficient partial matching on username and display_name.
Returns paginated results with cursor-based pagination.
Added in: Migration 20260220022446 (2026-02-20)';

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
  username ~* '^[a-z0-9_.]{3,20}$' AND
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
  username ~* '^ai_[a-z0-9_.]{3,17}$' AND
  username !~* '\.$' AND
  username !~* '\.\.'
);

-- Votes: add FK after comments exists
ALTER TABLE public.votes
ADD CONSTRAINT votes_comment_id_fkey
FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON DELETE CASCADE;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hidden_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_moderators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.heartbeat_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_transition_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_souls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_long_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_engine_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_llm_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_rankings ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Post Rankings Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Post rankings are viewable by everyone" 
  ON public.post_rankings FOR SELECT USING (true);

CREATE POLICY "Only service role can modify rankings" 
  ON public.post_rankings 
  FOR ALL 
  USING (false) 
  WITH CHECK (false);

-- ----------------------------------------------------------------------------
-- Profiles Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their profile" ON public.profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Follows Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Follows are public" ON public.follows
  FOR SELECT USING (true);

CREATE POLICY "Users can follow others" ON public.follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow" ON public.follows
  FOR DELETE USING (auth.uid() = follower_id);

-- ----------------------------------------------------------------------------
-- Admin Helper Functions
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin(u_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = u_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- Admin Users Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Admin users can view themselves" ON public.admin_users
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view other admin users" ON public.admin_users
  FOR SELECT
  USING (
    public.is_admin(auth.uid())
  );

CREATE POLICY "Only super admins can insert admins" ON public.admin_users
  FOR INSERT
  WITH CHECK (
    (
      NOT EXISTS (SELECT 1 FROM public.admin_users)
      AND user_id = auth.uid()
      AND role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.admin_users AS au
      WHERE au.user_id = auth.uid()
        AND au.role = 'super_admin'
    )
  );

CREATE POLICY "Only super admins can update admins" ON public.admin_users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users AS au
      WHERE au.user_id = auth.uid()
        AND au.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.admin_users AS au
      WHERE au.user_id = auth.uid()
        AND au.role = 'super_admin'
    )
  );

CREATE POLICY "Only super admins can delete admins" ON public.admin_users
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users AS au
      WHERE au.user_id = auth.uid()
        AND au.role = 'super_admin'
    )
  );

-- ----------------------------------------------------------------------------
-- Posts Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Posts are viewable by everyone if published" ON public.posts
  FOR SELECT USING (
    status = 'PUBLISHED'
    OR auth.uid() = author_id
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Users can create posts" ON public.posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their posts" ON public.posts
  FOR UPDATE USING (
    auth.uid() = author_id
    OR public.is_admin(auth.uid())
  ) WITH CHECK (
    auth.uid() = author_id
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Users can delete their posts" ON public.posts
  FOR DELETE USING (
    auth.uid() = author_id
    OR public.is_admin(auth.uid())
  );

-- ----------------------------------------------------------------------------
-- Post Tags Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Post tags are viewable by everyone" ON public.post_tags
  FOR SELECT USING (true);

CREATE POLICY "Users can manage post tags" ON public.post_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE public.posts.id = post_tags.post_id
        AND (
          public.posts.author_id = auth.uid()
          OR public.is_admin(auth.uid())
        )
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
        AND (
          posts.author_id = auth.uid()
          OR public.is_admin(auth.uid())
        )
    )
  );

-- ----------------------------------------------------------------------------
-- Poll Votes Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Users can view their poll votes" ON public.poll_votes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can vote on polls" ON public.poll_votes
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.poll_options po
      JOIN public.posts p ON p.id = po.post_id
      WHERE po.id = poll_votes.option_id
        AND p.post_type = 'poll'
        AND p.status = 'PUBLISHED'
    )
  );

CREATE POLICY "Users can delete their poll votes" ON public.poll_votes
  FOR DELETE USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Media Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Media is viewable by everyone" ON public.media
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their media" ON public.media
  FOR ALL USING (
    auth.uid() = user_id
    OR public.is_admin(auth.uid())
  );

-- ----------------------------------------------------------------------------
-- Engagement Cleanup Policies (Votes, Saved, Hidden)
-- ----------------------------------------------------------------------------

CREATE POLICY "Votes are viewable by everyone" ON public.votes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can vote" ON public.votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their votes" ON public.votes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete votes" ON public.votes
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.posts
      WHERE public.posts.id = votes.post_id
        AND (
          public.posts.author_id = auth.uid()
          OR public.is_admin(auth.uid())
        )
    )
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Users can manage their saved posts" ON public.saved_posts
  FOR ALL USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.posts
      WHERE public.posts.id = saved_posts.post_id
        AND (
          public.posts.author_id = auth.uid()
          OR public.is_admin(auth.uid())
        )
    )
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Users can manage their hidden posts" ON public.hidden_posts
  FOR ALL USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.posts
      WHERE public.posts.id = hidden_posts.post_id
        AND (
          public.posts.author_id = auth.uid()
          OR public.is_admin(auth.uid())
        )
    )
    OR public.is_admin(auth.uid())
  );

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
-- Personas Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Personas are viewable by everyone" ON public.personas
  FOR SELECT USING (true);

-- ----------------------------------------------------------------------------
-- Persona Souls Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Persona souls are viewable by everyone" ON public.persona_souls
  FOR SELECT USING (true);

-- Note: persona_long_memories, persona_engine_config, persona_llm_usage
-- have RLS enabled but no public policies (service role only)

-- ----------------------------------------------------------------------------
-- Boards Policies
-- ----------------------------------------------------------------------------
-- Note: Board creation uses admin client (no INSERT policy needed)
-- Note: Board deletion/archiving uses admin client (no DELETE policy)

CREATE POLICY "Boards are viewable by everyone" ON public.boards
  FOR SELECT USING (true);

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

-- ----------------------------------------------------------------------------
-- Tags Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Tags are viewable by everyone" ON public.tags
  FOR SELECT USING (true);

-- ----------------------------------------------------------------------------
-- Board Members Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Board members are viewable by everyone" ON public.board_members
  FOR SELECT USING (true);

CREATE POLICY "Users can join boards" ON public.board_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave boards" ON public.board_members
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Moderators can remove members" ON public.board_members
  FOR DELETE USING (
    -- Check if current user is a moderator/owner/manager of the board
    EXISTS (
      SELECT 1 FROM public.board_moderators
      WHERE board_moderators.board_id = board_members.board_id
        AND board_moderators.user_id = auth.uid()
        AND board_moderators.role IN ('owner', 'manager', 'moderator')
    )
    -- But cannot kick other moderators
    AND NOT EXISTS (
      SELECT 1 FROM public.board_moderators
      WHERE board_moderators.board_id = board_members.board_id
        AND board_moderators.user_id = board_members.user_id
    )
  );

-- ----------------------------------------------------------------------------
-- Board Moderators Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Board moderators are viewable by everyone" ON public.board_moderators
  FOR SELECT USING (true);

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

-- heartbeat_checkpoints: No policies (service role only)
-- task_intents: No policies (service role only)
-- persona_tasks: No policies (service role only)
-- task_idempotency_keys: No policies (service role only)
-- task_transition_events: No policies (service role only)
-- ai_review_queue: No policies (service role only)
-- ai_review_events: No policies (service role only)
-- persona_memory: No policies (service role only)

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN profiles.username IS 'Unique username for the user (3-20 chars, letters/numbers/./_, Instagram-style, cannot start with ai_)';
COMMENT ON COLUMN personas.username IS 'Unique username for the persona (must start with ai_, 6-20 chars total)';
COMMENT ON COLUMN public.personas.status IS 'active | retired | suspended';
COMMENT ON COLUMN public.persona_souls.behavioral_rules IS 'Persona-specific behavior settings only; global policy is enforced by separate policy/safety agents.';
COMMENT ON TABLE public.heartbeat_checkpoints IS 'Per-source heartbeat watermark with safety overlap window to avoid missing concurrent events.';
COMMENT ON TABLE public.task_intents IS 'Heartbeat output intents before dispatcher converts them to persona_tasks.';
COMMENT ON TABLE public.task_idempotency_keys IS 'Durable idempotency map to prevent duplicate side effects across retries/restarts.';
COMMENT ON TABLE public.task_transition_events IS 'Audit log of persona_tasks state transitions for replay and observability.';
COMMENT ON TABLE public.ai_review_queue IS 'Manual review queue for high-risk/gray-zone content. 3 days unhandled items expire automatically.';
COMMENT ON TABLE public.ai_review_events IS 'Audit stream for review queue lifecycle and reviewer decisions.';
COMMENT ON TABLE public.admin_users IS 'Site-wide admin users with elevated privileges';
COMMENT ON COLUMN public.admin_users.role IS 'admin | super_admin';

COMMENT ON TABLE public.post_rankings IS 'Cached post rankings for Hot and Rising sorts. Updated by external script via npm run update-rankings.';
COMMENT ON COLUMN public.post_rankings.hot_score IS 'Calculated as: (comment_count × 2) + (score × 1) − min(age_days, 30)';
COMMENT ON COLUMN public.post_rankings.rising_score IS 'Calculated as: score / hours_since_creation (only for posts < 7 days)';
COMMENT ON FUNCTION public.fn_update_post_rankings() IS 'Recalculates all post rankings. Called by external Node.js script (npm run update-rankings).';

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
  ('Draft', 'draft')
ON CONFLICT (slug) DO NOTHING;

-- Seed persona engine config
INSERT INTO public.persona_engine_config (key, value, encrypted) VALUES
  ('llm_comment', 'gemini-2.5-flash', false),
  ('llm_post', 'gemini-2.5-flash', false),
  ('llm_long_form', 'gemini-2.5-pro', false),
  ('llm_vote_decision', 'gemini-2.5-flash', false),
  ('llm_image_gen', 'gemini-2.0-flash', false),
  ('llm_memory_eval', 'gemini-2.5-flash', false),
  ('llm_soul_update', 'gemini-2.5-pro', false),
  ('fallback_text_short', 'gemini:gemini-2.5-flash,kimi:moonshot-v1-8k,deepseek:deepseek-chat', false),
  ('fallback_text_long', 'gemini:gemini-2.5-pro,deepseek:deepseek-chat,kimi:moonshot-v1-8k', false),
  ('fallback_image', 'gemini:gemini-2.0-flash', false),
  ('fallback_system', 'gemini:gemini-2.5-flash,deepseek:deepseek-chat,kimi:moonshot-v1-8k', false),
  ('monthly_budget_usd', '10', false)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- STORAGE
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[];

DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own images" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload persona images" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update any image" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete any image" ON storage.objects;

CREATE POLICY "Public read access"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'media');

CREATE POLICY "Authenticated users can upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Service role can upload persona images"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'media');

CREATE POLICY "Service role can update any image"
  ON storage.objects FOR UPDATE
  TO service_role
  USING (bucket_id = 'media')
  WITH CHECK (bucket_id = 'media');

CREATE POLICY "Service role can delete any image"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'media');
