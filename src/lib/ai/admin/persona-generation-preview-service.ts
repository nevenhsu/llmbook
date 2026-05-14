import { markdownToEditorHtml } from "@/lib/tiptap-markdown";
import { createDbBackedLlmProviderRegistry } from "@/lib/ai/llm/default-registry";
import { invokeLLM } from "@/lib/ai/llm/invoke-llm";
import { invokeStructuredLLM } from "@/lib/ai/llm/invoke-structured-llm";
import { resolveLlmInvocationConfig } from "@/lib/ai/llm/runtime-config-provider";
import { PersonaCoreV2Schema } from "@/lib/ai/core/persona-core-v2";
import type { PersonaCoreV2 } from "@/lib/ai/core/persona-core-v2";
import {
  ADMIN_UI_LLM_PROVIDER_RETRIES,
  PERSONA_GENERATION_BUDGETS,
} from "@/lib/ai/admin/persona-generation-token-budgets";
import {
  PersonaGenerationParseError,
  PersonaGenerationQualityError,
  type AiControlPlaneDocument,
  type AiModelConfig,
  type AiProviderConfig,
  type PersonaGenerationStructured,
  type PreviewResult,
  type PreviewTokenBudget,
} from "@/lib/ai/admin/control-plane-contract";
import type { StageDebugRecord } from "@/lib/ai/stage-debug-records";
import { resolvePersonaTextModel } from "@/lib/ai/admin/control-plane-model-resolution";
import { buildTokenBudgetSignal, DEFAULT_TOKEN_LIMITS } from "@/lib/ai/admin/control-plane-shared";
import {
  collectEnglishOnlyIssues,
  parsePersonaCoreStageOutput,
  validatePersonaCoreV2Quality,
} from "@/lib/ai/admin/persona-generation-contract";
import {
  buildPersonaGenerationPrompt,
  renderPersonaGenerationPromptBlock,
} from "@/lib/ai/prompt-runtime/persona/generation-prompt-builder";

export async function previewPersonaGeneration(input: {
  modelId: string;
  extraPrompt: string;
  referenceNames?: string;
  document: AiControlPlaneDocument;
  providers: AiProviderConfig[];
  models: AiModelConfig[];
  debug?: boolean;
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
}): Promise<
  PreviewResult & {
    structured: PersonaGenerationStructured;
    stageDebugRecords: StageDebugRecord[];
  }
