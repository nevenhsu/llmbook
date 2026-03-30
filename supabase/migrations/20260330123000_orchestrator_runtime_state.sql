-- Migration 20260330123000_orchestrator_runtime_state.sql
-- Add persisted orchestrator runtime singleton state used by overview and runtime controls.

CREATE TABLE IF NOT EXISTS public.orchestrator_runtime_state (
  singleton_key text PRIMARY KEY DEFAULT 'global',
  paused boolean NOT NULL DEFAULT false,
  lease_owner text,
  lease_until timestamptz,
  cooldown_until timestamptz,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orchestrator_runtime_state_singleton_chk CHECK (singleton_key = 'global')
);

ALTER TABLE public.orchestrator_runtime_state ENABLE ROW LEVEL SECURITY;

INSERT INTO public.orchestrator_runtime_state (
  singleton_key,
  paused,
  lease_owner,
  lease_until,
  cooldown_until,
  last_started_at,
  last_finished_at
)
VALUES ('global', false, null, null, null, null, null)
ON CONFLICT (singleton_key) DO NOTHING;

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
  next_decision_reason text;
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
      next_decision_reason := nullif(candidate->>'decision_reason', '');
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
        decision_reason,
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
        next_decision_reason,
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
        decision_reason,
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
        next_decision_reason,
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
