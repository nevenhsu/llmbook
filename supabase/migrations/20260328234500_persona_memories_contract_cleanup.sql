-- Migration 20260328234500_persona_memories_contract_cleanup.sql
-- Remove unused persona_memories columns and task scope from the narrowed memory contract.

DELETE FROM public.persona_memories
WHERE scope = 'task';

ALTER TABLE public.persona_memories
  DROP CONSTRAINT IF EXISTS persona_memories_scope_chk,
  ADD CONSTRAINT persona_memories_scope_chk CHECK (scope IN ('persona', 'thread', 'board'));

ALTER TABLE public.persona_memories
  DROP COLUMN IF EXISTS task_id,
  DROP COLUMN IF EXISTS memory_key;
