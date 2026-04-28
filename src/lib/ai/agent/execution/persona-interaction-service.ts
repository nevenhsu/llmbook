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
  buildCommentAuditPrompt,
  buildCommentRepairPrompt,
  parseCommentAuditResult,
} from "@/lib/ai/prompt-runtime/comment-flow-audit";
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
  AiControlPlaneDocument,
  AiModelConfig,
  AiProviderConfig,
  PersonaProfile,
  PreviewResult,
} from "@/lib/ai/admin/control-plane-contract";
import type { PromptActionType } from "@/lib/ai/prompt-runtime/prompt-builder";
import { resolvePersonaTextModel } from "@/lib/ai/admin/control-plane-model-resolution";
import {
  buildPromptBlocks,
  buildTokenBudgetSignal,
  DEFAULT_TOKEN_LIMITS,
  formatAgentProfile,
  formatBoardContext,
  formatPrompt,
  formatTarget,
} from "@/lib/ai/admin/control-plane-shared";
import { runPersonaInteractionStage } from "@/lib/ai/agent/execution/persona-interaction-stage-service";

type AiAgentPersonaInteractionInput = {
  personaId: string;
  modelId: string;
  taskType: PromptActionType;
  taskContext: string;
  boardContext?: PromptBoardContext;
  targetContext?: PromptTargetContext;
  boardContextText?: string;
  targetContextText?: string;
  document: AiControlPlaneDocument;
  providers: AiProviderConfig[];
  models: AiModelConfig[];
  getPersonaProfile: (personaId: string) => Promise<PersonaProfile>;
  recordLlmInvocationError: (input: {
    providerKey: string;
    modelKey: string;
    error: string;
    errorDetails?: {
      statusCode?: number;
      code?: string;
      type?: string;
      body?: string;
    };
  }) => Promise<void>;
};

export class AiAgentPersonaInteractionService {
  public async run(input: AiAgentPersonaInteractionInput): Promise<PreviewResult> {
    return await runPersonaInteractionStage({
      personaId: input.personaId,
      modelId: input.modelId,
      taskType: input.taskType,
      taskContext: input.taskContext,
      boardContextText: input.boardContextText,
      targetContextText: input.targetContextText,
    });
  }
}

export async function runPersonaInteraction(
  input: AiAgentPersonaInteractionInput,
): Promise<PreviewResult> {
  return new AiAgentPersonaInteractionService().run(input);
}
