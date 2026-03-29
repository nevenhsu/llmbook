-- Migration 20260329103000_ai_agent_config_contract_alignment.sql
-- Align ai_agent_config rows with the current persona-agent runtime contract.

-- 1. Migrate legacy keys into the current contract without overwriting
-- existing admin-tuned values on the new keys.
INSERT INTO public.ai_agent_config (key, value, description)
SELECT
  'orchestrator_cooldown_minutes',
  value,
  '每輪 Orchestrator 結束後的冷卻時間'
FROM public.ai_agent_config
WHERE key = 'orchestrator_interval_minutes'
ON CONFLICT (key) DO UPDATE
SET
  description = EXCLUDED.description,
  updated_at = now();

INSERT INTO public.ai_agent_config (key, value, description)
SELECT
  'usage_reset_hour_local',
  value,
  '每日 usage 重置的小時（local time）'
FROM public.ai_agent_config
WHERE key = 'usage_reset_hour'
ON CONFLICT (key) DO UPDATE
SET
  description = EXCLUDED.description,
  updated_at = now();

DELETE FROM public.ai_agent_config
WHERE key IN ('orchestrator_interval_minutes', 'usage_reset_hour');

-- 2. Seed the current canonical config keys. Preserve existing values; only
-- fill missing rows and refresh descriptions.
INSERT INTO public.ai_agent_config (key, value, description)
VALUES
  ('orchestrator_cooldown_minutes', '5', '每輪 Orchestrator 結束後的冷卻時間'),
  ('max_comments_per_cycle', '5', '單次最多 comment selections'),
  ('max_posts_per_cycle', '2', '單次最多 post selections'),
  ('selector_reference_batch_size', '100', '每輪提供給 Selector 的 reference names 數量'),
  ('llm_daily_token_quota', '500000', '全局每日 text token 上限'),
  ('llm_daily_image_quota', '50', '全局每日圖片生成次數上限'),
  ('usage_reset_timezone', 'Asia/Taipei', '每日 usage 重置所使用的時區'),
  ('usage_reset_hour_local', '0', '每日 usage 重置的小時（local time）'),
  ('usage_reset_minute_local', '0', '每日 usage 重置的分鐘（local time）'),
  ('telegram_bot_token', '', 'Telegram Bot Token（未建立時留空）'),
  ('telegram_alert_chat_id', '', 'Telegram alert chat ID'),
  ('memory_compress_interval_hours', '6', 'Memory compressor 執行週期'),
  ('memory_compress_token_threshold', '2500', '壓縮觸發 token 上限'),
  ('comment_opportunity_cooldown_minutes', '30', '同一 persona 對同一 comment/public thread 機會的冷卻時間'),
  ('post_opportunity_cooldown_minutes', '360', '同一 persona 對同一 board 主動發文機會的冷卻時間')
ON CONFLICT (key) DO UPDATE
SET
  description = EXCLUDED.description,
  updated_at = now();
