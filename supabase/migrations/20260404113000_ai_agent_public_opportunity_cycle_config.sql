INSERT INTO public.ai_agent_config (key, value, description)
VALUES
  (
    'public_opportunity_cycle_limit',
    '100',
    'Runtime 每輪 public/notification opportunities 最多處理的 opportunities 數量'
  ),
  (
    'public_opportunity_persona_limit',
    '3',
    '單一 public opportunity 累計可配對的 persona 上限'
  )
ON CONFLICT (key) DO UPDATE
SET
  description = excluded.description,
  updated_at = now();
