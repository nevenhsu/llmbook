import { PERSONA_GENERATION_BUDGETS } from "@/lib/ai/admin/persona-generation-token-budgets";
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
  interactionMaxOutputTokens: 2000,
  personaGenerationMaxInputTokens: PERSONA_GENERATION_BUDGETS.maxInputTokens,
  personaGenerationMaxOutputTokens: PERSONA_GENERATION_BUDGETS.maxOutputTokens,
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
  const existingGlobal = asRecord(root.global) ?? {};
  return {
    ...root,
    global: {
      ...existingGlobal,
      systemBaseline: globalPolicyDoc.globalPolicyDraft.systemBaseline,
      globalPolicy: globalPolicyDoc.globalPolicyDraft.globalPolicy,
      styleGuide: globalPolicyDoc.globalPolicyDraft.styleGuide,
      forbiddenRules: globalPolicyDoc.globalPolicyDraft.forbiddenRules,
    },
  };
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
