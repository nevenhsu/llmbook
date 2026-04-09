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
  last_compressed_at timestamptz,
  last_seen_at timestamptz DEFAULT now(),
  compression_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT personas_compression_state_object_chk CHECK (jsonb_typeof(compression_state) = 'object')
);

-- Persona cores (minimal reusable creative identity)
CREATE TABLE public.persona_cores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL UNIQUE REFERENCES public.personas(id) ON DELETE CASCADE,
  core_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT persona_cores_core_profile_object_chk CHECK (jsonb_typeof(core_profile) = 'object')
);

CREATE TABLE public.persona_reference_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  source_name text NOT NULL,
  normalized_name text NOT NULL,
  romanized_name text NOT NULL,
  match_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX persona_reference_sources_persona_id_idx
  ON public.persona_reference_sources(persona_id);

CREATE INDEX persona_reference_sources_match_key_idx
  ON public.persona_reference_sources(match_key);

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
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id uuid REFERENCES public.personas(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT poll_votes_author_check CHECK (
    (user_id IS NOT NULL AND persona_id IS NULL) OR
    (user_id IS NULL AND persona_id IS NOT NULL)
  )
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

-- Board bans (profiles + personas)
CREATE TABLE public.board_entity_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type in ('profile', 'persona')),
  entity_id uuid NOT NULL,
  reason text,
  expires_at timestamptz,
  banned_by uuid NOT NULL REFERENCES public.profiles(user_id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT board_entity_bans_unique_target UNIQUE (board_id, entity_type, entity_id)
);

-- ----------------------------------------------------------------------------
-- Media & Notifications
-- ----------------------------------------------------------------------------

-- Media uploads
CREATE TABLE public.media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id uuid REFERENCES public.personas(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  url text,
  mime_type text,
  width int,
  height int,
  size_bytes int,
  status text NOT NULL DEFAULT 'DONE',
  retry_count int NOT NULL DEFAULT 0,
  max_retries int NOT NULL DEFAULT 3,
  next_retry_at timestamptz,
  last_error text,
  image_prompt text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT media_author_check CHECK (
    (user_id IS NOT NULL AND persona_id IS NULL) OR
    (user_id IS NULL AND persona_id IS NOT NULL)
  ),
  CONSTRAINT media_status_chk CHECK (
    status IN ('PENDING_GENERATION', 'RUNNING', 'DONE', 'FAILED')
  ),
  CONSTRAINT media_retry_non_negative_chk CHECK (
    retry_count >= 0 AND max_retries >= 0
  )
);

-- User notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_persona_id uuid REFERENCES public.personas(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT notifications_recipient_check CHECK (
    (recipient_user_id IS NOT NULL AND recipient_persona_id IS NULL) OR
    (recipient_user_id IS NULL AND recipient_persona_id IS NOT NULL)
  )
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

-- Persona task queue
CREATE TABLE public.persona_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  task_type text NOT NULL,  -- 'comment' | 'post' | 'reply' | 'vote' | 'image_post' | 'poll_post'
  dispatch_kind text NOT NULL DEFAULT 'public', -- 'notification' | 'public'
  source_table text, -- notifications | posts | comments
  source_id uuid,
  dedupe_key text,
  cooldown_until timestamptz,
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
  result_id uuid,        -- ID of created post/comment/vote/poll_vote
  result_type text,      -- 'post' | 'comment' | 'vote' | 'poll_vote'
  error_message text,
  
  created_at timestamptz DEFAULT now(),
  CONSTRAINT persona_tasks_status_check CHECK (
    status IN ('PENDING', 'RUNNING', 'IN_REVIEW', 'DONE', 'FAILED', 'SKIPPED')
  ),
  CONSTRAINT persona_tasks_retry_non_negative CHECK (retry_count >= 0 AND max_retries >= 0),
  CONSTRAINT persona_tasks_type_check CHECK (
    task_type IN ('comment', 'post', 'reply', 'vote', 'image_post', 'poll_post', 'poll_vote')
  ),
  CONSTRAINT persona_tasks_dispatch_kind_check CHECK (
    dispatch_kind IN ('notification', 'public')
  ),
  CONSTRAINT persona_tasks_source_table_check CHECK (
    source_table IS NULL OR source_table IN ('notifications', 'posts', 'comments')
  ),
  CONSTRAINT persona_tasks_injection_shape_check CHECK (
    (dispatch_kind = 'notification' AND source_table = 'notifications' AND source_id IS NOT NULL)
    OR
    (dispatch_kind = 'public' AND dedupe_key IS NOT NULL AND cooldown_until IS NOT NULL)
  )
);

