-- Persona Engine Schema Migration
-- Generated from plans/persona-engine/ai-persona-design.md
-- Date: 2026-02-10

-- Enable pgvector extension (required for persona_long_memories)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- ALTER existing tables
-- ============================================================================

-- Add status column to personas table
ALTER TABLE public.personas
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Add comment for status column
COMMENT ON COLUMN public.personas.status IS 'active | retired | suspended';

-- Add columns to persona_tasks table
ALTER TABLE public.persona_tasks
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS retry_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries int DEFAULT 3,
  ADD COLUMN IF NOT EXISTS result_id uuid,
  ADD COLUMN IF NOT EXISTS result_type text;

-- Rename metadata to context_data in persona_memory table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'persona_memory'
      AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.persona_memory RENAME COLUMN metadata TO context_data;
  END IF;
END $$;

-- Drop modules column from personas table (data migration should happen first if needed)
-- Uncomment when ready to migrate data to persona_souls:
-- ALTER TABLE public.personas DROP COLUMN IF EXISTS modules;

-- ============================================================================
-- CREATE new tables
-- ============================================================================

-- Persona Souls (complete soul definition)
CREATE TABLE IF NOT EXISTS public.persona_souls (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id            uuid NOT NULL UNIQUE REFERENCES public.personas(id) ON DELETE CASCADE,

  -- Immutable core (admin manual edit only)
  identity              text NOT NULL,
  voice_style           text NOT NULL,
  knowledge_domains     jsonb NOT NULL DEFAULT '[]'::jsonb,
  personality_axes      jsonb NOT NULL DEFAULT '{}'::jsonb,
  behavioral_rules      text NOT NULL DEFAULT '',

  -- Daily batch update
  emotional_baseline    jsonb NOT NULL DEFAULT '{}'::jsonb,
  relationships         jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Posting preferences
  posting_preferences   jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Version tracking
  version               int NOT NULL DEFAULT 1,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- Indexes for persona_souls
CREATE INDEX IF NOT EXISTS idx_persona_souls_persona ON public.persona_souls(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_souls_domains ON public.persona_souls USING gin (knowledge_domains);

-- RLS for persona_souls
ALTER TABLE public.persona_souls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Persona souls are viewable by everyone" ON public.persona_souls;

CREATE POLICY "Persona souls are viewable by everyone"
  ON public.persona_souls FOR SELECT
  USING (true);

-- Persona Long-term Memories (with pgvector)
CREATE TABLE IF NOT EXISTS public.persona_long_memories (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id          uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  content             text NOT NULL,
  content_tsv         tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
  embedding           vector(1536),
  importance          real NOT NULL DEFAULT 0.5,
  memory_category     text NOT NULL,
  related_persona_id  uuid REFERENCES public.personas(id) ON DELETE SET NULL,
  related_board_slug  text,
  source_action_id    uuid REFERENCES public.persona_tasks(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now()
);

-- Indexes for persona_long_memories
CREATE INDEX IF NOT EXISTS idx_long_mem_persona ON public.persona_long_memories(persona_id);
CREATE INDEX IF NOT EXISTS idx_long_mem_embedding ON public.persona_long_memories
  USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_long_mem_tsv ON public.persona_long_memories
  USING gin (content_tsv);
CREATE INDEX IF NOT EXISTS idx_long_mem_category ON public.persona_long_memories(persona_id, memory_category);

-- Comments for long memories
COMMENT ON COLUMN public.persona_long_memories.memory_category IS 'interaction | knowledge | opinion | relationship';
COMMENT ON COLUMN public.persona_long_memories.content_tsv IS 'Uses simple text search config. Change to chinese if Chinese word segmentation is available.';

-- RLS for persona_long_memories
ALTER TABLE public.persona_long_memories ENABLE ROW LEVEL SECURITY;
-- No public policies, service role only

-- Persona Engine Config (global key-value settings)
CREATE TABLE IF NOT EXISTS public.persona_engine_config (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  encrypted   boolean NOT NULL DEFAULT false,
  updated_at  timestamptz DEFAULT now()
);

-- RLS for persona_engine_config
ALTER TABLE public.persona_engine_config ENABLE ROW LEVEL SECURITY;
-- No public policies, service role only

-- Persona LLM Usage (cost tracking)
CREATE TABLE IF NOT EXISTS public.persona_llm_usage (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id         uuid REFERENCES public.personas(id) ON DELETE SET NULL,
  task_id            uuid REFERENCES public.persona_tasks(id) ON DELETE SET NULL,
  task_type          text NOT NULL,
  provider           text NOT NULL,
  model              text NOT NULL,
  prompt_tokens      int NOT NULL DEFAULT 0,
  completion_tokens  int NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(10, 6) NOT NULL DEFAULT 0,
  created_at         timestamptz DEFAULT now()
);

-- Indexes for persona_llm_usage
CREATE INDEX IF NOT EXISTS idx_llm_usage_monthly ON public.persona_llm_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_llm_usage_persona ON public.persona_llm_usage(persona_id, created_at DESC);

-- Comments for llm_usage
COMMENT ON COLUMN public.persona_llm_usage.task_type IS 'comment | post | vote | memory_eval | soul_update';
COMMENT ON COLUMN public.persona_llm_usage.provider IS 'gemini | kimi | deepseek | anthropic | openai';

-- RLS for persona_llm_usage
ALTER TABLE public.persona_llm_usage ENABLE ROW LEVEL SECURITY;
-- No public policies, service role only

-- ============================================================================
-- Insert default config values
-- ============================================================================

INSERT INTO public.persona_engine_config (key, value, encrypted) VALUES
  ('llm_comment', 'gemini-2.5-flash', false),
  ('llm_post', 'gemini-2.5-flash', false),
  ('llm_long_form', 'gemini-2.5-pro', false),
  ('llm_vote_decision', 'gemini-2.5-flash', false),
  ('llm_image_gen', 'gemini-2.0-flash', false),
  ('llm_memory_eval', 'gemini-2.5-flash', false),
  ('llm_soul_update', 'gemini-2.5-pro', false),
  ('fallback_text_short', 'gemini:gemini-2.5-flash,kimi:moonshot-v1-8k,deepseek:deepseek-chat', false),
  ('fallback_text_long', 'gemini:gemini-2.5-pro,deepseek:deepseek-chat,kimi:moonshot-v1-8k', false),
  ('fallback_image', 'gemini:gemini-2.0-flash', false),
  ('fallback_system', 'gemini:gemini-2.5-flash,deepseek:deepseek-chat,kimi:moonshot-v1-8k', false),
  ('monthly_budget_usd', '50', false)
ON CONFLICT (key) DO NOTHING;
