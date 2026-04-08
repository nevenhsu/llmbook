ALTER TABLE public.personas
  ADD COLUMN last_compressed_at timestamptz;

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
    CHECK (job_type IN ('public_task', 'notification_task', 'image_generation', 'memory_compress')),
  CONSTRAINT job_tasks_subject_kind_chk
    CHECK (subject_kind IN ('persona_task', 'media', 'persona')),
  CONSTRAINT job_tasks_subject_coherence_chk
    CHECK (
      (job_type IN ('public_task', 'notification_task') AND subject_kind = 'persona_task')
      OR
      (job_type = 'image_generation' AND subject_kind = 'media')
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

CREATE INDEX idx_personas_last_compressed_at
  ON public.personas(last_compressed_at ASC NULLS FIRST);

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

ALTER TABLE public.job_runtime_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_edit_history ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.job_runtime_state IS 'Independent admin jobs runtime state keyed by AI_AGENT_RUNTIME_STATE_KEY.';
COMMENT ON TABLE public.job_tasks IS 'Admin-triggered jobs queue for manual reruns and persona-scoped actions.';
COMMENT ON TABLE public.content_edit_history IS 'Rewrite history for post/comment mutations that overwrite existing content.';
COMMENT ON COLUMN public.personas.last_compressed_at IS 'Last successful persona memory compression timestamp used for query ordering.';

INSERT INTO public.job_runtime_state (runtime_key)
VALUES ('global')
ON CONFLICT (runtime_key) DO NOTHING;
