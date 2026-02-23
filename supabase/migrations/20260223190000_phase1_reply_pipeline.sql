-- Phase 1 reply-only pipeline hardening
-- Adds checkpoint, intents, lease/idempotency, and transition audit tables.

CREATE TABLE IF NOT EXISTS public.heartbeat_checkpoints (
  source_name text PRIMARY KEY,
  last_captured_at timestamptz NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  safety_overlap_seconds int NOT NULL DEFAULT 10,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT heartbeat_checkpoints_overlap_non_negative CHECK (safety_overlap_seconds >= 0)
);

CREATE TABLE IF NOT EXISTS public.task_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_type text NOT NULL,
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  source_created_at timestamptz NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'NEW',
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

ALTER TABLE public.persona_tasks
  ADD COLUMN IF NOT EXISTS source_intent_id uuid REFERENCES public.task_intents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS lease_owner text,
  ADD COLUMN IF NOT EXISTS lease_until timestamptz,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'persona_tasks_status_check'
  ) THEN
    ALTER TABLE public.persona_tasks
      ADD CONSTRAINT persona_tasks_status_check
      CHECK (status IN ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'SKIPPED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'persona_tasks_retry_non_negative'
  ) THEN
    ALTER TABLE public.persona_tasks
      ADD CONSTRAINT persona_tasks_retry_non_negative
      CHECK (retry_count >= 0 AND max_retries >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'persona_tasks_type_check'
  ) THEN
    ALTER TABLE public.persona_tasks
      ADD CONSTRAINT persona_tasks_type_check
      CHECK (task_type IN ('comment', 'post', 'reply', 'vote', 'image_post', 'poll_post'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.task_idempotency_keys (
  task_type text NOT NULL,
  idempotency_key text NOT NULL,
  result_id uuid NOT NULL,
  result_type text NOT NULL,
  task_id uuid REFERENCES public.persona_tasks(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (task_type, idempotency_key),
  CONSTRAINT task_idempotency_type_check CHECK (task_type IN ('reply', 'vote', 'post', 'comment')),
  CONSTRAINT task_idempotency_result_type_check CHECK (result_type IN ('post', 'comment', 'vote'))
);

CREATE TABLE IF NOT EXISTS public.task_transition_events (
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
    from_status IN ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'SKIPPED')
    AND to_status IN ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'SKIPPED')
  )
);

CREATE INDEX IF NOT EXISTS idx_heartbeat_checkpoints_updated_at
  ON public.heartbeat_checkpoints(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_intents_status_created
  ON public.task_intents(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_intents_source_created
  ON public.task_intents(source_table, source_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_intents_selected_persona
  ON public.task_intents(selected_persona_id);

CREATE INDEX IF NOT EXISTS idx_persona_tasks_running_lease
  ON public.persona_tasks(lease_until) WHERE status = 'RUNNING';
CREATE INDEX IF NOT EXISTS idx_persona_tasks_source_intent
  ON public.persona_tasks(source_intent_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_persona_tasks_idempotency_key
  ON public.persona_tasks(task_type, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_task_idempotency_task_id
  ON public.task_idempotency_keys(task_id);
CREATE INDEX IF NOT EXISTS idx_task_idempotency_created_at
  ON public.task_idempotency_keys(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_transition_events_task_created
  ON public.task_transition_events(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_transition_events_persona_created
  ON public.task_transition_events(persona_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_transition_events_reason_code
  ON public.task_transition_events(reason_code);

ALTER TABLE public.heartbeat_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_transition_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.heartbeat_checkpoints IS
  'Per-source heartbeat watermark with safety overlap window to avoid missing concurrent events.';
COMMENT ON TABLE public.task_intents IS
  'Heartbeat output intents before dispatcher converts them to persona_tasks.';
COMMENT ON TABLE public.task_idempotency_keys IS
  'Durable idempotency map to prevent duplicate side effects across retries/restarts.';
COMMENT ON TABLE public.task_transition_events IS
  'Audit log of persona_tasks state transitions for replay and observability.';
