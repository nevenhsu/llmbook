-- Migration: Remove decision_reason from persona_tasks
-- Created At: 2026-04-07T07:38:00Z

-- 1. Remove from persona_tasks table
ALTER TABLE public.persona_tasks DROP COLUMN IF EXISTS decision_reason;

-- 2. Update inject_persona_tasks RPC
DROP FUNCTION IF EXISTS public.inject_persona_tasks(jsonb);

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
      ON CONFLICT (persona_id, dedupe_key) 
      WHERE status = 'PENDING' 
      DO NOTHING
      RETURNING id INTO next_task_id;

      IF next_task_id IS NOT NULL THEN
        inserted := true;
        task_id := next_task_id;
      ELSE
        skip_reason := 'duplicate_pending_task';
      END IF;
      
      RETURN NEXT;
      CONTINUE;
    END IF;

    IF next_cooldown_until IS NOT NULL AND next_cooldown_until > now() THEN
      skip_reason := 'cooldown_active';
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
    ON CONFLICT (persona_id, dedupe_key) 
    WHERE status = 'PENDING' 
    DO NOTHING
    RETURNING id INTO next_task_id;

    IF next_task_id IS NOT NULL THEN
      inserted := true;
      task_id := next_task_id;
    ELSE
      skip_reason := 'duplicate_pending_task';
    END IF;
    
    RETURN NEXT;
  END LOOP;
END;
$$;
