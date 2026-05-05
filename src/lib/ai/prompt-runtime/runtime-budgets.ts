import type { PromptActionType } from "@/lib/ai/prompt-runtime/prompt-builder";

export type InteractionRuntimeBudgetStage =
  | "initial"
  | "schemaRepair"
  | "personaAudit"
  | "compactPersonaAudit"
  | "personaRepair";

export type InteractionRuntimeBudgetProfile = Record<InteractionRuntimeBudgetStage, number>;
export type InteractionStageBudgetProfile =
  | "post_plan_audit"
  | "post_body_audit"
  | "comment_audit"
  | "reply_audit"
  | "text_schema_repair"
  | "text_quality_repair";

export const INTERACTION_RUNTIME_BUDGETS = {
  generic: {
    initial: 1000,
    schemaRepair: 1000,
    personaAudit: 1000,
    compactPersonaAudit: 1200,
    personaRepair: 1800,
  },
  comment: {
    initial: 1000,
    schemaRepair: 1000,
    personaAudit: 1000,
    compactPersonaAudit: 1200,
    personaRepair: 1800,
  },
  post: {
    initial: 2000,
    schemaRepair: 2000,
    personaAudit: 1000,
    compactPersonaAudit: 1200,
    personaRepair: 1800,
  },
} as const satisfies Record<string, InteractionRuntimeBudgetProfile>;

export const INTERACTION_STAGE_BUDGETS = {
  post_plan_audit: 900,
  post_body_audit: 900,
  comment_audit: 900,
  reply_audit: 900,
  text_schema_repair: 1600,
  text_quality_repair: 1400,
} as const satisfies Record<InteractionStageBudgetProfile, number>;

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
  stagePurpose: "main" | "schema_repair" | "audit" | "quality_repair";
}): number {
  if (input.stagePurpose === "schema_repair") {
    return INTERACTION_STAGE_BUDGETS.text_schema_repair;
  }

  if (input.stagePurpose === "quality_repair") {
    return INTERACTION_STAGE_BUDGETS.text_quality_repair;
  }

  if (input.stagePurpose === "audit") {
    if (input.actionType === "comment") {
      return INTERACTION_STAGE_BUDGETS.comment_audit;
    }
    if (input.actionType === "reply") {
      return INTERACTION_STAGE_BUDGETS.reply_audit;
    }
    if (input.actionType === "post_plan") {
      return INTERACTION_STAGE_BUDGETS.post_plan_audit;
    }
    return INTERACTION_STAGE_BUDGETS.post_body_audit;
  }

  return getInteractionRuntimeBudgets(input.actionType).initial;
}
