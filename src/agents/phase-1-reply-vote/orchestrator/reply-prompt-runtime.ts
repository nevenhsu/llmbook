import type { DispatcherPolicy } from "@/agents/task-dispatcher/policy/reply-only-policy";
import { createReplyPhase1ToolRegistry } from "@/agents/phase-1-reply-vote/orchestrator/reply-phase1-tools";
import type { RuntimeMemoryContext } from "@/lib/ai/memory/runtime-memory-context";
import { buildPhase1ReplyPrompt, type PromptBlock } from "@/lib/ai/prompt-runtime/prompt-builder";
import { parseMarkdownActionOutput } from "@/lib/ai/prompt-runtime/action-output";
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
} from "@/lib/ai/prompt-runtime/persona-output-audit";
import { getInteractionRuntimeBudgets } from "@/lib/ai/prompt-runtime/runtime-budgets";
import type { ModelAdapter } from "@/lib/ai/prompt-runtime/model-adapter";
import {
  LlmRuntimeAdapter,
  generateTextWithToolLoop,
  recordModelFallbackUsed,
  type ModelGenerateTextOutput,
} from "@/lib/ai/prompt-runtime/model-adapter";
import {
  buildInteractionCoreSummary,
  type RuntimeCoreContext,
} from "@/lib/ai/core/runtime-core-profile";

export type ReplyPromptBoardRule = {
  title: string;
  description?: string | null;
};

export type ReplyPromptBoardContext = {
  name?: string | null;
  description?: string | null;
  rules?: ReplyPromptBoardRule[] | null;
};

export type ReplyPromptAgentProfile = {
  displayName?: string | null;
  username?: string | null;
  bio?: string | null;
};

export type ReplyPromptRuntimeInput = {
  entityId: string;
  personaId: string;
  agentProfile?: ReplyPromptAgentProfile | null;
  postId: string;
  title: string;
  postBodySnippet: string;
  focusActor: string;
  focusSnippet: string | null;
  participantCount: number;
  soul: RuntimeCoreContext;
  memoryContext: RuntimeMemoryContext | null;
  boardContext?: ReplyPromptBoardContext | null;
  policy: DispatcherPolicy;
  modelAdapter?: ModelAdapter;
  now?: Date;
};

export type ReplyPromptRuntimeResult = {
  text: string;
  imageRequest: {
    needImage: boolean;
    imagePrompt: string | null;
    imageAlt: string | null;
  };
  promptBlocks: PromptBlock[];
  model: {
    provider: string | null;
    model: string | null;
    finishReason: string | null;
    usage: ModelGenerateTextOutput["usage"] | undefined;
  };
};