-- Orchestrator runtime singleton state
CREATE TABLE public.orchestrator_runtime_state (
  singleton_key text PRIMARY KEY DEFAULT 'global',
  paused boolean NOT NULL DEFAULT false,
  public_candidate_group_index integer NOT NULL DEFAULT 0,
  public_candidate_epoch bigint NOT NULL DEFAULT 0,
  lease_owner text,
  lease_until timestamptz,
  cooldown_until timestamptz,
  runtime_app_seen_at timestamptz,
  manual_phase_a_requested_at timestamptz,
  manual_phase_a_requested_by text,
  manual_phase_a_request_id text,
  manual_phase_a_started_at timestamptz,
  manual_phase_a_finished_at timestamptz,
  manual_phase_a_error text,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Orchestrator snapshot log
CREATE TABLE public.orchestrator_run_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at            timestamptz NOT NULL DEFAULT now(),
  snapshot_from     timestamptz NOT NULL,
  snapshot_to       timestamptz NOT NULL,
  comments_injected int NOT NULL DEFAULT 0,
  posts_injected    int NOT NULL DEFAULT 0,
  skipped_reason    text,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.job_runtime_state (
  runtime_key text PRIMARY KEY DEFAULT 'global',
  paused boolean NOT NULL DEFAULT false,
  lease_owner text,
  lease_until timestamptz,
  runtime_app_seen_at timestamptz,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_runtime_state_runtime_key_not_blank_chk
    CHECK (btrim(runtime_key) <> '')
);

CREATE TABLE public.job_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  runtime_key text NOT NULL DEFAULT 'global',
  job_type text NOT NULL,
  subject_kind text NOT NULL,
  subject_id uuid NOT NULL,
  dedupe_key text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_by text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  retry_count int NOT NULL DEFAULT 0,
  max_retries int NOT NULL DEFAULT 3,
  lease_owner text,
  lease_until timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_tasks_runtime_key_not_blank_chk
    CHECK (btrim(runtime_key) <> ''),
  CONSTRAINT job_tasks_status_chk
    CHECK (status IN ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'SKIPPED')),
  CONSTRAINT job_tasks_type_chk
    CHECK (job_type IN ('public_task', 'notification_task', 'memory_compress')),
  CONSTRAINT job_tasks_subject_kind_chk
    CHECK (subject_kind IN ('persona_task', 'persona')),
  CONSTRAINT job_tasks_subject_coherence_chk
    CHECK (
      (job_type IN ('public_task', 'notification_task') AND subject_kind = 'persona_task')
      OR
      (job_type = 'memory_compress' AND subject_kind = 'persona')
    ),
  CONSTRAINT job_tasks_retry_non_negative_chk
    CHECK (retry_count >= 0 AND max_retries >= 0),
  CONSTRAINT job_tasks_payload_object_chk
    CHECK (jsonb_typeof(payload) = 'object')
);

CREATE TABLE public.content_edit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  job_task_id uuid REFERENCES public.job_tasks(id) ON DELETE SET NULL,
  source_runtime text NOT NULL,
  source_kind text NOT NULL,
  source_id uuid,
  previous_snapshot jsonb NOT NULL,
  model_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_edit_history_target_type_chk
    CHECK (target_type IN ('post', 'comment')),
  CONSTRAINT content_edit_history_source_runtime_not_blank_chk
    CHECK (btrim(source_runtime) <> ''),
  CONSTRAINT content_edit_history_source_kind_not_blank_chk
    CHECK (btrim(source_kind) <> ''),
  CONSTRAINT content_edit_history_previous_snapshot_object_chk
    CHECK (jsonb_typeof(previous_snapshot) = 'object'),
  CONSTRAINT content_edit_history_model_metadata_object_chk
    CHECK (jsonb_typeof(model_metadata) = 'object')
);

CREATE TABLE public.ai_opps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  board_id uuid REFERENCES public.boards(id) ON DELETE CASCADE,
  board_slug text,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  notification_id uuid REFERENCES public.notifications(id) ON DELETE CASCADE,
  recipient_persona_id uuid REFERENCES public.personas(id) ON DELETE CASCADE,
  content_type text NOT NULL,
  summary text NOT NULL,
  probability real,
  selected boolean,
  matched_persona_count integer NOT NULL DEFAULT 0,
  notification_context text,
  notification_type text,
  notification_processed_at timestamptz,
  probability_model_key text,
  probability_prompt_version text,
  probability_evaluated_at timestamptz,
  source_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_opps_kind_chk CHECK (kind IN ('public', 'notification')),
  CONSTRAINT ai_opps_source_table_chk CHECK (source_table IN ('posts', 'comments', 'notifications')),
  CONSTRAINT ai_opps_content_type_chk CHECK (content_type IN ('post', 'comment', 'reply', 'notification')),
  CONSTRAINT ai_opps_probability_range_chk CHECK (
    probability IS NULL OR (probability >= 0 AND probability <= 1)
  ),
  CONSTRAINT ai_opps_matched_persona_count_non_negative_chk CHECK (matched_persona_count >= 0),
  CONSTRAINT ai_opps_notification_source_chk CHECK (
    (kind = 'notification') = (source_table = 'notifications')
  ),
  CONSTRAINT ai_opps_kind_source_unique UNIQUE (kind, source_table, source_id)
);

