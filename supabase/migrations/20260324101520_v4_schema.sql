-- Migration 20260324101520_v4_schema.sql
-- Clean up unnecessary tables and implement AI Persona Agent v4 schema.

-- 1. Drop old unused tables
DROP TABLE IF EXISTS public.task_idempotency_keys CASCADE;
DROP TABLE IF EXISTS public.ai_review_events CASCADE;
DROP TABLE IF EXISTS public.ai_review_queue CASCADE;
DROP TABLE IF EXISTS public.ai_runtime_events CASCADE;
DROP TABLE IF EXISTS public.ai_worker_status CASCADE;
DROP TABLE IF EXISTS public.persona_llm_usage CASCADE;
DROP TABLE IF EXISTS public.persona_engine_config CASCADE;

-- 2. Modify media table for v4
ALTER TABLE public.media
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN url DROP NOT NULL,
  ALTER COLUMN mime_type DROP NOT NULL,
  ALTER COLUMN width DROP NOT NULL,
  ALTER COLUMN height DROP NOT NULL,
  ALTER COLUMN size_bytes DROP NOT NULL,
  ADD COLUMN persona_id uuid REFERENCES public.personas(id) ON DELETE CASCADE,
  ADD COLUMN comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  ADD COLUMN status text NOT NULL DEFAULT 'DONE',
  ADD COLUMN image_prompt text;

-- Add checking constraints to media
ALTER TABLE public.media
  ADD CONSTRAINT media_author_check CHECK (
    (user_id IS NOT NULL AND persona_id IS NULL) OR
    (user_id IS NULL AND persona_id IS NOT NULL)
  ),
  ADD CONSTRAINT media_status_chk CHECK (
    status IN ('PENDING_GENERATION', 'RUNNING', 'DONE', 'FAILED')
  );

-- 3. Update task_intents constraints
ALTER TABLE public.task_intents
  DROP CONSTRAINT task_intents_type_check;

ALTER TABLE public.task_intents
  ADD CONSTRAINT task_intents_type_check CHECK (intent_type IN ('reply', 'vote', 'poll_vote', 'post', 'comment'));

-- 4. Create new v4 tables
CREATE TABLE public.ai_agent_config (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_global_usage (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  window_start           timestamptz NOT NULL,
  window_end             timestamptz,
  text_prompt_tokens     bigint NOT NULL DEFAULT 0,
  text_completion_tokens bigint NOT NULL DEFAULT 0,
  image_generation_count int    NOT NULL DEFAULT 0,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.orchestrator_run_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at            timestamptz NOT NULL DEFAULT now(),
  snapshot_from     timestamptz NOT NULL,
  snapshot_to       timestamptz NOT NULL,
  comments_injected int NOT NULL DEFAULT 0,
  posts_injected    int NOT NULL DEFAULT 0,
  skipped_reason    text,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.persona_memory_compress_status (
  persona_id       uuid PRIMARY KEY REFERENCES public.personas(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'PENDING_CHECK',
  last_checked_at  timestamptz,
  last_token_count int,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pmcs_status_chk CHECK (
    status IN ('PENDING_CHECK','NO_COMPRESS_NEEDED','COMPRESSING','COMPRESSED')
  )
);

-- 5. Enable RLS on new tables
ALTER TABLE public.ai_agent_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_global_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orchestrator_run_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_memory_compress_status ENABLE ROW LEVEL SECURITY;

-- 6. Default config data
INSERT INTO public.ai_agent_config (key, value, description)
VALUES
  ('orchestrator_interval_minutes', '5', 'Orchestrator 執行頻率'),
  ('max_comments_per_cycle', '5', '單次最多 comment tasks'),
  ('max_posts_per_cycle', '2', '單次最多 post tasks'),
  ('llm_daily_token_quota', '500000', '全局每日 text token 上限'),
  ('llm_daily_image_quota', '50', '全局每日圖片生成次數上限'),
  ('usage_reset_hour', '0', '每日 usage 重置時間（UTC hour，0 = 午夜）'),
  ('telegram_bot_token', '', 'Telegram Bot Token（未建立時留空）'),
  ('telegram_alert_chat_id', '', 'Telegram alert chat ID'),
  ('memory_compress_interval_hours', '6', 'Memory compressor 執行週期'),
  ('memory_compress_token_threshold', '2500', '壓縮觸發 token 上限')
ON CONFLICT (key) DO NOTHING;
