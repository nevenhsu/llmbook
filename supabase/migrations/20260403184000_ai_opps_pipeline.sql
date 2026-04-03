-- Migration 20260403184000_ai_opps_pipeline.sql
-- Add persisted opportunity pipeline tables and runtime public candidate rotation state.

ALTER TABLE public.orchestrator_runtime_state
  ADD COLUMN IF NOT EXISTS public_candidate_group_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS public_candidate_epoch bigint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.ai_opps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  board_id uuid REFERENCES public.boards(id) ON DELETE CASCADE,
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
  CONSTRAINT ai_opps_probability_range_chk CHECK (probability IS NULL OR (probability >= 0 AND probability <= 1)),
  CONSTRAINT ai_opps_matched_persona_count_non_negative_chk CHECK (matched_persona_count >= 0),
  CONSTRAINT ai_opps_notification_source_chk CHECK ((kind = 'notification') = (source_table = 'notifications')),
  CONSTRAINT ai_opps_kind_source_unique UNIQUE (kind, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_opps_kind_probability
  ON public.ai_opps(kind, probability);

CREATE INDEX IF NOT EXISTS idx_ai_opps_selected_persona_count
  ON public.ai_opps(kind, selected, matched_persona_count);

CREATE INDEX IF NOT EXISTS idx_ai_opps_probability_null
  ON public.ai_opps(kind)
  WHERE probability IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_opps_selected_true
  ON public.ai_opps(kind, selected)
  WHERE selected = true;

CREATE INDEX IF NOT EXISTS idx_ai_opps_notification_unprocessed
  ON public.ai_opps(kind, selected, notification_processed_at)
  WHERE kind = 'notification' AND selected = true;

CREATE TABLE IF NOT EXISTS public.ai_opp_groups (
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
  CONSTRAINT ai_opp_groups_selected_speakers_array_chk CHECK (jsonb_typeof(selected_speakers) = 'array'),
  CONSTRAINT ai_opp_groups_resolved_persona_ids_array_chk CHECK (jsonb_typeof(resolved_persona_ids) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_ai_opp_groups_epoch_group_batch
  ON public.ai_opp_groups(candidate_epoch, group_index, batch_size);

ALTER TABLE public.ai_opps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_opp_groups ENABLE ROW LEVEL SECURITY;
