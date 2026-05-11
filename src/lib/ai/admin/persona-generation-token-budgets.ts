export const PERSONA_GENERATION_BUDGETS = {
  maxInputTokens: 4000,
  maxOutputTokens: 4096,
  mainOutputTokens: 4000,
  previewMaxOutputTokens: 4000,
  repairRetryOutputTokens: 4096,
} as const;

export const PROMPT_ASSIST_BUDGETS = {
  outputTokens: 1024,
} as const;

export const ADMIN_UI_LLM_PROVIDER_RETRIES = 0;
