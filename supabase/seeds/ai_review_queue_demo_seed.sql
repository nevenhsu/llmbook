-- Demo seed for Review Queue MVP (safe to re-run)
-- Purpose: inject pending/in-review/expired review items for admin UI manual testing.

DO $$
DECLARE
  v_seed_tag text := 'review_queue_demo_v1';
  v_persona_ids uuid[];
  v_persona_count int;
  v_task_id uuid;
  v_review_id uuid;
  v_persona_id uuid;
  v_now timestamptz := now();
BEGIN
  SELECT array_agg(id)
    INTO v_persona_ids
  FROM (
    SELECT id
    FROM public.personas
    ORDER BY created_at ASC
    LIMIT 5
  ) p;

  v_persona_count := COALESCE(array_length(v_persona_ids, 1), 0);
  IF v_persona_count = 0 THEN
    RAISE EXCEPTION 'No personas found. Create persona records before running ai_review_queue_demo_seed.sql';
  END IF;

  -- Cleanup previous demo rows only
  DELETE FROM public.ai_review_events WHERE metadata->>'seed_tag' = v_seed_tag;
  DELETE FROM public.ai_review_queue WHERE metadata->>'seed_tag' = v_seed_tag;
  DELETE FROM public.persona_tasks WHERE payload->>'seed_tag' = v_seed_tag;

  -- 1) Pending / HIGH
  v_persona_id := v_persona_ids[1];
  v_task_id := gen_random_uuid();
  v_review_id := gen_random_uuid();

  INSERT INTO public.persona_tasks (id, persona_id, task_type, payload, status, scheduled_at, created_at, retry_count, max_retries)
  VALUES (
    v_task_id,
    v_persona_id,
    'reply',
    jsonb_build_object('seed_tag', v_seed_tag, 'case', 'pending_high', 'text', 'possible policy-sensitive content'),
    'IN_REVIEW',
    v_now - interval '50 minutes',
    v_now - interval '55 minutes',
    0,
    3
  );

  INSERT INTO public.ai_review_queue (id, task_id, persona_id, risk_level, status, enqueue_reason_code, expires_at, created_at, updated_at, metadata)
  VALUES (
    v_review_id,
    v_task_id,
    v_persona_id,
    'HIGH',
    'PENDING',
    'review_required',
    v_now + interval '2 days',
    v_now - interval '45 minutes',
    v_now - interval '45 minutes',
    jsonb_build_object('seed_tag', v_seed_tag, 'case', 'pending_high')
  );

  INSERT INTO public.ai_review_events (review_id, task_id, event_type, reason_code, created_at, metadata)
  VALUES (v_review_id, v_task_id, 'ENQUEUED', 'review_required', v_now - interval '45 minutes', jsonb_build_object('seed_tag', v_seed_tag));

  -- 2) Pending / GRAY
  v_persona_id := v_persona_ids[1 + (1 % v_persona_count)];
  v_task_id := gen_random_uuid();
  v_review_id := gen_random_uuid();

  INSERT INTO public.persona_tasks (id, persona_id, task_type, payload, status, scheduled_at, created_at, retry_count, max_retries)
  VALUES (
    v_task_id,
    v_persona_id,
    'comment',
    jsonb_build_object('seed_tag', v_seed_tag, 'case', 'pending_gray', 'text', 'ambiguous recommendation'),
    'IN_REVIEW',
    v_now - interval '35 minutes',
    v_now - interval '40 minutes',
    0,
    3
  );

  INSERT INTO public.ai_review_queue (id, task_id, persona_id, risk_level, status, enqueue_reason_code, expires_at, created_at, updated_at, metadata)
  VALUES (
    v_review_id,
    v_task_id,
    v_persona_id,
    'GRAY',
    'PENDING',
    'review_required',
    v_now + interval '1 day',
    v_now - interval '30 minutes',
    v_now - interval '30 minutes',
    jsonb_build_object('seed_tag', v_seed_tag, 'case', 'pending_gray')
  );

  INSERT INTO public.ai_review_events (review_id, task_id, event_type, reason_code, created_at, metadata)
  VALUES (v_review_id, v_task_id, 'ENQUEUED', 'review_required', v_now - interval '30 minutes', jsonb_build_object('seed_tag', v_seed_tag));

  -- 3) In Review / HIGH
  v_persona_id := v_persona_ids[1 + (2 % v_persona_count)];
  v_task_id := gen_random_uuid();
  v_review_id := gen_random_uuid();

  INSERT INTO public.persona_tasks (id, persona_id, task_type, payload, status, scheduled_at, created_at, retry_count, max_retries)
  VALUES (
    v_task_id,
    v_persona_id,
    'reply',
    jsonb_build_object('seed_tag', v_seed_tag, 'case', 'in_review_high', 'text', 'high-risk pending human check'),
    'IN_REVIEW',
    v_now - interval '20 minutes',
    v_now - interval '25 minutes',
    0,
    3
  );

  INSERT INTO public.ai_review_queue (
    id, task_id, persona_id, risk_level, status, enqueue_reason_code,
    claimed_at, expires_at, created_at, updated_at, metadata
  )
  VALUES (
    v_review_id,
    v_task_id,
    v_persona_id,
    'HIGH',
    'IN_REVIEW',
    'review_required',
    v_now - interval '10 minutes',
    v_now + interval '2 days',
    v_now - interval '20 minutes',
    v_now - interval '10 minutes',
    jsonb_build_object('seed_tag', v_seed_tag, 'case', 'in_review_high')
  );

  INSERT INTO public.ai_review_events (review_id, task_id, event_type, reason_code, created_at, metadata)
  VALUES
    (v_review_id, v_task_id, 'ENQUEUED', 'review_required', v_now - interval '20 minutes', jsonb_build_object('seed_tag', v_seed_tag)),
    (v_review_id, v_task_id, 'CLAIMED', null, v_now - interval '10 minutes', jsonb_build_object('seed_tag', v_seed_tag));

  -- 4) Expired / HIGH (already timeout)
  v_persona_id := v_persona_ids[1 + (3 % v_persona_count)];
  v_task_id := gen_random_uuid();
  v_review_id := gen_random_uuid();

  INSERT INTO public.persona_tasks (
    id, persona_id, task_type, payload, status, scheduled_at, created_at, retry_count, max_retries, completed_at, error_message
  )
  VALUES (
    v_task_id,
    v_persona_id,
    'reply',
    jsonb_build_object('seed_tag', v_seed_tag, 'case', 'expired_high', 'text', 'timed out waiting for review'),
    'SKIPPED',
    v_now - interval '4 days',
    v_now - interval '4 days',
    0,
    3,
    v_now - interval '1 day',
    'review_timeout_expired'
  );

  INSERT INTO public.ai_review_queue (
    id, task_id, persona_id, risk_level, status, enqueue_reason_code,
    decision, decision_reason_code, decided_at, expires_at, created_at, updated_at, metadata
  )
  VALUES (
    v_review_id,
    v_task_id,
    v_persona_id,
    'HIGH',
    'EXPIRED',
    'review_required',
    null,
    'review_timeout_expired',
    v_now - interval '1 day',
    v_now - interval '1 day',
    v_now - interval '4 days',
    v_now - interval '1 day',
    jsonb_build_object('seed_tag', v_seed_tag, 'case', 'expired_high')
  );

  INSERT INTO public.ai_review_events (review_id, task_id, event_type, reason_code, created_at, metadata)
  VALUES
    (v_review_id, v_task_id, 'ENQUEUED', 'review_required', v_now - interval '4 days', jsonb_build_object('seed_tag', v_seed_tag)),
    (v_review_id, v_task_id, 'EXPIRED', 'review_timeout_expired', v_now - interval '1 day', jsonb_build_object('seed_tag', v_seed_tag));

  RAISE NOTICE 'Inserted review queue demo data with seed_tag=%', v_seed_tag;
END $$;
