import {
  PLANNER_FAMILY_PROMPT_BLOCK_ORDER,
  WRITER_FAMILY_PROMPT_BLOCK_ORDER,
  buildActionOutputConstraints,
  type PromptActionType,
} from "@/lib/ai/prompt-runtime/prompt-builder";
import type { RuntimeCoreProfile } from "@/lib/ai/core/runtime-core-profile";
import {
  PERSONA_GENERATION_MAX_INPUT_TOKENS,
  PERSONA_GENERATION_MAX_OUTPUT_TOKENS,
} from "@/lib/ai/admin/persona-generation-token-budgets";
import type {
  AiControlPlaneDocument,
  GlobalPolicyStudioDraft,
  ModelErrorKind,
  ModelLifecycleStatus,
  ModelTestStatus,
  PreviewTokenBudget,
  PromptBlockStat,
  PromptBoardContext,
  PromptTargetContext,
} from "@/lib/ai/admin/control-plane-contract";

export const DEFAULT_POLICY_DRAFT = {
  systemBaseline: "",
  globalPolicy: "",
  styleGuide: "",
  forbiddenRules: "",
};

export const DEFAULT_TOKEN_LIMITS = {
  interactionMaxInputTokens: 3200,
  interactionMaxOutputTokens: 900,
  personaGenerationMaxInputTokens: PERSONA_GENERATION_MAX_INPUT_TOKENS,
  personaGenerationMaxOutputTokens: PERSONA_GENERATION_MAX_OUTPUT_TOKENS,
};

export function asRecord(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }
  return input as Record<string, unknown>;
}

export function readString(input: unknown, fallback = ""): string {
  if (typeof input !== "string") {
    return fallback;
  }
  return input;
}

export function readNullableString(input: unknown): string | null {
  if (typeof input !== "string") {
    return null;
  }
  const trimmed = input.trim();
  return trimmed.length ? trimmed : null;
}

export function readBoolean(input: unknown, fallback = false): boolean {
  return typeof input === "boolean" ? input : fallback;
}

export function readNumberOrNull(input: unknown): number | null {
  return typeof input === "number" && Number.isFinite(input) ? input : null;
}

export function readPositiveInt(input: unknown, fallback: number): number {
  const raw =
    typeof input === "string"
      ? Number.parseInt(input, 10)
      : typeof input === "number"
        ? input
        : Number.NaN;
  if (!Number.isFinite(raw)) {
    return fallback;
  }
  const value = Math.floor(raw);
  return value >= 1 ? value : fallback;
}

export function readModelTestStatus(input: unknown): ModelTestStatus {
  if (input === "success" || input === "failed") {
    return input;
  }
  return "untested";
}

export function readModelLifecycleStatus(input: unknown): ModelLifecycleStatus {
  return input === "retired" ? "retired" : "active";
}

export function readModelErrorKind(input: unknown): ModelErrorKind | null {
  if (input === "provider_api" || input === "model_retired" || input === "other") {
    return input;
  }
  return null;
}

export function readErrorDetails(input: unknown): { code: string | null; message: string } {
  const candidate = input as {
    message?: unknown;
    code?: unknown;
    statusCode?: unknown;
    cause?: unknown;
  };
  const cause = (candidate?.cause ?? null) as {
    message?: unknown;
    code?: unknown;
    statusCode?: unknown;
  } | null;
  const rawMessage =
    typeof candidate?.message === "string"
      ? candidate.message
      : typeof cause?.message === "string"
        ? cause.message
        : String(input);
  const codeSource = candidate?.code ?? cause?.code ?? candidate?.statusCode ?? cause?.statusCode;
  const code =
    typeof codeSource === "string"
      ? codeSource.trim() || null
      : typeof codeSource === "number"
        ? String(codeSource)
        : null;
  return {
    code,
    message: rawMessage.slice(0, 500),
  };
}

export function readNonEmptyMessage(...candidates: Array<unknown>): string | null {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }
    const message = candidate.trim();
    if (message.length > 0) {
      return message;
    }
  }
  return null;
}

