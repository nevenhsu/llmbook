import { getInteractionMaxOutputTokens } from "@/lib/ai/prompt-runtime/runtime-budgets";
import { createDbBackedLlmProviderRegistry } from "@/lib/ai/llm/default-registry";
import { invokeLLM } from "@/lib/ai/llm/invoke-llm";
import { resolveLlmInvocationConfig } from "@/lib/ai/llm/runtime-config-provider";
import { parsePersonaCoreV2 } from "@/lib/ai/core/persona-core-v2";
import { buildPersonaPacketForPrompt } from "@/lib/ai/prompt-runtime/persona-runtime-packets";
import type { ContentMode, PersonaCoreV2 } from "@/lib/ai/core/persona-core-v2";
import {
  buildTokenBudgetSignal,
  DEFAULT_TOKEN_LIMITS,
  formatAgentProfile,
  formatBoardContext,
  formatPrompt,
  formatTargetContext,
  buildPromptBlocks,
} from "@/lib/ai/admin/control-plane-shared";
import type { StageDebugRecord } from "@/lib/ai/stage-debug-records";
import type {
  AiControlPlaneDocument,
  AiModelConfig,
  AiProviderConfig,
  PersonaProfile,
  PreviewResult,
  PromptBoardContext,
  PromptTargetContext,
} from "@/lib/ai/admin/control-plane-contract";
import { resolvePersonaTextModel } from "@/lib/ai/admin/control-plane-model-resolution";
import type { PromptActionType } from "@/lib/ai/prompt-runtime/prompt-builder";

export type PersonaInteractionStagePurpose = "main" | "schema_repair" | "audit" | "quality_repair";

export type PersonaInteractionStageResult = {
  assembledPrompt: string;
  rawText: string;
  finishReason: string | null;
  tokenBudget: PreviewResult["tokenBudget"];
  providerId: string | null;
  modelId: string | null;
  debugRecord?: StageDebugRecord;
};

export type PersonaInteractionStageExecutionMode = "admin_preview" | "runtime";

export type PersonaInteractionStageInput = {
  personaId: string;
  modelId: string;
  taskType: PromptActionType;
  stagePurpose: PersonaInteractionStagePurpose;
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
  debug?: boolean;
  attemptLabel?: string;
  executionMode?: PersonaInteractionStageExecutionMode;
  contentMode?: ContentMode;
};

function buildLeanStageBlocks(input: {
  document: AiControlPlaneDocument;
  taskContext: string;
}): Array<{ name: string; content: string }> {
  return [
    {
      name: "system_baseline",
      content: input.document.globalPolicyDraft.systemBaseline.trim() || "(not set)",
    },
    {
      name: "global_policy",
      content: [
        "Policy:",
        input.document.globalPolicyDraft.globalPolicy,
        "Forbidden:",
        input.document.globalPolicyDraft.forbiddenRules,
      ].join("\n"),
    },
    {
      name: "task_context",
      content: input.taskContext,
    },
  ];
}

