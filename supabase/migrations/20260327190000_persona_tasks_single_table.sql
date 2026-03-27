-- Migration 20260327190000_persona_tasks_single_table.sql
-- Collapse task_intents + persona_tasks into a single persona_tasks runtime table.

-- 1. Remove old cross-table linkage before dropping the obsolete table.
DROP INDEX IF EXISTS public.idx_persona_tasks_source_intent;
DROP INDEX IF EXISTS public.idx_task_transition_events_task_created;
DROP INDEX IF EXISTS public.idx_task_transition_events_persona_created;
DROP INDEX IF EXISTS public.idx_task_transition_events_reason_code;

ALTER TABLE public.persona_tasks
  DROP COLUMN IF EXISTS source_intent_id;

DROP TABLE IF EXISTS public.task_intents CASCADE;
DROP TABLE IF EXISTS public.task_transition_events CASCADE;
DROP TABLE IF EXISTS public.persona_memory_compress_status CASCADE;
DROP TABLE IF EXISTS public.ai_safety_events CASCADE;

-- 2. Extend persona_tasks with injection-time dedupe/cooldown fields.
ALTER TABLE public.persona_tasks
  ADD COLUMN IF NOT EXISTS dispatch_kind text,
  ADD COLUMN IF NOT EXISTS source_table text,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS cooldown_until timestamptz,
  ADD COLUMN IF NOT EXISTS decision_reason text;

ALTER TABLE public.persona_tasks
  DROP CONSTRAINT IF EXISTS persona_tasks_dispatch_kind_check,
  DROP CONSTRAINT IF EXISTS persona_tasks_source_table_check,
  DROP CONSTRAINT IF EXISTS persona_tasks_injection_shape_check;

ALTER TABLE public.persona_tasks
  ADD CONSTRAINT persona_tasks_dispatch_kind_check CHECK (
    dispatch_kind IS NULL OR dispatch_kind IN ('notification', 'public')
  ),
  ADD CONSTRAINT persona_tasks_source_table_check CHECK (
    source_table IS NULL OR source_table IN ('notifications', 'posts', 'comments')
  ),
  ADD CONSTRAINT persona_tasks_injection_shape_check CHECK (
    (
      dispatch_kind IS NULL
      AND source_table IS NULL
      AND source_id IS NULL
      AND dedupe_key IS NULL
      AND cooldown_until IS NULL
      AND decision_reason IS NULL
    )
    OR
    (dispatch_kind = 'notification' AND source_table = 'notifications' AND source_id IS NOT NULL)
    OR
    (dispatch_kind = 'public' AND dedupe_key IS NOT NULL AND cooldown_until IS NOT NULL)
  );

ALTER TABLE public.persona_tasks
  ALTER COLUMN dispatch_kind SET DEFAULT 'public';

-- 3. Add runtime indexes for SQL-side injection gating.
CREATE UNIQUE INDEX IF NOT EXISTS idx_persona_tasks_notification_dedupe
  ON public.persona_tasks(task_type, source_table, source_id, persona_id)
  WHERE dispatch_kind = 'notification';

CREATE INDEX IF NOT EXISTS idx_persona_tasks_public_cooldown_lookup
  ON public.persona_tasks(task_type, persona_id, dedupe_key, cooldown_until DESC)
  WHERE dispatch_kind = 'public';

-- 4. Seed cooldown config defaults for public opportunities.
INSERT INTO public.ai_agent_config (key, value, description)
VALUES
  ('comment_opportunity_cooldown_minutes', '30', '同一 persona 對同一 comment/public thread 機會的冷卻時間'),
  ('post_opportunity_cooldown_minutes', '360', '同一 persona 對同一 board 主動發文機會的冷卻時間')
ON CONFLICT (key) DO NOTHING;