export function buildLlmErrorDetailsSuffix(details: unknown): string {
  if (!details || typeof details !== "object") {
    return "";
  }
  const candidate = details as {
    statusCode?: unknown;
    code?: unknown;
    type?: unknown;
  };
  const parts: string[] = [];
  if (typeof candidate.statusCode === "number" && Number.isFinite(candidate.statusCode)) {
    parts.push(`status=${String(candidate.statusCode)}`);
  }
  if (typeof candidate.code === "string" && candidate.code.trim().length > 0) {
    parts.push(`code=${candidate.code.trim()}`);
  }
  if (typeof candidate.type === "string" && candidate.type.trim().length > 0) {
    parts.push(`type=${candidate.type.trim()}`);
  }
  return parts.length > 0 ? ` (${parts.join(", ")})` : "";
}

export function isGenericModelTestError(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    normalized === "model test failed" ||
    normalized === "provider_error_output" ||
    normalized === "provider call failed" ||
    normalized === "provider_call_failed"
  );
}

export function estimateTokens(content: string): number {
  const normalized = content.trim();
  if (!normalized) {
    return 0;
  }
  return Math.ceil(normalized.split(/\s+/).length * 1.35);
}

export function readGlobalPolicyDocument(policy: unknown): AiControlPlaneDocument {
  const root = asRecord(policy) ?? {};
  const global = asRecord(root.global) ?? {};
  const globalPolicyDraft: GlobalPolicyStudioDraft = {
    systemBaseline: readString(global.systemBaseline, DEFAULT_POLICY_DRAFT.systemBaseline),
    globalPolicy: readString(global.globalPolicy, DEFAULT_POLICY_DRAFT.globalPolicy),
    styleGuide: readString(global.styleGuide, DEFAULT_POLICY_DRAFT.styleGuide),
    forbiddenRules: readString(global.forbiddenRules, DEFAULT_POLICY_DRAFT.forbiddenRules),
  };

  return {
    globalPolicyDraft,
  };
}

export function writeGlobalPolicyDocument(
  policy: unknown,
  globalPolicyDoc: AiControlPlaneDocument,
): Record<string, unknown> {
  const root = asRecord(policy) ?? {};
  return {
    ...root,
    global: {
      systemBaseline: globalPolicyDoc.globalPolicyDraft.systemBaseline,
      globalPolicy: globalPolicyDoc.globalPolicyDraft.globalPolicy,
      styleGuide: globalPolicyDoc.globalPolicyDraft.styleGuide,
      forbiddenRules: globalPolicyDoc.globalPolicyDraft.forbiddenRules,
    },
  };
}

function trimBoardContext(boardContext: string | undefined): string {
  if (!boardContext) {
    return "";
  }
  const trimmed = boardContext.trim();
  if (!trimmed) {
    return "";
  }
  const nameMatch = trimmed.match(/^Name:\s*(.+)$/m);
  return nameMatch ? `Name: ${nameMatch[1].trim()}` : trimmed.split("\n").slice(0, 1).join("\n");
}

function trimTargetContext(targetContext: string | undefined): string {
  if (!targetContext) {
    return "";
  }
  const trimmed = targetContext.trim();
  if (!trimmed || trimmed.length <= 200) {
    return trimmed;
  }
  return `${trimmed.slice(0, 200)}`;
}

