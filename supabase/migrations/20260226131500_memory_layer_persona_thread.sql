-- Phase 2 Memory Layer: persona/thread boundaries + runtime cleanup hooks

-- 1) Canonical long memory marker (single canonical copy per persona)
ALTER TABLE public.persona_long_memories
ADD COLUMN IF NOT EXISTS is_canonical boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill canonical row to latest record per persona, if any.
WITH ranked AS (
  SELECT
    id,
    persona_id,
    row_number() OVER (
      PARTITION BY persona_id
      ORDER BY coalesce(updated_at, created_at) DESC, created_at DESC, id DESC
    ) AS rn
  FROM public.persona_long_memories
)
UPDATE public.persona_long_memories m
SET is_canonical = (ranked.rn = 1),
    updated_at = coalesce(m.updated_at, m.created_at, now())
FROM ranked
WHERE ranked.id = m.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_persona_long_memory_canonical
  ON public.persona_long_memories(persona_id)
  WHERE is_canonical = true;

CREATE INDEX IF NOT EXISTS idx_long_mem_persona_canonical_updated
  ON public.persona_long_memories(persona_id, updated_at DESC)
  WHERE is_canonical = true;

-- 2) Thread short-memory (TTL + configurable effective window)
CREATE TABLE IF NOT EXISTS public.ai_thread_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  thread_id text NOT NULL,
  board_id uuid REFERENCES public.boards(id) ON DELETE CASCADE,
  task_type text NOT NULL DEFAULT 'reply',
  memory_key text NOT NULL,
  memory_value text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ttl_seconds int NOT NULL DEFAULT 172800,
  max_items int NOT NULL DEFAULT 20,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_thread_memories_task_type_check CHECK (
    task_type IN ('reply', 'vote', 'post', 'comment', 'image_post', 'poll_post')
  ),
  CONSTRAINT ai_thread_memories_ttl_positive CHECK (ttl_seconds > 0),
  CONSTRAINT ai_thread_memories_max_items_positive CHECK (max_items > 0 AND max_items <= 200),
  CONSTRAINT ai_thread_memories_expiry_check CHECK (expires_at > created_at),
  CONSTRAINT uq_ai_thread_memories_scope_key UNIQUE (persona_id, thread_id, task_type, memory_key)
);

CREATE INDEX IF NOT EXISTS idx_ai_thread_memories_scope_updated
  ON public.ai_thread_memories(persona_id, thread_id, task_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_thread_memories_expire_scan
  ON public.ai_thread_memories(expires_at ASC);

CREATE INDEX IF NOT EXISTS idx_ai_thread_memories_board_updated
  ON public.ai_thread_memories(board_id, updated_at DESC)
  WHERE board_id IS NOT NULL;

ALTER TABLE public.ai_thread_memories ENABLE ROW LEVEL SECURITY;

-- 3) Cleanup strategy for expired thread memories
CREATE OR REPLACE FUNCTION public.cleanup_ai_thread_memories(p_limit int DEFAULT 5000)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted int := 0;
BEGIN
  IF p_limit IS NULL OR p_limit <= 0 THEN
    RETURN 0;
  END IF;

  WITH expired AS (
    SELECT id
    FROM public.ai_thread_memories
    WHERE expires_at <= now()
    ORDER BY expires_at ASC
    LIMIT p_limit
  )
  DELETE FROM public.ai_thread_memories m
  USING expired
  WHERE m.id = expired.id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMENT ON TABLE public.ai_thread_memories IS 'Short-term per persona-thread memory entries with TTL and configurable per-scope max_items.';
COMMENT ON FUNCTION public.cleanup_ai_thread_memories(int) IS 'Deletes expired ai_thread_memories in bounded batches. Safe for cron scheduling.';

