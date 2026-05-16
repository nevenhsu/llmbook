import { getInteractionMaxOutputTokens } from "@/lib/ai/prompt-runtime/runtime-budgets";
import { createDbBackedLlmProviderRegistry } from "@/lib/ai/llm/default-registry";
import { invokeStructuredLLM } from "@/lib/ai/llm/invoke-structured-llm";
import { resolveLlmInvocationConfig } from "@/lib/ai/llm/runtime-config-provider";
import { parsePersonaCoreV2 } from "@/lib/ai/core/persona-core-v2";
import type { z } from "zod";
import {
  buildPersonaPacketForPrompt,
} from "@/lib/ai/prompt-runtime/persona-runtime-packets";
import type {
  ContentMode,
  PersonaCoreV2,
  PersonaFlowStage,
  PersonaInteractionFlow,
  PersonaInteractionStage,
} from "@/lib/ai/core/persona-core-v2";
import {
  buildPersonaPromptFamilyV2,
  type PersonaPromptFamilyV2StagePurpose,
} from "@/lib/ai/prompt-runtime/persona-v2-prompt-family";
import {
  buildOutputContractV2,
  PostPlanOutputSchema,
  PostFrameSchema,
  PostBodyOutputSchema,
  CommentOutputSchema,
  ReplyOutputSchema,
  getFlowSchemaMeta,
  type SchemaMetadata,
} from "@/lib/ai/prompt-runtime/persona-v2-flow-contracts";
import {
  buildTokenBudgetSignal,
  DEFAULT_TOKEN_LIMITS,
  formatPrompt,
} from "@/lib/ai/admin/control-plane-shared";
import { formatBoardContext, formatTargetContext } from "@/lib/ai/admin/control-plane-shared";
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

export type PersonaInteractionStagePurpose = "main";

export type PersonaInteractionStageResult = {
  assembledPrompt: string;
  rawText: string;
  finishReason: string | null;
  tokenBudget: PreviewResult["tokenBudget"];
  providerId: string | null;
  modelId: string | null;
  debugRecord?: StageDebugRecord;
  object?: unknown;
};

export type PersonaInteractionStageExecutionMode = "admin_preview" | "runtime";