export function buildPromptBlocks(input: {
  actionType: PromptActionType;
  globalDraft: GlobalPolicyStudioDraft;
  agentProfile?: string;
  outputStyle?: string;
  plannerMode?: string;
  agentCore: string;
  agentPostingLens?: string;
  planningScoringContract?: string;
  agentVoiceContract?: string;
  boardContext?: string;
  targetContext?: string;
  agentEnactmentRules?: string;
  agentAntiStyleRules?: string;
  agentExamples?: string;
  taskContext: string;
}): Array<{ name: string; content: string }> {
  const baseline = input.globalDraft.systemBaseline.trim();
  const systemBaseline = baseline || "(not set)";
  const allBlocks = {
    system_baseline: { name: "system_baseline", content: systemBaseline },
    global_policy: {
      name: "global_policy",
      content: (() => {
        const policy = input.globalDraft.globalPolicy.replace(/^Policy:\s*/im, "").trim();
        const forbidden = input.globalDraft.forbiddenRules.replace(/^Forbidden:\s*/im, "").trim();
        return ["Policy:", policy || "(not set)", "Forbidden:", forbidden || "(not set)"].join(
          "\n",
        );
      })(),
    },
    planner_mode: {
      name: "planner_mode",
      content:
        input.plannerMode?.trim() ||
        [
          "This stage is planning and scoring, not final writing.",
          "Generate candidate post ideas and score them conservatively.",
        ].join("\n"),
    },
    output_style: {
      name: "output_style",
      content: input.outputStyle?.trim() || "No output style guidance available.",
    },
    agent_profile: {
      name: "agent_profile",
      content: input.agentProfile?.trim() || "No agent profile available.",
    },
    agent_core: { name: "agent_core", content: input.agentCore },
    agent_posting_lens: {
      name: "agent_posting_lens",
      content:
        input.agentPostingLens?.trim() ||
        [
          "This persona tends to post when a workflow distinction is being blurred.",
          "Make the framing feel pointed, not neutral or theatrical.",
        ].join("\n"),
    },
    agent_voice_contract: {
      name: "agent_voice_contract",
      content:
        input.agentVoiceContract?.trim() ||
        [
          "Respond as a distinct persona, not as a neutral assistant.",
          "Lead with the agent's first reaction before polished explanation.",
        ].join("\n"),
    },
    board_context: {
      name: "board_context",
      content: trimBoardContext(input.boardContext),
    },
    target_context: {
      name: "target_context",
      content: trimTargetContext(input.targetContext),
    },
    planning_scoring_contract: {
      name: "planning_scoring_contract",
      content:
        input.planningScoringContract?.trim() ||
        ["Return exactly 3 candidates.", "Score conservatively."].join("\n"),
    },
    agent_enactment_rules: {
      name: "agent_enactment_rules",
      content:
        input.agentEnactmentRules?.trim() ||
        [
          "Before responding, infer how this agent would genuinely react based on agent_profile, agent_core, task_context, and target_context.",
          "Internally self-check value_fit, reasoning_fit, discourse_fit, and expression_fit before emitting the final JSON.",
          "Do not produce a generic assistant-style reply.",
        ].join("\n"),
    },
    agent_anti_style_rules: {
      name: "agent_anti_style_rules",
      content:
        input.agentAntiStyleRules?.trim() ||
        [
          "Do not sound like a generic assistant or polished editorial explainer.",
          "Avoid tutorial framing and advice-list structure unless the task explicitly requires it.",
        ].join("\n"),
    },
    agent_examples: {
      name: "agent_examples",
      content: input.agentExamples?.trim() || "",
    },
    task_context: { name: "task_context", content: input.taskContext },
    output_constraints: {
      name: "output_constraints",
      content: buildActionOutputConstraints(input.actionType),
    },
  } as const;

  const order =
    input.actionType === "post_plan"
      ? PLANNER_FAMILY_PROMPT_BLOCK_ORDER
      : WRITER_FAMILY_PROMPT_BLOCK_ORDER;

  return order.map((name) => allBlocks[name]).filter((block) => block.content.trim().length > 0);
}

export function formatAgentMemory(input: { shortTerm: string; longTerm: string }): string {
  return [
    "Short-term:",
    input.shortTerm.trim() || "(empty)",
    "",
    "Long-term:",
    input.longTerm.trim() || "(empty)",
  ].join("\n");
}

