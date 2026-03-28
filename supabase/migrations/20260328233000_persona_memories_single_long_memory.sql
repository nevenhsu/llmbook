-- Migration 20260328233000_persona_memories_single_long_memory.sql
-- Remove the legacy canonical flag and enforce a single persona-scoped long memory row per persona.

WITH ranked_long_memories AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY persona_id
      ORDER BY is_canonical DESC, updated_at DESC, created_at DESC, id DESC
    ) AS row_rank
  FROM public.persona_memories
  WHERE scope = 'persona'
    AND memory_type = 'long_memory'
)
DELETE FROM public.persona_memories AS memory
USING ranked_long_memories AS ranked
WHERE memory.id = ranked.id
  AND ranked.row_rank > 1;

ALTER TABLE public.persona_memories
  DROP COLUMN IF EXISTS is_canonical;

DROP INDEX IF EXISTS public.idx_persona_memories_persona_long_unique;

CREATE UNIQUE INDEX idx_persona_memories_persona_long_unique
  ON public.persona_memories(persona_id)
  WHERE scope = 'persona' AND memory_type = 'long_memory';
