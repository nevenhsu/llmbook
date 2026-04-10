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
  parsePostActionOutput,
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
  formatAgentProfile,
  formatBoardContext,
  formatPrompt,
  formatTargetContext,
} from "@/lib/ai/admin/control-plane-shared";

export type AiAgentPersonaInteractionInput = {
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
    const { model, provider } = resolvePersonaTextModel({
      modelId: input.modelId,
      models: input.models,
      providers: input.providers,
      featureLabel: "persona interaction",
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
    const runtimePersonaProfile = normalizeCoreProfile(effectivePersonaCore).profile;
    const personaDirectiveActionType =
      input.taskType === "post" || input.taskType === "post_body" || input.taskType === "post_plan"
        ? "post"
        : "comment";
    const personaPromptDirectives = derivePromptPersonaDirectives({
      actionType: personaDirectiveActionType,
      profile: runtimePersonaProfile,
      personaCore: effectivePersonaCore,
    });
    const personaEvidence = buildPersonaEvidence({
      displayName: profile.persona.display_name,
      profile: runtimePersonaProfile,
      personaCore: effectivePersonaCore,
    });
    const personaCoreSummary = buildInteractionCoreSummary({
      actionType:
        input.taskType === "post" ||
        input.taskType === "post_body" ||
        input.taskType === "post_plan"
          ? "post"
          : input.taskType === "reply"
            ? "reply"
            : "comment",
      profile: runtimePersonaProfile,
      personaCore: effectivePersonaCore,
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
      plannerMode:
        input.taskType === "post_plan"
          ? "This stage is planning and scoring, not final writing."
          : undefined,
      agentCore: [personaCoreSummary, defaultStance ? `default_stance: ${defaultStance}` : null]
        .filter((item): item is string => Boolean(item))
        .join("\n\n"),
      agentPostingLens:
        input.taskType === "post_plan"
          ? buildPlannerPostingLens({
              profile: runtimePersonaProfile,
              personaCore: effectivePersonaCore,
            }).join("\n")
          : undefined,
      planningScoringContract:
        input.taskType === "post_plan"
          ? "Return exactly 3 candidates with conservative scores."
          : undefined,
      agentVoiceContract: personaPromptDirectives.voiceContract.join("\n"),
      boardContext: input.boardContextText ?? formatBoardContext(input.boardContext),
      targetContext:
        input.targetContextText ??
        formatTargetContext({
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

    const invokeInteractionAttempt = async (
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
        entityId: `persona-interaction:${model.id}`,
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

    let llmResult = await invokeInteractionAttempt(
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
          `persona interaction returned empty output (finishReason=${String(llmResult.finishReason ?? "unknown")})`,
      );
    }

    let normalizedOutput = llmResult.text.trim();
    let markdown = "";
    let auditDiagnostics: PreviewAuditDiagnostics | null = null;

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
        const compactAuditResult = await invokeInteractionAttempt(
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
      const auditResult = await invokeInteractionAttempt(
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

    const readLockedTitleFromSelectedPlan = (): string | null => {
      const source = input.targetContextText ?? "";
      const match = source.match(/^Locked title:\s*(.+)$/m);
      const title = match?.[1]?.trim() ?? "";
      return title.length > 0 ? title : null;
    };

    const renderLockedPost = (postBody: { body: string; tags: string[] }): string => {
      const lockedTitle = readLockedTitleFromSelectedPlan();
      return [
        lockedTitle ? `# ${lockedTitle}` : null,
        postBody.tags.join(" ").trim() || null,
        postBody.body.trim(),
      ]
        .filter((part): part is string => Boolean(part))
        .join("\n\n")
        .trim();
    };

    const runPostBodyAudit = async (
      renderedOutput: string,
      failureCode: "persona_audit_invalid" | "persona_repair_invalid",
    ) => {
      const auditPrompt = buildPostBodyAuditPrompt({
        boardContextText: input.boardContextText,
        selectedPostPlanText:
          input.targetContextText ?? "[selected_post_plan]\nNo selected post plan available.",
        renderedFinalPost: renderedOutput,
        personaEvidence,
      });
      const auditResult = await invokeInteractionAttempt(
        auditPrompt,
        Math.min(
          model.maxOutputTokens ?? interactionOutputBudgets.personaAudit,
          interactionOutputBudgets.personaAudit,
        ),
        0,
      );
      const auditText = auditResult.text.trim();
      if (!auditText) {
        throw new PersonaOutputValidationError({
          code: failureCode,
          message:
            failureCode === "persona_audit_invalid"
              ? "Post body audit returned empty output."
              : "Post body re-audit returned empty output.",
          rawOutput: auditResult.text,
        });
      }
      try {
        return parsePostBodyAuditResult(auditText);
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

    const extractTargetBlock = (blockName: string): string | null => {
      const source = input.targetContextText ?? "";
      const marker = `[${blockName}]`;
      const start = source.indexOf(marker);
      if (start < 0) {
        return null;
      }
      const rest = source.slice(start + marker.length);
      const nextOffset = rest.search(/\n\[[^\n]+\]/);
      return nextOffset === -1
        ? source.slice(start).trim()
        : source.slice(start, start + marker.length + nextOffset).trim();
    };

    const runCommentAudit = async (
      markdown: string,
      failureCode: "persona_audit_invalid" | "persona_repair_invalid",
    ) => {
      const auditPrompt = buildCommentAuditPrompt({
        personaEvidence,
        rootPostText: extractTargetBlock("root_post"),
        recentTopLevelCommentsText: extractTargetBlock("recent_top_level_comments"),
        generatedComment: markdown,
      });
      const auditResult = await invokeInteractionAttempt(
        auditPrompt,
        Math.min(
          model.maxOutputTokens ?? interactionOutputBudgets.personaAudit,
          interactionOutputBudgets.personaAudit,
        ),
        0,
      );
      const auditText = auditResult.text.trim();
      if (!auditText) {
        throw new PersonaOutputValidationError({
          code: failureCode,
          message:
            failureCode === "persona_audit_invalid"
              ? "Comment audit returned empty output."
              : "Comment re-audit returned empty output.",
          rawOutput: auditResult.text,
        });
      }
      try {
        return parseCommentAuditResult(auditText);
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

    const runReplyAudit = async (
      markdown: string,
      failureCode: "persona_audit_invalid" | "persona_repair_invalid",
    ) => {
      const auditPrompt = buildReplyAuditPrompt({
        personaEvidence,
        sourceCommentText: extractTargetBlock("source_comment"),
        ancestorCommentsText: extractTargetBlock("ancestor_comments"),
        generatedReply: markdown,
      });
      const auditResult = await invokeInteractionAttempt(
        auditPrompt,
        Math.min(
          model.maxOutputTokens ?? interactionOutputBudgets.personaAudit,
          interactionOutputBudgets.personaAudit,
        ),
        0,
      );
      const auditText = auditResult.text.trim();
      if (!auditText) {
        throw new PersonaOutputValidationError({
          code: failureCode,
          message:
            failureCode === "persona_audit_invalid"
              ? "Reply audit returned empty output."
              : "Reply re-audit returned empty output.",
          rawOutput: auditResult.text,
        });
      }
      try {
        return parseReplyAuditResult(auditText);
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
        const repaired = await invokeInteractionAttempt(
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
        const repaired = await invokeInteractionAttempt(
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
        auditDiagnostics = {
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
        auditDiagnostics = {
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
          message: "persona interaction returned empty markdown",
          rawOutput: normalizedOutput,
        });
      }
      const initialAudit = await runCommentAudit(parsed.markdown, "persona_audit_invalid");
      if (!initialAudit.passes) {
        const repaired = await invokeInteractionAttempt(
          buildCommentRepairPrompt({
            personaEvidence,
            rootPostText: extractTargetBlock("root_post"),
            recentTopLevelCommentsText: extractTargetBlock("recent_top_level_comments"),
            issues: initialAudit.issues,
            repairGuidance: initialAudit.repairGuidance,
            previousOutput: normalizedOutput,
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
            message: "Comment repair returned empty output.",
            issues: initialAudit.issues,
            repairGuidance: initialAudit.repairGuidance,
            rawOutput: repaired.text,
          });
        }
        const repairedParsed = parseMarkdownActionOutput(repairedText);
        if (!repairedParsed.markdown.trim()) {
          throw new PersonaOutputValidationError({
            code: "persona_repair_invalid",
            message: "Comment repair returned empty markdown.",
            issues: initialAudit.issues,
            repairGuidance: initialAudit.repairGuidance,
            rawOutput: repairedText,
          });
        }
        normalizedOutput = repairedText;
        parsed = repairedParsed;
        llmResult = repaired;
        const repairedAudit = await runCommentAudit(parsed.markdown, "persona_repair_invalid");
        if (!repairedAudit.passes) {
          throw new PersonaOutputValidationError({
            code: "persona_repair_failed",
            message: "Repaired output still failed comment audit.",
            issues: repairedAudit.issues,
            repairGuidance: repairedAudit.repairGuidance,
            rawOutput: normalizedOutput,
          });
        }
        auditDiagnostics = {
          contract: "comment_audit",
          status: "passed_after_repair",
          issues: initialAudit.issues,
          repairGuidance: initialAudit.repairGuidance,
          severity: "low",
          confidence: 1,
          missingSignals: [],
          repairApplied: true,
          auditMode: "compact",
          compactRetryUsed: false,
          checks: repairedAudit.checks,
        };
      } else {
        auditDiagnostics = {
          contract: "comment_audit",
          status: "passed",
          issues: initialAudit.issues,
          repairGuidance: initialAudit.repairGuidance,
          severity: "low",
          confidence: 1,
          missingSignals: [],
          repairApplied: false,
          auditMode: "compact",
          compactRetryUsed: false,
          checks: initialAudit.checks,
        };
      }
      markdown = parsed.markdown.trim();
    } else if (input.taskType === "reply") {
      let parsed = parseMarkdownActionOutput(normalizedOutput);
      if (!parsed.markdown.trim()) {
        throw new PersonaOutputValidationError({
          code: "schema_validation_failed",
          message: "persona interaction returned empty markdown",
          rawOutput: normalizedOutput,
        });
      }
      const initialAudit = await runReplyAudit(parsed.markdown, "persona_audit_invalid");
      if (!initialAudit.passes) {
        const repaired = await invokeInteractionAttempt(
          buildReplyRepairPrompt({
            personaEvidence,
            sourceCommentText: extractTargetBlock("source_comment"),
            ancestorCommentsText: extractTargetBlock("ancestor_comments"),
            issues: initialAudit.issues,
            repairGuidance: initialAudit.repairGuidance,
            previousOutput: normalizedOutput,
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
            message: "Reply repair returned empty output.",
            issues: initialAudit.issues,
            repairGuidance: initialAudit.repairGuidance,
            rawOutput: repaired.text,
          });
        }
        const repairedParsed = parseMarkdownActionOutput(repairedText);
        if (!repairedParsed.markdown.trim()) {
          throw new PersonaOutputValidationError({
            code: "persona_repair_invalid",
            message: "Reply repair returned empty markdown.",
            issues: initialAudit.issues,
            repairGuidance: initialAudit.repairGuidance,
            rawOutput: repairedText,
          });
        }
        normalizedOutput = repairedText;
        parsed = repairedParsed;
        llmResult = repaired;
        const repairedAudit = await runReplyAudit(parsed.markdown, "persona_repair_invalid");
        if (!repairedAudit.passes) {
          throw new PersonaOutputValidationError({
            code: "persona_repair_failed",
            message: "Repaired output still failed reply audit.",
            issues: repairedAudit.issues,
            repairGuidance: repairedAudit.repairGuidance,
            rawOutput: normalizedOutput,
          });
        }
        auditDiagnostics = {
          contract: "reply_audit",
          status: "passed_after_repair",
          issues: initialAudit.issues,
          repairGuidance: initialAudit.repairGuidance,
          severity: "low",
          confidence: 1,
          missingSignals: [],
          repairApplied: true,
          auditMode: "compact",
          compactRetryUsed: false,
          checks: repairedAudit.checks,
        };
      } else {
        auditDiagnostics = {
          contract: "reply_audit",
          status: "passed",
          issues: initialAudit.issues,
          repairGuidance: initialAudit.repairGuidance,
          severity: "low",
          confidence: 1,
          missingSignals: [],
          repairApplied: false,
          auditMode: "compact",
          compactRetryUsed: false,
          checks: initialAudit.checks,
        };
      }
      markdown = parsed.markdown.trim();
    } else if (input.taskType === "post_body") {
      let parsed = parsePostBodyActionOutput(normalizedOutput);
      if (parsed.error) {
        const repairPrompt = [
          assembledPrompt,
          "",
          "[retry_repair]",
          "Your previous response was invalid for the required post_body JSON contract.",
          "Rewrite it as exactly one valid JSON object using the same language.",
          "Required keys: body, tags, need_image, image_prompt, image_alt.",
          "Do not output title.",
          "The tags array must contain 1 to 5 hashtags like #cthulhu.",
          "Return JSON only. Do not use markdown fences.",
          "",
          "[previous_invalid_response]",
          normalizedOutput,
        ].join("\n");
        const repaired = await invokeInteractionAttempt(
          repairPrompt,
          Math.min(
            model.maxOutputTokens ?? interactionOutputBudgets.schemaRepair,
            interactionOutputBudgets.schemaRepair,
          ),
          0.15,
        );
        if (repaired.text.trim()) {
          normalizedOutput = repaired.text.trim();
          parsed = parsePostBodyActionOutput(normalizedOutput);
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

      const initialAudit = await runPostBodyAudit(
        renderLockedPost({ body: parsed.body, tags: parsed.tags }),
        "persona_audit_invalid",
      );
      if (!initialAudit.passes) {
        const repaired = await invokeInteractionAttempt(
          buildPostBodyRepairPrompt({
            selectedPostPlanText:
              input.targetContextText ?? "[selected_post_plan]\nNo selected post plan available.",
            personaEvidence,
            issues: initialAudit.issues,
            repairGuidance: initialAudit.repairGuidance,
            previousOutput: normalizedOutput,
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
            message: "Post body repair returned empty output.",
            issues: initialAudit.issues,
            repairGuidance: initialAudit.repairGuidance,
            rawOutput: repaired.text,
          });
        }
        const repairedParsed = parsePostBodyActionOutput(repairedText);
        if (repairedParsed.error) {
          throw new PersonaOutputValidationError({
            code: "persona_repair_invalid",
            message: repairedParsed.error,
            issues: initialAudit.issues,
            repairGuidance: initialAudit.repairGuidance,
            rawOutput: repairedText,
          });
        }
        normalizedOutput = repairedText;
        parsed = repairedParsed;
        llmResult = repaired;
        const repairedAudit = await runPostBodyAudit(
          renderLockedPost({ body: parsed.body, tags: parsed.tags }),
          "persona_repair_invalid",
        );
        if (!repairedAudit.passes) {
          throw new PersonaOutputValidationError({
            code: "persona_repair_failed",
            message: "Repaired post body still failed merged post_body audit.",
            issues: repairedAudit.issues,
            repairGuidance: repairedAudit.repairGuidance,
            rawOutput: normalizedOutput,
          });
        }
        auditDiagnostics = {
          contract: "post_body_audit",
          status: "passed_after_repair",
          issues: initialAudit.issues,
          repairGuidance: initialAudit.repairGuidance,
          severity: "low",
          confidence: 1,
          missingSignals: [],
          repairApplied: true,
          auditMode: "compact",
          compactRetryUsed: false,
          contentChecks: repairedAudit.contentChecks,
          personaChecks: repairedAudit.personaChecks,
        };
      } else {
        auditDiagnostics = {
          contract: "post_body_audit",
          status: "passed",
          issues: initialAudit.issues,
          repairGuidance: initialAudit.repairGuidance,
          severity: "low",
          confidence: 1,
          missingSignals: [],
          repairApplied: false,
          auditMode: "compact",
          compactRetryUsed: false,
          contentChecks: initialAudit.contentChecks,
          personaChecks: initialAudit.personaChecks,
        };
      }
      markdown = renderLockedPost({ body: parsed.body, tags: parsed.tags });
    } else {
      markdown = ["```json", normalizedOutput, "```"].join("\n");
    }

    if (!markdown) {
      throw new Error("persona interaction returned empty markdown");
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
        auditDiagnostics,
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
        auditDiagnostics,
      };
    }
  }
}

export async function runPersonaInteraction(
  input: AiAgentPersonaInteractionInput,
): Promise<PreviewResult> {
  return new AiAgentPersonaInteractionService().run(input);
}