CREATE INDEX idx_ai_opps_kind_probability
  ON public.ai_opps(kind, probability);

CREATE INDEX idx_ai_opps_selected_persona_count
  ON public.ai_opps(kind, selected, matched_persona_count);

CREATE INDEX idx_ai_opps_probability_null
  ON public.ai_opps(kind)
  WHERE probability IS NULL;

CREATE INDEX idx_ai_opps_selected_true
  ON public.ai_opps(kind, selected)
  WHERE selected = true;

CREATE INDEX idx_ai_opps_notification_unprocessed
  ON public.ai_opps(kind, selected, notification_processed_at)
  WHERE kind = 'notification' AND selected = true;

CREATE TABLE public.ai_opp_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opp_id uuid NOT NULL REFERENCES public.ai_opps(id) ON DELETE CASCADE,
  candidate_epoch bigint NOT NULL DEFAULT 0,
  group_index integer NOT NULL,
  batch_size integer NOT NULL,
  selected_speakers jsonb NOT NULL DEFAULT '[]'::jsonb,
  resolved_persona_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_opp_groups_unique UNIQUE (opp_id, candidate_epoch, group_index, batch_size),
  CONSTRAINT ai_opp_groups_group_index_non_negative_chk CHECK (group_index >= 0),
  CONSTRAINT ai_opp_groups_batch_size_positive_chk CHECK (batch_size > 0),
  CONSTRAINT ai_opp_groups_selected_speakers_array_chk CHECK (
    jsonb_typeof(selected_speakers) = 'array'
  ),
  CONSTRAINT ai_opp_groups_resolved_persona_ids_array_chk CHECK (
    jsonb_typeof(resolved_persona_ids) = 'array'
  )
);

CREATE INDEX idx_ai_opp_groups_epoch_group_batch
  ON public.ai_opp_groups(candidate_epoch, group_index, batch_size);

-- Unified persona memories (minimal model)
CREATE TABLE public.persona_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  memory_type text NOT NULL,
  scope text NOT NULL,
  thread_id text,
  board_id uuid REFERENCES public.boards(id) ON DELETE CASCADE,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  importance real,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT persona_memories_memory_type_chk CHECK (memory_type IN ('long_memory', 'memory')),
  CONSTRAINT persona_memories_scope_chk CHECK (scope IN ('persona', 'thread', 'board'))
);

-- AI Agent Config (global key-value settings)
CREATE TABLE public.ai_agent_config (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- AI Global Usage (Cost Tracking)
CREATE TABLE public.ai_global_usage (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  window_start           timestamptz NOT NULL,
  window_end             timestamptz,
  text_prompt_tokens     bigint NOT NULL DEFAULT 0,
  text_completion_tokens bigint NOT NULL DEFAULT 0,
  image_generation_count int    NOT NULL DEFAULT 0,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Encrypted AI provider secrets (service role only)
CREATE TABLE public.ai_provider_secrets (
  provider_key text PRIMARY KEY,
  encrypted_api_key text NOT NULL,
  iv text NOT NULL,
  auth_tag text NOT NULL,
  key_last4 text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_provider_secrets_key_last4_chk CHECK (key_last4 IS NULL OR char_length(key_last4) <= 4)
);

-- AI providers metadata/status (control plane inventory)
CREATE TABLE public.ai_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  sdk_package text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  test_status text NOT NULL DEFAULT 'untested',
  last_api_error_code text,
  last_api_error_message text,
  last_api_error_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_providers_status_chk CHECK (status IN ('active', 'disabled')),
  CONSTRAINT ai_providers_test_status_chk
    CHECK (test_status IN ('untested', 'success', 'failed', 'disabled', 'key_missing'))
);

-- AI models metadata/status/order (control plane inventory)
CREATE TABLE public.ai_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.ai_providers(id) ON DELETE CASCADE,
  model_key text NOT NULL,
  display_name text NOT NULL,
  capability text NOT NULL,
  status text NOT NULL DEFAULT 'disabled',
  test_status text NOT NULL DEFAULT 'untested',
  lifecycle_status text NOT NULL DEFAULT 'active',
  display_order int NOT NULL DEFAULT 0,
  last_error_kind text,
  last_error_code text,
  last_error_message text,
  last_error_at timestamptz,
  supports_input boolean NOT NULL DEFAULT true,
  supports_image_input_prompt boolean NOT NULL DEFAULT false,
  supports_output boolean NOT NULL DEFAULT true,
  context_window int,
  max_output_tokens int,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_models_provider_model_unique UNIQUE (provider_id, model_key),
  CONSTRAINT ai_models_capability_chk CHECK (capability IN ('text_generation', 'image_generation')),
  CONSTRAINT ai_models_status_chk CHECK (status IN ('active', 'disabled')),
  CONSTRAINT ai_models_test_status_chk CHECK (test_status IN ('untested', 'success', 'failed')),
  CONSTRAINT ai_models_lifecycle_status_chk CHECK (lifecycle_status IN ('active', 'retired')),
  CONSTRAINT ai_models_last_error_kind_chk
    CHECK (last_error_kind IS NULL OR last_error_kind IN ('provider_api', 'model_retired', 'other')),
  CONSTRAINT ai_models_metadata_object_chk CHECK (jsonb_typeof(metadata) = 'object')
);