> {
  const { model, provider } = resolvePersonaTextModel({
    modelId: input.modelId,
    models: input.models,
    providers: input.providers,
    featureLabel: "persona generation",
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
  const maxOutputTokens = Math.min(
    model.maxOutputTokens ?? DEFAULT_TOKEN_LIMITS.personaGenerationMaxOutputTokens,
    DEFAULT_TOKEN_LIMITS.personaGenerationMaxOutputTokens,
  );
  const previewProviderRetries = Math.min(
    invocationConfig.retries ?? 0,
    ADMIN_UI_LLM_PROVIDER_RETRIES,
  );
  const promptBuildResult = buildPersonaGenerationPrompt({
    extraPrompt: input.extraPrompt,
    referenceNames: input.referenceNames ?? "",
  });
  const stageDebugRecords: StageDebugRecord[] = [];

  const recordStageAttempt = (
    stageName: string,
    attempt: string,
    result: {
      text: string;
      finishReason?: string | null;
      providerId?: string | null;
      modelId?: string | null;
      error?: string | null;
      schemaGateDebug?: StageDebugRecord["attempts"][number]["schemaGateDebug"];
    },
  ) => {
    let record = stageDebugRecords.find((r) => r.name === stageName);
    if (!record) {
      record = {
        name: stageName,
        displayPrompt: "",
        outputMaxTokens: 0,
        attempts: [],
      };
      stageDebugRecords.push(record);
    }
    record.attempts.push({
      attempt,
      text: result.text,
      finishReason: result.finishReason ?? null,
      providerId: result.providerId ?? null,
      modelId: result.modelId ?? null,
      hadError: Boolean(result.error),
      ...(result.schemaGateDebug ? { schemaGateDebug: result.schemaGateDebug } : {}),
    });
  };

  const runPersonaGenerationStage = async <T>(stageInput: {
    stageName: string;
    stageGoal: string;
    parse: (rawText: string) => T;
    validateQuality?: (parsed: T) => string[];
    carryForwardContext?: Record<string, unknown> | null;
    allowedReferenceNames?: string[];
    outputMaxTokens: number;
  }): Promise<T> => {
    const basePrompt = promptBuildResult.assembledPrompt;
    const displayPrompt = promptBuildResult.assembledPrompt;

    let stageDebug = stageDebugRecords.find((r) => r.name === stageInput.stageName);
    if (!stageDebug) {
      stageDebug = {
        name: stageInput.stageName,
        displayPrompt,
        outputMaxTokens: stageInput.outputMaxTokens,
        attempts: [],
      };
      stageDebugRecords.push(stageDebug);
    } else {
      stageDebug.displayPrompt = displayPrompt;
      stageDebug.outputMaxTokens = stageInput.outputMaxTokens;
    }

    const invokeStageAttempt = async (prompt: string, attempt: 1 | 2) => {
      if (stageInput.stageName === "persona_core_v2" && attempt === 1) {
        const structuredResult = await invokeStructuredLLM({
          registry,
          taskType: "generic",
          routeOverride: invocationConfig.route,
          modelInput: {
            prompt,
            maxOutputTokens: Math.min(stageInput.outputMaxTokens, maxOutputTokens),
            temperature: 0.4,
          },
          entityId: `persona-generation-preview:${model.id}:${stageInput.stageName}:attempt-${attempt}`,
          timeoutMs: invocationConfig.timeoutMs,
          retries: previewProviderRetries,
          onProviderError: async (event) => {
            await input.recordLlmInvocationError({
              providerKey: event.providerId,
              modelKey: event.modelId,
              error: event.error,
              errorDetails: event.errorDetails,
            });
          },
          schemaGate: {
            schemaName: "PersonaCoreV2Schema",
            schema: PersonaCoreV2Schema,
            allowedRepairPaths: [
              "persona_fit_probability",
              "identity",
              "identity.*",
              "mind",
              "mind.*",
              "mind.thinking_procedure",
              "mind.thinking_procedure.*",
              "taste",
              "taste.*",
              "voice",
              "voice.*",
              "forum",
              "forum.*",
              "narrative",
              "narrative.*",
              "reference_style",
              "reference_style.reference_names",
              "reference_style.other_references",
              "reference_style.abstract_traits",
              "anti_generic",
              "anti_generic.avoid_patterns",
              "anti_generic.failure_mode",
            ],
            immutablePaths: ["schema_version"],
          },
        });

        if (structuredResult.status === "schema_failure") {
          const rawOutput = structuredResult.raw.text.trim();
          recordStageAttempt(stageInput.stageName, `attempt-${attempt}`, {
            ...structuredResult.raw,
            schemaGateDebug: structuredResult.schemaGateDebug,
            error: structuredResult.error,
          });
          const error = new PersonaGenerationParseError(structuredResult.error, rawOutput, {
            stageName: stageInput.stageName,
            details: {
              attemptStage: `attempt-${attempt}`,
              schemaGateDebug: structuredResult.schemaGateDebug,
              ...buildStageAttemptDetails({
                attemptStage: `attempt-${attempt}`,
                llmResult: structuredResult.raw,
              }),
            },
          });
          throw error;
        }

        const result = {
          ...structuredResult.raw,
          text: structuredResult.raw.text.trim() || JSON.stringify(structuredResult.value),
          object: structuredResult.value,
          schemaGateDebug: structuredResult.schemaGateDebug,
        };
        recordStageAttempt(stageInput.stageName, `attempt-${attempt}`, result);
        return result;
      }

      const result = await invokeLLM({
        registry,
        taskType: "generic",
        routeOverride: invocationConfig.route,
        modelInput: {
          prompt,
          maxOutputTokens:
            attempt === 1
              ? Math.min(stageInput.outputMaxTokens, maxOutputTokens)
              : Math.min(PERSONA_GENERATION_BUDGETS.repairRetryOutputTokens, maxOutputTokens),
          temperature: attempt === 1 ? 0.4 : 0.2,
        },
        entityId: `persona-generation-preview:${model.id}:${stageInput.stageName}:attempt-${attempt}`,
        timeoutMs: invocationConfig.timeoutMs,
        retries: previewProviderRetries,
        onProviderError: async (event) => {
          await input.recordLlmInvocationError({
            providerKey: event.providerId,
            modelKey: event.modelId,
            error: event.error,
            errorDetails: event.errorDetails,
          });
        },
      });
      recordStageAttempt(stageInput.stageName, `attempt-${attempt}`, result);
      return result;
    };

    const buildStageAttemptDetails = (input: {
      attemptStage: string;
      llmResult: {
        text: string;
        finishReason?: string | null;
        providerId?: string | null;
        modelId?: string | null;
        attempts?: number | null;
        usedFallback?: boolean | null;
        error?: string | null;
        errorDetails?: unknown;
      };
    }): Record<string, unknown> => {
      const trimmedText = input.llmResult.text.trim();
      return {
        attemptStage: input.attemptStage,
        providerId: input.llmResult.providerId ?? null,
        modelId: input.llmResult.modelId ?? null,
        finishReason: input.llmResult.finishReason ?? null,
        hadText: trimmedText.length > 0,
        attempts: input.llmResult.attempts ?? null,
        usedFallback: input.llmResult.usedFallback ?? false,
        ...(input.llmResult.error ? { providerError: input.llmResult.error } : {}),
        ...(input.llmResult.errorDetails ? { errorDetails: input.llmResult.errorDetails } : {}),
      };
    };

    const attemptParse = (
      result: {
        text: string;
        error?: string | null;
        finishReason?: string | null;
        providerId?: string | null;
        modelId?: string | null;
        attempts?: number | null;
        usedFallback?: boolean | null;
        errorDetails?: unknown;
        object?: unknown;
      },
      attemptStage: string,
    ) => {
      if (result.object && stageInput.stageName === "persona_core_v2") {
        const parsedObject = PersonaCoreV2Schema.safeParse(result.object);
        if (parsedObject.success) {
          return parsedObject.data as T;
        }
        throw new PersonaGenerationParseError(
          `persona_core_v2 validation failed: ${parsedObject.error.message}`,
          result.text,
          {
            stageName: stageInput.stageName,
            details: buildStageAttemptDetails({
              attemptStage,
              llmResult: result,
            }),
          },
        );
      }
      if (!result.text.trim()) {
        throw new PersonaGenerationParseError(
          result.error ?? "persona generation model returned empty output",
          result.text,
          {
            stageName: stageInput.stageName,
            details: buildStageAttemptDetails({
              attemptStage,
              llmResult: result,
            }),
          },
        );
      }
      try {
        return stageInput.parse(result.text);
      } catch (error) {
        if (error instanceof PersonaGenerationParseError) {
          throw new PersonaGenerationParseError(error.message, error.rawOutput, {
            stageName: stageInput.stageName,
            details: buildStageAttemptDetails({
              attemptStage,
              llmResult: result,
            }),
          });
        }
        throw error;
      }
    };

    const resolveParsedStage = async (): Promise<T> => {
      const first = await invokeStageAttempt(basePrompt, 1);
      return attemptParse(first, "attempt-1");
    };

    const collectStageQualityResult = (candidateStage: T): string[] => {
      return [
        ...collectEnglishOnlyIssues(candidateStage, {
          allowedReferenceNames: stageInput.allowedReferenceNames,
        }),
        ...(stageInput.validateQuality?.(candidateStage) ?? []),
      ];
    };

    const parsedStage = (await resolveParsedStage()) as T;
    const qualityIssues = collectStageQualityResult(parsedStage);
    if (qualityIssues.length > 0) {
      throw new PersonaGenerationQualityError({
        stageName: stageInput.stageName,
        message: `persona generation stage ${stageInput.stageName} quality check failed`,
        rawOutput: "",
        issues: qualityIssues,
      });
    }
    return parsedStage;
  };

  let personaCore!: PersonaCoreV2;
  let structured!: PersonaGenerationStructured;
  let assembledPrompt!: string;
  let tokenBudget!: PreviewTokenBudget;
  let markdown!: string;

  try {
    personaCore = await runPersonaGenerationStage<PersonaCoreV2>({
      stageName: "persona_core_v2",
      stageGoal: "Generate one compact PersonaCoreV2 JSON object.",
      parse: (rawText) => PersonaCoreV2Schema.parse(parsePersonaCoreStageOutput(rawText)),
      validateQuality: (stage) =>
        validatePersonaCoreV2Quality(stage as unknown as Record<string, unknown>),
      allowedReferenceNames: [],
      outputMaxTokens: PERSONA_GENERATION_BUDGETS.mainOutputTokens,
    });

    structured = {
      persona: {
        display_name: personaCore.identity.display_name,
        status: "active",
        bio: personaCore.identity.bio,
      },
      persona_core: personaCore as unknown as Record<string, unknown>,
      reference_sources: personaCore.reference_style.reference_names.map((name) => ({
        name,
        type: "core_reference",
        contribution: [],
      })),
      other_reference_sources: personaCore.reference_style.other_references.map((name) => ({
        name,
        type: "supporting_reference",
        contribution: [],
      })),
      reference_derivation: personaCore.reference_style.abstract_traits,
      originalization_note: personaCore.originalization_note,
    };
    assembledPrompt = promptBuildResult.assembledPrompt;
    tokenBudget = buildTokenBudgetSignal({
      blocks: promptBuildResult.blocks.map((block) => ({
        name: block.name,
        content: renderPersonaGenerationPromptBlock(block),
      })),
      maxInputTokens: DEFAULT_TOKEN_LIMITS.personaGenerationMaxInputTokens,
      maxOutputTokens: PERSONA_GENERATION_BUDGETS.previewMaxOutputTokens,
    });

    markdown = [
      `## Persona Preview (${model.displayName})`,
      "",
      `### persona`,
      `- display_name: ${structured.persona.display_name}`,
      `- status: ${structured.persona.status}`,
      `- bio: ${structured.persona.bio}`,
      "",
      `### persona_core`,
      "```json",
      JSON.stringify(structured.persona_core, null, 2),
      "```",
      "",
      `### reference_sources (${structured.reference_sources.length})`,
      "```json",
      JSON.stringify(structured.reference_sources, null, 2),
      "```",
      "",
      `### other_reference_sources (${structured.other_reference_sources.length})`,
      "```json",
      JSON.stringify(structured.other_reference_sources, null, 2),
      "```",
      "",
      `### reference_derivation`,
      "```json",
      JSON.stringify(structured.reference_derivation, null, 2),
      "```",
      "",
      `### originalization_note`,
      structured.originalization_note,
    ].join("\n");
  } catch (error) {
    if (error instanceof PersonaGenerationParseError) {
      (error as unknown as { details: Record<string, unknown> | null }).details = {
        ...(error.details ?? {}),
        stageDebugRecords,
      };
    }
    throw error;
  }

  try {
    markdownToEditorHtml(markdown);
    return {
      assembledPrompt,
      markdown,
      renderOk: true,
      renderError: null,
      tokenBudget,
      structured,
      stageDebugRecords: input.debug ? stageDebugRecords : [],
    };
  } catch (error) {
    return {
      assembledPrompt,
      markdown,
      renderOk: false,
      renderError: error instanceof Error ? error.message : "render validation failed",
      tokenBudget,
      structured,
      stageDebugRecords: input.debug ? stageDebugRecords : [],
    };
  }
}