export type PersonaInteractionStageInput = {
  personaId: string;
  modelId: string;
  flow: PersonaInteractionFlow;
  stage: PersonaInteractionStage;
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

function resolveStageSchema(flowStage: PersonaFlowStage): z.ZodTypeAny | undefined {
  switch (flowStage.stage) {
    case "post_plan":
      return PostPlanOutputSchema;
    case "post_frame":
      return PostFrameSchema;
    case "post_body":
      return PostBodyOutputSchema;
    case "comment_body":
      return CommentOutputSchema;
    case "reply_body":
      return ReplyOutputSchema;
    default:
      return undefined;
  }
}

function buildV2Blocks(input: {
  input: PersonaInteractionStageInput;
  personaCore: PersonaCoreV2;
  contentMode: ContentMode;
  personaPacket: ReturnType<typeof buildPersonaPacketForPrompt>;
  personaPacketText: string;
}): Array<{ name: string; content: string }> {
  if (!input.personaPacket) {
    return buildLeanStageBlocks({
      document: input.input.document,
      taskContext: input.input.taskContext,
    });
  }

  const boardContextText =
    input.input.boardContextText ?? formatBoardContext(input.input.boardContext);
  const targetContextText =
    input.input.targetContextText ??
    formatTargetContext({
      targetContext: input.input.targetContext,
    });

  const result = buildPersonaPromptFamilyV2({
    flow: input.input.flow,
    stage: input.input.stage,
    contentMode: input.contentMode,
    stagePurpose: input.input.stagePurpose as PersonaPromptFamilyV2StagePurpose,
    systemBaseline: input.input.document.globalPolicyDraft.systemBaseline,
    globalPolicy: [
      "Policy:",
      input.input.document.globalPolicyDraft.globalPolicy,
      "Forbidden:",
      input.input.document.globalPolicyDraft.forbiddenRules,
    ].join("\n"),
    personaPacket: input.personaPacket,
    boardContext: boardContextText || null,
    targetContext: targetContextText || null,
    taskContext: input.input.taskContext,
    outputContract: buildOutputContractV2({
      flow: input.input.flow,
      stage: input.input.stage,
      contentMode: input.contentMode,
    }),
  });

  return result.blocks.map((block) => ({
    name: block.name,
    content: block.content,
  }));
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
      includeDeepSeek: true,
    });

    const profile = await input.getPersonaProfile(input.personaId);
    const effectivePersonaCore = profile.personaCore as Record<string, unknown>;
    const contentMode = input.contentMode ?? "discussion";
    const flowStage: PersonaFlowStage = { flow: input.flow, stage: input.stage };

    const { core: personaCore } = parsePersonaCoreV2(effectivePersonaCore);

    const personaPacket = buildPersonaPacketForPrompt({
      flow: input.flow,
      stage: input.stage,
      stagePurpose: input.stagePurpose,
      contentMode,
      personaId: input.personaId,
      displayName: profile.persona.display_name,
      core: personaCore,
    });

    const personaPacketText = personaPacket?.renderedText ?? "";

    const maxOutputTokens = getInteractionMaxOutputTokens({
      flow: input.flow,
      stage: input.stage,
      stagePurpose: input.stagePurpose,
    });

    const blocks = buildV2Blocks({
      input,
      personaCore,
      contentMode,
      personaPacket,
      personaPacketText,
    });
    const assembledPrompt = formatPrompt(blocks);
    const tokenBudget = buildTokenBudgetSignal({
      blocks,
      maxInputTokens: DEFAULT_TOKEN_LIMITS.interactionMaxInputTokens,
      maxOutputTokens,
    });

    // Main stage always uses structured invocation when a schema is resolvable
    const stageSchema = resolveStageSchema(flowStage);
    if (stageSchema) {
      const schemaMeta =
        getFlowSchemaMeta(flowStage) ??
        ({
          schemaName: "Unknown",
          allowedRepairPaths: [],
          immutablePaths: [],
        } satisfies SchemaMetadata);

      const structuredResult = await invokeStructuredLLM({
        registry,
        taskType: "generic",
        routeOverride: invocationConfig.route,
        modelInput: {
          prompt: assembledPrompt,
          maxOutputTokens: Math.min(model.maxOutputTokens ?? maxOutputTokens, maxOutputTokens),
          temperature: 0.3,
          metadata: {
            _m: {
              stagePurpose: input.stagePurpose,
              flow: input.flow,
              stage: input.stage,
              schemaName: schemaMeta.schemaName,
            },
          },
        },
        entityId: `persona-interaction-stage:${input.stagePurpose}:${model.id}`,
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
        schemaGate: {
          schemaName: schemaMeta.schemaName,
          schema: stageSchema,
          allowedRepairPaths: schemaMeta.allowedRepairPaths,
          immutablePaths: schemaMeta.immutablePaths,
        },
      });

      if (structuredResult.status === "schema_failure") {
        throw new Error(structuredResult.error);
      }

      const rawText = structuredResult.raw.text.trim() || JSON.stringify(structuredResult.value);
      if (!rawText) {
        throw new Error(
          structuredResult.raw.error ??
            `persona interaction stage returned empty output (finishReason=${String(structuredResult.raw.finishReason ?? "unknown")})`,
        );
      }

      return {
        assembledPrompt,
        rawText,
        finishReason: structuredResult.raw.finishReason ?? null,
        tokenBudget,
        providerId: structuredResult.raw.providerId,
        modelId: structuredResult.raw.modelId,
        object: structuredResult.value,
        ...(input.debug
          ? {
              debugRecord: {
                name: input.attemptLabel ?? `${input.flow}:${input.stage}:${input.stagePurpose}`,
                displayPrompt: assembledPrompt,
                outputMaxTokens: Math.min(
                  model.maxOutputTokens ?? maxOutputTokens,
                  maxOutputTokens,
                ),
                attempts: [
                  {
                    attempt: input.attemptLabel ?? "attempt_1",
                    text: rawText,
                    finishReason: structuredResult.raw.finishReason ?? null,
                    providerId: structuredResult.raw.providerId,
                    modelId: structuredResult.raw.modelId,
                    hadError: false,
                    schemaGateDebug: structuredResult.schemaGateDebug,
                  },
                ],
              },
            }
          : {}),
      };
    }

    return this.invokeRawAndReturn(
      assembledPrompt,
      tokenBudget,
      maxOutputTokens,
      model,
      provider,
      invocationConfig,
      registry,
      input,
    );
  }

  private async invokeRawAndReturn(
    assembledPrompt: string,
    tokenBudget: PreviewResult["tokenBudget"],
    maxOutputTokens: number,
    model: AiModelConfig,
    provider: AiProviderConfig,
    invocationConfig: Awaited<ReturnType<typeof resolveLlmInvocationConfig>>,
    registry: Awaited<ReturnType<typeof createDbBackedLlmProviderRegistry>>,
    input: PersonaInteractionStageInput,
  ): Promise<PersonaInteractionStageResult> {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    const llmResult = await invokeLLM({
      registry,
      taskType: "generic",
      routeOverride: invocationConfig.route,
      modelInput: {
        prompt: assembledPrompt,
        maxOutputTokens: Math.min(model.maxOutputTokens ?? maxOutputTokens, maxOutputTokens),
        temperature: 0.3,
      },
      entityId: `persona-interaction-stage:${input.stagePurpose}:${model.id}`,
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
      object: llmResult.object,
      ...(input.debug
        ? {
            debugRecord: {
              name: input.attemptLabel ?? `${input.flow}:${input.stage}:${input.stagePurpose}`,
              displayPrompt: assembledPrompt,
              outputMaxTokens: Math.min(model.maxOutputTokens ?? maxOutputTokens, maxOutputTokens),
              attempts: [
                {
                  attempt: input.attemptLabel ?? "attempt_1",
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
    stageDebugRecords: stageResult.debugRecord ? [stageResult.debugRecord] : undefined,
    object: stageResult.object,
  };
}