-- AI Policy Releases (policy control plane)
CREATE TABLE public.ai_policy_releases (
  version bigint generated always as identity PRIMARY KEY,
  policy jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by text,
  change_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_policy_releases_policy_object_chk CHECK (jsonb_typeof(policy) = 'object')
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
  ON public.notifications(recipient_user_id, created_at DESC) 
  WHERE deleted_at IS NULL;

CREATE INDEX idx_notifications_throttle 
  ON public.notifications(recipient_user_id, type, created_at DESC)
  WHERE type = 'followed_user_post' AND recipient_user_id IS NOT NULL;

-- Admin users
CREATE INDEX idx_admin_users_role ON public.admin_users(role);

-- Personas
CREATE UNIQUE INDEX personas_username_unique_idx ON public.personas (LOWER(username));
CREATE INDEX idx_persona_cores_persona ON public.persona_cores(persona_id);
CREATE INDEX idx_personas_last_compressed_at ON public.personas(last_compressed_at ASC NULLS FIRST);

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
CREATE UNIQUE INDEX uq_poll_votes_user_post
  ON public.poll_votes(user_id, post_id)
  WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX uq_poll_votes_persona_post
  ON public.poll_votes(persona_id, post_id)
  WHERE persona_id IS NOT NULL;
CREATE UNIQUE INDEX uq_poll_votes_user_option
  ON public.poll_votes(user_id, option_id)
  WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX uq_poll_votes_persona_option
  ON public.poll_votes(persona_id, option_id)
  WHERE persona_id IS NOT NULL;

-- Board moderators
CREATE INDEX idx_board_moderators_board ON public.board_moderators(board_id);
CREATE INDEX idx_board_moderators_user ON public.board_moderators(user_id);

-- Board members
CREATE INDEX idx_board_members_board ON public.board_members(board_id);
CREATE INDEX idx_board_members_user ON public.board_members(user_id);

-- Board bans
CREATE INDEX idx_board_entity_bans_board_created
  ON public.board_entity_bans(board_id, created_at DESC);
CREATE INDEX idx_board_entity_bans_entity
  ON public.board_entity_bans(entity_type, entity_id);

-- Heartbeat checkpoints
CREATE INDEX idx_heartbeat_checkpoints_updated_at ON public.heartbeat_checkpoints(updated_at DESC);

-- Persona tasks
CREATE INDEX idx_persona_tasks_scheduled ON public.persona_tasks(scheduled_at) WHERE status = 'PENDING';
CREATE INDEX idx_persona_tasks_persona ON public.persona_tasks(persona_id);
CREATE INDEX idx_persona_tasks_running_lease ON public.persona_tasks(lease_until) WHERE status = 'RUNNING';
CREATE UNIQUE INDEX idx_persona_tasks_notification_dedupe
  ON public.persona_tasks(task_type, source_table, source_id, persona_id)
  WHERE dispatch_kind = 'notification';
CREATE INDEX idx_persona_tasks_public_cooldown_lookup
  ON public.persona_tasks(task_type, persona_id, dedupe_key, cooldown_until DESC)
  WHERE dispatch_kind = 'public';

CREATE INDEX idx_job_tasks_claim_pending
  ON public.job_tasks(runtime_key, scheduled_at, created_at)
  WHERE status = 'PENDING';
CREATE INDEX idx_job_tasks_running_lease
  ON public.job_tasks(runtime_key, lease_until)
  WHERE status = 'RUNNING';
CREATE INDEX idx_job_tasks_subject_created
  ON public.job_tasks(subject_kind, subject_id, created_at DESC);
CREATE UNIQUE INDEX uq_job_tasks_active_dedupe
  ON public.job_tasks(runtime_key, dedupe_key)
  WHERE status IN ('PENDING', 'RUNNING');
CREATE INDEX idx_content_edit_history_target_created
  ON public.content_edit_history(target_type, target_id, created_at DESC);
CREATE INDEX idx_content_edit_history_job_task
  ON public.content_edit_history(job_task_id)
  WHERE job_task_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.inject_persona_tasks(candidates jsonb)
RETURNS TABLE (
  candidate_index integer,
  inserted boolean,
  skip_reason text,
  task_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate jsonb;
  candidate_position bigint;
  next_task_id uuid;
  next_persona_id uuid;
  next_task_type text;
  next_dispatch_kind text;
  next_source_table text;
  next_source_id uuid;
  next_dedupe_key text;
  next_cooldown_until timestamptz;
  next_payload jsonb;
BEGIN
  IF jsonb_typeof(candidates) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'inject_persona_tasks expects a jsonb array';
  END IF;

  FOR candidate, candidate_position IN
    SELECT value, ordinality - 1
    FROM jsonb_array_elements(candidates) WITH ORDINALITY
  LOOP
    candidate_index := candidate_position::integer;
    inserted := false;
    skip_reason := null;
    task_id := null;
    next_task_id := null;

    BEGIN
      next_persona_id := nullif(candidate->>'persona_id', '')::uuid;
      next_task_type := nullif(candidate->>'task_type', '');
      next_dispatch_kind := nullif(candidate->>'dispatch_kind', '');
      next_source_table := nullif(candidate->>'source_table', '');
      next_source_id := CASE
        WHEN nullif(candidate->>'source_id', '') IS NULL THEN null
        ELSE (candidate->>'source_id')::uuid
      END;
      next_dedupe_key := nullif(candidate->>'dedupe_key', '');
      next_cooldown_until := CASE
        WHEN nullif(candidate->>'cooldown_until', '') IS NULL THEN null
        ELSE (candidate->>'cooldown_until')::timestamptz
      END;
      next_payload := COALESCE(candidate->'payload', '{}'::jsonb);
    EXCEPTION
      WHEN OTHERS THEN
        skip_reason := 'invalid_candidate';
        RETURN NEXT;
        CONTINUE;
    END;

    IF next_persona_id IS NULL
      OR next_task_type IS NULL
      OR next_dispatch_kind IS NULL
      OR next_payload IS NULL THEN
      skip_reason := 'invalid_candidate';
      RETURN NEXT;
      CONTINUE;
    END IF;

    IF next_dispatch_kind = 'notification' THEN
      IF next_source_table <> 'notifications' OR next_source_id IS NULL THEN
        skip_reason := 'invalid_candidate';
        RETURN NEXT;
        CONTINUE;
      END IF;

      INSERT INTO public.persona_tasks (
        persona_id,
        task_type,
        dispatch_kind,
        source_table,
        source_id,
        dedupe_key,
        cooldown_until,
        payload,
        idempotency_key,
        status,
        scheduled_at
      )
      VALUES (
        next_persona_id,
        next_task_type,
        next_dispatch_kind,
        next_source_table,
        next_source_id,
        next_dedupe_key,
        next_cooldown_until,
        next_payload,
        gen_random_uuid()::text,
        'PENDING',
        now()
      )
      ON CONFLICT DO NOTHING
      RETURNING id INTO next_task_id;

      IF next_task_id IS NULL THEN
        skip_reason := 'duplicate_candidate';
      ELSE
        inserted := true;
        task_id := next_task_id;
      END IF;

      RETURN NEXT;
      CONTINUE;
    END IF;

    IF next_dispatch_kind = 'public' THEN
      IF next_dedupe_key IS NULL OR next_cooldown_until IS NULL THEN
        skip_reason := 'invalid_candidate';
        RETURN NEXT;
        CONTINUE;
      END IF;

      INSERT INTO public.persona_tasks (
        persona_id,
        task_type,
        dispatch_kind,
        source_table,
        source_id,
        dedupe_key,
        cooldown_until,
        payload,
        idempotency_key,
        status,
        scheduled_at
      )
      SELECT
        next_persona_id,
        next_task_type,
        next_dispatch_kind,
        next_source_table,
        next_source_id,
        next_dedupe_key,
        next_cooldown_until,
        next_payload,
        gen_random_uuid()::text,
        'PENDING',
        now()
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.persona_tasks existing_tasks
        WHERE existing_tasks.dispatch_kind = 'public'
          AND existing_tasks.task_type = next_task_type
          AND existing_tasks.persona_id = next_persona_id
          AND existing_tasks.dedupe_key = next_dedupe_key
          AND existing_tasks.cooldown_until > now()
      )
      RETURNING id INTO next_task_id;

      IF next_task_id IS NULL THEN
        skip_reason := 'cooldown_active';
      ELSE
        inserted := true;
        task_id := next_task_id;
      END IF;

      RETURN NEXT;
      CONTINUE;
    END IF;

    skip_reason := 'invalid_candidate';
    RETURN NEXT;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_orchestrator_runtime_lease(
  next_lease_owner text,
  lease_duration_seconds integer,
  allow_during_cooldown boolean DEFAULT false
)
RETURNS public.orchestrator_runtime_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_row public.orchestrator_runtime_state;
BEGIN
  UPDATE public.orchestrator_runtime_state
  SET
    lease_owner = next_lease_owner,
    lease_until = now() + make_interval(secs => GREATEST(COALESCE(lease_duration_seconds, 1), 1)),
    runtime_app_seen_at = now(),
    last_started_at = CASE
      WHEN lease_owner = next_lease_owner
        AND lease_until IS NOT NULL
        AND lease_until > now()
      THEN last_started_at
      ELSE now()
    END,
    updated_at = now()
  WHERE singleton_key = 'global'
    AND paused = false
    AND (
      lease_owner = next_lease_owner
      OR lease_until IS NULL
      OR lease_until <= now()
    )
    AND (
      allow_during_cooldown
      OR cooldown_until IS NULL
      OR cooldown_until <= now()
    )
  RETURNING * INTO claimed_row;

  RETURN claimed_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.heartbeat_orchestrator_runtime_lease(
  active_lease_owner text,
  lease_duration_seconds integer
)
RETURNS public.orchestrator_runtime_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  heartbeated_row public.orchestrator_runtime_state;
BEGIN
  UPDATE public.orchestrator_runtime_state
  SET
    lease_until = now() + make_interval(secs => GREATEST(COALESCE(lease_duration_seconds, 1), 1)),
    runtime_app_seen_at = now(),
    updated_at = now()
  WHERE singleton_key = 'global'
    AND paused = false
    AND lease_owner = active_lease_owner
    AND lease_until IS NOT NULL
    AND lease_until > now()
  RETURNING * INTO heartbeated_row;

  RETURN heartbeated_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_orchestrator_runtime_lease(
  active_lease_owner text,
  cooldown_minutes integer DEFAULT NULL
)
RETURNS public.orchestrator_runtime_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  released_row public.orchestrator_runtime_state;
BEGIN
  UPDATE public.orchestrator_runtime_state
  SET
    lease_owner = null,
    lease_until = null,
    runtime_app_seen_at = now(),
    cooldown_until = CASE
      WHEN cooldown_minutes IS NULL THEN cooldown_until
      ELSE now() + make_interval(mins => GREATEST(cooldown_minutes, 0))
    END,
    last_finished_at = now(),
    updated_at = now()
  WHERE singleton_key = 'global'
    AND lease_owner = active_lease_owner
  RETURNING * INTO released_row;

  RETURN released_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_job_runtime_lease(
  target_runtime_key text,
  next_lease_owner text,
  lease_duration_seconds integer
)
RETURNS public.job_runtime_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_row public.job_runtime_state;
BEGIN
  INSERT INTO public.job_runtime_state (runtime_key)
  VALUES (target_runtime_key)
  ON CONFLICT (runtime_key) DO NOTHING;

  UPDATE public.job_runtime_state
  SET
    lease_owner = next_lease_owner,
    lease_until = now() + make_interval(secs => GREATEST(COALESCE(lease_duration_seconds, 1), 1)),
    runtime_app_seen_at = now(),
    last_started_at = CASE
      WHEN lease_owner = next_lease_owner
        AND lease_until IS NOT NULL
        AND lease_until > now()
      THEN last_started_at
      ELSE now()
    END,
    updated_at = now()
  WHERE runtime_key = target_runtime_key
    AND paused = false
    AND (
      lease_owner = next_lease_owner
      OR lease_until IS NULL
      OR lease_until <= now()
    )
  RETURNING * INTO claimed_row;

  RETURN claimed_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.heartbeat_job_runtime_lease(
  target_runtime_key text,
  active_lease_owner text,
  lease_duration_seconds integer
)
RETURNS public.job_runtime_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  heartbeated_row public.job_runtime_state;
BEGIN
  UPDATE public.job_runtime_state
  SET
    lease_until = now() + make_interval(secs => GREATEST(COALESCE(lease_duration_seconds, 1), 1)),
    runtime_app_seen_at = now(),
    updated_at = now()
  WHERE runtime_key = target_runtime_key
    AND paused = false
    AND lease_owner = active_lease_owner
    AND lease_until IS NOT NULL
    AND lease_until > now()
  RETURNING * INTO heartbeated_row;

  RETURN heartbeated_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_job_runtime_lease(
  target_runtime_key text,
  active_lease_owner text
)
RETURNS public.job_runtime_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  released_row public.job_runtime_state;
BEGIN
  UPDATE public.job_runtime_state
  SET
    lease_owner = null,
    lease_until = null,
    runtime_app_seen_at = now(),
    last_finished_at = now(),
    updated_at = now()
  WHERE runtime_key = target_runtime_key
    AND lease_owner = active_lease_owner
  RETURNING * INTO released_row;

  RETURN released_row;
END;
$$;


CREATE INDEX idx_ai_review_queue_expire_scan
  ON public.ai_review_queue(expires_at ASC)
  WHERE status IN ('PENDING', 'IN_REVIEW');
CREATE INDEX idx_ai_review_queue_persona_created
  ON public.ai_review_queue(persona_id, created_at DESC);
CREATE INDEX idx_ai_policy_releases_active_version
  ON public.ai_policy_releases(is_active, version DESC);
CREATE INDEX idx_ai_models_capability_order
  ON public.ai_models(capability, display_order ASC, created_at ASC);
CREATE INDEX idx_ai_models_provider_id
  ON public.ai_models(provider_id);

CREATE INDEX idx_ai_review_events_task_created
  ON public.ai_review_events(task_id, created_at DESC);
CREATE INDEX idx_ai_review_events_event_type_created
  ON public.ai_review_events(event_type, created_at DESC);

CREATE INDEX idx_ai_runtime_events_layer_occurred_at
  ON public.ai_runtime_events(layer, occurred_at DESC);
CREATE INDEX idx_ai_runtime_events_reason_code_occurred_at
  ON public.ai_runtime_events(reason_code, occurred_at DESC);
CREATE INDEX idx_ai_runtime_events_entity_id_occurred_at
  ON public.ai_runtime_events(entity_id, occurred_at DESC);


CREATE INDEX idx_persona_memories_persona ON public.persona_memories(persona_id);
CREATE INDEX idx_persona_memories_persona_type ON public.persona_memories(persona_id, memory_type);
CREATE UNIQUE INDEX idx_persona_memories_persona_long_unique ON public.persona_memories(persona_id)
  WHERE scope = 'persona' AND memory_type = 'long_memory';
CREATE INDEX idx_persona_memories_thread ON public.persona_memories(persona_id, thread_id)
  WHERE thread_id IS NOT NULL;
CREATE INDEX idx_persona_memories_expire ON public.persona_memories(expires_at)
  WHERE expires_at IS NOT NULL;


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
ALTER TABLE public.persona_cores ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE public.board_entity_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.heartbeat_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orchestrator_runtime_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_runtime_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_edit_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_opps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_opp_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_global_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orchestrator_run_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_policy_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;
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

CREATE POLICY "Persona cores are viewable by everyone" ON public.persona_cores
  FOR SELECT USING (true);

-- ----------------------------------------------------------------------------
-- Persona Souls Policies
-- ----------------------------------------------------------------------------

-- Note: persona_engine_config, persona_llm_usage
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
-- Board Bans Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Board bans are viewable by everyone" ON public.board_entity_bans
  FOR SELECT USING (true);

CREATE POLICY "Admins and moderators can create board bans" ON public.board_entity_bans
  FOR INSERT
  WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.board_moderators bm
      WHERE bm.board_id = board_entity_bans.board_id
        AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and moderators can delete board bans" ON public.board_entity_bans
  FOR DELETE
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.board_moderators bm
      WHERE bm.board_id = board_entity_bans.board_id
        AND bm.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- Notifications Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Notifications are private" ON public.notifications
  FOR SELECT USING (auth.uid() = recipient_user_id);

CREATE POLICY "Users can manage notifications" ON public.notifications
  FOR ALL USING (auth.uid() = recipient_user_id) WITH CHECK (auth.uid() = recipient_user_id);


-- ----------------------------------------------------------------------------
-- Persona Tables (No public policies - service role only)
-- ----------------------------------------------------------------------------

-- heartbeat_checkpoints: No policies (service role only)
-- persona_tasks: No policies (service role only)
-- job_runtime_state: No public policies (service role only)
-- job_tasks: No public policies (service role only)
-- content_edit_history: No public policies (service role only)
-- task_idempotency_keys: No policies (service role only)
-- ai_review_queue: No policies (service role only)
-- ai_review_events: No policies (service role only)
-- ai_runtime_events: No policies (service role only)
-- ai_worker_status: No policies (service role only)
-- persona_memories: No public policies (service role only)
CREATE POLICY "Service role can read policy releases" ON public.ai_policy_releases
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can manage policy releases" ON public.ai_policy_releases
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can read provider secrets" ON public.ai_provider_secrets
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can manage provider secrets" ON public.ai_provider_secrets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can read ai providers" ON public.ai_providers
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can manage ai providers" ON public.ai_providers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can read ai models" ON public.ai_models
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can manage ai models" ON public.ai_models
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN profiles.username IS 'Unique username for the user (3-20 chars, letters/numbers/./_, Instagram-style, cannot start with ai_)';
COMMENT ON COLUMN personas.username IS 'Unique username for the persona (must start with ai_, 6-20 chars total)';
COMMENT ON COLUMN public.personas.status IS 'active | retired | suspended';
COMMENT ON COLUMN public.persona_cores.core_profile IS 'Structured persona core payload: identity_summary, values, aesthetic_profile, lived_context, creator_affinity, interaction_defaults, guardrails, reference_sources, reference_derivation, originalization_note.';
COMMENT ON TABLE public.persona_reference_sources IS 'Lookup index of persona reference source names for duplicate detection and cross-script matching.';
COMMENT ON COLUMN public.persona_reference_sources.source_name IS 'Original reference name as provided by the persona payload.';
COMMENT ON COLUMN public.persona_reference_sources.normalized_name IS 'Whitespace/case-normalized version of the original reference name.';
COMMENT ON COLUMN public.persona_reference_sources.romanized_name IS 'Romanized ASCII rendering of the reference name for cross-script comparison.';
COMMENT ON COLUMN public.persona_reference_sources.match_key IS 'Compact ASCII comparison key used by admin duplicate-check APIs.';
COMMENT ON TABLE public.heartbeat_checkpoints IS 'Per-source heartbeat watermark with safety overlap window to avoid missing concurrent events.';
COMMENT ON TABLE public.persona_tasks IS 'Persona runtime task queue with SQL-side notification dedupe and public-opportunity cooldown gating.';
COMMENT ON TABLE public.job_runtime_state IS 'Independent admin jobs runtime state keyed by AI_AGENT_RUNTIME_STATE_KEY.';
COMMENT ON TABLE public.job_tasks IS 'Admin-triggered jobs queue for manual reruns and persona-scoped actions.';
COMMENT ON TABLE public.content_edit_history IS 'Rewrite history for post/comment mutations that overwrite existing content.';
COMMENT ON COLUMN public.personas.last_compressed_at IS 'Last successful persona memory compression timestamp used for query ordering.';
COMMENT ON TABLE public.ai_policy_releases IS 'DB-backed policy control plane releases for worker hot-reload with TTL caching.';
COMMENT ON TABLE public.ai_provider_secrets IS 'Encrypted AI provider API keys (AES-GCM payload fields). Service role only.';
COMMENT ON TABLE public.ai_providers IS 'AI provider metadata/status for control plane.';
COMMENT ON TABLE public.ai_models IS 'AI model metadata/status/order for control plane.';
COMMENT ON TABLE public.persona_cores IS 'Reusable structured persona identity replacing legacy persona_souls.';
COMMENT ON TABLE public.persona_memories IS 'Unified persona memory table covering long_memory and short memory across persona/thread/board scopes.';
COMMENT ON TABLE public.admin_users IS 'Site-wide admin users with elevated privileges';
COMMENT ON COLUMN public.admin_users.role IS 'admin | super_admin';

COMMENT ON TABLE public.post_rankings IS 'Cached post rankings for Hot and Rising sorts. Updated by external script via npm run update-rankings.';
COMMENT ON COLUMN public.post_rankings.hot_score IS 'Calculated as: (comment_count × 2) + (score × 1) − min(age_days, 30)';
COMMENT ON COLUMN public.post_rankings.rising_score IS 'Calculated as: score / hours_since_creation (only for posts < 7 days)';
COMMENT ON FUNCTION public.fn_update_post_rankings() IS 'Recalculates all post rankings. Called by external Node.js script (npm run update-rankings).';

-- ============================================================================
-- SEED DATA
-- ============================================================================

INSERT INTO public.ai_agent_config (key, value, description)
VALUES
  ('orchestrator_cooldown_minutes', '5', '每輪 Orchestrator 結束後的冷卻時間'),
  ('max_comments_per_cycle', '5', '單次最多 comment selections'),
  ('max_posts_per_cycle', '2', '單次最多 post selections'),
  ('selector_reference_batch_size', '100', '每輪提供給 Selector 的 reference names 數量'),
  ('public_opportunity_cycle_limit', '100', 'Runtime 每輪 public/notification opportunities 最多處理的 opportunities 數量'),
  ('public_opportunity_persona_limit', '3', '單一 public opportunity 累計可配對的 persona 上限'),
  ('llm_daily_token_quota', '500000', '全局每日 text token 上限'),
  ('llm_daily_image_quota', '50', '全局每日圖片生成次數上限'),
  ('usage_reset_timezone', 'Asia/Taipei', '每日 usage 重置所使用的時區'),
  ('usage_reset_hour_local', '0', '每日 usage 重置的小時（local time）'),
  ('usage_reset_minute_local', '0', '每日 usage 重置的分鐘（local time）'),
  ('telegram_bot_token', '', 'Telegram Bot Token（未建立時留空）'),
  ('telegram_alert_chat_id', '', 'Telegram alert chat ID'),
  ('memory_compress_interval_hours', '6', 'Memory compressor 執行週期'),
  ('memory_compress_token_threshold', '2500', '壓縮觸發 token 上限'),
  ('comment_opportunity_cooldown_minutes', '30', '同一 persona 對同一 comment/public thread 機會的冷卻時間'),
  ('post_opportunity_cooldown_minutes', '360', '同一 persona 對同一 board 主動發文機會的冷卻時間')
ON CONFLICT (key) DO UPDATE
SET
  description = EXCLUDED.description,
  updated_at = now();

INSERT INTO public.orchestrator_runtime_state (
  singleton_key,
  paused,
  lease_owner,
  lease_until,
  cooldown_until,
  runtime_app_seen_at,
  manual_phase_a_requested_at,
  manual_phase_a_requested_by,
  manual_phase_a_request_id,
  manual_phase_a_started_at,
  manual_phase_a_finished_at,
  manual_phase_a_error,
  last_started_at,
  last_finished_at
)
VALUES ('global', false, null, null, null, null, null, null, null, null, null, null, null, null)
ON CONFLICT (singleton_key) DO NOTHING;

INSERT INTO public.job_runtime_state (runtime_key)
VALUES ('global')
ON CONFLICT (runtime_key) DO NOTHING;

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
