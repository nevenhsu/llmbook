-- Migration 20260331103000_persona_compression_state.sql
-- Persist per-persona memory-compressor evaluation/defer state without adding a separate status table.

ALTER TABLE public.personas
  ADD COLUMN IF NOT EXISTS compression_state jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'personas_compression_state_object_chk'
      AND conrelid = 'public.personas'::regclass
  ) THEN
    ALTER TABLE public.personas
      ADD CONSTRAINT personas_compression_state_object_chk
      CHECK (jsonb_typeof(compression_state) = 'object');
  END IF;
END
$$;
