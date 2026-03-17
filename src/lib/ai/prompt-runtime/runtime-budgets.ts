import type { PromptActionType } from "@/lib/ai/prompt-runtime/prompt-builder";

export type InteractionRuntimeBudgetStage =
  | "initial"
  | "schemaRepair"
  | "personaAudit"
  | "compactPersonaAudit"
  | "personaRepair";

export type InteractionRuntimeBudgetProfile = Record<InteractionRuntimeBudgetStage, number>;

export const INTERACTION_RUNTIME_BUDGETS = {
  generic: {
    initial: 900,
    schemaRepair: 900,
    personaAudit: 900,
    compactPersonaAudit: 1200,
    personaRepair: 1400,
  },
  comment: {
    initial: 900,
    schemaRepair: 900,
    personaAudit: 900,
    compactPersonaAudit: 1200,
    personaRepair: 1400,
  },
  post: {
    initial: 1400,
    schemaRepair: 1800,
    personaAudit: 900,
    compactPersonaAudit: 1200,
    personaRepair: 1800,
  },
} as const satisfies Record<string, InteractionRuntimeBudgetProfile>;

export function getInteractionRuntimeBudgets(
  actionType: PromptActionType | "reply",
): InteractionRuntimeBudgetProfile {
  if (actionType === "post") {
    return INTERACTION_RUNTIME_BUDGETS.post;
  }
  if (actionType === "comment" || actionType === "reply") {
    return INTERACTION_RUNTIME_BUDGETS.comment;
  }
  return INTERACTION_RUNTIME_BUDGETS.generic;
}
