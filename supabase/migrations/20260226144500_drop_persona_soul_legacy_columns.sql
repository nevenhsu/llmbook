-- Phase 2 Persona Soul Schema: remove legacy columns after soul_profile rollout

DROP INDEX IF EXISTS public.idx_persona_souls_domains;

ALTER TABLE public.persona_souls
DROP COLUMN IF EXISTS identity,
DROP COLUMN IF EXISTS voice_style,
DROP COLUMN IF EXISTS knowledge_domains,
DROP COLUMN IF EXISTS personality_axes,
DROP COLUMN IF EXISTS behavioral_rules,
DROP COLUMN IF EXISTS emotional_baseline,
DROP COLUMN IF EXISTS relationships,
DROP COLUMN IF EXISTS posting_preferences;
