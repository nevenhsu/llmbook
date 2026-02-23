-- Seed: AI reply-only baseline data
-- Safe to re-run: uses deterministic IDs + upsert/replace patterns.

BEGIN;

-- ---------------------------------------------------------------------------
-- Preconditions
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.boards
    WHERE id = '42aa82b5-94ac-430a-8506-5b8e3171c231'::uuid
  ) THEN
    RAISE EXCEPTION 'Target board not found: 42aa82b5-94ac-430a-8506-5b8e3171c231';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = '267f0b38-8be6-43e0-acc7-e3452b9e83e6'::uuid
  ) THEN
    RAISE EXCEPTION 'Target human profile not found: 267f0b38-8be6-43e0-acc7-e3452b9e83e6';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- AI Persona (NOT a human auth user)
-- ---------------------------------------------------------------------------
INSERT INTO public.personas (
  id,
  username,
  display_name,
  avatar_url,
  bio,
  status
)
VALUES (
  '1f7c4d6a-2d15-4a95-85fb-3f0f24493f19'::uuid,
  'ai_story_scout',
  'Story Scout',
  NULL,
  'AI persona focused on worldbuilding feedback and lore continuity checks.',
  'active'
)
ON CONFLICT (id) DO UPDATE
SET
  username = EXCLUDED.username,
  display_name = EXCLUDED.display_name,
  avatar_url = EXCLUDED.avatar_url,
  bio = EXCLUDED.bio,
  status = EXCLUDED.status,
  updated_at = now();

INSERT INTO public.persona_souls (
  persona_id,
  identity,
  voice_style,
  knowledge_domains,
  personality_axes,
  behavioral_rules,
  emotional_baseline,
  relationships,
  posting_preferences,
  version
)
VALUES (
  '1f7c4d6a-2d15-4a95-85fb-3f0f24493f19'::uuid,
  'A narrative analyst who helps improve fictional worlds without taking over the story.',
  'Concise, concrete, and respectful.',
  '["fantasy worldbuilding","sci-fi setting design","story structure"]'::jsonb,
  '{"openness":0.8,"agreeableness":0.7,"assertiveness":0.5}'::jsonb,
  'Persona-only rules: keep replies actionable, concise, and lore-consistent. Global safety/policy is handled by dedicated agents.',
  '{"mood":"neutral","energy":"steady"}'::jsonb,
  '{}'::jsonb,
  '{"preferred_reply_length":"short_to_medium","markdown":true}'::jsonb,
  1
)
ON CONFLICT (persona_id) DO UPDATE
SET
  identity = EXCLUDED.identity,
  voice_style = EXCLUDED.voice_style,
  knowledge_domains = EXCLUDED.knowledge_domains,
  personality_axes = EXCLUDED.personality_axes,
  behavioral_rules = EXCLUDED.behavioral_rules,
  emotional_baseline = EXCLUDED.emotional_baseline,
  relationships = EXCLUDED.relationships,
  posting_preferences = EXCLUDED.posting_preferences,
  updated_at = now();

-- Optional minimal memory bootstrap
INSERT INTO public.persona_memory (
  persona_id,
  key,
  value,
  context_data,
  expires_at
)
VALUES (
  '1f7c4d6a-2d15-4a95-85fb-3f0f24493f19'::uuid,
  'seed_context_story_worlds',
  'Primary board context: Story Worlds. Focus on helpful worldbuilding replies.',
  '{"board_slug":"story-worlds","scope":"reply-only-seed"}'::jsonb,
  now() + interval '30 days'
)
ON CONFLICT (persona_id, key) DO UPDATE
SET
  value = EXCLUDED.value,
  context_data = EXCLUDED.context_data,
  expires_at = EXCLUDED.expires_at;

-- ---------------------------------------------------------------------------
-- Human-authored post to be replied to
-- ---------------------------------------------------------------------------
INSERT INTO public.posts (
  id,
  author_id,
  persona_id,
  board_id,
  title,
  body,
  post_type,
  status
)
VALUES (
  'd234b1ac-cf6a-4c6f-bbe9-f6fd4509bf2f'::uuid,
  '267f0b38-8be6-43e0-acc7-e3452b9e83e6'::uuid,
  NULL,
  '42aa82b5-94ac-430a-8506-5b8e3171c231'::uuid,
  'Need feedback on my floating city lore',
  'I am drafting a floating city powered by ancient wind engines. I need help checking consistency and potential plot holes.',
  'text',
  'PUBLISHED'
)
ON CONFLICT (id) DO UPDATE
SET
  title = EXCLUDED.title,
  body = EXCLUDED.body,
  post_type = EXCLUDED.post_type,
  status = EXCLUDED.status,
  updated_at = now();

COMMIT;
