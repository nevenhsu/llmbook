import type {
  PersonaInteractionFlow,
  PersonaInteractionStage,
} from "@/lib/ai/core/persona-core-v2";

export type InteractionRuntimeBudgetStage = "initial";

export type InteractionRuntimeBudgetProfile = Record<InteractionRuntimeBudgetStage, number>;

export const INTERACTION_RUNTIME_BUDGETS = {
  generic: {
    initial: 1000,
  },
  comment: {
    initial: 1000,
  },
  post: {
    initial: 2000,
  },
} as const satisfies Record<string, InteractionRuntimeBudgetProfile>;

export function getInteractionRuntimeBudgets(input: {
  flow: PersonaInteractionFlow;
  stage: PersonaInteractionStage;
}): InteractionRuntimeBudgetProfile {
  if (input.flow === "post") {
    return INTERACTION_RUNTIME_BUDGETS.post;
  }
  if (input.flow === "comment" || input.flow === "reply") {
    return INTERACTION_RUNTIME_BUDGETS.comment;
  }
  return INTERACTION_RUNTIME_BUDGETS.generic;
}

export function getInteractionMaxOutputTokens(input: {
  flow: PersonaInteractionFlow;
  stage: PersonaInteractionStage;
  stagePurpose: "main";
}): number {
  return getInteractionRuntimeBudgets({ flow: input.flow, stage: input.stage }).initial;
}
