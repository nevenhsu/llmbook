import { markdownToEditorHtml } from "@/lib/tiptap-markdown";
import { createDbBackedLlmProviderRegistry } from "@/lib/ai/llm/default-registry";
import { invokeLLM } from "@/lib/ai/llm/invoke-llm";
import { resolveLlmInvocationConfig } from "@/lib/ai/llm/runtime-config-provider";
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
  type PersonaGenerationCoreStage,
  type PersonaGenerationSeedStage,
  type PersonaGenerationStructured,
  type PreviewResult,
  type PreviewTokenBudget,
} from "@/lib/ai/admin/control-plane-contract";
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
  buildRepairSchemaHint,
} from "@/lib/ai/admin/llm-flow-shared";
import {
  collectEnglishOnlyIssues,
  parsePersonaGenerationOutput,
  parsePersonaGenerationSemanticAuditResult,
  parsePersonaCoreStageOutput,
  parsePersonaSeedOutput,
  parseQualityRepairDelta,
  validatePersonaCoreStageQuality,
  validateSeedStageQuality,
} from "@/lib/ai/admin/persona-generation-contract";
import { PERSONA_GENERATION_TEMPLATE_STAGES } from "@/lib/ai/admin/persona-generation-prompt-template";

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
    stageDebugRecords: Array<{
      name: string;
      displayPrompt: string;
      outputMaxTokens: number;
      attempts: Array<{
        attempt: string;
        text: string;
        finishReason: string | null;
        providerId: string | null;
        modelId: string | null;
        hadError: boolean;
      }>;
    }>;
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
        "Generate the canonical persona payload in smaller validated stages.",
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

  const stageDebugRecords: Array<{
    name: string;
    displayPrompt: string;
    outputMaxTokens: number;
    attempts: Array<{
      attempt: string;
      text: string;
      finishReason: string | null;
      providerId: string | null;
      modelId: string | null;
      hadError: boolean;
    }>;
  }> = [];

  const recordStageAttempt = (
    stageName: string,
    attempt: string,
    result: {
      text: string;
      finishReason?: string | null;
      providerId?: string | null;
      modelId?: string | null;
      error?: string | null;
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
          "Output strictly valid JSON.",
          "No markdown, wrapper text, or explanatory prose outside the JSON object.",
          "Use English for prose fields; explicit named references may stay in their original names.",
          "Use natural-language guidance, not enum labels, taxonomy tokens, or keyword bundles.",
          "Do not add extra keys.",
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
      'If the stage passes, return exactly {"passes":true,"issues":[],"repairGuidance":[]}.',
      "If the stage fails, keep the whole JSON response under 120 words.",
      "Do not include analysis, reasoning, or explanatory prose.",
      "passes: boolean",
      "issues: string[]",
      "repairGuidance: string[]",
      "keptReferenceNames?: string[]",
      "{",
      '  "passes": true,',
      '  "issues": ["string"],',
      '  "repairGuidance": ["string"],',
      '  "keptReferenceNames": ["string"]',
      "}",
      "Omit keptReferenceNames unless the audit instructions ask you to filter kept reference names.",
      "If the note is already sufficient, set passes=true and return empty arrays.",
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

    if (!auditResult.text.trim()) {
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
      const parsed = parsePersonaGenerationSemanticAuditResult(auditResult.text);
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

  const auditSeedOriginalizationSemantics = async (
    stage: PersonaGenerationSeedStage,
  ): Promise<{
    issues: string[];
    repairGuidance: string[];
  }> =>
    runPersonaGenerationSemanticAudit({
      stageName: "seed",
      auditLabel: "seed_originalization_audit",
      instructions: [
        "You are judging whether the seed-stage output has been adapted into a new forum-native identity rather than staying as literal roleplay, direct copy, or reference-world transplant.",
        "PASS when the persona has its own distinct name, describes original forum-native behavior, and the originalization_note explains how the adaptation was done.",
        "FAIL only when the persona is unmistakably the reference character placed in the forum with no meaningful adaptation.",
        "In every issue and repairGuidance, name the exact field that needs rewriting (e.g., persona.bio, originalization_note, reference_derivation[0]).",
        "Examples:",
        "  PASS: 'Inspired by Sherlock Holmes's analytical rigor but grounded as a data science forum moderator.'",
        "  FAIL: 'Sherlock Holmes has joined the forum. He solves cases at 221B Baker Street.' → issue: 'persona.bio directly copies the reference character without adaptation.'",
        "Legitimate inspiration that recontextualizes traits for forum-native behavior should pass.",
        "If in doubt, pass.",
      ],
      parsedOutput: {
        persona: stage.persona,
        identity_summary: stage.identity_summary,
        reference_sources: stage.reference_sources,
        other_reference_sources: stage.other_reference_sources,
        reference_derivation: stage.reference_derivation,
        originalization_note: stage.originalization_note,
      },
      defaultIssue:
        "originalization_note must explain how the persona was adapted into a forum-native identity distinct from the named references.",
      failClosedOnTransport: false,
      fallbackRepairGuidance: [
        "Rewrite originalization_note to explicitly describe the adaptation: name the reference traits that were kept, explain what was changed, and state the resulting forum-native identity.",
        "Ensure persona.bio does not copy the reference character's name, context, or in-universe details.",
      ],
    });

  const auditSeedReferenceClassification = async (
    stage: PersonaGenerationSeedStage,
  ): Promise<{
    issues: string[];
    repairGuidance: string[];
    normalizedParsedOutput?: PersonaGenerationSeedStage;
  }> => {
    const auditResult = await runPersonaGenerationSemanticAudit({
      stageName: "seed",
      auditLabel: "seed_reference_source_audit",
      instructions: [
        "You are judging whether reference_sources contains only personality-bearing named references.",
        "A personality-bearing reference must be a person-like entity with a distinct persona, such as a real person, historical figure, fictional character, mythic figure, or iconic persona.",
        "Concepts, methods, principles, works, films, movements, groups, locations, and abstract nouns do not belong in reference_sources.",
        "If some entries are valid personality-bearing references and others are not, set passes=true and return keptReferenceNames containing only the valid reference_sources names to keep.",
        "If none of the entries are valid personality-bearing references, set passes=false.",
        "Do not invent new names. Only keep names that already exist in parsed_stage.reference_sources.",
        "Ignore other_reference_sources except as context; you are only filtering reference_sources.",
      ],
      parsedOutput: {
        reference_sources: stage.reference_sources,
        other_reference_sources: stage.other_reference_sources,
      },
      defaultIssue:
        "reference_sources must contain at least one personality-bearing named reference.",
      failClosedOnTransport: true,
      fallbackRepairGuidance: [
        "Keep only personality-bearing named references inside reference_sources.",
        "Move concepts, works, principles, groups, and other non-personality references into other_reference_sources.",
        "Ensure at least one personality-bearing named reference remains in reference_sources.",
      ],
    });

    const keptReferenceNames =
      auditResult.keptReferenceNames && auditResult.keptReferenceNames.length > 0
        ? new Set(auditResult.keptReferenceNames)
        : null;
    const filteredReferenceSources = keptReferenceNames
      ? stage.reference_sources.filter((item) => keptReferenceNames.has(item.name))
      : stage.reference_sources;

    if (filteredReferenceSources.length === 0) {
      return {
        issues:
          auditResult.issues.length > 0
            ? auditResult.issues
            : ["reference_sources must contain at least one personality-bearing named reference."],
        repairGuidance:
          auditResult.repairGuidance.length > 0
            ? auditResult.repairGuidance
            : [
                "Keep only personality-bearing named references in reference_sources.",
                "Add at least one real person, historical figure, fictional character, mythic figure, or iconic persona to reference_sources.",
              ],
      };
    }

    return {
      issues: [],
      repairGuidance: [],
      normalizedParsedOutput: {
        ...stage,
        reference_sources: filteredReferenceSources,
      },
    };
  };

  const auditSeedStageSemantics = async (
    stage: PersonaGenerationSeedStage,
  ): Promise<{
    issues: string[];
    repairGuidance: string[];
    normalizedParsedOutput?: PersonaGenerationSeedStage;
  }> => {
    const referenceAudit = await auditSeedReferenceClassification(stage);
    if (referenceAudit.issues.length > 0) {
      return referenceAudit;
    }

    const normalizedStage = referenceAudit.normalizedParsedOutput ?? stage;
    const originalizationAudit = await auditSeedOriginalizationSemantics(normalizedStage);
    if (originalizationAudit.issues.length > 0) {
      return {
        issues: originalizationAudit.issues,
        repairGuidance: originalizationAudit.repairGuidance,
        normalizedParsedOutput: normalizedStage,
      };
    }

    return {
      issues: [],
      repairGuidance: [],
      normalizedParsedOutput: normalizedStage,
    };
  };

  const auditPersonaCoreSemantics = async (
    stage: PersonaGenerationCoreStage,
    seedStage: PersonaGenerationSeedStage,
  ): Promise<{
    issues: string[];
    repairGuidance: string[];
  }> =>
    runPersonaGenerationSemanticAudit({
      stageName: "persona_core",
      auditLabel: "persona_core_quality_audit",
      instructions: [
        "You are judging a compact review packet for persona_core quality.",
        "The packet is intentionally compact. Do not fail only because omitted background is missing.",
        "Judge whether values, interaction_defaults, voice_fingerprint, and task_style_matrix describe the same persona without internal contradictions.",
        "Flag only concrete problems. In every issue, include the exact field path (e.g., voice_fingerprint.opening_move):",
        "  - A field directly contradicts another field (e.g., 'voice_fingerprint.opening_move says aggressive but interaction_defaults.default_stance says deferential').",
        "  - A field uses single-word labels that provide no actionable guidance (e.g., 'interaction_defaults.default_stance is just \"skeptic\"').",
        "  - Two fields repeat identical long-form text verbatim (e.g., 'voice_fingerprint.closing_move copies task_style_matrix.post.close_shape').",
        "  - A required behavioral dimension is entirely absent (e.g., 'voice_fingerprint.praise_style is missing').",
        "In repairGuidance, name the exact field(s) to rewrite and suggest the target tone or approach.",
        "Do not flag reasonable stylistic variation or thematically coherent but differently-phrased guidance.",
      ],
      parsedOutput: {
        identity_summary: {
          archetype: seedStage.identity_summary.archetype,
          core_motivation: seedStage.identity_summary.core_motivation,
          one_sentence_identity: seedStage.identity_summary.one_sentence_identity,
        },
        values: stage.values,
        interaction_defaults: stage.interaction_defaults,
        voice_fingerprint: stage.voice_fingerprint,
        task_style_matrix: stage.task_style_matrix,
      },
      defaultIssue:
        "persona_core coherence could not be verified — check voice_fingerprint.opening_move against interaction_defaults.default_stance for consistency.",
      failClosedOnTransport: false,
      fallbackRepairGuidance: [
        "Ensure voice_fingerprint.opening_move describes how the persona starts interactions, distinct from interaction_defaults.default_stance which describes the overall posture.",
        "Expand any compressed single-word labels into reusable natural-language guidance.",
      ],
    });

  const auditPersonaCoreDistinctSignals = async (
    stage: PersonaGenerationCoreStage,
  ): Promise<{
    issues: string[];
    repairGuidance: string[];
  }> =>
    runPersonaGenerationSemanticAudit({
      stageName: "persona_core",
      auditLabel: "persona_core_distinct_signals_audit",
      instructions: [
        "You are judging whether four key persona_core fields are meaningfully distinct.",
        "Evaluate: interaction_defaults.default_stance, voice_fingerprint.opening_move, task_style_matrix.post.body_shape, task_style_matrix.comment.feedback_shape.",
        "These fields serve different purposes and should describe different aspects of the persona's behavior.",
        "Flag only when two or more are functionally interchangeable — name both fields explicitly in the issue.",
        "Example issue: 'interaction_defaults.default_stance and voice_fingerprint.opening_move both say the same thing — differentiate them.'",
        "Coherent thematic overlap is expected and should pass.",
        "In repairGuidance, name which exact field(s) to rewrite and suggest what aspect they should cover instead.",
      ],
      parsedOutput: {
        interaction_defaults: stage.interaction_defaults,
        voice_fingerprint: stage.voice_fingerprint,
        task_style_matrix: stage.task_style_matrix,
      },
      defaultIssue:
        "voice_fingerprint.opening_move, interaction_defaults.default_stance, task_style_matrix.post.body_shape, and task_style_matrix.comment.feedback_shape must describe different behavioral dimensions.",
      failClosedOnTransport: false,
      fallbackRepairGuidance: [
        "Rewrite voice_fingerprint.opening_move to describe how the persona opens a conversation, distinct from interaction_defaults.default_stance which describes the overall posture.",
        "Ensure task_style_matrix.post.body_shape and task_style_matrix.comment.feedback_shape cover different response formats.",
      ],
    });

  const auditPersonaCoreStageSemantics = async (
    stage: PersonaGenerationCoreStage,
    seedStage: PersonaGenerationSeedStage,
  ): Promise<{
    issues: string[];
    repairGuidance: string[];
    normalizedParsedOutput?: PersonaGenerationCoreStage;
  }> => {
    const coherenceAudit = await auditPersonaCoreSemantics(stage, seedStage);
    const distinctSignalsAudit = await auditPersonaCoreDistinctSignals(stage);

    const issues = [...coherenceAudit.issues, ...distinctSignalsAudit.issues];
    const repairGuidance = [
      ...coherenceAudit.repairGuidance,
      ...distinctSignalsAudit.repairGuidance,
    ];

    if (issues.length === 0) {
      return { issues: [], repairGuidance: [] };
    }

    return { issues, repairGuidance };
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

    const isLengthTruncated = (result: { text: string; finishReason?: string | null }) =>
      result.finishReason === "length" && result.text.trim().length > 0;

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

    const formatTruncatedOutputForRepair = (rawText: string) => {
      const text = rawText.trim();
      if (!text) {
        return "";
      }
      if (text.length <= 1600) {
        return text;
      }
      const head = text.slice(0, 1000).trimEnd();
      const tail = text.slice(-500).trimStart();
      return `${head}\n...[middle omitted for repair context]...\n${tail}`;
    };

    const buildTruncatedOutputContext = (rawText: string | null | undefined) => {
      const formatted = formatTruncatedOutputForRepair(rawText ?? "");
      if (!formatted) {
        return "";
      }
      return [
        "",
        "[previous_truncated_output]",
        formatted,
        "",
        "Use the partial output only as repair context.",
        "Do not continue token-by-token.",
        "Do not copy the broken JSON verbatim.",
        "Rewrite a complete valid JSON object from scratch that preserves the same intended meaning in a shorter form.",
      ].join("\n");
    };

    const buildStageSpecificTruncationGuidance = () => {
      if (stageInput.stageName === "seed") {
        return [
          "For seed, keep reference_derivation to at most 2 short items.",
          "Keep each contribution array to at most 2 short items.",
          "Keep originalization_note to one short sentence.",
        ].join("\n");
      }
      if (stageInput.stageName === "persona_core") {
        return [
          "For persona_core, keep value_hierarchy to at most 4 items.",
          "value_hierarchy must be a JSON array of objects, never a plain string.",
          "Keep worldview to 1 short item.",
          "Keep every array field to at most 2 short items unless the schema requires more.",
          "Keep every task_style_matrix shape field to one short sentence.",
          "Keep voice_fingerprint opening_move, attack_style, praise_style, and closing_move to one short sentence each.",
        ].join("\n");
      }
      return "";
    };

    const buildRetryRepairPrompt = (repairInput: {
      mode: "generic" | "truncated";
      previousTruncatedOutput?: string | null;
      parsedOutput?: Record<string, unknown> | null;
    }) =>
      repairInput.mode === "truncated"
        ? `${basePrompt}\n\n[retry_repair]\nYour previous response for stage ${stageInput.stageName} was truncated before the JSON object was complete.\nRewrite it from scratch in a shorter form.\nReturn strictly valid JSON only.\nKeep every string to one short sentence.\nLimit arrays to at most 2 items unless the schema requires more.\nPrioritize finishing the full JSON object over richness.\nvalue_hierarchy must be a JSON array of {value, priority} objects — never a plain string.\nDo not collapse array fields into strings.${buildTruncatedOutputContext(repairInput.previousTruncatedOutput)}\n${buildStageSpecificTruncationGuidance()}\n${buildRepairSchemaHint(repairInput.parsedOutput ?? null)}\nDo not add commentary.\nDo not omit required keys.`
        : `${basePrompt}\n\n[retry_repair]\nYour previous response for stage ${stageInput.stageName} was invalid or incomplete JSON. Retry once with a shorter response.\nReturn strictly valid JSON only.\nKeep every string concise.\nLimit arrays to at most 3 items.\nvalue_hierarchy must be a JSON array of {value, priority} objects — never a plain string.\nDo not collapse array fields into strings.\n${buildRepairSchemaHint(repairInput.parsedOutput ?? null)}\nDo not add commentary.\nDo not omit required keys.`;

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
      const targetedSchema =
        mentionedKeys.length > 0 && mentionedKeys.length < Object.keys(output).length
          ? mentionedKeys
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
      },
      attemptStage: string,
    ) => {
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
      const firstWasTruncated = isLengthTruncated(first);
      try {
        return attemptParse(first, "attempt-1");
      } catch (error) {
        if (!(error instanceof PersonaGenerationParseError)) {
          throw error;
        }
        const repairPrompt = buildRetryRepairPrompt({
          mode: firstWasTruncated ? "truncated" : "generic",
          previousTruncatedOutput: firstWasTruncated ? first.text : null,
          parsedOutput: null,
        });
        const second = await invokeStageAttempt(repairPrompt, 2);
        return attemptParse(second, "attempt-2");
      }
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
        const delta = parseQualityRepairDelta(qualityRepaired.text);
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

  let seedStage!: PersonaGenerationSeedStage;
  let personaCoreStage!: PersonaGenerationCoreStage;
  let structured!: PersonaGenerationStructured;
  let assembledPrompt!: string;
  let tokenBudget!: PreviewTokenBudget;
  let markdown!: string;

  try {
    seedStage = await runPersonaGenerationStage({
      stageName: PERSONA_GENERATION_TEMPLATE_STAGES[0].name,
      stageGoal: PERSONA_GENERATION_TEMPLATE_STAGES[0].goal,
      stageContract: PERSONA_GENERATION_TEMPLATE_STAGES[0].contract.join("\n"),
      parse: parsePersonaSeedOutput,
      validateQuality: validateSeedStageQuality,
      validateQualityAsync: auditSeedStageSemantics,
      allowedReferenceNames: [],
      outputMaxTokens: PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.seed,
    });

    personaCoreStage = await runPersonaGenerationStage({
      stageName: PERSONA_GENERATION_TEMPLATE_STAGES[1].name,
      stageGoal: PERSONA_GENERATION_TEMPLATE_STAGES[1].goal,
      stageContract: PERSONA_GENERATION_TEMPLATE_STAGES[1].contract.join("\n"),
      parse: parsePersonaCoreStageOutput,
      validateQuality: validatePersonaCoreStageQuality,
      validateQualityAsync: (stage) => auditPersonaCoreStageSemantics(stage, seedStage),
      carryForwardContext: {
        persona: seedStage.persona,
        identity_summary: seedStage.identity_summary,
        reference_sources: seedStage.reference_sources,
      },
      allowedReferenceNames: [
        ...seedStage.reference_sources.map((item) => item.name),
        ...seedStage.other_reference_sources.map((item) => item.name),
      ],
      outputMaxTokens: PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.persona_core,
    });

    const personaCore: PersonaGenerationStructured["persona_core"] = {
      identity_summary: seedStage.identity_summary,
      values: personaCoreStage.values,
      aesthetic_profile: personaCoreStage.aesthetic_profile,
      lived_context: personaCoreStage.lived_context,
      creator_affinity: personaCoreStage.creator_affinity,
      interaction_defaults: personaCoreStage.interaction_defaults,
      guardrails: personaCoreStage.guardrails,
      voice_fingerprint: personaCoreStage.voice_fingerprint,
      task_style_matrix: personaCoreStage.task_style_matrix,
    };

    structured = parsePersonaGenerationOutput(
      JSON.stringify({
        persona: seedStage.persona,
        persona_core: personaCore,
        reference_sources: seedStage.reference_sources,
        other_reference_sources: seedStage.other_reference_sources,
        reference_derivation: seedStage.reference_derivation,
        originalization_note: seedStage.originalization_note,
      }),
    ).structured;
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
