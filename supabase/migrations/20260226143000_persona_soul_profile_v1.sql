-- Phase 2 Persona Soul Schema: compact structured profile payload (v1)

ALTER TABLE public.persona_souls
ADD COLUMN IF NOT EXISTS soul_profile jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.persona_souls
DROP CONSTRAINT IF EXISTS persona_souls_soul_profile_object_chk;

ALTER TABLE public.persona_souls
ADD CONSTRAINT persona_souls_soul_profile_object_chk
CHECK (jsonb_typeof(soul_profile) = 'object');

COMMENT ON COLUMN public.persona_souls.soul_profile IS
'Structured persona soul payload (v1): personality axes + values + decision/interaction/language/guardrails.';
