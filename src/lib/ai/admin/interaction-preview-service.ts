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
  parsePostActionOutput,
} from "@/lib/ai/prompt-runtime/action-output";
import type {
  AiControlPlaneDocument,
  AiModelConfig,
  AiProviderConfig,
  PersonaProfile,
  PreviewAuditDiagnostics,
  PreviewResult,
  PromptBoardContext,
  PromptTargetContext,
} from "@/lib/ai/admin/control-plane-contract";
import type { PromptActionType } from "@/lib/ai/prompt-runtime/prompt-builder";
import { resolvePersonaTextModel } from "@/lib/ai/admin/control-plane-model-resolution";
import {
  buildPromptBlocks,
  buildTokenBudgetSignal,
  DEFAULT_TOKEN_LIMITS,
  formatAgentMemory,
  formatAgentProfile,
  formatAgentRelationshipContext,
  formatBoardContext,
  formatPrompt,
  formatTargetContext,
} from "@/lib/ai/admin/control-plane-shared";

export async function runPersonaInteraction(input: {
  personaId: string;
  modelId: string;
  taskType: PromptActionType;
  taskContext: string;
  boardContext?: PromptBoardContext;
  targetContext?: PromptTargetContext;
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
}): Promise<PreviewResult> {
  const { model, provider } = resolvePersonaTextModel({
    modelId: input.modelId,
    models: input.models,
    providers: input.providers,
    featureLabel: "interaction preview",
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
  const personaMemory = profile.personaMemories
    .filter((item) => item.memoryType === "memory")
    .map((item) => item.content)
    .join("\n");
  const longMemoryText = profile.personaMemories
    .filter((item) => item.memoryType === "long_memory")
    .map((item) => item.content)
    .join("\n");
  const effectivePersonaCore = profile.personaCore as Record<string, unknown>;
  const runtimePersonaProfile = normalizeCoreProfile(effectivePersonaCore).profile;
  const personaDirectiveActionType = input.taskType === "post" ? "post" : "comment";
  const personaPromptDirectives = derivePromptPersonaDirectives({
    actionType: personaDirectiveActionType,
    profile: runtimePersonaProfile,
    personaCore: effectivePersonaCore,
  });
  const personaCoreSummary = buildInteractionCoreSummary({
    actionType: input.taskType === "post" ? "post" : "comment",
    profile: runtimePersonaProfile,
    personaCore: effectivePersonaCore,
    shortTermMemory: personaMemory,
    longTermMemory: longMemoryText,
  });
  const defaultStance =
    typeof (effectivePersonaCore.interaction_defaults as Record<string, unknown> | undefined)
      ?.default_stance === "string"
      ? (
          (effectivePersonaCore.interaction_defaults as Record<string, unknown>)
            .default_stance as string
        ).trim()
      : "";

  const blocks = buildPromptBlocks({
    actionType: input.taskType,
    globalDraft: input.document.globalPolicyDraft,
    outputStyle: input.document.globalPolicyDraft.styleGuide,
    agentProfile: formatAgentProfile({
      displayName: profile.persona.display_name,
      username: profile.persona.username,
      bio: profile.persona.bio,
    }),
    agentCore: [personaCoreSummary, defaultStance ? `default_stance: ${defaultStance}` : null]
      .filter((item): item is string => Boolean(item))
      .join("\n\n"),
    agentVoiceContract: personaPromptDirectives.voiceContract.join("\n"),
    agentMemory: formatAgentMemory({
      shortTerm: personaMemory,
      longTerm: longMemoryText,
    }),
    agentRelationshipContext: formatAgentRelationshipContext({
      runtimePersonaProfile,
      targetContext: input.targetContext,
    }),
    boardContext: formatBoardContext(input.boardContext),
    targetContext: formatTargetContext({
      taskType: input.taskType,
      targetContext: input.targetContext,
    }),
    agentEnactmentRules: personaPromptDirectives.enactmentRules.join("\n"),
    agentAntiStyleRules: personaPromptDirectives.antiStyleRules.join("\n"),
    agentExamples: personaPromptDirectives.inCharacterExamples
      .map((example) =>
        [`Scenario: ${example.scenario}`, `Response: ${example.response}`].join("\n"),
      )
      .join("\n\n"),
    taskContext: input.taskContext,
  });

  const tokenBudget = buildTokenBudgetSignal({
    blocks,
    maxInputTokens: DEFAULT_TOKEN_LIMITS.interactionMaxInputTokens,
    maxOutputTokens: DEFAULT_TOKEN_LIMITS.interactionMaxOutputTokens,
  });

  const assembledPrompt = formatPrompt(blocks);
  const interactionOutputBudgets = getInteractionRuntimeBudgets(input.taskType);

  const invokePreviewAttempt = async (
    prompt: string,
    maxOutputTokens: number,
    temperature: number,
  ) =>
    invokeLLM({
      registry,
      taskType: "generic",
      routeOverride: invocationConfig.route,
      modelInput: {
        prompt,
        maxOutputTokens,
        temperature,
      },
      entityId: `interaction-preview:${model.id}`,
      timeoutMs: invocationConfig.timeoutMs,
      retries: Math.min(invocationConfig.retries ?? 0, ADMIN_UI_LLM_PROVIDER_RETRIES),
      onProviderError: async (event) => {
        await input.recordLlmInvocationError({
          providerKey: event.providerId,
          modelKey: event.modelId,
          error: event.error,
          errorDetails: event.errorDetails,
        });
      },
    });

  let llmResult = await invokePreviewAttempt(
    assembledPrompt,
    Math.min(
      model.maxOutputTokens ?? interactionOutputBudgets.initial,
      interactionOutputBudgets.initial,
    ),
    0.3,
  );

  if (!llmResult.text.trim()) {
    throw new Error(
      llmResult.error ??
        `interaction preview returned empty output (finishReason=${String(llmResult.finishReason ?? "unknown")})`,
    );
  }

  let normalizedOutput = llmResult.text.trim();
  let markdown = "";
  let previewAuditDiagnostics: PreviewAuditDiagnostics | null = null;

  const runPersonaAudit = async (
    actionType: Extract<PromptActionType, "post" | "comment">,
    renderedOutput: string,
    failureCode: "persona_audit_invalid" | "persona_repair_invalid",
  ): Promise<
    PersonaAuditResult & {
      auditMode: PersonaOutputAuditPromptMode;
      compactRetryUsed: boolean;
    }
  > => {
    const observedIssues = detectPersonaVoiceDrift(renderedOutput);
    let auditMode: PersonaOutputAuditPromptMode = "default";
    let compactRetryUsed = false;
    const parseAuditText = (auditText: string): PersonaAuditResult => {
      try {
        return parsePersonaAuditResult(auditText);
      } catch (error) {
        if (error instanceof PersonaOutputValidationError) {
          throw new PersonaOutputValidationError({
            code: failureCode,
            message: error.message,
            rawOutput: auditText,
          });
        }
        throw error;
      }
    };
    const runCompactAuditAttempt = async (): Promise<PersonaAuditResult> => {
      compactRetryUsed = true;
      auditMode = "compact";
      const compactAuditPrompt = buildPersonaOutputAuditPrompt({
        actionType,
        taskContext: input.taskContext,
        renderedOutput,
        directives: personaPromptDirectives,
        observedIssues,
        mode: "compact",
      });
      const compactAuditResult = await invokePreviewAttempt(
        compactAuditPrompt,
        Math.min(
          model.maxOutputTokens ?? interactionOutputBudgets.compactPersonaAudit,
          interactionOutputBudgets.compactPersonaAudit,
        ),
        0,
      );
      const compactAuditText = compactAuditResult.text.trim();
      if (!compactAuditText) {
        throw new PersonaOutputValidationError({
          code: failureCode,
          message:
            failureCode === "persona_audit_invalid"
              ? "Persona audit returned empty output."
              : "Persona re-audit returned empty output.",
          rawOutput: compactAuditResult.text,
        });
      }
      return parseAuditText(compactAuditText);
    };
    const auditPrompt = buildPersonaOutputAuditPrompt({
      actionType,
      taskContext: input.taskContext,
      renderedOutput,
      directives: personaPromptDirectives,
      observedIssues,
    });
    const auditResult = await invokePreviewAttempt(
      auditPrompt,
      Math.min(
        model.maxOutputTokens ?? interactionOutputBudgets.personaAudit,
        interactionOutputBudgets.personaAudit,
      ),
      0,
    );
    const auditText = auditResult.text.trim();
    if (!auditText) {
      const compactAudit = await runCompactAuditAttempt();
      return {
        ...compactAudit,
        auditMode,
        compactRetryUsed,
      };
    }
    try {
      const parsedAudit = parseAuditText(auditText);
      return {
        ...parsedAudit,
        auditMode,
        compactRetryUsed,
      };
    } catch (error) {
      if (auditMode === "default" && isRetryablePersonaAuditParseFailure(error)) {
        const compactAudit = await runCompactAuditAttempt();
        return {
          ...compactAudit,
          auditMode,
          compactRetryUsed,
        };
      }
      throw error;
    }
  };

  if (input.taskType === "post") {
    let parsed = parsePostActionOutput(normalizedOutput);
    if (parsed.error) {
      const repairPrompt = [
        assembledPrompt,
        "",
        "[retry_repair]",
        "Your previous response was invalid for the required post JSON contract.",
        "Rewrite it as exactly one valid JSON object using the same language.",
        "Required keys: title, body, tags, need_image, image_prompt, image_alt.",
        "The tags array must contain 1 to 5 hashtags like #cthulhu.",
        "Return JSON only. Do not use markdown fences.",
        "",
        "[previous_invalid_response]",
        normalizedOutput,
      ].join("\n");
      const repaired = await invokePreviewAttempt(
        repairPrompt,
        Math.min(
          model.maxOutputTokens ?? interactionOutputBudgets.schemaRepair,
          interactionOutputBudgets.schemaRepair,
        ),
        0.15,
      );
      if (repaired.text.trim()) {
        normalizedOutput = repaired.text.trim();
        parsed = parsePostActionOutput(normalizedOutput);
        llmResult = repaired;
      }
    }
    if (parsed.error) {
      throw new PersonaOutputValidationError({
        code: "schema_validation_failed",
        message: parsed.error,
        rawOutput: normalizedOutput,
      });
    }

    const toRenderedPost = () =>
      [
        parsed.title ? `# ${parsed.title}` : null,
        parsed.tags.join(" ").trim() || null,
        parsed.body.trim(),
      ]
        .filter((part): part is string => Boolean(part))
        .join("\n\n")
        .trim();

    const initialAudit = await runPersonaAudit("post", toRenderedPost(), "persona_audit_invalid");
    if (!initialAudit.passes) {
      const repaired = await invokePreviewAttempt(
        buildPersonaVoiceRepairPrompt({
          assembledPrompt,
          rawOutput: normalizedOutput,
          actionType: "post",
          directives: personaPromptDirectives,
          issues: initialAudit.issues,
          repairGuidance: initialAudit.repairGuidance,
          severity: initialAudit.severity,
          missingSignals: initialAudit.missingSignals,
        }),
        Math.min(
          model.maxOutputTokens ?? interactionOutputBudgets.personaRepair,
          interactionOutputBudgets.personaRepair,
        ),
        0.15,
      );
      const repairedText = repaired.text.trim();
      if (!repairedText) {
        throw new PersonaOutputValidationError({
          code: "persona_repair_invalid",
          message: "Persona repair returned empty output.",
          issues: initialAudit.issues,
          repairGuidance: initialAudit.repairGuidance,
          severity: initialAudit.severity,
          confidence: initialAudit.confidence,
          missingSignals: initialAudit.missingSignals,
          rawOutput: repaired.text,
        });
      }
      const repairedParsed = parsePostActionOutput(repairedText);
      if (repairedParsed.error) {
        throw new PersonaOutputValidationError({
          code: "persona_repair_invalid",
          message: repairedParsed.error,
          issues: initialAudit.issues,
          repairGuidance: initialAudit.repairGuidance,
          severity: initialAudit.severity,
          confidence: initialAudit.confidence,
          missingSignals: initialAudit.missingSignals,
          rawOutput: repairedText,
        });
      }
      parsed = repairedParsed;
      normalizedOutput = repairedText;
      llmResult = repaired;
      const repairedAudit = await runPersonaAudit(
        "post",
        toRenderedPost(),
        "persona_repair_invalid",
      );
      if (!repairedAudit.passes) {
        throw new PersonaOutputValidationError({
          code: "persona_repair_failed",
          message: "Repaired output still failed persona audit.",
          issues: repairedAudit.issues,
          repairGuidance: repairedAudit.repairGuidance,
          severity: repairedAudit.severity,
          confidence: repairedAudit.confidence,
          missingSignals: repairedAudit.missingSignals,
          rawOutput: normalizedOutput,
        });
      }
      previewAuditDiagnostics = {
        status: "passed_after_repair",
        issues: initialAudit.issues,
        repairGuidance: initialAudit.repairGuidance,
        severity: initialAudit.severity,
        confidence: initialAudit.confidence,
        missingSignals: initialAudit.missingSignals,
        repairApplied: true,
        auditMode: repairedAudit.auditMode,
        compactRetryUsed: initialAudit.compactRetryUsed || repairedAudit.compactRetryUsed,
      };
    } else {
      previewAuditDiagnostics = {
        status: "passed",
        issues: initialAudit.issues,
        repairGuidance: initialAudit.repairGuidance,
        severity: initialAudit.severity,
        confidence: initialAudit.confidence,
        missingSignals: initialAudit.missingSignals,
        repairApplied: false,
        auditMode: initialAudit.auditMode,
        compactRetryUsed: initialAudit.compactRetryUsed,
      };
    }

    markdown = [
      parsed.title ? `# ${parsed.title}` : null,
      parsed.tags.join(" ").trim() || null,
      parsed.body.trim(),
    ]
      .filter((part): part is string => Boolean(part))
      .join("\n\n")
      .trim();
  } else if (input.taskType === "comment") {
    let parsed = parseMarkdownActionOutput(normalizedOutput);
    if (!parsed.markdown.trim()) {
      throw new PersonaOutputValidationError({
        code: "schema_validation_failed",
        message: "interaction preview returned empty markdown",
        rawOutput: normalizedOutput,
      });
    }
    const initialAudit = await runPersonaAudit("comment", parsed.markdown, "persona_audit_invalid");
    if (!initialAudit.passes) {
      const repaired = await invokePreviewAttempt(
        buildPersonaVoiceRepairPrompt({
          assembledPrompt,
          rawOutput: normalizedOutput,
          actionType: "comment",
          directives: personaPromptDirectives,
          issues: initialAudit.issues,
          repairGuidance: initialAudit.repairGuidance,
          severity: initialAudit.severity,
          missingSignals: initialAudit.missingSignals,
        }),
        Math.min(
          model.maxOutputTokens ?? interactionOutputBudgets.personaRepair,
          interactionOutputBudgets.personaRepair,
        ),
        0.15,
      );
      const repairedText = repaired.text.trim();
      if (!repairedText) {
        throw new PersonaOutputValidationError({
          code: "persona_repair_invalid",
          message: "Persona repair returned empty output.",
          issues: initialAudit.issues,
          repairGuidance: initialAudit.repairGuidance,
          severity: initialAudit.severity,
          confidence: initialAudit.confidence,
          missingSignals: initialAudit.missingSignals,
          rawOutput: repaired.text,
        });
      }
      const repairedParsed = parseMarkdownActionOutput(repairedText);
      if (!repairedParsed.markdown.trim()) {
        throw new PersonaOutputValidationError({
          code: "persona_repair_invalid",
          message: "Persona repair returned empty markdown.",
          issues: initialAudit.issues,
          repairGuidance: initialAudit.repairGuidance,
          severity: initialAudit.severity,
          confidence: initialAudit.confidence,
          missingSignals: initialAudit.missingSignals,
          rawOutput: repairedText,
        });
      }
      normalizedOutput = repairedText;
      parsed = repairedParsed;
      llmResult = repaired;
      const repairedAudit = await runPersonaAudit(
        "comment",
        parsed.markdown,
        "persona_repair_invalid",
      );
      if (!repairedAudit.passes) {
        throw new PersonaOutputValidationError({
          code: "persona_repair_failed",
          message: "Repaired output still failed persona audit.",
          issues: repairedAudit.issues,
          repairGuidance: repairedAudit.repairGuidance,
          severity: repairedAudit.severity,
          confidence: repairedAudit.confidence,
          missingSignals: repairedAudit.missingSignals,
          rawOutput: normalizedOutput,
        });
      }
      previewAuditDiagnostics = {
        status: "passed_after_repair",
        issues: initialAudit.issues,
        repairGuidance: initialAudit.repairGuidance,
        severity: initialAudit.severity,
        confidence: initialAudit.confidence,
        missingSignals: initialAudit.missingSignals,
        repairApplied: true,
        auditMode: repairedAudit.auditMode,
        compactRetryUsed: initialAudit.compactRetryUsed || repairedAudit.compactRetryUsed,
      };
    } else {
      previewAuditDiagnostics = {
        status: "passed",
        issues: initialAudit.issues,
        repairGuidance: initialAudit.repairGuidance,
        severity: initialAudit.severity,
        confidence: initialAudit.confidence,
        missingSignals: initialAudit.missingSignals,
        repairApplied: false,
        auditMode: initialAudit.auditMode,
        compactRetryUsed: initialAudit.compactRetryUsed,
      };
    }
    markdown = parsed.markdown.trim();
  } else {
    markdown = ["```json", normalizedOutput, "```"].join("\n");
  }

  if (!markdown) {
    throw new Error("interaction preview returned empty markdown");
  }

  try {
    markdownToEditorHtml(markdown);
    return {
      assembledPrompt,
      markdown,
      rawResponse: normalizedOutput,
      renderOk: true,
      renderError: null,
      tokenBudget: {
        ...tokenBudget,
        maxOutputTokens: interactionOutputBudgets.initial,
      },
      auditDiagnostics: previewAuditDiagnostics,
    };
  } catch (error) {
    if (error instanceof PersonaOutputValidationError) {
      throw error;
    }
    return {
      assembledPrompt,
      markdown,
      rawResponse: normalizedOutput,
      renderOk: false,
      renderError: error instanceof Error ? error.message : "render validation failed",
      tokenBudget: {
        ...tokenBudget,
        maxOutputTokens: interactionOutputBudgets.initial,
      },
      auditDiagnostics: previewAuditDiagnostics,
    };
  }
}

export async function previewPersonaInteraction(input: {
  personaId: string;
  modelId: string;
  taskType: PromptActionType;
  taskContext: string;
  boardContext?: PromptBoardContext;
  targetContext?: PromptTargetContext;
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
}): Promise<PreviewResult> {
  return runPersonaInteraction(input);
}
