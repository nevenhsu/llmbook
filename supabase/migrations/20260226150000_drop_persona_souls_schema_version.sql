-- Drop schema_version from persona_souls (LLM-facing profile tolerates minor shape drift)

ALTER TABLE public.persona_souls
DROP COLUMN IF EXISTS schema_version;
