import { markdownToEditorHtml } from "@/lib/tiptap-markdown";
import { createDbBackedLlmProviderRegistry } from "@/lib/ai/llm/default-registry";
import { invokeLLM } from "@/lib/ai/llm/invoke-llm";
import { invokeStructuredLLM } from "@/lib/ai/llm/invoke-structured-llm";
import { resolveLlmInvocationConfig } from "@/lib/ai/llm/runtime-config-provider";
import { Output } from "ai";
import { z } from "zod";
import { PersonaCoreV2Schema } from "@/lib/ai/core/persona-core-v2";
import type { PersonaCoreV2 } from "@/lib/ai/core/persona-core-v2";
import {
  ADMIN_UI_LLM_PROVIDER_RETRIES,
  PERSONA_GENERATION_PREVIEW_MAX_OUTPUT_TOKENS,
  PERSONA_GENERATION_SEMANTIC_AUDIT_MAX_OUTPUT_TOKENS,
  PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS,
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
import {
  buildTokenBudgetSignal,
  DEFAULT_TOKEN_LIMITS,
  formatPrompt,
} from "@/lib/ai/admin/control-plane-shared";
import {
  deepMergeJson,
  deriveJsonLeafType,
  deriveJsonSchema,
} from "@/lib/ai/admin/llm-flow-shared";
import {
  collectEnglishOnlyIssues,
  parsePersonaGenerationSemanticAuditResult,
  parsePersonaCoreStageOutput,
  parseQualityRepairDelta,
  validatePersonaCoreV2Quality,
} from "@/lib/ai/admin/persona-generation-contract";
import { PERSONA_GENERATION_TEMPLATE_STAGES } from "@/lib/ai/admin/persona-generation-prompt-template";

const PersonaGenerationSemanticAuditSchema = z.object({
  passes: z.boolean(),
  issues: z.array(z.string()).default([]),
  repairGuidance: z.array(z.string()).default([]),
  keptReferenceNames: z.array(z.string()).optional(),
});

const PersonaGenerationQualityRepairDeltaSchema = z.object({
  repair: z.record(z.string(), z.unknown()),
});

export async function previewPersonaGeneration(input: {
  modelId: string;
  extraPrompt: string;
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
    includeMinimax: true,
  });
  const commonBlocks = [
    { name: "system_baseline", content: "Generate a coherent forum persona profile." },
    {
      name: "global_policy",
      content: `${input.document.globalPolicyDraft.systemBaseline}\n${input.document.globalPolicyDraft.globalPolicy}`,
    },
    {
      name: "generator_instruction",
      content: [
        "Generate the canonical PersonaCoreV2 payload as one validated JSON object.",
        "Write all persona-generation content in English, regardless of the language used in global policy text or admin extra prompt.",
        "Use snake_case keys exactly as provided.",
        "Preserve named references when they clarify the persona.",
        "Do not include markdown, explanation, persona_id, id, timestamps, or extra wrapper keys.",
      ].join("\n"),
    },
    { name: "admin_extra_prompt", content: input.extraPrompt },
  ];
  const maxOutputTokens = Math.min(
    model.maxOutputTokens ?? DEFAULT_TOKEN_LIMITS.personaGenerationMaxOutputTokens,
    DEFAULT_TOKEN_LIMITS.personaGenerationMaxOutputTokens,
  );
  const previewProviderRetries = Math.min(
    invocationConfig.retries ?? 0,
    ADMIN_UI_LLM_PROVIDER_RETRIES,
  );
  const stagePromptRecords: Array<{
    name: string;
    prompt: string;
    displayPrompt: string;
    outputMaxTokens: number;
  }> = [];

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

  const buildStagePrompt = (stageInput: {
    stageName: string;
    stageGoal: string;
    stageContract: string;
    carryForwardContext?: Record<string, unknown> | null;
    contextFormatting?: "compact" | "pretty";
  }) => {
    const carryForwardContextContent = stageInput.carryForwardContext
      ? JSON.stringify(
          stageInput.carryForwardContext,
          null,
          stageInput.contextFormatting === "compact" ? 0 : 2,
        )
      : null;
    const blocks = [
      ...commonBlocks,
      {
        name: "persona_generation_stage",
        content: [
          `stage_name: ${stageInput.stageName}`,
          `stage_goal: ${stageInput.stageGoal}`,
          ...(carryForwardContextContent
            ? ["prior_stage_source_of_truth:", carryForwardContextContent]
            : []),
        ].join("\n"),
      },
      { name: "stage_contract", content: stageInput.stageContract },
      {
        name: "output_constraints",
        content: [
          "Return only strict JSON.",
          "No markdown, no comments, no explanation.",
          "Do not output text outside the JSON object.",
        ].join("\n"),
      },
    ];
    return formatPrompt(blocks);
  };

  const runPersonaGenerationSemanticAudit = async (auditInput: {
    stageName: string;
    auditLabel: string;
    instructions: string[];
    parsedOutput: Record<string, unknown>;
    defaultIssue: string;
    failClosedOnTransport?: boolean;
    fallbackRepairGuidance?: string[];
  }): Promise<{
    passes: boolean;
    keptReferenceNames?: string[];
    issues: string[];
    repairGuidance: string[];
  }> => {
    const auditPrompt = [
      `[${auditInput.auditLabel}]`,
      ...auditInput.instructions,
      "Keep your response in English.",
      "The parsed_stage packet is intentionally compact — do not fail because omitted background is missing.",
      "",
      "[output_constraints]",
      "Return exactly one JSON object.",
      "Return raw JSON only. Do not use markdown fences.",
      "If the stage passes, return passes=true with empty issues and repairGuidance arrays.",
      "If the stage fails, keep the whole JSON response under 120 words.",
      "Do not include analysis, reasoning, or explanatory prose.",
      "Keep every issue and repairGuidance item short and functional.",
      "",
      "[parsed_stage]",
      (() => {
        const compactValue = (val: unknown, depth: number): unknown => {
          if (depth >= 2 && typeof val === "string") return val.slice(0, 50);
          if (depth >= 4) return null;
          if (Array.isArray(val)) {
            const items = val.slice(0, depth >= 2 ? 1 : 2).map((v) => compactValue(v, depth + 1));
            return items;
          }
          if (val && typeof val === "object") {
            const sub: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
              sub[k] = compactValue(v, depth + 1);
            }
            return sub;
          }
          return val;
        };
        return JSON.stringify(compactValue(auditInput.parsedOutput, 0));
      })(),
    ].join("\n");

    const auditResult = await invokeLLM({
      registry,
      taskType: "generic",
      routeOverride: invocationConfig.route,
      modelInput: {
        prompt: auditPrompt,
        maxOutputTokens: Math.min(
          PERSONA_GENERATION_SEMANTIC_AUDIT_MAX_OUTPUT_TOKENS,
          maxOutputTokens,
        ),
        temperature: 0,
        providerOptions: {
          xai: {
            reasoningEffort: "low",
          },
          deepseek: {
            reasoningEffort: "low",
          },
        },
        output: Output.object({ schema: PersonaGenerationSemanticAuditSchema }),
      },
      entityId: `persona-generation-preview:${model.id}:${auditInput.stageName}:${auditInput.auditLabel}:semantic-audit-1`,
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

    recordStageAttempt(auditInput.stageName, auditInput.auditLabel, auditResult);

    if (!auditResult.text.trim() && !auditResult.object) {
      if (!auditInput.failClosedOnTransport) {
        return { passes: true, issues: [], repairGuidance: [] };
      }
      return {
        passes: false,
        issues: [auditInput.defaultIssue],
        repairGuidance: auditInput.fallbackRepairGuidance ?? [],
      };
    }

    try {
      const auditText = auditResult.text.trim() || JSON.stringify(auditResult.object ?? {});
      const parsed = parsePersonaGenerationSemanticAuditResult(auditText);
      if (parsed.passes) {
        return {
          passes: true,
          keptReferenceNames: parsed.keptReferenceNames,
          issues: [],
          repairGuidance: [],
        };
      }
      return {
        passes: false,
        keptReferenceNames: parsed.keptReferenceNames,
        issues: parsed.issues.length > 0 ? parsed.issues : [auditInput.defaultIssue],
        repairGuidance: parsed.repairGuidance,
      };
    } catch {
      if (!auditInput.failClosedOnTransport) {
        return { passes: true, issues: [], repairGuidance: [] };
      }
      return {
        passes: false,
        issues: [auditInput.defaultIssue],
        repairGuidance: auditInput.fallbackRepairGuidance ?? [],
      };
    }
  };

  const auditPersonaCoreV2StageQuality = async (
    _stage: Record<string, unknown>,
  ): Promise<{
    issues: string[];
    repairGuidance: string[];
    normalizedParsedOutput?: Record<string, unknown>;
  }> => {
    return { issues: [], repairGuidance: [] };
  };

  const deriveRepairType = (val: unknown): string => deriveJsonLeafType(val);
  const deriveRepairSchema = (value: unknown, prefix: string): string =>
    deriveJsonSchema(value, prefix);

  const runPersonaGenerationStage = async <T>(stageInput: {
    stageName: string;
    stageGoal: string;
    stageContract: string;
    parse: (rawText: string) => T;
    validateQuality?: (parsed: T) => string[];
    validateQualityAsync?: (parsed: T) => Promise<{
      issues: string[];
      repairGuidance?: string[];
      normalizedParsedOutput?: T;
    }>;
    carryForwardContext?: Record<string, unknown> | null;
    allowedReferenceNames?: string[];
    outputMaxTokens: number;
  }): Promise<T> => {
    const basePrompt = buildStagePrompt({
      ...stageInput,
      contextFormatting: "compact",
    });
    const displayPrompt = buildStagePrompt({
      ...stageInput,
      contextFormatting: "pretty",
    });
    stagePromptRecords.push({
      name: stageInput.stageName,
      prompt: basePrompt,
      displayPrompt,
      outputMaxTokens: stageInput.outputMaxTokens,
    });

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
            validationRules: [
              "persona_fit_probability must be integer 0-100",
              "reference_style.reference_names must contain 1-5 items",
              "mind.thinking_procedure is required",
              "narrative is required",
            ],
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
              : Math.min(PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.repairRetryCap, maxOutputTokens),
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

    const invokeQualityRepairAttempt = async (prompt: string, attempt: 1 | 2) => {
      const result = await invokeLLM({
        registry,
        taskType: "generic",
        routeOverride: invocationConfig.route,
        modelInput: {
          prompt,
          maxOutputTokens: Math.min(
            PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.qualityRepairCap,
            maxOutputTokens,
          ),
          temperature: attempt === 1 ? 0.2 : 0.1,
          output: Output.object({ schema: PersonaGenerationQualityRepairDeltaSchema }),
        },
        entityId: `persona-generation-preview:${model.id}:${stageInput.stageName}:quality-repair-${attempt}`,
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
      recordStageAttempt(stageInput.stageName, `quality-repair-${attempt}`, result);
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

    const buildQualityRepairPrompt = (repairInput: {
      qualityIssues: string[];
      previousParsedOutput: T;
      repairGuidance?: string[];
      isRetry: boolean;
    }) => {
      const validKeys = Object.keys(
        repairInput.previousParsedOutput as Record<string, unknown>,
      ).join(", ");

      const allText = [...repairInput.qualityIssues, ...(repairInput.repairGuidance ?? [])].join(
        " ",
      );
      const output = repairInput.previousParsedOutput as Record<string, unknown>;
      const mentionedKeys = Object.keys(output).filter((key) => allText.includes(key));
      const mappedKeys =
        mentionedKeys.length === 0
          ? Object.keys(output).filter((key) => {
              const lower = allText.toLowerCase();
              const keywordMap: Record<string, string> = {
                voice_fingerprint: "voice tone flat personality",
                identity_summary: "generic identity archetype",
                values: "values principle judgment value_hierarchy",
                interaction_defaults: "interaction stance discussion",
                aesthetic_profile: "creative narrative humor",
                lived_context: "lived context experience",
                creator_affinity: "creator admired preference",
                task_style_matrix: "task post comment write",
                guardrails: "guardrail boundary hard_no",
              };
              const keywords = keywordMap[key];
              if (!keywords) {
                return false;
              }
              return keywords.split(" ").some((word) => lower.includes(word));
            })
          : [];
      const targetedKeys = mappedKeys.length > 0 ? mappedKeys : mentionedKeys;
      const targetedSchema =
        targetedKeys.length > 0 && targetedKeys.length < Object.keys(output).length
          ? targetedKeys
              .map((key) => {
                const schema = deriveRepairSchema(output[key], key);
                return schema
                  ? `${key}: { ${schema} }`
                  : `${key}: ${deriveRepairType(output[key])}`;
              })
              .join("\n")
          : "";

      const compactPrevious = JSON.stringify(repairInput.previousParsedOutput);
      const previousSnippet =
        compactPrevious.length <= 1200
          ? compactPrevious
          : `${compactPrevious.slice(0, 800)}...${compactPrevious.slice(-300)}`;

      const header = repairInput.isRetry
        ? "[retry] Parse failed on previous delta. Return a SMALL delta with only the fields mentioned in the issue below."
        : `[repair] Fix the quality issue below. Return a delta with only the fields that need to change.`;

      const lines = [
        header,
        "",
        `Available keys: ${validKeys}`,
        "",
        "Issue to fix:",
        ...repairInput.qualityIssues.map((issue) => `- ${issue}`),
        ...(repairInput.repairGuidance?.length
          ? ["", "Repair guidance:", ...repairInput.repairGuidance.map((item) => `- ${item}`)]
          : []),
      ];

      if (targetedSchema) {
        lines.push(
          "",
          "Sub-key structure for the field(s) to fix — use these exact sub-keys:",
          targetedSchema,
        );
      }

      lines.push(
        "",
        "What to return: a delta object containing ONLY the sub-fields that need changing.",
        "Use the exact sub-key names from the structure above. Do NOT invent new sub-key names.",
        "Leave all other fields and sub-fields unchanged — they are already correct.",
        "",
        '[output] {"repair": {"<key>": {"<sub_key>": "<new value>"}}}',
        "Return raw JSON only. No markdown, no commentary.",
        "",
        "=== CONTEXT ONLY — DO NOT INCLUDE IN OUTPUT ===",
        "Reference JSON showing current values:",
        previousSnippet,
        "=== END CONTEXT ===",
      );

      return lines.join("\n");
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

    const collectStageQualityResult = async (candidateStage: T) => {
      const baseDeterministicQualityIssues = [
        ...collectEnglishOnlyIssues(candidateStage, {
          allowedReferenceNames: stageInput.allowedReferenceNames,
        }),
        ...(stageInput.validateQuality?.(candidateStage) ?? []),
      ];
      const semanticQualityResult =
        baseDeterministicQualityIssues.length === 0 && stageInput.validateQualityAsync
          ? await stageInput.validateQualityAsync(candidateStage)
          : null;
      const normalizedParsedOutput =
        semanticQualityResult?.normalizedParsedOutput ?? candidateStage;
      const deterministicQualityIssues =
        normalizedParsedOutput === candidateStage
          ? baseDeterministicQualityIssues
          : [
              ...collectEnglishOnlyIssues(normalizedParsedOutput, {
                allowedReferenceNames: stageInput.allowedReferenceNames,
              }),
              ...(stageInput.validateQuality?.(normalizedParsedOutput) ?? []),
            ];
      return {
        normalizedParsedOutput,
        issues: [...deterministicQualityIssues, ...(semanticQualityResult?.issues ?? [])],
        repairGuidance: semanticQualityResult?.repairGuidance,
      };
    };

    const parsedStage = (await resolveParsedStage()) as T;
    const initialQualityResult = await collectStageQualityResult(parsedStage);
    if (initialQualityResult.issues.length === 0) {
      return initialQualityResult.normalizedParsedOutput;
    }

    let previousParsedOutput = initialQualityResult.normalizedParsedOutput;
    let pendingQualityIssues = initialQualityResult.issues;
    let pendingRepairGuidance = initialQualityResult.repairGuidance;
    let isQualityRepairRetry = false;

    for (const attempt of [1, 2] as const) {
      const qualityRepairPrompt = buildQualityRepairPrompt({
        qualityIssues: pendingQualityIssues,
        previousParsedOutput: previousParsedOutput,
        repairGuidance: pendingRepairGuidance,
        isRetry: isQualityRepairRetry,
      });

      const qualityRepaired = await invokeQualityRepairAttempt(qualityRepairPrompt, attempt);
      const attemptStage = `quality-repair-${attempt}` as const;

      try {
        const qualityRepairText =
          qualityRepaired.text.trim() || JSON.stringify(qualityRepaired.object ?? {});
        const delta = parseQualityRepairDelta(qualityRepairText);
        const rawMerged = deepMergeJson(
          previousParsedOutput as Record<string, unknown>,
          delta.repair,
        );
        const mergedStage = stageInput.parse(JSON.stringify(rawMerged)) as T;
        const repairedQualityResult = await collectStageQualityResult(mergedStage);
        if (repairedQualityResult.issues.length === 0) {
          return repairedQualityResult.normalizedParsedOutput;
        }
        if (attempt === 2) {
          throw new PersonaGenerationQualityError({
            stageName: stageInput.stageName,
            message: `persona generation stage ${stageInput.stageName} quality repair failed`,
            rawOutput: qualityRepaired.text,
            issues: repairedQualityResult.issues,
            details: buildStageAttemptDetails({
              attemptStage,
              llmResult: qualityRepaired,
            }),
          });
        }

        previousParsedOutput = repairedQualityResult.normalizedParsedOutput;
        pendingQualityIssues = repairedQualityResult.issues;
        pendingRepairGuidance = repairedQualityResult.repairGuidance;
        isQualityRepairRetry = false;
      } catch (parseError) {
        if (attempt === 2) {
          if (parseError instanceof PersonaGenerationQualityError) {
            throw parseError;
          }
          const parseMessage =
            parseError instanceof Error ? parseError.message : "unknown parse error";
          throw new PersonaGenerationQualityError({
            stageName: stageInput.stageName,
            message: `persona generation stage ${stageInput.stageName} quality repair delta parse or merge failed: ${parseMessage}`,
            rawOutput: qualityRepaired.text,
            issues: pendingQualityIssues,
            details: buildStageAttemptDetails({
              attemptStage,
              llmResult: qualityRepaired,
            }),
          });
        }
        isQualityRepairRetry = true;
      }
    }

    throw new PersonaGenerationQualityError({
      stageName: stageInput.stageName,
      message: `persona generation stage ${stageInput.stageName} quality repair failed`,
      rawOutput: "",
      issues: pendingQualityIssues,
    });
  };

  let personaCore!: PersonaCoreV2;
  let structured!: PersonaGenerationStructured;
  let assembledPrompt!: string;
  let tokenBudget!: PreviewTokenBudget;
  let markdown!: string;

  try {
    const personaCoreStage = PERSONA_GENERATION_TEMPLATE_STAGES[0];
    personaCore = await runPersonaGenerationStage<PersonaCoreV2>({
      stageName: personaCoreStage.name,
      stageGoal: personaCoreStage.goal,
      stageContract: personaCoreStage.contract.join("\n"),
      parse: (rawText) => PersonaCoreV2Schema.parse(parsePersonaCoreStageOutput(rawText)),
      validateQuality: (stage) =>
        validatePersonaCoreV2Quality(stage as unknown as Record<string, unknown>),
      allowedReferenceNames: [],
      outputMaxTokens: PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.persona_core,
    });

    structured = {
      persona: {
        display_name: personaCore.identity.archetype,
        status: "active",
        bio: personaCore.identity.core_drive,
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
      originalization_note: personaCore.identity.central_tension,
    };
    assembledPrompt = stagePromptRecords
      .map((stage, index) => `### Stage ${index + 1}: ${stage.name}\n${stage.displayPrompt}`)
      .join("\n\n");
    tokenBudget = buildTokenBudgetSignal({
      blocks: stagePromptRecords.map((stage) => ({ name: stage.name, content: stage.prompt })),
      maxInputTokens:
        DEFAULT_TOKEN_LIMITS.personaGenerationMaxInputTokens * stagePromptRecords.length,
      maxOutputTokens: PERSONA_GENERATION_PREVIEW_MAX_OUTPUT_TOKENS,
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
