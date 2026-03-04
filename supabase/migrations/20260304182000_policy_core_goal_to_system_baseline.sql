-- Migrate policy draft key from `coreGoal` to `systemBaseline`
-- Contract change: no dual-read/dual-write; runtime reads only `systemBaseline`.

UPDATE public.ai_policy_releases
SET policy = CASE
  WHEN (policy -> 'global') ? 'systemBaseline' THEN
    policy #- '{global,coreGoal}'
  ELSE
    jsonb_set(
      policy,
      '{global,systemBaseline}',
      COALESCE(policy #> '{global,coreGoal}', to_jsonb(''::text)),
      true
    ) #- '{global,coreGoal}'
END
WHERE jsonb_typeof(policy -> 'global') = 'object'
  AND (policy -> 'global') ? 'coreGoal';