export class AiAgentPersonaInteractionStageService {
  public async runStage(
    input: PersonaInteractionStageInput,
  ): Promise<PersonaInteractionStageResult> {
    const { model, provider } = resolvePersonaTextModel({
      modelId: input.modelId,
      models: input.models,
      providers: input.providers,
      featureLabel: "persona interaction stage",
    });
    const invocationConfig = await resolveLlmInvocationConfig({
      taskType: "generic",
      capability: "text_generation",
      promptModality: "text_only",
      targetOverride: {
        providerId: provider.providerKey,
        modelId: model.modelKey,
      },
    });
    const registry = await createDbBackedLlmProviderRegistry({
      includeMock: true,
      includeXai: true,
      includeMinimax: true,
    });

    const profile = await input.getPersonaProfile(input.personaId);
    const effectivePersonaCore = profile.personaCore as Record<string, unknown>;
    const contentMode = input.contentMode ?? "discussion";

    const { core: personaCore } = parsePersonaCoreV2(effectivePersonaCore);

    const personaPacket = buildPersonaPacketForPrompt({
      taskType: input.taskType,
      stagePurpose: input.stagePurpose,
      contentMode,
      personaId: input.personaId,
      displayName: profile.persona.display_name,
      core: personaCore,
    });

    const personaPacketText = personaPacket?.renderedText ?? "";

    const includeExpandedContext =
      input.stagePurpose === "main" || input.stagePurpose === "schema_repair";

    const maxOutputTokens = getInteractionMaxOutputTokens({
      actionType: input.taskType,
      stagePurpose: input.stagePurpose,
    });

    const blocks = includeExpandedContext
      ? buildPromptBlocks({
          actionType: input.taskType,
          globalDraft: input.document.globalPolicyDraft,
          outputStyle: input.document.globalPolicyDraft.styleGuide,
          agentProfile: formatAgentProfile({
            displayName: profile.persona.display_name,
            username: profile.persona.username,
            bio: profile.persona.bio,
          }),
          plannerMode:
            input.taskType === "post_plan"
              ? "This stage is planning and scoring, not final writing."
              : undefined,
          agentCore: personaPacketText,
          boardContext: input.boardContextText ?? formatBoardContext(input.boardContext),
          targetContext:
            input.targetContextText ??
            formatTargetContext({
              taskType: input.taskType,
              targetContext: input.targetContext,
            }),
          taskContext: input.taskContext,
        })
      : buildLeanStageBlocks({
          document: input.document,
          taskContext: input.taskContext,
        });
    const assembledPrompt = formatPrompt(blocks);
    const tokenBudget = buildTokenBudgetSignal({
      blocks,
      maxInputTokens: DEFAULT_TOKEN_LIMITS.interactionMaxInputTokens,
      maxOutputTokens,
    });

    const llmResult = await invokeLLM({
      registry,
      taskType: "generic",
      routeOverride: invocationConfig.route,
      modelInput: {
        prompt: assembledPrompt,
        maxOutputTokens: Math.min(model.maxOutputTokens ?? maxOutputTokens, maxOutputTokens),
        temperature: input.stagePurpose === "audit" ? 0 : 0.3,
      },
      entityId: `persona-interaction-stage:${model.id}`,
      timeoutMs: invocationConfig.timeoutMs,
      retries: input.executionMode === "admin_preview" ? 0 : (invocationConfig.retries ?? 0),
      onProviderError: async (event) => {
        await input.recordLlmInvocationError({
          providerKey: event.providerId,
          modelKey: event.modelId,
          error: event.error,
          errorDetails: event.errorDetails,
        });
      },
    });

    const rawText = llmResult.text.trim();
    if (!rawText) {
      throw new Error(
        llmResult.error ??
          `persona interaction stage returned empty output (finishReason=${String(llmResult.finishReason ?? "unknown")})`,
      );
    }

    return {
      assembledPrompt,
      rawText,
      finishReason: llmResult.finishReason ?? null,
      tokenBudget,
      providerId: llmResult.providerId,
      modelId: llmResult.modelId,
      ...(input.debug
        ? {
            debugRecord: {
              name: input.attemptLabel ?? `${input.taskType}:${input.stagePurpose}`,
              displayPrompt: assembledPrompt,
              outputMaxTokens: Math.min(model.maxOutputTokens ?? maxOutputTokens, maxOutputTokens),
              attempts: [
                {
                  attempt: input.attemptLabel ?? `attempt_1`,
                  text: rawText,
                  finishReason: llmResult.finishReason ?? null,
                  providerId: llmResult.providerId,
                  modelId: llmResult.modelId,
                  hadError: false,
                },
              ],
            },
          }
        : {}),
    };
  }
}

export async function runPersonaInteractionStage(
  input: Omit<PersonaInteractionStageInput, "stagePurpose"> & {
    stagePurpose?: PersonaInteractionStagePurpose;
    debug?: boolean;
    attemptLabel?: string;
  },
): Promise<PreviewResult> {
  const stageService = new AiAgentPersonaInteractionStageService();
  const stageResult = await stageService.runStage({
    ...input,
    stagePurpose: input.stagePurpose ?? "main",
    debug: input.debug,
    attemptLabel: input.attemptLabel,
  });

  return {
    assembledPrompt: stageResult.assembledPrompt,
    markdown: stageResult.rawText,
    rawResponse: stageResult.rawText,
    renderOk: true,
    renderError: null,
    tokenBudget: stageResult.tokenBudget,
    auditDiagnostics: null,
    stageDebugRecords: stageResult.debugRecord ? [stageResult.debugRecord] : undefined,
  };
}
