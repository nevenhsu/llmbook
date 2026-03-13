export const PERSONA_GENERATION_MAX_INPUT_TOKENS = 2800;
export const PERSONA_GENERATION_MAX_OUTPUT_TOKENS = 1200;

export const PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS = {
  seed: 850,
  values_and_aesthetic: 850,
  context_and_affinity: 850,
  interaction_and_guardrails: 700,
  memories: 600,
  repairRetryCap: 650,
  compactRetryCap: 500,
} as const;

export const PERSONA_GENERATION_PREVIEW_MAX_OUTPUT_TOKENS =
  PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.seed +
  PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.values_and_aesthetic +
  PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.context_and_affinity +
  PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.interaction_and_guardrails +
  PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.memories;
