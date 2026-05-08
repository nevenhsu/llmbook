import { getInteractionMaxOutputTokens } from "@/lib/ai/prompt-runtime/runtime-budgets";
import { createDbBackedLlmProviderRegistry } from "@/lib/ai/llm/default-registry";
import { invokeStructuredLLM } from "@/lib/ai/llm/invoke-structured-llm";
import { resolveLlmInvocationConfig } from "@/lib/ai/llm/runtime-config-provider";
import { parsePersonaCoreV2 } from "@/lib/ai/core/persona-core-v2";
import { buildPersonaPacketForPrompt } from "@/lib/ai/prompt-runtime/persona-runtime-packets";
import type { ContentMode, PersonaFlowKind, PersonaCoreV2 } from "@/lib/ai/core/persona-core-v2";
import {
  buildPersonaPromptFamilyV2,
  buildActionModePolicy,
  buildContentModePolicy,
  buildAntiGenericContract,
  type PersonaPromptFamilyV2StagePurpose,
} from "@/lib/ai/prompt-runtime/persona-v2-prompt-family";
import {
  buildOutputContractV2,
  PostPlanOutputSchema,
  PostBodyOutputSchema,
  CommentOutputSchema,
  ReplyOutputSchema,
  POST_PLAN_SCHEMA_META,
  POST_BODY_SCHEMA_META,
  COMMENT_SCHEMA_META,
  REPLY_SCHEMA_META,
  getAuditSchema,
  getAuditSchemaMeta,
  type SchemaMetadata,
} from "@/lib/ai/prompt-runtime/persona-v2-flow-contracts";
import type { z } from "zod";
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
  object?: unknown;
};

export type PersonaInteractionStageExecutionMode = "admin_preview" | "runtime";

export type PersonaPromptFamilyMode = "legacy" | "persona_core_v2";

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
  promptFamily?: PersonaPromptFamilyMode;
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

type ActionTypeToFlowMap = Record<string, Exclude<PersonaFlowKind, "audit"> | null>;

const ACTION_TYPE_TO_FLOW: ActionTypeToFlowMap = {
  post_plan: "post_plan",
  post_body: "post_body",
  post: "post_body",
  comment: "comment",
  reply: "reply",
  vote: null,
  poll_post: null,
  poll_vote: null,
};

function resolveFlowSchemaMeta(taskType: string): SchemaMetadata | undefined {
  switch (taskType) {
    case "post_plan":
      return POST_PLAN_SCHEMA_META;
    case "post_body":
    case "post":
      return POST_BODY_SCHEMA_META;
    case "comment":
      return COMMENT_SCHEMA_META;
    case "reply":
      return REPLY_SCHEMA_META;
    default:
      return undefined;
  }
}

function resolveStageSchema(taskType: string) {
  switch (taskType) {
    case "post_plan":
      return PostPlanOutputSchema;
    case "post_body":
    case "post":
      return PostBodyOutputSchema;
    case "comment":
      return CommentOutputSchema;
    case "reply":
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
  const flow = ACTION_TYPE_TO_FLOW[input.input.taskType];
  if (!flow || !input.personaPacket) {
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
      taskType: input.input.taskType,
      targetContext: input.input.targetContext,
    });

  const result = buildPersonaPromptFamilyV2({
    flow,
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
    outputContract: buildOutputContractV2({ flow, contentMode: input.contentMode }),
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

    const useV2 = input.promptFamily === "persona_core_v2";

    const blocks = useV2
      ? buildV2Blocks({
          input,
          personaCore,
          contentMode,
          personaPacket,
          personaPacketText,
        })
      : includeExpandedContext
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

    // Determine if this stage should use structured invocation
    const isAudit = input.stagePurpose === "audit";
    const isJsonStage =
      input.stagePurpose === "main" ||
      input.stagePurpose === "quality_repair" ||
      input.stagePurpose === "schema_repair" ||
      isAudit;

    if (isJsonStage) {
      // Resolve the appropriate schema and metadata
      let stageSchema: z.ZodTypeAny;
      let schemaMeta: SchemaMetadata;

      if (isAudit) {
        stageSchema = getAuditSchema(input.taskType, contentMode);
        schemaMeta = getAuditSchemaMeta(input.taskType, contentMode);
      } else {
        const resolved = resolveStageSchema(input.taskType);
        if (!resolved) {
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
        stageSchema = resolved;
        schemaMeta =
          resolveFlowSchemaMeta(input.taskType) ??
          ({
            schemaName: "Unknown",
            validationRules: [],
            allowedRepairPaths: [],
            immutablePaths: [],
          } satisfies SchemaMetadata);
      }

      const structuredResult = await invokeStructuredLLM({
        registry,
        taskType: "generic",
        routeOverride: invocationConfig.route,
        modelInput: {
          prompt: assembledPrompt,
          maxOutputTokens: Math.min(model.maxOutputTokens ?? maxOutputTokens, maxOutputTokens),
          temperature: isAudit ? 0 : 0.3,
          metadata: {
            _m: {
              stagePurpose: input.stagePurpose,
              taskType: input.taskType,
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
          validationRules: schemaMeta.validationRules,
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
                name: input.attemptLabel ?? `${input.taskType}:${input.stagePurpose}`,
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
        temperature: input.stagePurpose === "audit" ? 0 : 0.3,
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
              name: input.attemptLabel ?? `${input.taskType}:${input.stagePurpose}`,
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
    auditDiagnostics: null,
    stageDebugRecords: stageResult.debugRecord ? [stageResult.debugRecord] : undefined,
  };
}
