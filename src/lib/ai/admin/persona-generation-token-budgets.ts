export const PERSONA_GENERATION_MAX_INPUT_TOKENS = 2800;
export const PERSONA_GENERATION_MAX_OUTPUT_TOKENS = 1800;

export const PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS = {
  seed: 1200,
  values_and_aesthetic: 1200,
  context_and_affinity: 1200,
  interaction_and_guardrails: 1500,
  memories: 900,
  repairRetryCap: 1400,
  compactRetryCap: 1100,
  qualityRepairCap: 1500,
} as const;

export const PERSONA_GENERATION_PREVIEW_MAX_OUTPUT_TOKENS =
  PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.seed +
  PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.values_and_aesthetic +
  PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.context_and_affinity +
  PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.interaction_and_guardrails +
  PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.memories;
