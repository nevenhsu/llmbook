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
  type PersonaGenerationMemoriesStage,
  type PersonaGenerationSeedStage,
  type PersonaGenerationStructured,
  type PreviewResult,
} from "@/lib/ai/admin/control-plane-contract";
import { resolvePersonaTextModel } from "@/lib/ai/admin/control-plane-model-resolution";
import {
  buildTokenBudgetSignal,
  DEFAULT_TOKEN_LIMITS,
  formatPrompt,
} from "@/lib/ai/admin/control-plane-shared";
import {
  collectEnglishOnlyIssues,
  parsePersonaGenerationOutput,
  parsePersonaGenerationSemanticAuditResult,
  parsePersonaContextAndAffinityOutput,
  parsePersonaInteractionOutput,
  parsePersonaMemoriesOutput,
  parsePersonaSeedOutput,
  parsePersonaValuesAndAestheticOutput,
  validateInteractionStageQuality,
  validateMemoriesStageQuality,
  validateSeedStageQuality,
  validateValuesStageQuality,
} from "@/lib/ai/admin/persona-generation-contract";

export async function previewPersonaGeneration(input: {
  modelId: string;
  extraPrompt: string;
  document: AiControlPlaneDocument;
  providers: AiProviderConfig[];
  models: AiModelConfig[];
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

  const buildStagePrompt = (stageInput: {
    stageName: string;
    stageGoal: string;
    stageContract: string;
    validatedContext?: Record<string, unknown> | null;
    contextFormatting?: "compact" | "pretty";
  }) => {
    const validatedContextContent = stageInput.validatedContext
      ? JSON.stringify(
          stageInput.validatedContext,
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
        ].join("\n"),
      },
      ...(stageInput.validatedContext
        ? [
            {
              name: "validated_context",
              content: validatedContextContent ?? "",
            },
          ]
        : []),
      { name: "stage_contract", content: stageInput.stageContract },
      { name: "output_constraints", content: "Output strictly valid JSON." },
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
      "Return exactly one JSON object.",
      "Return raw JSON only. Do not use markdown fences.",
      "passes: boolean",
      "issues: string[]",
      "repairGuidance: string[]",
      "If the note is already sufficient, set passes=true and return empty arrays.",
      "Keep every issue and repairGuidance item short and functional.",
      "",
      "[parsed_stage]",
      JSON.stringify(auditInput.parsedOutput, null, 2),
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
        "Judge semantic meaning, not specific keywords.",
        "Flag unresolved reference-world proper noun leakage in persona.bio, identity_summary, or originalization_note when it keeps the persona too close to the source material.",
        "Check whether originalization_note clearly explains the adaptation into a new identity.",
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
        "originalization_note must explain how the persona is adapted into an original forum-native identity.",
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
        "Return valid audit JSON.",
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

  const auditMemoriesOriginalizationSemantics = async (
    stage: PersonaGenerationMemoriesStage,
    referenceSources: PersonaGenerationStructured["reference_sources"],
  ): Promise<{
    issues: string[];
    repairGuidance: string[];
  }> =>
    runPersonaGenerationSemanticAudit({
      stageName: "memories",
      auditLabel: "memories_originalization_audit",
      instructions: [
        "You are judging whether persona memories stay originalized into forum-native incidents, habits, beliefs, and lived context rather than drifting into canon scenes, in-universe identity, or literal reference roleplay.",
        "Judge semantic meaning, not specific keywords.",
        "Flag reference-world proper nouns or roleplay framing when the memory content reads like the persona is literally inside the source world instead of a forum-native identity.",
      ],
      parsedOutput: {
        persona_memories: stage.persona_memories,
        reference_sources: referenceSources,
      },
      defaultIssue:
        "persona_memories must stay originalized into forum-native incidents, habits, or beliefs instead of literal reference roleplay.",
    });

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
    validatedContext?: Record<string, unknown> | null;
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

    const invokeStageAttempt = async (prompt: string, attempt: 1 | 2 | 3 | 4) =>
      invokeLLM({
        registry,
        taskType: "generic",
        routeOverride: invocationConfig.route,
        modelInput: {
          prompt,
          maxOutputTokens:
            attempt === 1
              ? Math.min(stageInput.outputMaxTokens, maxOutputTokens)
              : attempt === 2
                ? Math.min(PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.repairRetryCap, maxOutputTokens)
                : attempt === 3
                  ? Math.min(
                      PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.compactRetryCap,
                      maxOutputTokens,
                    )
                  : Math.min(
                      PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.qualityRepairCap,
                      maxOutputTokens,
                    ),
          temperature: attempt === 1 ? 0.4 : attempt === 2 ? 0.2 : 0.1,
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

    const invokeQualityRepairAttempt = async (prompt: string, attempt: 1 | 2 | 3) =>
      invokeLLM({
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

    const isLengthTruncated = (result: { text: string; finishReason?: string | null }) =>
      result.finishReason === "length" && result.text.trim().length > 0;

    const hasEmptyOutput = (result: { text: string }) => result.text.trim().length === 0;

    const shouldRetryQualityRepair = (result: {
      text: string;
      finishReason?: string | null;
      error?: string | null;
    }) => isLengthTruncated(result) || hasEmptyOutput(result) || Boolean(result.error);

    const buildQualityRepairFailureMessage = (result: { text: string }) =>
      hasEmptyOutput(result)
        ? `persona generation stage ${stageInput.stageName} quality repair returned empty output`
        : `persona generation stage ${stageInput.stageName} quality repair returned invalid JSON`;

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
      if (stageInput.stageName === "values_and_aesthetic") {
        return [
          "For values_and_aesthetic, keep value_hierarchy to at most 4 items.",
          "Each values.value_hierarchy[*].value must be a short natural-language phrase, not an identifier label.",
          "Keep worldview to 1 short item.",
          "Keep every aesthetic_profile field to at most 1 short item.",
        ].join("\n");
      }
      if (stageInput.stageName === "interaction_and_guardrails") {
        return [
          "For interaction_and_guardrails, keep every array as short as possible.",
          "Use at most 2 items for discussion_strengths, friction_triggers, non_generic_traits, metaphor_domains, and forbidden_shapes.",
          "Keep voice_fingerprint.closing_move as one short string, not an array.",
          "Keep post/comment entry_shape, body_shape, feedback_shape, and close_shape to one short clause each.",
          "voice_fingerprint must still include opening_move, metaphor_domains, attack_style, praise_style, closing_move, and forbidden_shapes.",
          "task_style_matrix.post and task_style_matrix.comment must each include every required shape field and forbidden_shapes.",
        ].join("\n");
      }
      return "";
    };

    const buildRetryRepairPrompt = (repairInput: {
      mode: "generic" | "truncated";
      previousTruncatedOutput?: string | null;
    }) =>
      repairInput.mode === "truncated"
        ? `${basePrompt}\n\n[retry_repair]\nYour previous response for stage ${stageInput.stageName} was truncated before the JSON object was complete.\nRewrite it from scratch in a shorter form.\nReturn strictly valid JSON only.\nKeep every string to one short sentence.\nLimit arrays to at most 2 items unless the schema requires more.\nPrioritize finishing the full JSON object over richness.${buildTruncatedOutputContext(repairInput.previousTruncatedOutput)}\n${buildStageSpecificTruncationGuidance()}\nDo not add commentary.\nDo not omit required keys.`
        : `${basePrompt}\n\n[retry_repair]\nYour previous response for stage ${stageInput.stageName} was invalid or incomplete JSON. Retry once with a shorter response.\nReturn strictly valid JSON only.\nKeep every string concise.\nLimit arrays to at most 3 items.\nDo not add commentary.\nDo not omit required keys.`;

    const buildCompactRepairPrompt = (repairInput: {
      mode: "generic" | "truncated";
      previousTruncatedOutput?: string | null;
    }) =>
      repairInput.mode === "truncated"
        ? `${basePrompt}\n\n[retry_repair]\nYour previous responses for stage ${stageInput.stageName} were truncated before the JSON object was complete.\nReturn a much shorter version from scratch using the same contract.\nReturn strictly valid JSON only.\nKeep every string extremely short.\nUse only 1 item in arrays unless the schema requires more.\nPrefer the shortest valid phrasing for every field.\nPrioritize closing the full JSON object.${buildTruncatedOutputContext(repairInput.previousTruncatedOutput)}\n${buildStageSpecificTruncationGuidance()}\nDo not add commentary.\nDo not omit required keys.`
        : `${basePrompt}\n\n[retry_repair]\nYour previous responses for stage ${stageInput.stageName} were invalid or incomplete JSON.\nReturn a compact version from scratch using the same contract.\nReturn strictly valid JSON only.\nKeep every string very short.\nUse at most 2 items in arrays unless the schema requires more.\nDo not add commentary.\nDo not omit required keys.`;

    const buildFinalTruncationRescuePrompt = (repairInput: {
      previousTruncatedOutput?: string | null;
    }) =>
      `${basePrompt}\n\n[retry_repair]\nYour previous responses for stage ${stageInput.stageName} kept truncating before the JSON object was complete.\nReturn the shortest valid JSON object that still satisfies the exact schema.\nReturn strictly valid JSON only.\nBefore finishing, verify that every required key from stage_contract is present exactly once.\nKeep every string to one short clause.\nUse only 1 item in arrays unless the schema requires more.${buildTruncatedOutputContext(repairInput.previousTruncatedOutput)}\n${buildStageSpecificTruncationGuidance()}\nDo not add commentary.\nDo not omit required keys.`;

    const buildQualityRepairPrompt = (repairInput: {
      qualityIssues: string[];
      previousParsedOutput: T;
      repairGuidance?: string[];
      mode: "initial" | "truncated" | "empty_or_error" | "final_truncated";
      previousTruncatedOutput?: string | null;
    }) =>
      [
        basePrompt,
        "",
        "[quality_repair]",
        repairInput.mode === "truncated"
          ? `Your previous quality-repair response for stage ${stageInput.stageName} was truncated before the JSON object was complete.`
          : repairInput.mode === "final_truncated"
            ? `Your previous quality-repair response for stage ${stageInput.stageName} kept truncating before the JSON object was complete.`
            : repairInput.mode === "empty_or_error"
              ? `Your previous quality-repair response for stage ${stageInput.stageName} was empty or failed before returning JSON.`
              : `Your previous response for stage ${stageInput.stageName} was valid JSON but failed the quality contract.`,
        repairInput.mode === "truncated" || repairInput.mode === "final_truncated"
          ? "Rewrite this stage from scratch in a shorter form while preserving the quality fixes."
          : repairInput.mode === "empty_or_error"
            ? "Rewrite this stage from scratch and return the full JSON object without leaving it blank."
            : "Rewrite this stage from scratch using the same JSON schema.",
        "Use natural-language behavioral descriptions, not enum labels, taxonomy tokens, or snake_case identifiers.",
        "Every style-bearing string should read like prompt-ready persona guidance another model can directly follow.",
        ...(repairInput.mode === "truncated" || repairInput.mode === "final_truncated"
          ? [
              "Keep every string to one short sentence.",
              repairInput.mode === "final_truncated"
                ? "Use only 1 item in arrays unless the schema requires more."
                : "Limit arrays to at most 2 items unless the schema requires more.",
              "Prioritize finishing the full JSON object over richness.",
              buildStageSpecificTruncationGuidance(),
            ]
          : repairInput.mode === "empty_or_error"
            ? [
                "Return strictly valid JSON in one attempt.",
                "Do not return blank output.",
                "Do not defer, explain, or apologize.",
              ]
            : []),
        "Quality issues:",
        ...repairInput.qualityIssues.map((issue) => `- ${issue}`),
        ...(repairInput.repairGuidance?.length
          ? [
              "",
              "Additional repair guidance:",
              ...repairInput.repairGuidance.map((item) => `- ${item}`),
            ]
          : []),
        "",
        "Previous parsed output:",
        JSON.stringify(repairInput.previousParsedOutput, null, 2),
        ...(repairInput.mode === "truncated" || repairInput.mode === "final_truncated"
          ? ["", buildTruncatedOutputContext(repairInput.previousTruncatedOutput)]
          : []),
        "",
        "Return strictly valid JSON only.",
        "Do not add commentary.",
      ]
        .filter((value) => value !== "")
        .join("\n");

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
        });
        const second = await invokeStageAttempt(repairPrompt, 2);
        const secondWasTruncated = isLengthTruncated(second);
        try {
          return attemptParse(second, "attempt-2");
        } catch (secondParseError) {
          if (!(secondParseError instanceof PersonaGenerationParseError)) {
            throw secondParseError;
          }
          const latestTruncatedOutput = secondWasTruncated
            ? second.text
            : firstWasTruncated
              ? first.text
              : null;
          const compactRepairPrompt = buildCompactRepairPrompt({
            mode: latestTruncatedOutput ? "truncated" : "generic",
            previousTruncatedOutput: latestTruncatedOutput,
          });
          const third = await invokeStageAttempt(compactRepairPrompt, 3);
          const thirdWasTruncated = isLengthTruncated(third);
          try {
            return attemptParse(third, "attempt-3");
          } catch (compactError) {
            if (compactError instanceof PersonaGenerationParseError) {
              if (thirdWasTruncated) {
                const fourth = await invokeStageAttempt(
                  buildFinalTruncationRescuePrompt({
                    previousTruncatedOutput: third.text,
                  }),
                  4,
                );
                return attemptParse(fourth, "attempt-4");
              }
              throw compactError;
            }
            throw secondParseError;
          }
        }
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
    let nextRepairMode: "initial" | "truncated" | "empty_or_error" | "final_truncated" = "initial";
    let previousTruncatedOutput: string | null = null;

    for (const attempt of [1, 2, 3] as const) {
      const qualityRepairPrompt = buildQualityRepairPrompt({
        qualityIssues: pendingQualityIssues,
        previousParsedOutput: previousParsedOutput,
        repairGuidance: pendingRepairGuidance,
        mode: nextRepairMode,
        previousTruncatedOutput,
      });

      const qualityRepaired = await invokeQualityRepairAttempt(qualityRepairPrompt, attempt);
      const attemptStage = `quality-repair-${attempt}` as const;

      try {
        const repairedStage = attemptParse(qualityRepaired, attemptStage) as T;
        const repairedQualityResult = await collectStageQualityResult(repairedStage);
        if (repairedQualityResult.issues.length === 0) {
          return repairedQualityResult.normalizedParsedOutput;
        }
        if (attempt === 3) {
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
        nextRepairMode = "initial";
        previousTruncatedOutput = null;
      } catch (error) {
        if (!(error instanceof PersonaGenerationParseError)) {
          throw error;
        }
        if (attempt === 3 || !shouldRetryQualityRepair(qualityRepaired)) {
          throw new PersonaGenerationQualityError({
            stageName: stageInput.stageName,
            message: buildQualityRepairFailureMessage(qualityRepaired),
            rawOutput: error.rawOutput,
            issues: pendingQualityIssues,
            details: error.details,
          });
        }

        const truncated = isLengthTruncated(qualityRepaired);
        nextRepairMode = truncated
          ? attempt === 2
            ? "final_truncated"
            : "truncated"
          : "empty_or_error";
        previousTruncatedOutput = truncated ? qualityRepaired.text : null;
      }
    }

    throw new PersonaGenerationQualityError({
      stageName: stageInput.stageName,
      message: `persona generation stage ${stageInput.stageName} quality repair failed`,
      rawOutput: "",
      issues: pendingQualityIssues,
    });
  };

  const seedStage = await runPersonaGenerationStage({
    stageName: "seed",
    stageGoal: "Establish the persona's identity seed, bio, and explicit references.",
    stageContract: [
      "Return one JSON object with keys:",
      "persona{display_name,bio,status},",
      "identity_summary{archetype,core_motivation,one_sentence_identity},",
      "reference_sources[{name,type,contribution}],",
      "other_reference_sources[{name,type,contribution}],",
      "reference_derivation:string[],",
      "originalization_note:string.",
      "status should be active or inactive.",
      "The final persona must be reference-inspired, not reference-cosplay.",
      "reference_sources must contain only personality-bearing named references such as real people, historical figures, fictional characters, mythic figures, or iconic personas.",
      "Place works, films, books, concepts, methods, principles, groups, places, and other non-personality references in other_reference_sources instead.",
      "Keep named references inside reference_sources, other_reference_sources, and reference_derivation; do not turn bio or identity_summary into the literal canon character.",
      "Avoid copying in-universe goals, titles, adversaries, or mixed-language artifacts into the final persona identity.",
    ].join("\n"),
    parse: parsePersonaSeedOutput,
    validateQuality: validateSeedStageQuality,
    validateQualityAsync: auditSeedStageSemantics,
    allowedReferenceNames: [],
    outputMaxTokens: PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.seed,
  });

  const valuesStage = await runPersonaGenerationStage({
    stageName: "values_and_aesthetic",
    stageGoal: "Define the persona's values and aesthetic taste using the seed identity.",
    stageContract: [
      "Return one JSON object with keys:",
      "values{value_hierarchy,worldview,judgment_style},",
      "aesthetic_profile{humor_preferences,narrative_preferences,creative_preferences,disliked_patterns,taste_boundaries}.",
      "value_hierarchy must be an array of {value,priority} objects.",
      "Write values and aesthetic preferences as natural-language persona guidance, not snake_case labels or keyword bundles.",
    ].join("\n"),
    parse: parsePersonaValuesAndAestheticOutput,
    validateQuality: validateValuesStageQuality,
    validatedContext: seedStage,
    allowedReferenceNames: [
      ...seedStage.reference_sources.map((item) => item.name),
      ...seedStage.other_reference_sources.map((item) => item.name),
    ],
    outputMaxTokens: PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.values_and_aesthetic,
  });

  const contextStage = await runPersonaGenerationStage({
    stageName: "context_and_affinity",
    stageGoal: "Ground the persona in lived context and creator affinity.",
    stageContract: [
      "Return one JSON object with keys:",
      "lived_context{familiar_scenes_of_life,personal_experience_flavors,cultural_contexts,topics_with_confident_grounding,topics_requiring_runtime_retrieval},",
      "creator_affinity{admired_creator_types,structural_preferences,detail_selection_habits,creative_biases}.",
    ].join("\n"),
    parse: parsePersonaContextAndAffinityOutput,
    validatedContext: {
      ...seedStage,
      ...valuesStage,
    },
    allowedReferenceNames: [
      ...seedStage.reference_sources.map((item) => item.name),
      ...seedStage.other_reference_sources.map((item) => item.name),
    ],
    outputMaxTokens: PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.context_and_affinity,
  });

  const interactionStage = await runPersonaGenerationStage({
    stageName: "interaction_and_guardrails",
    stageGoal: "Define how the persona behaves in discussion and what it avoids.",
    stageContract: [
      "Return one JSON object with keys:",
      "interaction_defaults{default_stance,discussion_strengths,friction_triggers,non_generic_traits},",
      "guardrails{hard_no,deescalation_style},",
      "voice_fingerprint{opening_move,metaphor_domains,attack_style,praise_style,closing_move,forbidden_shapes},",
      "task_style_matrix{post{entry_shape,body_shape,close_shape,forbidden_shapes},comment{entry_shape,feedback_shape,close_shape,forbidden_shapes}}.",
      "Use natural-language behavioral descriptions, not enum labels or taxonomy tokens.",
      "Do not output snake_case identifier-style values like impulsive_challenge or bold_declaration.",
      "Every style-bearing string should read like prompt-ready persona guidance another model can directly follow.",
    ].join("\n"),
    parse: parsePersonaInteractionOutput,
    validateQuality: validateInteractionStageQuality,
    validatedContext: {
      ...seedStage,
      ...valuesStage,
      ...contextStage,
    },
    allowedReferenceNames: [
      ...seedStage.reference_sources.map((item) => item.name),
      ...seedStage.other_reference_sources.map((item) => item.name),
    ],
    outputMaxTokens: PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.interaction_and_guardrails,
  });

  const personaCore = {
    identity_summary: seedStage.identity_summary,
    values: valuesStage.values,
    aesthetic_profile: valuesStage.aesthetic_profile,
    lived_context: contextStage.lived_context,
    creator_affinity: contextStage.creator_affinity,
    interaction_defaults: interactionStage.interaction_defaults,
    guardrails: interactionStage.guardrails,
    voice_fingerprint: interactionStage.voice_fingerprint,
    task_style_matrix: interactionStage.task_style_matrix,
  };

  const memoriesStage = await runPersonaGenerationStage({
    stageName: "memories",
    stageGoal: "Optionally add a few useful canonical or recent persona memories.",
    stageContract: [
      "Return one JSON object with key:",
      "persona_memories[{memory_type,scope,memory_key,content,metadata,expires_in_hours,is_canonical,importance}].",
      "persona_memories may be an empty array if no useful memories should be added.",
      "memory_type must be memory or long_memory.",
      "scope must be persona, thread, or task.",
      "Keep memories reference-inspired, not reference-cosplay.",
      "Describe forum-native incidents, habits, or beliefs; do not narrate canon scenes or speak as the literal reference character.",
    ].join("\n"),
    parse: parsePersonaMemoriesOutput,
    validateQuality: (stage) => validateMemoriesStageQuality(stage),
    validateQualityAsync: (stage) =>
      auditMemoriesOriginalizationSemantics(stage, seedStage.reference_sources),
    validatedContext: {
      persona: seedStage.persona,
      persona_core: personaCore,
      reference_sources: seedStage.reference_sources,
      other_reference_sources: seedStage.other_reference_sources,
    },
    allowedReferenceNames: [
      ...seedStage.reference_sources.map((item) => item.name),
      ...seedStage.other_reference_sources.map((item) => item.name),
    ],
    outputMaxTokens: PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.memories,
  });

  const structured = parsePersonaGenerationOutput(
    JSON.stringify({
      persona: seedStage.persona,
      persona_core: personaCore,
      reference_sources: seedStage.reference_sources,
      other_reference_sources: seedStage.other_reference_sources,
      reference_derivation: seedStage.reference_derivation,
      originalization_note: seedStage.originalization_note,
      persona_memories: memoriesStage.persona_memories,
    }),
  ).structured;
  const assembledPrompt = stagePromptRecords
    .map((stage, index) => `### Stage ${index + 1}: ${stage.name}\n${stage.displayPrompt}`)
    .join("\n\n");
  const tokenBudget = buildTokenBudgetSignal({
    blocks: stagePromptRecords.map((stage) => ({ name: stage.name, content: stage.prompt })),
    maxInputTokens:
      DEFAULT_TOKEN_LIMITS.personaGenerationMaxInputTokens * stagePromptRecords.length,
    maxOutputTokens: PERSONA_GENERATION_PREVIEW_MAX_OUTPUT_TOKENS,
  });

  const markdown = [
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
    "",
    `### persona_memories (${structured.persona_memories.length})`,
    "```json",
    JSON.stringify(structured.persona_memories, null, 2),
    "```",
  ].join("\n");

  try {
    markdownToEditorHtml(markdown);
    return {
      assembledPrompt,
      markdown,
      renderOk: true,
      renderError: null,
      tokenBudget,
      structured,
    };
  } catch (error) {
    return {
      assembledPrompt,
      markdown,
      renderOk: false,
      renderError: error instanceof Error ? error.message : "render validation failed",
      tokenBudget,
      structured,
    };
  }
}