export function formatBoardContext(input?: PromptBoardContext | null): string {
  if (!input) {
    return "";
  }

  const rules =
    input.rules?.map((rule) => {
      const title = rule.title.trim();
      const description = rule.description?.trim();
      return description ? `- ${title}: ${description}` : `- ${title}`;
    }) ?? [];

  return [
    input.name?.trim() ? `Name: ${input.name.trim()}` : null,
    input.description?.trim() ? `Description: ${input.description.trim()}` : null,
    rules.length > 0 ? `Rules:\n${rules.join("\n")}` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n");
}

export function formatTargetContext(input: {
  taskType: PromptActionType;
  targetContext?: PromptTargetContext | null;
}): string {
  const targetContext = input.targetContext;
  if (!targetContext) {
    return "";
  }

  const pollOptions =
    targetContext.pollOptions
      ?.map((item) => `- ${item.id}: ${item.label}`)
      .join("\n")
      .trim() ?? "";

  return [
    targetContext.targetType ? `target_type: ${targetContext.targetType}` : null,
    targetContext.targetId ? `target_id: ${targetContext.targetId}` : null,
    targetContext.targetAuthor ? `target_author: ${targetContext.targetAuthor}` : null,
    targetContext.threadSummary ? `thread_summary:\n${targetContext.threadSummary}` : null,
    targetContext.targetContent ? `target_content:\n${targetContext.targetContent}` : null,
    targetContext.pollPostId ? `poll_post_id: ${targetContext.pollPostId}` : null,
    targetContext.pollQuestion ? `poll_question: ${targetContext.pollQuestion}` : null,
    pollOptions ? `poll_options:\n${pollOptions}` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n");
}

export function formatAgentProfile(input: {
  displayName: string;
  username: string;
  bio: string;
}): string {
  return [
    `display_name: ${input.displayName}`,
    `username: ${input.username}`,
    `bio: ${input.bio}`,
  ].join("\n");
}

export function formatAgentRelationshipContext(input: {
  runtimePersonaProfile?: RuntimeCoreProfile | Record<string, unknown> | null;
  targetContext?: PromptTargetContext | null;
}): string {
  const profile = asRecord(input.runtimePersonaProfile);
  const targetContext = input.targetContext;
  const relationshipBias = readString(profile?.relationshipBias).trim();
  const trustSignals = Array.isArray(profile?.trustSignals)
    ? profile?.trustSignals.map((item) => readString(item).trim()).filter((item) => item.length > 0)
    : [];
  const cautionSignals = Array.isArray(profile?.cautionSignals)
    ? profile?.cautionSignals
        .map((item) => readString(item).trim())
        .filter((item) => item.length > 0)
    : [];

  return [
    relationshipBias ? `Relationship bias: ${relationshipBias}` : null,
    trustSignals.length > 0 ? `Trust signals: ${trustSignals.join("; ")}` : null,
    cautionSignals.length > 0 ? `Caution signals: ${cautionSignals.join("; ")}` : null,
    targetContext?.targetAuthor ? `Current counterpart: ${targetContext.targetAuthor}` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n");
}

export function formatAgentEnactmentRules(
  runtimePersonaProfile?: RuntimeCoreProfile | Record<string, unknown> | null,
): string {
  const record = asRecord(runtimePersonaProfile);
  const rules = Array.isArray(record?.enactmentRules)
    ? record.enactmentRules.map((item) => readString(item).trim()).filter((item) => item.length > 0)
    : [];

  return rules.join("\n");
}

export function formatAgentExamples(
  runtimePersonaProfile?: RuntimeCoreProfile | Record<string, unknown> | null,
): string {
  const record = asRecord(runtimePersonaProfile);
  const examples = Array.isArray(record?.inCharacterExamples) ? record.inCharacterExamples : [];
  const lines = examples
    .map((item) => {
      const row = asRecord(item);
      if (!row) {
        return null;
      }
      const scenario = readString(row.scenario).trim();
      const response = readString(row.response).trim();
      if (!scenario || !response) {
        return null;
      }
      return [`Scenario: ${scenario}`, `Response: ${response}`].join("\n");
    })
    .filter((item): item is string => Boolean(item));

  return lines.join("\n\n");
}

export function formatPrompt(blocks: Array<{ name: string; content: string }>): string {
  return blocks.map((block) => `[${block.name}]\n${block.content || "(empty)"}`).join("\n\n");
}

export function buildTokenBudgetSignal(input: {
  blocks: Array<{ name: string; content: string }>;
  maxInputTokens: number;
  maxOutputTokens: number;
}): PreviewTokenBudget {
  const blockStats: PromptBlockStat[] = input.blocks.map((block) => ({
    name: block.name,
    tokens: estimateTokens(block.content),
  }));
  const estimatedInputTokens = blockStats.reduce((sum, block) => sum + block.tokens, 0);

  return {
    estimatedInputTokens,
    maxInputTokens: input.maxInputTokens,
    maxOutputTokens: input.maxOutputTokens,
    blockStats,
    compressedStages: [],
    exceeded: estimatedInputTokens > input.maxInputTokens,
    message:
      estimatedInputTokens > input.maxInputTokens
        ? `Estimated input tokens ${estimatedInputTokens} exceed limit ${input.maxInputTokens}.`
        : null,
  };
}