function readToolEnabled(): boolean {
  const raw = (process.env.AI_TOOL_RUNTIME_ENABLED ?? "true").trim().toLowerCase();
  return raw !== "0" && raw !== "false";
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function readAllowlist(): string[] {
  const raw = (process.env.AI_TOOL_ALLOWLIST ?? "").trim();
  if (!raw) {
    return ["get_thread_context", "get_persona_memory", "get_global_policy", "create_reply"];
  }
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function formatAgentProfile(
  profile: ReplyPromptAgentProfile | null | undefined,
): string | undefined {
  const displayName = profile?.displayName?.trim();
  const username = profile?.username?.trim();
  const bio = profile?.bio?.trim();
  if (!displayName && !username && !bio) {
    return undefined;
  }
  return [
    `display_name: ${displayName ?? "(empty)"}`,
    `username: ${username ?? "(empty)"}`,
    `bio: ${bio ?? "(empty)"}`,
  ].join("\n");
}

function formatMemoryBlock(memoryContext: RuntimeMemoryContext | null): string | undefined {
  if (!memoryContext) {
    return undefined;
  }

  const threadEntries = memoryContext.threadShortMemory.entries
    .slice(0, 8)
    .map((entry) => `- ${entry.key}: ${entry.value.slice(0, 160)}`);
  const longMemory =
    memoryContext.personaLongMemory?.content.slice(0, 240) ?? "No persona long memory available.";

  return [
    `Policy version: ${memoryContext.policyRefs.policyVersion ?? "none"}`,
    `Memory refs: community=${memoryContext.memoryRefs.communityMemoryVersion ?? "none"}, safety=${
      memoryContext.memoryRefs.safetyMemoryVersion ?? "none"
    }`,
    `Persona long memory: ${longMemory}`,
    `Thread short memory entries (${String(threadEntries.length)}):`,
    ...(threadEntries.length > 0 ? threadEntries : ["- none"]),
  ].join("\n");
}

function formatPolicyBlock(policy: DispatcherPolicy): string {
  return [
    "Phase1 policy:",
    `- replyEnabled: ${String(policy.replyEnabled)}`,
    `- precheckEnabled: ${String(policy.precheckEnabled)}`,
    `- hourlyLimit: ${String(policy.perPersonaHourlyReplyLimit)}`,
    `- postCooldownSeconds: ${String(policy.perPostCooldownSeconds)}`,
    `- precheckSimilarityThreshold: ${String(policy.precheckSimilarityThreshold)}`,
    "- respect safety/review gates, no policy bypass",
  ].join("\n");
}

function formatRelationshipContext(input: ReplyPromptRuntimeInput): string | undefined {
  if (!input.focusSnippet) {
    return undefined;
  }

  return [
    `target_author: ${input.focusActor}`,
    "current_interaction: direct reply to target content in the active thread",
    `participants_in_thread: ${String(input.participantCount)}`,
    `default_stance: ${input.soul.profile.relationshipTendencies.defaultStance}`,
    `trust_signals: ${input.soul.profile.relationshipTendencies.trustSignals.join(", ") || "(none)"}`,
    `friction_triggers: ${input.soul.profile.relationshipTendencies.frictionTriggers.join(", ") || "(none)"}`,
  ].join("\n");
}

function formatEnactmentRules(soul: RuntimeCoreContext): string | undefined {
  const directives = derivePromptPersonaDirectives({
    actionType: "comment",
    profile: soul.profile,
  });
  if (directives.enactmentRules.length === 0) {
    return undefined;
  }
  return directives.enactmentRules.join("\n");
}

function formatVoiceContract(soul: RuntimeCoreContext): string | undefined {
  const directives = derivePromptPersonaDirectives({
    actionType: "comment",
    profile: soul.profile,
  });
  if (directives.voiceContract.length === 0) {
    return undefined;
  }
  return directives.voiceContract.join("\n");
}

function formatAntiStyleRules(soul: RuntimeCoreContext): string | undefined {
  const directives = derivePromptPersonaDirectives({
    actionType: "comment",
    profile: soul.profile,
  });
  if (directives.antiStyleRules.length === 0) {
    return undefined;
  }
  return directives.antiStyleRules.join("\n");
}

function formatAgentExamples(soul: RuntimeCoreContext): string | undefined {
  const directives = derivePromptPersonaDirectives({
    actionType: "comment",
    profile: soul.profile,
  });
  if (directives.inCharacterExamples.length === 0) {
    return undefined;
  }
  return directives.inCharacterExamples
    .map((example) => [`Scenario: ${example.scenario}`, `Response: ${example.response}`].join("\n"))
    .join("\n\n");
}

function formatBoardContext(
  boardContext: ReplyPromptBoardContext | null | undefined,
): string | undefined {
  const name = boardContext?.name?.trim();
  const description = boardContext?.description?.trim();
  const rules = Array.isArray(boardContext?.rules)
    ? boardContext.rules
        .map((rule) => {
          const title = rule.title.trim();
          const ruleDescription = rule.description?.trim();
          if (!title && !ruleDescription) {
            return null;
          }
          return title && ruleDescription
            ? `- ${title}: ${ruleDescription}`
            : `- ${title || ruleDescription}`;
        })
        .filter((rule): rule is string => Boolean(rule))
    : [];

  if (!name && !description && rules.length === 0) {
    return undefined;
  }

  return [
    `Board: ${name ?? "(empty)"}`,
    `Description: ${description ?? "(empty)"}`,
    "Rules:",
    ...(rules.length > 0 ? rules : ["- (empty)"]),
  ].join("\n");
}

function formatTaskContext(input: ReplyPromptRuntimeInput): string {
  return [
    `Task: generate a single markdown reply for post ${input.postId} by persona ${input.personaId}.`,
    `Post title: ${input.title}`,
    `Post snippet: ${input.postBodySnippet || "(empty)"}`,
    input.focusSnippet
      ? `Focus comment by ${input.focusActor}: "${input.focusSnippet}"`
      : `No focus comment. Use post context from ${input.focusActor}.`,
    `Participants in thread: ${String(input.participantCount)}`,
  ].join("\n");
}

function formatTargetContext(input: ReplyPromptRuntimeInput): string | undefined {
  if (!input.focusSnippet) {
    return undefined;
  }

  return [
    "target_type: comment",
    `target_id: ${input.postId}:focus`,
    `target_author: ${input.focusActor}`,
    `target_content: ${input.focusSnippet}`,
  ].join("\n");
}

function postProcessModelText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function generateReplyTextWithPromptRuntime(
  input: ReplyPromptRuntimeInput,
): Promise<ReplyPromptRuntimeResult> {
  const now = input.now ?? new Date();
  const modelAdapter = input.modelAdapter ?? new LlmRuntimeAdapter();
  const interactionBudgets = getInteractionRuntimeBudgets("reply");
  const coreText = buildInteractionCoreSummary({
    actionType: "reply",
    profile: input.soul.profile,
    shortTermMemory:
      input.memoryContext?.threadShortMemory.entries
        .slice(0, 2)
        .map((entry) => `${entry.key}: ${entry.value}`)
        .join(" | ") ?? null,
    longTermMemory: input.memoryContext?.personaLongMemory?.content ?? null,
  });
  const directives = derivePromptPersonaDirectives({
    actionType: "comment",
    profile: input.soul.profile,
  });

  const prompt = await buildPhase1ReplyPrompt({
    entityId: input.entityId,
    actionType: "comment",
    now,
    systemBaseline:
      "You are a phase1 reply agent. Be accurate, concise, and constructive. Keep language natural.",
    policyText: formatPolicyBlock(input.policy),
    agentProfileText: formatAgentProfile(input.agentProfile),
    coreText,
    memoryText: formatMemoryBlock(input.memoryContext),
    relationshipContextText: formatRelationshipContext(input),
    boardContextText: formatBoardContext(input.boardContext),
    targetContextText: formatTargetContext(input),
    voiceContractText: formatVoiceContract(input.soul),
    enactmentRulesText: formatEnactmentRules(input.soul),
    antiStyleRulesText: formatAntiStyleRules(input.soul),
    agentExamplesText: formatAgentExamples(input.soul),
    taskContextText: formatTaskContext(input),
  });

  const toolEnabled = readToolEnabled();
  const allowlist = readAllowlist();
  const maxIterations = readPositiveInt(process.env.AI_TOOL_LOOP_MAX_ITERATIONS, 3);
  const timeoutMs = readPositiveInt(process.env.AI_TOOL_LOOP_TIMEOUT_MS, 2_500);

  let modelResult: ModelGenerateTextOutput;
  try {
    if (!toolEnabled) {
      modelResult = await modelAdapter.generateText({
        prompt: prompt.prompt,
        messages: prompt.messages,
        maxOutputTokens: interactionBudgets.initial,
        temperature: 0.4,
        metadata: {
          entityId: input.entityId,
          personaId: input.personaId,
          postId: input.postId,
          taskType: "reply",
          promptBlockOrder: prompt.blocks.map((block) => block.name),
          toolRuntimeEnabled: false,
        },
      });
    } else {
      const toolRegistry = createReplyPhase1ToolRegistry({
        context: {
          postId: input.postId,
          personaId: input.personaId,
          title: input.title,
          postBodySnippet: input.postBodySnippet,
          focusActor: input.focusActor,
          focusSnippet: input.focusSnippet,
          participantCount: input.participantCount,
          memoryContext: input.memoryContext,
          policy: input.policy,
        },
        allowlist,
      });

      const toolLoop = await generateTextWithToolLoop({
        adapter: modelAdapter,
        modelInput: {
          prompt: prompt.prompt,
          messages: prompt.messages,
          maxOutputTokens: interactionBudgets.initial,
          temperature: 0.4,
          metadata: {
            entityId: input.entityId,
            personaId: input.personaId,
            postId: input.postId,
            taskType: "reply",
            promptBlockOrder: prompt.blocks.map((block) => block.name),
            toolRuntimeEnabled: true,
          },
        },
        registry: toolRegistry,
        entityId: input.entityId,
        allowlist,
        maxIterations,
        timeoutMs,
      });

      modelResult = toolLoop.output;
    }
  } catch (error) {
    modelResult = {
      text: "",
      finishReason: "error",
      provider: "unknown",
      model: "unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  const parsedOutput = parseMarkdownActionOutput(modelResult.text);
  if (parsedOutput.markdown.length > 0) {
    const runPersonaAudit = async (
      renderedOutput: string,
      failureCode: "persona_audit_invalid" | "persona_repair_invalid",
    ) => {
      const observedIssues = detectPersonaVoiceDrift(renderedOutput);
      let auditMode: "default" | "compact" = "default";
      const parseAuditText = (auditText: string) => {
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
      const runCompactAuditAttempt = async () => {
        auditMode = "compact";
        const compactAuditResult = await modelAdapter.generateText({
          prompt: buildPersonaOutputAuditPrompt({
            actionType: "comment",
            taskContext: formatTaskContext(input),
            renderedOutput,
            directives,
            observedIssues,
            mode: "compact",
          }),
          messages: prompt.messages,
          maxOutputTokens: interactionBudgets.compactPersonaAudit,
          temperature: 0,
          metadata: {
            entityId: input.entityId,
            personaId: input.personaId,
            postId: input.postId,
            taskType: "reply_persona_audit",
            promptBlockOrder: prompt.blocks.map((block) => block.name),
            auditMode,
          },
        });
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
      const auditResult = await modelAdapter.generateText({
        prompt: buildPersonaOutputAuditPrompt({
          actionType: "comment",
          taskContext: formatTaskContext(input),
          renderedOutput,
          directives,
          observedIssues,
        }),
        messages: prompt.messages,
        maxOutputTokens: interactionBudgets.personaAudit,
        temperature: 0,
        metadata: {
          entityId: input.entityId,
          personaId: input.personaId,
          postId: input.postId,
          taskType: "reply_persona_audit",
          promptBlockOrder: prompt.blocks.map((block) => block.name),
        },
      });
      const auditText = auditResult.text.trim();
      if (!auditText) {
        const compactAudit = await runCompactAuditAttempt();
        return { ...compactAudit, auditMode };
      }
      try {
        const parsedAudit = parseAuditText(auditText);
        return { ...parsedAudit, auditMode };
      } catch (error) {
        if (auditMode === "default" && isRetryablePersonaAuditParseFailure(error)) {
          const compactAudit = await runCompactAuditAttempt();
          return { ...compactAudit, auditMode };
        }
        throw error;
      }
    };

    const audit = await runPersonaAudit(parsedOutput.markdown, "persona_audit_invalid");
    if (!audit.passes) {
      const repaired = await modelAdapter.generateText({
        prompt: buildPersonaVoiceRepairPrompt({
          assembledPrompt: prompt.prompt,
          rawOutput: modelResult.text,
          actionType: "comment",
          directives,
          issues: audit.issues,
          repairGuidance: audit.repairGuidance,
          severity: audit.severity,
          missingSignals: audit.missingSignals,
        }),
        messages: prompt.messages,
        maxOutputTokens: interactionBudgets.personaRepair,
        temperature: 0.2,
        metadata: {
          entityId: input.entityId,
          personaId: input.personaId,
          postId: input.postId,
          taskType: "reply_persona_repair",
          promptBlockOrder: prompt.blocks.map((block) => block.name),
        },
      });
      const repairedText = repaired.text.trim();
      if (!repairedText) {
        throw new PersonaOutputValidationError({
          code: "persona_repair_invalid",
          message: "Persona repair returned empty output.",
          issues: audit.issues,
          repairGuidance: audit.repairGuidance,
          severity: audit.severity,
          confidence: audit.confidence,
          missingSignals: audit.missingSignals,
          rawOutput: repaired.text,
        });
      }
      const repairedParsed = parseMarkdownActionOutput(repairedText);
      if (!repairedParsed.markdown.trim()) {
        throw new PersonaOutputValidationError({
          code: "persona_repair_invalid",
          message: "Persona repair returned empty markdown.",
          issues: audit.issues,
          repairGuidance: audit.repairGuidance,
          severity: audit.severity,
          confidence: audit.confidence,
          missingSignals: audit.missingSignals,
          rawOutput: repairedText,
        });
      }
      const repairedAudit = await runPersonaAudit(
        repairedParsed.markdown,
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
          rawOutput: repairedText,
        });
      }
      return {
        text: repairedParsed.markdown,
        imageRequest: repairedParsed.imageRequest,
        promptBlocks: prompt.blocks,
        model: {
          provider: repaired.provider ?? modelResult.provider ?? null,
          model: repaired.model ?? modelResult.model ?? null,
          finishReason: repaired.finishReason ?? null,
          usage: repaired.usage,
        },
      };
    }
    return {
      text: parsedOutput.markdown,
      imageRequest: parsedOutput.imageRequest,
      promptBlocks: prompt.blocks,
      model: {
        provider: modelResult.provider ?? null,
        model: modelResult.model ?? null,
        finishReason: modelResult.finishReason ?? null,
        usage: modelResult.usage,
      },
    };
  }

  const fallbackReason = modelResult.errorMessage?.trim() || "EMPTY_MODEL_OUTPUT";
  await recordModelFallbackUsed({
    entityId: input.entityId,
    reason: fallbackReason,
    now,
    metadata: {
      provider: modelResult.provider ?? null,
      model: modelResult.model ?? null,
    },
  });
  throw new Error(fallbackReason);
}
