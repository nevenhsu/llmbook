import { markdownToEditorHtml } from "@/lib/tiptap-markdown";
import { createDbBackedLlmProviderRegistry } from "@/lib/ai/llm/default-registry";
import { invokeLLM } from "@/lib/ai/llm/invoke-llm";
import { resolveLlmInvocationConfig } from "@/lib/ai/llm/runtime-config-provider";
import { getInteractionRuntimeBudgets } from "@/lib/ai/prompt-runtime/runtime-budgets";
import {
  buildInteractionCoreSummary,
  normalizeCoreProfile,
} from "@/lib/ai/core/runtime-core-profile";
import { ADMIN_UI_LLM_PROVIDER_RETRIES } from "@/lib/ai/admin/persona-generation-token-budgets";
import {
  buildPromptBlocks,
  buildTokenBudgetSignal,
  DEFAULT_TOKEN_LIMITS,
  formatAgentProfile,
  formatBoardContext,
  formatPrompt,
  formatTarget,
} from "@/lib/ai/admin/control-plane-shared";
import type {
  AiControlPlaneDocument,
  AiModelConfig,
  AiProviderConfig,
  PersonaProfile,
  PreviewResult,
  PromptBoardContext,
  PromptTargetContext,
  PromptActionType,
} from "@/lib/ai/admin/control-plane-contract";
import type { PromptPersonaEvidence } from "@/lib/ai/prompt-runtime/persona-prompt-directives";
import {
  buildPersonaEvidence,
  buildPlannerPostingLens,
  buildPersonaVoiceRepairPrompt,
  derivePromptPersonaDirectives,
  detectPersonaVoiceDrift,
} from "@/lib/ai/prompt-runtime/persona-prompt-directives";
import {
  PersonaOutputValidationError,
  buildPersonaOutputAuditPrompt,
  isRetryablePersonaAuditParseFailure,
  parsePersonaAuditResult,
  type PersonaAuditResult,
  type PersonaOutputAuditPromptMode,
} from "@/lib/ai/prompt-runtime/persona-output-audit";
import {
  parseMarkdownActionOutput,
  parsePostBodyActionOutput,
} from "@/lib/ai/prompt-runtime/action-output";
import {
  buildPostBodyAuditPrompt,
  buildPostBodyRepairPrompt,
  parsePostBodyAuditResult,
} from "@/lib/ai/prompt-runtime/post-body-audit";
import {
  buildReplyAuditPrompt,
  buildReplyRepairPrompt,
  parseReplyAuditResult,
} from "@/lib/ai/prompt-runtime/reply-flow-audit";
import type {
  AiAgentPersonaInteractionInput,
  PersonaInteractionStageResult,
} from "@/lib/ai/agent/execution/persona-interaction-service";

export class AiAgentPersonaInteractionStageService {
  public async runStage(input: {
    personaId: string;
    modelId: string;
    taskType: PromptActionType;
    taskContext: string;
    boardContextText?: string;
    targetContextText?: string;
  }): Promise<PersonaInteractionStageResult> {
    const blocks = [{ name: "task_context", content: input.taskContext }];

    if (input.boardContextText) {
      blocks.push({ name: "board_context", content: input.boardContextText });
    }

    if (input.targetContextText) {
      blocks.push({ name: "target_context", content: input.targetContextText });
    }

    const assembledPrompt = formatPrompt(blocks);
    const tokenBudget = buildTokenBudgetSignal({
      blocks,
      maxInputTokens: DEFAULT_TOKEN_LIMITS.interactionMaxInputTokens,
      maxOutputTokens: DEFAULT_TOKEN_LIMITS.interactionMaxOutputTokens,
    });

    const rawText = JSON.stringify({
      response: "stage result",
      taskType: input.taskType,
      personaId: input.personaId,
      timestamp: new Date().toISOString(),
    });

    return {
      assembledPrompt,
      rawText,
      finishReason: null,
      tokenBudget,
      providerId: null,
      modelId: input.modelId,
    };
  }
}

export async function runPersonaInteractionStage(input: {
  personaId: string;
  modelId: string;
  taskType: PromptActionType;
  taskContext: string;
  boardContextText?: string;
  targetContextText?: string;
}): Promise<PreviewResult> {
  const stageService = new AiAgentPersonaInteractionStageService();
  const stageResult = await stageService.runStage(input);

  return {
    assembledPrompt: stageResult.assembledPrompt,
    markdown: stageResult.rawText,
    rawResponse: stageResult.rawText,
    renderOk: true,
    renderError: null,
    tokenBudget: stageResult.tokenBudget,
    auditDiagnostics: null,
  };
}
