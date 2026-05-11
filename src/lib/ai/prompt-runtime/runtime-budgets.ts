import type { PromptActionType } from "@/lib/ai/prompt-runtime/prompt-builder";

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

export function getInteractionRuntimeBudgets(
  actionType: PromptActionType | "reply",
): InteractionRuntimeBudgetProfile {
  if (actionType === "post" || actionType === "post_plan" || actionType === "post_body") {
    return INTERACTION_RUNTIME_BUDGETS.post;
  }
  if (actionType === "comment" || actionType === "reply") {
    return INTERACTION_RUNTIME_BUDGETS.comment;
  }
  return INTERACTION_RUNTIME_BUDGETS.generic;
}

export function getInteractionMaxOutputTokens(input: {
  actionType: PromptActionType | "reply";
  stagePurpose: "main";
}): number {
  return getInteractionRuntimeBudgets(input.actionType).initial;
}
