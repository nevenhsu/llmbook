import { generateImage } from "ai";
import { createXai } from "@ai-sdk/xai";
import { createAdminClient } from "@/lib/supabase/admin";
import { markdownToEditorHtml } from "@/lib/tiptap-markdown";
import {
  buildActionOutputConstraints,
  type PromptActionType,
} from "@/lib/ai/prompt-runtime/prompt-builder";
import {
  parseMarkdownActionOutput,
  parsePostActionOutput,
} from "@/lib/ai/prompt-runtime/action-output";
import {
  PERSONA_GENERATION_MAX_INPUT_TOKENS,
  PERSONA_GENERATION_MAX_OUTPUT_TOKENS,
  PERSONA_GENERATION_PREVIEW_MAX_OUTPUT_TOKENS,
  PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS,
} from "@/lib/ai/admin/persona-generation-token-budgets";
import { invokeLLM } from "@/lib/ai/llm/invoke-llm";
import { createDbBackedLlmProviderRegistry } from "@/lib/ai/llm/default-registry";
import {
  listProviderSecretStatuses,
  loadDecryptedProviderSecrets,
  upsertProviderSecret,
} from "@/lib/ai/llm/provider-secrets";
import { resolveLlmInvocationConfig } from "@/lib/ai/llm/runtime-config-provider";
import { normalizeSoulProfile, type RuntimeSoulProfile } from "@/lib/ai/soul/runtime-soul-profile";

export type ProviderTestStatus = "untested" | "success" | "failed" | "disabled" | "key_missing";
export type ProviderStatus = "active" | "disabled";
export type ModelCapability = "text_generation" | "image_generation";
export type ModelStatus = "active" | "disabled";
export type ModelTestStatus = "untested" | "success" | "failed";
export type ModelLifecycleStatus = "active" | "retired";
export type ModelErrorKind = "provider_api" | "model_retired" | "other";

export type AiProviderConfig = {
  id: string;
  providerKey: string;
  displayName: string;
  sdkPackage: string;
  status: ProviderStatus;
  testStatus: ProviderTestStatus;
  keyLast4: string | null;
  hasKey: boolean;
  lastApiErrorCode: string | null;
  lastApiErrorMessage: string | null;
  lastApiErrorAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiModelConfig = {
  id: string;
  providerId: string;
  modelKey: string;
  displayName: string;
  capability: ModelCapability;
  status: ModelStatus;
  testStatus: ModelTestStatus;
  lifecycleStatus: ModelLifecycleStatus;
  displayOrder: number;
  lastErrorKind: ModelErrorKind | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastErrorAt: string | null;
  supportsInput: boolean;
  supportsImageInputPrompt: boolean;
  supportsOutput: boolean;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  metadata: Record<string, unknown>;
  updatedAt: string;
};

export type GlobalPolicyStudioDraft = {
  systemBaseline: string;
  globalPolicy: string;
  styleGuide: string;
  forbiddenRules: string;
};

export type AiControlPlaneDocument = {
  globalPolicyDraft: GlobalPolicyStudioDraft;
};

export type PolicyReleaseListItem = {
  version: number;
  isActive: boolean;
  createdBy: string | null;
  changeNote: string | null;
  createdAt: string;
  globalPolicyDraft: GlobalPolicyStudioDraft;
};

export type AdminControlPlaneSnapshot = {
  providers: AiProviderConfig[];
  models: AiModelConfig[];
  releases: PolicyReleaseListItem[];
  activeRelease: PolicyReleaseListItem | null;
};

export type ModelTestResult = {
  model: AiModelConfig;
  provider: AiProviderConfig;
  artifact?: {
    imageDataUrl?: string;
  };
};

export type PromptBlockStat = {
  name: string;
  tokens: number;
};

export type PreviewTokenBudget = {
  estimatedInputTokens: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  blockStats: PromptBlockStat[];
  compressedStages: Array<"memory" | "long_memory">;
  exceeded: boolean;
  message: string | null;
};

export type PreviewResult = {
  assembledPrompt: string;
  markdown: string;
  rawResponse?: string | null;
  renderOk: boolean;
  renderError: string | null;
  tokenBudget: PreviewTokenBudget;
};

export class PersonaGenerationParseError extends Error {
  public readonly rawOutput: string;

  public constructor(message: string, rawOutput: string) {
    super(message);
    this.name = "PersonaGenerationParseError";
    this.rawOutput = rawOutput;
  }
}

export type PersonaGenerationStructured = {
  personas: {
    display_name: string;
    bio: string;
    status: "active" | "inactive";
  };
  persona_core: Record<string, unknown>;
  reference_sources: Array<{
    name: string;
    type: string;
    contribution: string[];
  }>;
  reference_derivation: string[];
  originalization_note: string;
  persona_memories: Array<{
    memory_type: "memory" | "long_memory";
    scope: "persona" | "thread" | "task";
    memory_key: string | null;
    content: string;
    metadata: Record<string, unknown>;
    expires_in_hours: number | null;
    is_canonical: boolean;
    importance: number | null;
  }>;
};

export type PersonaProfile = {
  persona: PersonaSummary;
  personaCore: Record<string, unknown>;
  personaMemories: Array<{
    id: string;
    memoryType: "memory" | "long_memory";
    scope: "persona" | "thread" | "task";
    memoryKey: string | null;
    content: string;
    metadata: Record<string, unknown>;
    expiresAt: string | null;
    isCanonical: boolean;
    importance: number | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

type PersonaGenerationSeedStage = {
  personas: PersonaGenerationStructured["personas"];
  identity_summary: Record<string, unknown>;
  reference_sources: PersonaGenerationStructured["reference_sources"];
  reference_derivation: string[];
  originalization_note: string;
};

type PersonaGenerationValuesStage = {
  values: Record<string, unknown>;
  aesthetic_profile: Record<string, unknown>;
};

type PersonaGenerationContextStage = {
  lived_context: Record<string, unknown>;
  creator_affinity: Record<string, unknown>;
};

type PersonaGenerationInteractionStage = {
  interaction_defaults: Record<string, unknown>;
  guardrails: Record<string, unknown>;
};

type PersonaGenerationMemoriesStage = {
  persona_memories: PersonaGenerationStructured["persona_memories"];
};

export type PromptBoardRule = {
  title: string;
  description?: string | null;
};

export type PromptBoardContext = {
  name?: string | null;
  description?: string | null;
  rules?: PromptBoardRule[] | null;
};

export type PromptTargetOption = {
  id: string;
  label: string;
};

export type PromptTargetContext = {
  targetType?: "post" | "comment" | null;
  targetId?: string | null;
  targetAuthor?: string | null;
  targetContent?: string | null;
  threadSummary?: string | null;
  pollPostId?: string | null;
  pollQuestion?: string | null;
  pollOptions?: PromptTargetOption[] | null;
};

type PolicyReleaseRow = {
  version: number;
  policy: unknown;
  is_active: boolean;
  created_by: string | null;
  change_note: string | null;
  created_at: string;
};

type ProviderRow = {
  id: string;
  provider_key: string;
  display_name: string;
  sdk_package: string;
  status: ProviderStatus;
  test_status: ProviderTestStatus;
  last_api_error_code: string | null;
  last_api_error_message: string | null;
  last_api_error_at: string | null;
  created_at: string;
  updated_at: string;
};

type ModelRow = {
  id: string;
  provider_id: string;
  model_key: string;
  display_name: string;
  capability: ModelCapability;
  status: ModelStatus;
  test_status: ModelTestStatus;
  lifecycle_status: ModelLifecycleStatus;
  display_order: number;
  last_error_kind: ModelErrorKind | null;
  last_error_code: string | null;
  last_error_message: string | null;
  last_error_at: string | null;
  supports_input: boolean;
  supports_image_input_prompt: boolean;
  supports_output: boolean;
  context_window: number | null;
  max_output_tokens: number | null;
  metadata: Record<string, unknown> | null;
  updated_at: string;
  created_at: string;
};

type PersonaSummary = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  status: string;
};

type PersonaCoreRow = {
  core_profile: unknown;
};

type PersonaMemoryRow = {
  id: string;
  key: string;
  value: string | null;
  context_data: Record<string, unknown>;
  expires_at: string | null;
  created_at: string;
};

type PersonaLongMemoryRow = {
  id: string;
  content: string;
  importance: number;
  memory_category: string;
  updated_at: string;
};

type PersonaMemoryStoreRow = {
  id: string;
  memory_key: string | null;
  content: string;
  metadata: Record<string, unknown> | null;
  expires_at: string | null;
  is_canonical: boolean;
  importance: number | null;
  updated_at: string;
  created_at: string;
};

const DEFAULT_POLICY_DRAFT = {
  systemBaseline: "",
  globalPolicy: "",
  styleGuide: "",
  forbiddenRules: "",
};

const DEFAULT_TOKEN_LIMITS = {
  interactionMaxInputTokens: 3200,
  interactionMaxOutputTokens: 900,
  personaGenerationMaxInputTokens: PERSONA_GENERATION_MAX_INPUT_TOKENS,
  personaGenerationMaxOutputTokens: PERSONA_GENERATION_MAX_OUTPUT_TOKENS,
};

const SUPPORTED_PROVIDER_CATALOG: Array<{
  providerKey: string;
  displayName: string;
  sdkPackage: string;
}> = [
  { providerKey: "xai", displayName: "xAI", sdkPackage: "@ai-sdk/xai" },
  {
    providerKey: "minimax",
    displayName: "Minimax",
    sdkPackage: "vercel-minimax-ai-provider",
  },
];

const SUPPORTED_MODEL_CATALOG: Array<{
  providerKey: string;
  modelKey: string;
  displayName: string;
  capability: ModelCapability;
  metadata: Record<string, unknown>;
  supportsImageInputPrompt: boolean;
}> = [
  {
    providerKey: "xai",
    modelKey: "grok-4-1-fast-reasoning",
    displayName: "Grok 4.1 Fast Reasoning",
    capability: "text_generation",
    metadata: { input: ["text", "image"], output: ["text"] },
    supportsImageInputPrompt: true,
  },
  {
    providerKey: "xai",
    modelKey: "grok-imagine-image",
    displayName: "Grok Imagine Image",
    capability: "image_generation",
    metadata: { input: ["text", "image"], output: ["image"] },
    supportsImageInputPrompt: true,
  },
  {
    providerKey: "minimax",
    modelKey: "MiniMax-M2.5",
    displayName: "MiniMax M2.5",
    capability: "text_generation",
    metadata: { input: ["text"], output: ["text"] },
    supportsImageInputPrompt: false,
  },
];

function nowIso(): string {
  return new Date().toISOString();
}

function asRecord(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }
  return input as Record<string, unknown>;
}

function readString(input: unknown, fallback = ""): string {
  if (typeof input !== "string") {
    return fallback;
  }
  return input;
}

function readNullableString(input: unknown): string | null {
  if (typeof input !== "string") {
    return null;
  }
  const trimmed = input.trim();
  return trimmed.length ? trimmed : null;
}

function readBoolean(input: unknown, fallback = false): boolean {
  return typeof input === "boolean" ? input : fallback;
}

function readNumberOrNull(input: unknown): number | null {
  return typeof input === "number" && Number.isFinite(input) ? input : null;
}

function readPositiveInt(input: unknown, fallback: number): number {
  const raw =
    typeof input === "string"
      ? Number.parseInt(input, 10)
      : typeof input === "number"
        ? input
        : NaN;
  if (!Number.isFinite(raw)) {
    return fallback;
  }
  const value = Math.floor(raw);
  return value >= 1 ? value : fallback;
}

function readModelTestStatus(input: unknown): ModelTestStatus {
  if (input === "success" || input === "failed") {
    return input;
  }
  return "untested";
}

function readModelLifecycleStatus(input: unknown): ModelLifecycleStatus {
  return input === "retired" ? "retired" : "active";
}

function readModelErrorKind(input: unknown): ModelErrorKind | null {
  if (input === "provider_api" || input === "model_retired" || input === "other") {
    return input;
  }
  return null;
}

function readErrorDetails(input: unknown): { code: string | null; message: string } {
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

function readNonEmptyMessage(...candidates: Array<unknown>): string | null {
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

function buildLlmErrorDetailsSuffix(details: unknown): string {
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

function isGenericModelTestError(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    normalized === "model test failed" ||
    normalized === "provider_error_output" ||
    normalized === "provider call failed" ||
    normalized === "provider_call_failed"
  );
}

function toPersonaUsername(input: string): string {
  const normalized = input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_\.]+|[_\.]+$/g, "");

  const withoutPrefix = normalized.startsWith("ai_") ? normalized.slice(3) : normalized;
  const fallback = withoutPrefix.length > 0 ? withoutPrefix : "persona";
  const constrained = fallback.slice(0, 17);
  const minSized = constrained.length >= 3 ? constrained : `${constrained}bot`.slice(0, 3);
  return `ai_${minSized}`;
}

function estimateTokens(content: string): number {
  const normalized = content.trim();
  if (!normalized) {
    return 0;
  }
  return Math.ceil(normalized.split(/\s+/).length * 1.35);
}

function readGlobalPolicyDocument(policy: unknown): AiControlPlaneDocument {
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

function writeGlobalPolicyDocument(
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

function buildPromptBlocks(input: {
  actionType: PromptActionType;
  globalDraft: GlobalPolicyStudioDraft;
  agentProfile?: string;
  outputStyle?: string;
  personaSoul: string;
  agentMemory: string;
  agentRelationshipContext?: string;
  boardContext?: string;
  targetContext?: string;
  agentEnactmentRules?: string;
  agentExamples?: string;
  taskContext: string;
}): Array<{ name: string; content: string }> {
  const baseline = input.globalDraft.systemBaseline.trim();
  const systemBaseline = baseline || "(not set)";

  return [
    { name: "system_baseline", content: systemBaseline },
    {
      name: "global_policy",
      content: [
        "Policy:",
        input.globalDraft.globalPolicy,
        "Forbidden:",
        input.globalDraft.forbiddenRules,
      ].join("\n"),
    },
    {
      name: "output_style",
      content: input.outputStyle?.trim() || "No output style guidance available.",
    },
    {
      name: "agent_profile",
      content: input.agentProfile?.trim() || "No agent profile available.",
    },
    { name: "agent_soul", content: input.personaSoul },
    { name: "agent_memory", content: input.agentMemory },
    {
      name: "agent_relationship_context",
      content: input.agentRelationshipContext?.trim() || "No relationship context available.",
    },
    { name: "board_context", content: input.boardContext?.trim() || "No board context available." },
    {
      name: "target_context",
      content: input.targetContext?.trim() || "No target context available.",
    },
    {
      name: "agent_enactment_rules",
      content:
        input.agentEnactmentRules?.trim() ||
        [
          "Before responding, infer how this agent would genuinely react based on agent_profile, agent_soul, agent_memory, target_context, and agent_relationship_context.",
          "The response must reflect the agent's priorities, biases, tone, and decision style.",
          "Do not produce a generic assistant-style reply.",
        ].join("\n"),
    },
    {
      name: "agent_examples",
      content: input.agentExamples?.trim() || "No in-character examples available.",
    },
    { name: "task_context", content: input.taskContext },
    { name: "output_constraints", content: buildActionOutputConstraints(input.actionType) },
  ];
}

function formatAgentMemory(input: { shortTerm: string; longTerm: string }): string {
  return [
    "Short-term:",
    input.shortTerm.trim() || "(empty)",
    "",
    "Long-term:",
    input.longTerm.trim() || "(empty)",
  ].join("\n");
}

function formatBoardContext(input?: PromptBoardContext | null): string {
  const name = readNullableString(input?.name);
  const description = readNullableString(input?.description);
  const rules = Array.isArray(input?.rules)
    ? input.rules
        .map((rule) => {
          const title = readNullableString(rule?.title);
          const ruleDescription = readNullableString(rule?.description);
          if (!title && !ruleDescription) {
            return null;
          }
          return title && ruleDescription
            ? `- ${title}: ${ruleDescription}`
            : `- ${title ?? ruleDescription}`;
        })
        .filter((rule): rule is string => Boolean(rule))
    : [];

  if (!name && !description && rules.length === 0) {
    return "";
  }

  return [
    `Board: ${name ?? "(empty)"}`,
    `Description: ${description ?? "(empty)"}`,
    "Rules:",
    ...(rules.length > 0 ? rules : ["- (empty)"]),
  ].join("\n");
}

function formatTargetContext(input: {
  taskType: PromptActionType;
  targetContext?: PromptTargetContext | null;
}): string {
  const targetContext = input.targetContext;

  if (input.taskType === "poll_vote") {
    const pollPostId = readNullableString(targetContext?.pollPostId);
    const pollQuestion = readNullableString(targetContext?.pollQuestion);
    const threadSummary = readNullableString(targetContext?.threadSummary);
    const pollOptions = Array.isArray(targetContext?.pollOptions)
      ? targetContext.pollOptions
          .map((option) => {
            const id = readString(option?.id).trim();
            const label = readString(option?.label).trim();
            if (!id || !label) {
              return null;
            }
            return `- ${id}: ${label}`;
          })
          .filter((option): option is string => Boolean(option))
      : [];

    if (!pollPostId && !pollQuestion && !threadSummary && pollOptions.length === 0) {
      return "";
    }

    return [
      `poll_post_id: ${pollPostId ?? "(empty)"}`,
      `poll_question: ${pollQuestion ?? "(empty)"}`,
      "poll_options:",
      ...(pollOptions.length > 0 ? pollOptions : ["- (empty)"]),
      ...(threadSummary ? [`thread_summary: ${threadSummary}`] : []),
    ].join("\n");
  }

  const targetType = readNullableString(targetContext?.targetType);
  const targetId = readNullableString(targetContext?.targetId);
  const targetAuthor = readNullableString(targetContext?.targetAuthor);
  const targetContent = readNullableString(targetContext?.targetContent);
  const threadSummary = readNullableString(targetContext?.threadSummary);

  if (!targetType && !targetId && !targetAuthor && !targetContent && !threadSummary) {
    return "";
  }

  return [
    ...(targetType ? [`target_type: ${targetType}`] : []),
    ...(targetId ? [`target_id: ${targetId}`] : []),
    ...(targetAuthor ? [`target_author: ${targetAuthor}`] : []),
    ...(targetContent ? [`target_content: ${targetContent}`] : []),
    ...(threadSummary ? [`thread_summary: ${threadSummary}`] : []),
  ].join("\n");
}

function formatAgentProfile(input: { displayName: string; username: string; bio: string }): string {
  return [
    `display_name: ${input.displayName}`,
    `username: ${input.username}`,
    `bio: ${input.bio || "(empty)"}`,
  ].join("\n");
}

function formatAgentRelationshipContext(input: {
  runtimePersonaProfile?: RuntimeSoulProfile | Record<string, unknown> | null;
  targetContext?: PromptTargetContext;
}): string {
  const runtimePersonaProfile = asRecord(input.runtimePersonaProfile);
  const tendencies = asRecord(runtimePersonaProfile?.relationshipTendencies);
  const defaultStance = readString(tendencies?.defaultStance).trim();
  const trustSignals = Array.isArray(tendencies?.trustSignals)
    ? tendencies?.trustSignals.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      )
    : [];
  const frictionTriggers = Array.isArray(tendencies?.frictionTriggers)
    ? tendencies?.frictionTriggers.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      )
    : [];
  const targetAuthor = readNullableString(input.targetContext?.targetAuthor);
  const threadSummary = readNullableString(input.targetContext?.threadSummary);

  if (!targetAuthor) {
    return "";
  }

  return [
    ...(targetAuthor ? [`target_author: ${targetAuthor}`] : []),
    ...(threadSummary ? [`thread_summary: ${threadSummary}`] : []),
    ...(defaultStance ? [`default_stance: ${defaultStance}`] : []),
    ...(trustSignals.length > 0 ? [`trust_signals: ${trustSignals.join(", ")}`] : []),
    ...(frictionTriggers.length > 0 ? [`friction_triggers: ${frictionTriggers.join(", ")}`] : []),
  ].join("\n");
}

function formatAgentEnactmentRules(
  runtimePersonaProfile?: RuntimeSoulProfile | Record<string, unknown> | null,
): string {
  const record = asRecord(runtimePersonaProfile);
  const rules = Array.isArray(record?.agentEnactmentRules)
    ? record.agentEnactmentRules.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      )
    : [];

  return rules.join("\n");
}

function formatAgentExamples(
  runtimePersonaProfile?: RuntimeSoulProfile | Record<string, unknown> | null,
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

function requirePersonaRecord(value: unknown, fieldPath: string): Record<string, unknown> {
  const record = asRecord(value);
  if (!record) {
    throw new Error(`persona generation output missing ${fieldPath}`);
  }
  return record;
}

function requirePersonaText(value: unknown, fieldPath: string): string {
  const text = readString(value).trim();
  if (!text) {
    throw new Error(`persona generation output missing ${fieldPath}`);
  }
  return text;
}

function normalizePersonaStringArray(value: unknown, fieldPath: string): string[] {
  const items =
    typeof value === "string"
      ? [value]
      : Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : null;
  if (!items) {
    throw new Error(`persona generation output missing ${fieldPath}`);
  }
  const normalized = items.map((item) => item.trim()).filter((item) => item.length > 0);
  if (normalized.length === 0) {
    throw new Error(`persona generation output missing ${fieldPath}`);
  }
  return normalized;
}

function normalizePersonaValueHierarchy(
  value: unknown,
  fieldPath: string,
): Array<{ value: string; priority: number }> {
  const arrayRows = Array.isArray(value)
    ? value
        .map((item) => {
          const row = asRecord(item);
          if (!row) {
            return null;
          }
          const label = readString(row.value).trim();
          const priority = readPositiveInt(row.priority, 0);
          if (!label || priority < 1) {
            return null;
          }
          return { value: label, priority };
        })
        .filter((item): item is { value: string; priority: number } => item !== null)
    : [];

  if (arrayRows.length > 0) {
    return arrayRows.sort((a, b) => a.priority - b.priority || a.value.localeCompare(b.value));
  }

  const recordRows = asRecord(value);
  if (!recordRows) {
    throw new Error(`persona generation output missing ${fieldPath}`);
  }
  const normalized = Object.entries(recordRows)
    .map(([priorityRaw, labelValue]) => {
      const label = readString(labelValue).trim();
      const priority = readPositiveInt(priorityRaw, 0);
      if (!label || priority < 1) {
        return null;
      }
      return { value: label, priority };
    })
    .filter((item): item is { value: string; priority: number } => item !== null)
    .sort((a, b) => a.priority - b.priority || a.value.localeCompare(b.value));

  if (normalized.length === 0) {
    throw new Error(`persona generation output missing ${fieldPath}`);
  }
  return normalized;
}

function parsePersonaIdentitySummary(
  value: unknown,
  fieldPath = "persona_core.identity_summary",
): Record<string, unknown> {
  const root = requirePersonaRecord(value, fieldPath);
  return {
    ...root,
    archetype: requirePersonaText(root.archetype, `${fieldPath}.archetype`),
    core_motivation: requirePersonaText(root.core_motivation, `${fieldPath}.core_motivation`),
    one_sentence_identity: requirePersonaText(
      root.one_sentence_identity,
      `${fieldPath}.one_sentence_identity`,
    ),
  };
}

function parsePersonaValues(
  value: unknown,
  fieldPath = "persona_core.values",
): Record<string, unknown> {
  const root = requirePersonaRecord(value, fieldPath);
  return {
    ...root,
    value_hierarchy: normalizePersonaValueHierarchy(
      root.value_hierarchy,
      `${fieldPath}.value_hierarchy`,
    ),
    worldview: normalizePersonaStringArray(root.worldview, `${fieldPath}.worldview`),
    judgment_style: requirePersonaText(root.judgment_style, `${fieldPath}.judgment_style`),
  };
}

function parsePersonaAestheticProfile(
  value: unknown,
  fieldPath = "persona_core.aesthetic_profile",
): Record<string, unknown> {
  const root = requirePersonaRecord(value, fieldPath);
  return {
    ...root,
    humor_preferences: normalizePersonaStringArray(
      root.humor_preferences,
      `${fieldPath}.humor_preferences`,
    ),
    narrative_preferences: normalizePersonaStringArray(
      root.narrative_preferences,
      `${fieldPath}.narrative_preferences`,
    ),
    creative_preferences: normalizePersonaStringArray(
      root.creative_preferences,
      `${fieldPath}.creative_preferences`,
    ),
    disliked_patterns: normalizePersonaStringArray(
      root.disliked_patterns,
      `${fieldPath}.disliked_patterns`,
    ),
    taste_boundaries: normalizePersonaStringArray(
      root.taste_boundaries,
      `${fieldPath}.taste_boundaries`,
    ),
  };
}

function parsePersonaLivedContext(
  value: unknown,
  fieldPath = "persona_core.lived_context",
): Record<string, unknown> {
  const root = requirePersonaRecord(value, fieldPath);
  return {
    ...root,
    familiar_scenes_of_life: normalizePersonaStringArray(
      root.familiar_scenes_of_life,
      `${fieldPath}.familiar_scenes_of_life`,
    ),
    personal_experience_flavors: normalizePersonaStringArray(
      root.personal_experience_flavors,
      `${fieldPath}.personal_experience_flavors`,
    ),
    cultural_contexts: normalizePersonaStringArray(
      root.cultural_contexts,
      `${fieldPath}.cultural_contexts`,
    ),
    topics_with_confident_grounding: normalizePersonaStringArray(
      root.topics_with_confident_grounding,
      `${fieldPath}.topics_with_confident_grounding`,
    ),
    topics_requiring_runtime_retrieval: normalizePersonaStringArray(
      root.topics_requiring_runtime_retrieval,
      `${fieldPath}.topics_requiring_runtime_retrieval`,
    ),
  };
}

function parsePersonaCreatorAffinity(
  value: unknown,
  fieldPath = "persona_core.creator_affinity",
): Record<string, unknown> {
  const root = requirePersonaRecord(value, fieldPath);
  return {
    ...root,
    admired_creator_types: normalizePersonaStringArray(
      root.admired_creator_types,
      `${fieldPath}.admired_creator_types`,
    ),
    structural_preferences: normalizePersonaStringArray(
      root.structural_preferences,
      `${fieldPath}.structural_preferences`,
    ),
    detail_selection_habits: normalizePersonaStringArray(
      root.detail_selection_habits,
      `${fieldPath}.detail_selection_habits`,
    ),
    creative_biases: normalizePersonaStringArray(
      root.creative_biases,
      `${fieldPath}.creative_biases`,
    ),
  };
}

function parsePersonaInteractionDefaults(
  value: unknown,
  fieldPath = "persona_core.interaction_defaults",
): Record<string, unknown> {
  const root = requirePersonaRecord(value, fieldPath);
  return {
    ...root,
    default_stance: requirePersonaText(root.default_stance, `${fieldPath}.default_stance`),
    discussion_strengths: normalizePersonaStringArray(
      root.discussion_strengths,
      `${fieldPath}.discussion_strengths`,
    ),
    friction_triggers: normalizePersonaStringArray(
      root.friction_triggers,
      `${fieldPath}.friction_triggers`,
    ),
    non_generic_traits: normalizePersonaStringArray(
      root.non_generic_traits,
      `${fieldPath}.non_generic_traits`,
    ),
  };
}

function parsePersonaGuardrails(
  value: unknown,
  fieldPath = "persona_core.guardrails",
): Record<string, unknown> {
  const root = requirePersonaRecord(value, fieldPath);
  return {
    ...root,
    hard_no: normalizePersonaStringArray(root.hard_no, `${fieldPath}.hard_no`),
    deescalation_style: normalizePersonaStringArray(
      root.deescalation_style,
      `${fieldPath}.deescalation_style`,
    ),
  };
}

function parsePersonaCore(value: unknown): Record<string, unknown> {
  const root = requirePersonaRecord(value, "persona_core");
  return {
    ...root,
    identity_summary: parsePersonaIdentitySummary(root.identity_summary),
    values: parsePersonaValues(root.values),
    aesthetic_profile: parsePersonaAestheticProfile(root.aesthetic_profile),
    lived_context: parsePersonaLivedContext(root.lived_context),
    creator_affinity: parsePersonaCreatorAffinity(root.creator_affinity),
    interaction_defaults: parsePersonaInteractionDefaults(root.interaction_defaults),
    guardrails: parsePersonaGuardrails(root.guardrails),
  };
}

function parseReferenceSources(value: unknown): PersonaGenerationStructured["reference_sources"] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("persona generation output missing reference_sources");
  }
  const normalized = value
    .map((item) => {
      const row = requirePersonaRecord(item, "reference_sources");
      const name = requirePersonaText(row.name, "reference_sources.name");
      const type = requirePersonaText(row.type, "reference_sources.type");
      const contribution = normalizePersonaStringArray(
        row.contribution,
        "reference_sources.contribution",
      );
      return { name, type, contribution };
    })
    .filter((item) => item.name.length > 0);
  if (normalized.length === 0) {
    throw new Error("persona generation output missing reference_sources");
  }
  return normalized;
}

function parsePersonaMemories(value: unknown): PersonaGenerationStructured["persona_memories"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const row = asRecord(item);
      if (!row) {
        return null;
      }
      const memoryType =
        readString(row.memory_type).trim() === "long_memory" ? "long_memory" : "memory";
      const scopeRaw = readString(row.scope).trim();
      const scope: "persona" | "thread" | "task" =
        scopeRaw === "thread" || scopeRaw === "task" ? scopeRaw : "persona";
      const content = readString(row.content).trim();
      if (!content) {
        return null;
      }
      const memoryKey = readNullableString(row.memory_key);
      return {
        memory_type: memoryType,
        scope,
        memory_key: memoryKey,
        content,
        metadata: asRecord(row.metadata) ?? {},
        expires_in_hours: readNumberOrNull(row.expires_in_hours),
        is_canonical: readBoolean(row.is_canonical, false),
        importance: readNumberOrNull(row.importance),
      };
    })
    .filter(
      (item): item is PersonaGenerationStructured["persona_memories"][number] => item !== null,
    );
}

function extractJsonFromText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i) ?? trimmed.match(/```\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  return trimmed;
}

function normalizeSingleLineText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function containsCjk(text: string): boolean {
  return /[\u3400-\u9fff]/u.test(text);
}

function hasLikelyNamedReference(text: string): boolean {
  const normalized = normalizeSingleLineText(text);
  if (!normalized) {
    return false;
  }

  return (
    /(?:參考|参考|像|例如|比如|inspired by|reference|references|like|such as)\s*[:：]?\s*[\p{L}]/iu.test(
      normalized,
    ) ||
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/.test(normalized) ||
    /\b(?:Fleabag|Sherlock|Batman|Madonna|Björk|Kafka|Murakami|Didion|Grisham|Musk)\b/.test(
      normalized,
    ) ||
    /(?:伊坂幸太郎|村上春樹|宮藤官九郎|是枝裕和|昆汀|王家衛|芙莉貝格)/u.test(normalized)
  );
}

function parseResolvedReferenceNames(text: string): string[] {
  const normalized = normalizeSingleLineText(text);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/\s*(?:\||,|;|\/|、|，|；|\n)\s*/u)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 3);
}

function buildPromptAssistReferenceFallback(input: {
  mode: "random" | "optimize";
  sourceText: string;
  resolvedReferenceNames?: string[];
}): string {
  const referenceName = input.resolvedReferenceNames?.[0]?.trim() ?? "";
  if (input.mode === "random") {
    if (referenceName) {
      return containsCjk(input.sourceText)
        ? `以${referenceName}為參考，塑造一位有明確審美、重視生活觀察、回覆俐落而有判斷力的論壇人格。`
        : `A forum persona shaped by ${referenceName}, with grounded observations, sharp taste, and concise, opinionated replies.`;
    }
    return containsCjk(input.sourceText)
      ? "塑造一位有明確審美、重視生活觀察、回覆俐落而有判斷力的論壇人格。"
      : "A forum persona with grounded observations, sharp taste, and concise, opinionated replies.";
  }

  return referenceName;
}

function normalizePromptAssistComparisonText(text: string): string {
  return normalizeSingleLineText(text)
    .toLowerCase()
    .replace(/[“”"'`.,!?;:(){}\[\]<>，。！？；：「」『』（）【】]/gu, "")
    .trim();
}

function stripTrailingReferenceAppendix(text: string): string {
  return normalizeSingleLineText(text)
    .replace(/\s*(?:reference|references|inspired by|like|such as)\s+[^.]+\.?$/iu, "")
    .replace(/\s*(?:參考|参考|像|例如|比如)\s*[^。！？」]+[。！？]?$/u, "")
    .trim();
}

function looksLikeImperativePersonaRequest(text: string): boolean {
  const normalized = normalizeSingleLineText(text);
  return (
    /^(?:generate|create|write|craft|build)\b/i.test(normalized) ||
    /^(?:請)?(?:生成|產生|建立|打造|寫出)/u.test(normalized)
  );
}

function derivePromptAssistSubject(text: string): string {
  const normalized = normalizeSingleLineText(text)
    .replace(
      /^(?:rewrite|optimize|improve|refine)\s+(?:this|the)?\s*(?:extra\s+)?prompt(?:\s+for\s+generating\s+a\s+forum\s+persona)?[:：]?\s*/iu,
      "",
    )
    .replace(/^(?:generate|create|write|craft|build)\s+(?:me\s+)?(?:a|an|one)?\s*/iu, "")
    .replace(/^(?:請)?(?:生成|產生|建立|打造|寫出|保留)(?:一個|一位|一名|個|位)?/u, "")
    .replace(/[.。]+$/u, "")
    .trim();

  if (!normalized) {
    return containsCjk(text) ? "創作者人格" : "forum persona";
  }
  return normalized;
}

function buildPromptAssistClarityFallback(
  sourceText: string,
  resolvedReferenceNames?: string[],
): string {
  const reference = buildPromptAssistReferenceFallback({
    mode: "optimize",
    sourceText,
    resolvedReferenceNames,
  });
  const subject = derivePromptAssistSubject(sourceText);
  if (containsCjk(sourceText)) {
    return reference
      ? `塑造一位受${subject}啟發的人格，明確寫出其審美立場、判斷偏好與互動方式，回覆機智但尊重、具體而不討好，參考${reference}。`
      : `塑造一位受${subject}啟發的人格，明確寫出其審美立場、判斷偏好與互動方式，回覆機智但尊重、具體而不討好。`;
  }

  return reference
    ? `A persona inspired by ${subject}, with a clear creative bias, values craft over hype, and responds with witty but respectful specificity. Reference ${reference}.`
    : `A persona inspired by ${subject}, with a clear creative bias, values craft over hype, and responds with witty but respectful specificity.`;
}

function ensurePromptAssistReferenceName(input: {
  text: string;
  mode: "random" | "optimize";
  sourceText: string;
  resolvedReferenceNames?: string[];
}): string {
  const normalized = normalizeSingleLineText(input.text);
  if (!normalized) {
    return buildPromptAssistReferenceFallback({
      mode: input.mode,
      sourceText: input.sourceText,
      resolvedReferenceNames: input.resolvedReferenceNames,
    });
  }
  if (hasLikelyNamedReference(normalized)) {
    return normalized;
  }

  const fallbackReference = buildPromptAssistReferenceFallback({
    mode: input.mode,
    sourceText: input.sourceText,
    resolvedReferenceNames: input.resolvedReferenceNames,
  });
  if (!fallbackReference) {
    return normalized;
  }
  if (input.mode === "random") {
    return containsCjk(input.sourceText || normalized)
      ? `${normalized} 參考${fallbackReference}。`
      : `${normalized} Reference ${fallbackReference}.`;
  }

  return containsCjk(input.sourceText)
    ? `${normalized} 參考${fallbackReference}。`
    : `${normalized} Reference ${fallbackReference}.`;
}

function isWeakPromptAssistRewrite(input: {
  text: string;
  mode: "random" | "optimize";
  sourceText: string;
}): boolean {
  if (input.mode !== "optimize") {
    return false;
  }

  const normalizedOutput = normalizeSingleLineText(input.text);
  const normalizedSource = normalizeSingleLineText(input.sourceText);
  if (!normalizedOutput) {
    return true;
  }

  if (looksLikeImperativePersonaRequest(normalizedOutput)) {
    return true;
  }

  const outputWithoutReference = stripTrailingReferenceAppendix(normalizedOutput);
  if (
    normalizePromptAssistComparisonText(outputWithoutReference) ===
    normalizePromptAssistComparisonText(normalizedSource)
  ) {
    return true;
  }

  const sourceHasReference = hasLikelyNamedReference(normalizedSource);
  const outputHasReference = hasLikelyNamedReference(normalizedOutput);
  if (!sourceHasReference && outputHasReference) {
    const sourceComparable = normalizePromptAssistComparisonText(normalizedSource);
    const outputComparable = normalizePromptAssistComparisonText(outputWithoutReference);
    if (outputComparable === sourceComparable) {
      return true;
    }
  }

  return false;
}

function parsePersonaStageObject(rawText: string): Record<string, unknown> {
  const jsonText = extractJsonFromText(rawText);
  if (!jsonText) {
    throw new PersonaGenerationParseError("persona generation output is empty", rawText);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new PersonaGenerationParseError("persona generation output must be valid JSON", rawText);
  }

  const record = asRecord(parsed);
  if (!record) {
    throw new PersonaGenerationParseError(
      "persona generation output must be a JSON object",
      rawText,
    );
  }
  return record;
}

function parsePersonaSeedOutput(rawText: string): PersonaGenerationSeedStage {
  const record = parsePersonaStageObject(rawText);
  const personas = requirePersonaRecord(record.personas, "personas");
  try {
    return {
      personas: {
        display_name: requirePersonaText(personas.display_name, "personas.display_name"),
        bio: requirePersonaText(personas.bio, "personas.bio"),
        status: readString(personas.status).trim() === "inactive" ? "inactive" : "active",
      },
      identity_summary: parsePersonaIdentitySummary(record.identity_summary),
      reference_sources: parseReferenceSources(record.reference_sources),
      reference_derivation: normalizePersonaStringArray(
        record.reference_derivation,
        "reference_derivation",
      ),
      originalization_note: requirePersonaText(record.originalization_note, "originalization_note"),
    };
  } catch (error) {
    throw new PersonaGenerationParseError(
      error instanceof Error ? error.message : "persona generation output is invalid",
      rawText,
    );
  }
}

function parsePersonaValuesAndAestheticOutput(rawText: string): PersonaGenerationValuesStage {
  const record = parsePersonaStageObject(rawText);
  try {
    return {
      values: parsePersonaValues(record.values),
      aesthetic_profile: parsePersonaAestheticProfile(record.aesthetic_profile),
    };
  } catch (error) {
    throw new PersonaGenerationParseError(
      error instanceof Error ? error.message : "persona generation output is invalid",
      rawText,
    );
  }
}

function parsePersonaContextAndAffinityOutput(rawText: string): PersonaGenerationContextStage {
  const record = parsePersonaStageObject(rawText);
  try {
    return {
      lived_context: parsePersonaLivedContext(record.lived_context),
      creator_affinity: parsePersonaCreatorAffinity(record.creator_affinity),
    };
  } catch (error) {
    throw new PersonaGenerationParseError(
      error instanceof Error ? error.message : "persona generation output is invalid",
      rawText,
    );
  }
}

function parsePersonaInteractionOutput(rawText: string): PersonaGenerationInteractionStage {
  const record = parsePersonaStageObject(rawText);
  try {
    return {
      interaction_defaults: parsePersonaInteractionDefaults(record.interaction_defaults),
      guardrails: parsePersonaGuardrails(record.guardrails),
    };
  } catch (error) {
    throw new PersonaGenerationParseError(
      error instanceof Error ? error.message : "persona generation output is invalid",
      rawText,
    );
  }
}

function parsePersonaMemoriesOutput(rawText: string): PersonaGenerationMemoriesStage {
  const record = parsePersonaStageObject(rawText);
  try {
    return {
      persona_memories: parsePersonaMemories(record.persona_memories),
    };
  } catch (error) {
    throw new PersonaGenerationParseError(
      error instanceof Error ? error.message : "persona generation output is invalid",
      rawText,
    );
  }
}

function parsePersonaGenerationOutput(rawText: string): {
  structured: PersonaGenerationStructured;
} {
  const record = parsePersonaStageObject(rawText);
  try {
    const personas = requirePersonaRecord(record.personas, "personas");
    const personaCore = requirePersonaRecord(record.persona_core, "persona_core");
    return {
      structured: {
        personas: {
          display_name: requirePersonaText(personas.display_name, "personas.display_name"),
          bio: requirePersonaText(personas.bio, "personas.bio"),
          status: readString(personas.status).trim() === "inactive" ? "inactive" : "active",
        },
        persona_core: parsePersonaCore(personaCore),
        reference_sources: parseReferenceSources(record.reference_sources),
        reference_derivation: normalizePersonaStringArray(
          record.reference_derivation,
          "reference_derivation",
        ),
        originalization_note: requirePersonaText(
          record.originalization_note,
          "originalization_note",
        ),
        persona_memories: parsePersonaMemories(record.persona_memories),
      },
    };
  } catch (error) {
    if (error instanceof PersonaGenerationParseError) {
      throw error;
    }
    throw new PersonaGenerationParseError(
      error instanceof Error ? error.message : "persona generation output is invalid",
      rawText,
    );
  }
}

function formatPrompt(blocks: Array<{ name: string; content: string }>): string {
  return blocks.map((block) => `[${block.name}]\n${block.content || "(empty)"}`).join("\n\n");
}

function buildTokenBudgetSignal(input: {
  blocks: Array<{ name: string; content: string }>;
  maxInputTokens: number;
  maxOutputTokens: number;
}): PreviewTokenBudget {
  const blockStats: PromptBlockStat[] = input.blocks.map((block) => ({
    name: block.name,
    tokens: estimateTokens(block.content),
  }));

  const mutableOrder = ["memory", "long_memory"] as const;
  const mutableTokensByName = new Map(
    blockStats
      .filter((item) =>
        mutableOrder.includes(
          (item.name === "persona_memory"
            ? "memory"
            : item.name === "persona_long_memory"
              ? "long_memory"
              : item.name) as (typeof mutableOrder)[number],
        ),
      )
      .map((item) => [item.name, item.tokens]),
  );
  const compressedStages: Array<"memory" | "long_memory"> = [];

  let total = blockStats.reduce((sum, item) => sum + item.tokens, 0);
  for (const stage of mutableOrder) {
    if (total <= input.maxInputTokens) {
      break;
    }
    const sourceBlockName = stage === "memory" ? "persona_memory" : "persona_long_memory";
    const current = mutableTokensByName.get(sourceBlockName) ?? 0;
    if (current <= 0) {
      continue;
    }
    // Admin preview only exposes the signal. Runtime compression is delegated to AI agents plan.
    const reduced = Math.ceil(current * 0.5);
    mutableTokensByName.set(sourceBlockName, reduced);
    compressedStages.push(stage);
    total = total - current + reduced;
    const target = blockStats.find((item) => item.name === sourceBlockName);
    if (target) {
      target.tokens = reduced;
    }
  }

  const exceeded = total > input.maxInputTokens;
  return {
    estimatedInputTokens: total,
    maxInputTokens: input.maxInputTokens,
    maxOutputTokens: input.maxOutputTokens,
    blockStats,
    compressedStages,
    exceeded,
    message: exceeded
      ? "Token budget exceeded after memory + long_memory compression signal. Please simplify global rules in Policy."
      : null,
  };
}

export class AdminAiControlPlaneStore {
  private readonly supabase = createAdminClient();

  private toProviderConfig(row: ProviderRow): AiProviderConfig {
    return {
      id: row.id,
      providerKey: row.provider_key,
      displayName: row.display_name,
      sdkPackage: row.sdk_package,
      status: row.status,
      testStatus: row.test_status,
      keyLast4: null,
      hasKey: false,
      lastApiErrorCode: row.last_api_error_code,
      lastApiErrorMessage: row.last_api_error_message,
      lastApiErrorAt: row.last_api_error_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toModelConfig(row: ModelRow): AiModelConfig {
    return {
      id: row.id,
      providerId: row.provider_id,
      modelKey: row.model_key,
      displayName: row.display_name,
      capability: row.capability,
      status: row.status,
      testStatus: row.test_status,
      lifecycleStatus: row.lifecycle_status,
      displayOrder: row.display_order,
      lastErrorKind: row.last_error_kind,
      lastErrorCode: row.last_error_code,
      lastErrorMessage: row.last_error_message,
      lastErrorAt: row.last_error_at,
      supportsInput: row.supports_input,
      supportsImageInputPrompt: row.supports_image_input_prompt,
      supportsOutput: row.supports_output,
      contextWindow: row.context_window,
      maxOutputTokens: row.max_output_tokens,
      metadata: row.metadata ?? {},
      updatedAt: row.updated_at,
    };
  }

  private modelToRow(model: AiModelConfig): Omit<ModelRow, "created_at"> {
    return {
      id: model.id,
      provider_id: model.providerId,
      model_key: model.modelKey,
      display_name: model.displayName,
      capability: model.capability,
      status: model.status,
      test_status: model.testStatus,
      lifecycle_status: model.lifecycleStatus,
      display_order: model.displayOrder,
      last_error_kind: model.lastErrorKind,
      last_error_code: model.lastErrorCode,
      last_error_message: model.lastErrorMessage,
      last_error_at: model.lastErrorAt,
      supports_input: model.supportsInput,
      supports_image_input_prompt: model.supportsImageInputPrompt,
      supports_output: model.supportsOutput,
      context_window: model.contextWindow,
      max_output_tokens: model.maxOutputTokens,
      metadata: model.metadata,
      updated_at: model.updatedAt,
    };
  }

  private async listProvidersFromDb(): Promise<AiProviderConfig[]> {
    const { data, error } = await this.supabase
      .from("ai_providers")
      .select(
        "id, provider_key, display_name, sdk_package, status, test_status, last_api_error_code, last_api_error_message, last_api_error_at, created_at, updated_at",
      )
      .order("created_at", { ascending: true });
    if (error) {
      throw new Error(`list providers failed: ${error.message}`);
    }
    return ((data ?? []) as ProviderRow[]).map((row) => this.toProviderConfig(row));
  }

  private async listModelsFromDb(): Promise<AiModelConfig[]> {
    const { data, error } = await this.supabase
      .from("ai_models")
      .select(
        "id, provider_id, model_key, display_name, capability, status, test_status, lifecycle_status, display_order, last_error_kind, last_error_code, last_error_message, last_error_at, supports_input, supports_image_input_prompt, supports_output, context_window, max_output_tokens, metadata, updated_at, created_at",
      )
      .order("display_order", { ascending: true })
      .order("display_name", { ascending: true });
    if (error) {
      throw new Error(`list models failed: ${error.message}`);
    }
    return ((data ?? []) as ModelRow[]).map((row) => this.toModelConfig(row));
  }

  private async upsertProviderRow(provider: AiProviderConfig): Promise<AiProviderConfig> {
    const payload = {
      id: provider.id,
      provider_key: provider.providerKey,
      display_name: provider.displayName,
      sdk_package: provider.sdkPackage,
      status: provider.status,
      test_status: provider.testStatus,
      last_api_error_code: provider.lastApiErrorCode,
      last_api_error_message: provider.lastApiErrorMessage,
      last_api_error_at: provider.lastApiErrorAt,
      updated_at: provider.updatedAt,
    };
    const { data, error } = await this.supabase
      .from("ai_providers")
      .upsert(payload, { onConflict: "id" })
      .select(
        "id, provider_key, display_name, sdk_package, status, test_status, last_api_error_code, last_api_error_message, last_api_error_at, created_at, updated_at",
      )
      .single<ProviderRow>();
    if (error || !data) {
      throw new Error(`upsert provider failed: ${error?.message ?? "unknown"}`);
    }
    const saved = this.toProviderConfig(data);
    await this.applyProviderSecretStatuses([saved]);
    return saved;
  }

  private async upsertModelRow(model: AiModelConfig): Promise<AiModelConfig> {
    const { data, error } = await this.supabase
      .from("ai_models")
      .upsert(this.modelToRow(model), { onConflict: "id" })
      .select(
        "id, provider_id, model_key, display_name, capability, status, test_status, lifecycle_status, display_order, last_error_kind, last_error_code, last_error_message, last_error_at, supports_input, supports_image_input_prompt, supports_output, context_window, max_output_tokens, metadata, updated_at, created_at",
      )
      .single<ModelRow>();
    if (error || !data) {
      throw new Error(`upsert model failed: ${error?.message ?? "unknown"}`);
    }
    return this.toModelConfig(data);
  }

  public async getActiveControlPlane(): Promise<{
    release: PolicyReleaseListItem | null;
    document: AiControlPlaneDocument;
    providers: AiProviderConfig[];
    models: AiModelConfig[];
  }> {
    const active = await this.fetchActiveRelease();
    const [providers, models] = await Promise.all([
      this.listProvidersFromDb(),
      this.listModelsFromDb(),
    ]);
    if (!active) {
      const emptyDoc = readGlobalPolicyDocument({});
      await this.applyProviderSecretStatuses(providers);
      return {
        release: null,
        document: emptyDoc,
        providers,
        models,
      };
    }

    const document = readGlobalPolicyDocument(active.policy);
    await this.applyProviderSecretStatuses(providers);
    return {
      release: {
        version: active.version,
        isActive: active.is_active,
        createdBy: active.created_by,
        changeNote: active.change_note,
        createdAt: active.created_at,
        globalPolicyDraft: document.globalPolicyDraft,
      },
      document,
      providers,
      models,
    };
  }

  public async listPolicyReleases(limit = 20): Promise<PolicyReleaseListItem[]> {
    const { data, error } = await this.supabase
      .from("ai_policy_releases")
      .select("version, policy, is_active, created_by, change_note, created_at")
      .order("version", { ascending: false })
      .limit(Math.max(1, Math.min(100, limit)));

    if (error) {
      throw new Error(`list policy releases failed: ${error.message}`);
    }

    return (data as PolicyReleaseRow[]).map((row) => {
      const doc = readGlobalPolicyDocument(row.policy);
      return {
        version: row.version,
        isActive: row.is_active,
        createdBy: row.created_by,
        changeNote: row.change_note,
        createdAt: row.created_at,
        globalPolicyDraft: doc.globalPolicyDraft,
      };
    });
  }

  public async getAdminControlPlaneSnapshot(input?: {
    releaseLimit?: number;
  }): Promise<AdminControlPlaneSnapshot> {
    const releaseLimit = Math.max(1, Math.min(50, input?.releaseLimit ?? 20));
    const [state, releases] = await Promise.all([
      this.getActiveControlPlane(),
      this.listPolicyReleases(releaseLimit),
    ]);

    return {
      providers: state.providers,
      models: state.models,
      releases,
      activeRelease: state.release,
    };
  }

  public async upsertProvider(
    input: Partial<AiProviderConfig> & {
      providerKey: string;
      displayName: string;
      sdkPackage: string;
      apiKey?: string | null;
    },
    actorId: string,
  ): Promise<AiProviderConfig> {
    const { providers, models } = await this.loadActiveForMutation();
    const now = nowIso();
    const apiKey = input.apiKey?.trim() ?? "";
    const keyLast4 = apiKey ? apiKey.slice(-4) : null;
    const existingProvider =
      (input.id ? (providers.find((item) => item.id === input.id) ?? null) : null) ??
      providers.find((item) => item.providerKey === input.providerKey) ??
      null;

    const nextProvider: AiProviderConfig = {
      id: existingProvider?.id ?? input.id ?? crypto.randomUUID(),
      providerKey: input.providerKey,
      displayName: input.displayName,
      sdkPackage: input.sdkPackage,
      status: input.status === "disabled" ? "disabled" : "active",
      testStatus:
        input.status === "disabled"
          ? "disabled"
          : apiKey
            ? "untested"
            : input.testStatus === "key_missing"
              ? "key_missing"
              : (input.testStatus ?? existingProvider?.testStatus ?? "untested"),
      keyLast4: keyLast4 ?? input.keyLast4 ?? existingProvider?.keyLast4 ?? null,
      hasKey: apiKey.length > 0 ? true : (input.hasKey ?? existingProvider?.hasKey ?? false),
      lastApiErrorCode: apiKey
        ? null
        : (input.lastApiErrorCode ?? existingProvider?.lastApiErrorCode ?? null),
      lastApiErrorMessage: apiKey
        ? null
        : (input.lastApiErrorMessage ?? existingProvider?.lastApiErrorMessage ?? null),
      lastApiErrorAt: apiKey
        ? null
        : (input.lastApiErrorAt ?? existingProvider?.lastApiErrorAt ?? null),
      createdAt: input.createdAt ?? now,
      updatedAt: now,
    };

    if (apiKey.length > 0) {
      const secret = await upsertProviderSecret({
        providerKey: nextProvider.providerKey,
        apiKey,
      });
      nextProvider.hasKey = true;
      nextProvider.keyLast4 = secret.keyLast4;
      nextProvider.testStatus = nextProvider.status === "disabled" ? "disabled" : "untested";
      nextProvider.lastApiErrorCode = null;
      nextProvider.lastApiErrorMessage = null;
      nextProvider.lastApiErrorAt = null;

      for (const model of models) {
        if (model.providerId !== nextProvider.id) {
          continue;
        }
        model.testStatus = "untested";
        model.lastErrorKind = null;
        model.lastErrorCode = null;
        model.lastErrorMessage = null;
        model.lastErrorAt = null;
        model.updatedAt = now;
      }
    }

    const savedProvider = await this.upsertProviderRow(nextProvider);
    if (apiKey.length > 0) {
      const providerModels = models.filter((item) => item.providerId === savedProvider.id);
      if (providerModels.length > 0) {
        await Promise.all(
          providerModels.map((model) =>
            this.upsertModelRow({
              ...model,
              testStatus: "untested",
              lastErrorKind: null,
              lastErrorCode: null,
              lastErrorMessage: null,
              lastErrorAt: null,
              updatedAt: now,
            }),
          ),
        );
      }
    }

    return savedProvider;
  }

  public async upsertModel(
    input: Partial<AiModelConfig> & {
      providerId: string;
      modelKey: string;
      displayName: string;
      capability: ModelCapability;
    },
    actorId: string,
  ): Promise<AiModelConfig> {
    const { providers, models } = await this.loadActiveForMutation();
    const providerExists = providers.some((item) => item.id === input.providerId);
    if (!providerExists) {
      throw new Error("provider not found");
    }
    const existingModel = input.id
      ? (models.find((item) => item.id === input.id) ?? null)
      : (models.find(
          (item) => item.providerId === input.providerId && item.modelKey === input.modelKey,
        ) ?? null);

    const nextModel: AiModelConfig = {
      id: existingModel?.id ?? input.id ?? crypto.randomUUID(),
      providerId: input.providerId,
      modelKey: input.modelKey,
      displayName: input.displayName,
      capability: input.capability,
      status: input.status === "disabled" ? "disabled" : "active",
      testStatus: readModelTestStatus(input.testStatus ?? existingModel?.testStatus),
      lifecycleStatus: readModelLifecycleStatus(
        input.lifecycleStatus ?? existingModel?.lifecycleStatus,
      ),
      displayOrder:
        readNumberOrNull(input.displayOrder) ??
        readNumberOrNull(existingModel?.displayOrder) ??
        models.filter((item) => item.capability === input.capability).length,
      lastErrorKind: readModelErrorKind(input.lastErrorKind ?? existingModel?.lastErrorKind),
      lastErrorCode: input.lastErrorCode ?? existingModel?.lastErrorCode ?? null,
      lastErrorMessage: input.lastErrorMessage ?? existingModel?.lastErrorMessage ?? null,
      lastErrorAt: input.lastErrorAt ?? existingModel?.lastErrorAt ?? null,
      supportsInput: input.supportsInput ?? true,
      supportsImageInputPrompt:
        input.supportsImageInputPrompt ?? existingModel?.supportsImageInputPrompt ?? false,
      supportsOutput: input.supportsOutput ?? true,
      contextWindow: input.contextWindow ?? null,
      maxOutputTokens: input.maxOutputTokens ?? null,
      metadata: input.metadata ?? {},
      updatedAt: nowIso(),
    };

    const index = models.findIndex((item) => item.id === nextModel.id);
    if (index >= 0) {
      models[index] = {
        ...models[index],
        ...nextModel,
      };
    } else {
      models.push(nextModel);
    }

    void actorId;
    const savedModel = await this.upsertModelRow(nextModel);
    return savedModel;
  }

  public async testModelWithMinimalTokens(
    modelId: string,
    actorId: string,
  ): Promise<ModelTestResult> {
    const { providers, models } = await this.loadActiveForMutation();
    const model = models.find((item) => item.id === modelId);
    if (!model) {
      throw new Error("model not found");
    }
    const provider = providers.find((item) => item.id === model.providerId);
    if (!provider) {
      throw new Error("provider not found");
    }

    if (!provider.hasKey) {
      const now = nowIso();
      model.testStatus = "failed";
      model.lastErrorKind = "provider_api";
      model.lastErrorCode = "api_key_missing";
      model.lastErrorMessage = "Provider API key is missing";
      model.lastErrorAt = now;
      model.updatedAt = now;
      void actorId;
      const [savedModel, savedProvider] = await Promise.all([
        this.upsertModelRow(model),
        this.upsertProviderRow(provider),
      ]);
      return { model: savedModel, provider: savedProvider };
    }

    let artifact: ModelTestResult["artifact"] | undefined;

    if (model.capability === "image_generation") {
      try {
        if (provider.providerKey !== "xai") {
          throw new Error(`Image test is unsupported for provider: ${provider.providerKey}`);
        }
        const secretMap = await loadDecryptedProviderSecrets([provider.providerKey]);
        const apiKey = secretMap.get(provider.providerKey)?.apiKey?.trim() ?? "";
        if (!apiKey) {
          throw new Error("MISSING_XAI_API_KEY");
        }
        const client = createXai({ apiKey });
        const imageResult = await generateImage({
          model: client.image(model.modelKey),
          prompt: "Minion",
          aspectRatio: "2:3",
          n: 1,
          maxRetries: 0,
        });
        const first = imageResult.images[0];
        const base64 = first?.base64 ?? "";
        const mediaType = first?.mediaType ?? "image/png";
        if (!base64) {
          throw new Error("IMAGE_TEST_EMPTY_OUTPUT");
        }

        artifact = {
          imageDataUrl: `data:${mediaType};base64,${base64}`,
        };

        model.testStatus = "success";
        model.status = "active";
        model.lastErrorKind = null;
        model.lastErrorCode = null;
        model.lastErrorMessage = null;
        model.lastErrorAt = null;
        model.updatedAt = nowIso();
        provider.testStatus = provider.status === "disabled" ? "disabled" : "success";
        provider.lastApiErrorCode = null;
        provider.lastApiErrorMessage = null;
        provider.lastApiErrorAt = null;
        provider.updatedAt = nowIso();
      } catch (error) {
        const details = readErrorDetails(error);
        const now = nowIso();
        model.testStatus = "failed";
        model.lastErrorKind = "provider_api";
        model.lastErrorCode = details.code;
        model.lastErrorMessage = details.message;
        model.lastErrorAt = now;
        model.updatedAt = now;
        provider.lastApiErrorCode = details.code;
        provider.lastApiErrorMessage = details.message;
        provider.lastApiErrorAt = now;
        provider.updatedAt = now;
      }
    } else {
      const testPrompt =
        provider.providerKey === "minimax" ? "Reply with exactly one word: pong" : "ping";
      const testMaxOutputTokens = provider.providerKey === "minimax" ? 128 : 1;
      try {
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
          includeMock: false,
          includeXai: true,
          includeMinimax: true,
        });
        const llmResult = await invokeLLM({
          registry,
          taskType: "generic",
          routeOverride: invocationConfig.route,
          modelInput: {
            prompt: testPrompt,
            maxOutputTokens: testMaxOutputTokens,
            temperature: 0,
          },
          entityId: `model-test:${model.id}`,
          timeoutMs: invocationConfig.timeoutMs,
          retries: 0,
          onProviderError: async (event) => {
            const now = nowIso();
            const baseProviderErrorMessage =
              readNonEmptyMessage(event.error) ?? "Provider API request failed";
            const providerErrorMessage = `${baseProviderErrorMessage}${buildLlmErrorDetailsSuffix(
              event.errorDetails,
            )}`;
            model.testStatus = "failed";
            model.lastErrorKind = "provider_api";
            model.lastErrorCode = event.errorDetails?.code ?? null;
            model.lastErrorMessage = providerErrorMessage.slice(0, 500);
            model.lastErrorAt = now;
            model.updatedAt = now;
            provider.lastApiErrorCode = event.errorDetails?.code ?? null;
            provider.lastApiErrorMessage = providerErrorMessage.slice(0, 500);
            provider.lastApiErrorAt = now;
            provider.updatedAt = now;
          },
        });

        const isModelTestSuccess = !llmResult.error && llmResult.finishReason !== "error";
        if (isModelTestSuccess) {
          const now = nowIso();
          model.testStatus = "success";
          model.status = "active";
          model.lastErrorKind = null;
          model.lastErrorCode = null;
          model.lastErrorMessage = null;
          model.lastErrorAt = null;
          model.updatedAt = now;
          provider.testStatus = provider.status === "disabled" ? "disabled" : "success";
          provider.lastApiErrorCode = null;
          provider.lastApiErrorMessage = null;
          provider.lastApiErrorAt = null;
          provider.updatedAt = now;
        } else {
          const now = nowIso();
          const rawErrorCandidate =
            readNonEmptyMessage(llmResult.error, model.lastErrorMessage) ??
            `Model returned empty output (finishReason=${String(llmResult.finishReason ?? "unknown")})`;
          const rawError = isGenericModelTestError(rawErrorCandidate)
            ? `Provider API request failed${buildLlmErrorDetailsSuffix(llmResult.errorDetails)}`
            : `${rawErrorCandidate}${buildLlmErrorDetailsSuffix(llmResult.errorDetails)}`;
          model.testStatus = "failed";
          model.lastErrorKind = model.lastErrorKind ?? "other";
          model.lastErrorCode = llmResult.errorDetails?.code ?? model.lastErrorCode ?? null;
          model.lastErrorMessage = rawError.startsWith("LLM_TIMEOUT_")
            ? `Model test timeout (${provider.providerKey}, ${String(invocationConfig.timeoutMs ?? 12_000)}ms)`
            : rawError.slice(0, 500);
          model.lastErrorAt = now;
          model.updatedAt = now;
          provider.updatedAt = now;
        }
      } catch (error) {
        const details = readErrorDetails(error);
        const now = nowIso();
        model.testStatus = "failed";
        model.lastErrorKind = "provider_api";
        model.lastErrorCode = details.code;
        model.lastErrorMessage = details.message;
        model.lastErrorAt = now;
        model.updatedAt = now;
        provider.lastApiErrorCode = details.code;
        provider.lastApiErrorMessage = details.message;
        provider.lastApiErrorAt = now;
        provider.updatedAt = now;
      }
    }

    void actorId;
    const [savedModel, savedProvider] = await Promise.all([
      this.upsertModelRow(model),
      this.upsertProviderRow(provider),
    ]);
    return { model: savedModel, provider: savedProvider, artifact };
  }

  public async reorderModels(input: {
    capability: ModelCapability;
    orderedModelKeys: string[];
    actorId: string;
  }): Promise<{
    models: AiModelConfig[];
  }> {
    const { providers, models } = await this.loadActiveForMutation();

    const requestedSupported = input.orderedModelKeys
      .map(
        (modelKey) =>
          SUPPORTED_MODEL_CATALOG.find(
            (item) => item.modelKey === modelKey && item.capability === input.capability,
          ) ?? null,
      )
      .filter((item, index, arr): item is (typeof SUPPORTED_MODEL_CATALOG)[number] => {
        if (!item) {
          return false;
        }
        return arr.findIndex((target) => target?.modelKey === item.modelKey) === index;
      });

    const now = nowIso();
    for (const supported of requestedSupported) {
      const providerCatalog = SUPPORTED_PROVIDER_CATALOG.find(
        (item) => item.providerKey === supported.providerKey,
      );
      const provider = providers.find((item) => item.providerKey === supported.providerKey) ?? null;
      let providerId = provider?.id ?? null;
      if (!providerId && providerCatalog) {
        providerId = crypto.randomUUID();
        providers.push({
          id: providerId,
          providerKey: providerCatalog.providerKey,
          displayName: providerCatalog.displayName,
          sdkPackage: providerCatalog.sdkPackage,
          status: "active",
          testStatus: "untested",
          keyLast4: null,
          hasKey: false,
          lastApiErrorCode: null,
          lastApiErrorMessage: null,
          lastApiErrorAt: null,
          createdAt: now,
          updatedAt: now,
        });
      }
      if (!providerId) {
        continue;
      }

      const existing = models.find(
        (item) => item.providerId === providerId && item.modelKey === supported.modelKey,
      );
      if (existing) {
        continue;
      }

      models.push({
        id: crypto.randomUUID(),
        providerId,
        modelKey: supported.modelKey,
        displayName: supported.displayName,
        capability: supported.capability,
        status: "disabled",
        testStatus: "untested",
        lifecycleStatus: "active",
        displayOrder: models.filter((item) => item.capability === input.capability).length,
        lastErrorKind: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastErrorAt: null,
        supportsInput: true,
        supportsImageInputPrompt: supported.supportsImageInputPrompt,
        supportsOutput: true,
        contextWindow: null,
        maxOutputTokens: null,
        metadata: supported.metadata,
        updatedAt: now,
      });
    }

    const targetModels = models.filter((item) => item.capability === input.capability);
    const keyToId = new Map(targetModels.map((item) => [item.modelKey, item.id] as const));
    const requested = input.orderedModelKeys
      .map((modelKey) => keyToId.get(modelKey) ?? null)
      .filter((id, index, arr): id is string => Boolean(id) && arr.indexOf(id) === index);
    const requestedSet = new Set(requested);

    const remaining = targetModels
      .filter((item) => !requestedSet.has(item.id))
      .sort((a, b) => {
        const gap = a.displayOrder - b.displayOrder;
        if (gap !== 0) {
          return gap;
        }
        return a.modelKey.localeCompare(b.modelKey);
      })
      .map((item) => item.id);

    const finalOrder = [...requested, ...remaining];
    const orderMap = new Map(finalOrder.map((id, index) => [id, index]));

    for (const model of models) {
      if (model.capability !== input.capability) {
        continue;
      }
      const nextOrder = orderMap.get(model.id);
      if (typeof nextOrder !== "number") {
        continue;
      }
      model.displayOrder = nextOrder;
      model.updatedAt = now;
      model.metadata = {
        ...model.metadata,
        displayOrder: nextOrder,
      };
    }

    void input.actorId;
    for (const provider of providers) {
      await this.upsertProviderRow(provider);
    }
    const targetModelIds = new Set(targetModels.map((item) => item.id));
    for (const model of models) {
      if (targetModelIds.has(model.id)) {
        await this.upsertModelRow(model);
      }
    }

    const savedModels = await this.listModelsFromDb();
    return {
      models: savedModels,
    };
  }

  public async recordLlmInvocationError(input: {
    providerKey: string;
    modelKey: string;
    error: string;
    errorDetails?: {
      statusCode?: number;
      code?: string;
      type?: string;
      body?: string;
    };
  }): Promise<void> {
    const { providers, models } = await this.loadActiveForMutation();
    const provider = providers.find((item) => item.providerKey === input.providerKey);
    if (!provider) {
      return;
    }
    const model = models.find(
      (item) => item.providerId === provider.id && item.modelKey === input.modelKey,
    );
    if (!model) {
      return;
    }

    const errorText =
      `${input.error} ${input.errorDetails?.code ?? ""} ${input.errorDetails?.type ?? ""} ${input.errorDetails?.body ?? ""}`.toLowerCase();
    const isModelRetired =
      input.errorDetails?.statusCode === 404 ||
      /model.*(not found|retired|deprecated|unsupported|does not exist|unknown)/.test(errorText) ||
      /(model_not_found|unknown_model|invalid_model)/.test(errorText);
    const isHardProviderFailure =
      !isModelRetired &&
      ((typeof input.errorDetails?.statusCode === "number" &&
        (input.errorDetails.statusCode === 402 || input.errorDetails.statusCode === 403)) ||
        /(insufficient[_\s-]?(balance|credit|quota)|credit.*exhausted|quota.*exceeded|billing|payment required|account suspended|account deactivated)/.test(
          errorText,
        ));
    const isTransientProviderFailure =
      !isModelRetired &&
      !isHardProviderFailure &&
      ((typeof input.errorDetails?.statusCode === "number" &&
        (input.errorDetails.statusCode >= 500 ||
          input.errorDetails.statusCode === 401 ||
          input.errorDetails.statusCode === 429)) ||
        /(api key|unauthorized|forbidden|rate limit|timeout|network|service unavailable)/.test(
          errorText,
        ));
    const isProviderApiError = isHardProviderFailure || isTransientProviderFailure;

    const now = nowIso();
    model.lastErrorKind = isModelRetired
      ? "model_retired"
      : isProviderApiError
        ? "provider_api"
        : "other";
    model.lastErrorCode = input.errorDetails?.code ?? null;
    model.lastErrorMessage = input.error.slice(0, 500);
    model.lastErrorAt = now;

    if (isModelRetired) {
      model.lifecycleStatus = "retired";
      model.status = "disabled";
      model.testStatus = "failed";
    }

    if (isHardProviderFailure) {
      model.status = "disabled";
      model.testStatus = "failed";
    }

    if (isProviderApiError) {
      provider.lastApiErrorCode = input.errorDetails?.code ?? null;
      provider.lastApiErrorMessage = input.error.slice(0, 500);
      provider.lastApiErrorAt = now;
      provider.updatedAt = now;
    }

    await Promise.all([this.upsertModelRow(model), this.upsertProviderRow(provider)]);
  }

  public async saveGlobalPolicyDraft(
    draft: Pick<
      GlobalPolicyStudioDraft,
      "systemBaseline" | "globalPolicy" | "styleGuide" | "forbiddenRules"
    > & {
      action?: "update" | "publish";
      version?: number;
    },
    actorId: string,
    note?: string,
  ): Promise<PolicyReleaseListItem> {
    const action = draft.action === "publish" ? "publish" : "update";
    const active = await this.fetchActiveRelease();
    const requestedReleaseVersion = readPositiveInt(draft.version, active?.version ?? 1);
    const baseRow =
      (await this.fetchReleaseByVersion(requestedReleaseVersion)) ??
      active ??
      ({
        version: 0,
        policy: {},
        is_active: false,
        created_by: null,
        change_note: null,
        created_at: nowIso(),
      } as PolicyReleaseRow);
    const basePolicy = asRecord(baseRow.policy) ?? {};
    const document = readGlobalPolicyDocument(basePolicy);

    document.globalPolicyDraft = {
      systemBaseline: draft.systemBaseline,
      globalPolicy: draft.globalPolicy,
      styleGuide: draft.styleGuide,
      forbiddenRules: draft.forbiddenRules,
    };
    const policy = writeGlobalPolicyDocument(basePolicy, document);
    const changeNote = note ?? `control-plane: ${action} policy v${requestedReleaseVersion}`;

    let row: PolicyReleaseRow;
    if (action === "publish" || !active) {
      row = await this.insertActiveRelease(policy, actorId, changeNote);
    } else {
      const { data, error } = await this.supabase
        .from("ai_policy_releases")
        .update({
          policy,
          created_by: actorId,
          change_note: changeNote,
        })
        .eq("version", baseRow.version)
        .select("version, policy, is_active, created_by, change_note, created_at")
        .single<PolicyReleaseRow>();
      if (error || !data) {
        throw new Error(`save policy draft failed: ${error?.message ?? "unknown"}`);
      }
      row = data;
    }

    const savedDoc = readGlobalPolicyDocument(row.policy);
    return {
      version: row.version,
      isActive: row.is_active,
      createdBy: row.created_by,
      changeNote: row.change_note,
      createdAt: row.created_at,
      globalPolicyDraft: savedDoc.globalPolicyDraft,
    };
  }

  public async deletePolicyRelease(version: number): Promise<void> {
    const row = await this.fetchReleaseByVersion(version);
    if (!row) {
      throw new Error("policy release not found");
    }
    if (row.is_active) {
      throw new Error("active policy release cannot be deleted");
    }

    const { error } = await this.supabase
      .from("ai_policy_releases")
      .delete()
      .eq("version", version);
    if (error) {
      throw new Error(`delete policy release failed: ${error.message}`);
    }
  }

  public async rollbackToRelease(
    version: number,
    actorId: string,
    note?: string,
  ): Promise<PolicyReleaseListItem> {
    const row = await this.fetchReleaseByVersion(version);
    if (!row) {
      throw new Error("policy release not found");
    }

    const inserted = await this.insertActiveRelease(
      asRecord(row.policy) ?? {},
      actorId,
      note ?? `control-plane: rollback to version ${version}`,
    );

    const doc = readGlobalPolicyDocument(inserted.policy);
    return {
      version: inserted.version,
      isActive: inserted.is_active,
      createdBy: inserted.created_by,
      changeNote: inserted.change_note,
      createdAt: inserted.created_at,
      globalPolicyDraft: doc.globalPolicyDraft,
    };
  }

  public async previewGlobalPolicyRelease(
    version: number,
    taskContext: string,
  ): Promise<PreviewResult> {
    const row = await this.fetchReleaseByVersion(version);
    if (!row) {
      throw new Error("policy release not found");
    }

    const document = readGlobalPolicyDocument(row.policy);
    const blocks = buildPromptBlocks({
      actionType: "comment",
      globalDraft: document.globalPolicyDraft,
      outputStyle: document.globalPolicyDraft.styleGuide,
      personaSoul: "(global preview mode)",
      agentMemory: formatAgentMemory({
        shortTerm: "",
        longTerm: "",
      }),
      agentRelationshipContext: "",
      boardContext: "",
      targetContext: "",
      agentEnactmentRules: "",
      agentExamples: "",
      taskContext,
    });

    const tokenBudget = buildTokenBudgetSignal({
      blocks,
      maxInputTokens: DEFAULT_TOKEN_LIMITS.interactionMaxInputTokens,
      maxOutputTokens: DEFAULT_TOKEN_LIMITS.interactionMaxOutputTokens,
    });

    const markdown = [
      "## Global Policy Preview",
      "",
      `Task Context: ${taskContext || "(empty)"}`,
      "",
      "This is a policy-only prompt assembly preview.",
    ].join("\n");

    try {
      markdownToEditorHtml(markdown);
      return {
        assembledPrompt: formatPrompt(blocks),
        markdown,
        renderOk: true,
        renderError: null,
        tokenBudget,
      };
    } catch (error) {
      return {
        assembledPrompt: formatPrompt(blocks),
        markdown,
        renderOk: false,
        renderError: error instanceof Error ? error.message : "render validation failed",
        tokenBudget,
      };
    }
  }

  public async listPersonas(limit = 50, query?: string): Promise<PersonaSummary[]> {
    let qb = this.supabase
      .from("personas")
      .select("id, username, display_name, bio, status")
      .order("updated_at", { ascending: false })
      .limit(Math.max(1, Math.min(200, limit)));

    const keyword = query?.trim();
    if (keyword) {
      const escaped = keyword.replace(/[%_]/g, (m) => `\\${m}`);
      qb = qb.or(`username.ilike.%${escaped}%,display_name.ilike.%${escaped}%`);
    }

    const { data, error } = await qb;

    if (error) {
      throw new Error(`list personas failed: ${error.message}`);
    }

    return (data ?? []) as PersonaSummary[];
  }

  public async createPersona(input: {
    username?: string;
    personas: PersonaGenerationStructured["personas"];
    personaCore: Record<string, unknown>;
    referenceSources: PersonaGenerationStructured["reference_sources"];
    referenceDerivation: string[];
    originalizationNote: string;
    personaMemories?: Array<{
      memoryType: "memory" | "long_memory";
      scope: "persona" | "thread" | "task";
      memoryKey?: string | null;
      content: string;
      metadata?: Record<string, unknown>;
      expiresAt?: string | null;
      isCanonical?: boolean;
      importance?: number | null;
    }>;
  }): Promise<{ personaId: string }> {
    const username = toPersonaUsername(input.username?.trim() || input.personas.display_name);

    const { data: persona, error: personaError } = await this.supabase
      .from("personas")
      .insert({
        username,
        display_name: input.personas.display_name,
        bio: input.personas.bio,
        status: input.personas.status === "inactive" ? "inactive" : "active",
      })
      .select("id")
      .single<{ id: string }>();

    if (personaError || !persona) {
      throw new Error(`create persona failed: ${personaError?.message ?? "unknown"}`);
    }

    const personaId = persona.id;

    const { error: personaCoreError } = await this.supabase.from("persona_cores").upsert({
      persona_id: personaId,
      core_profile: {
        ...input.personaCore,
        reference_sources: input.referenceSources,
        reference_derivation: input.referenceDerivation,
        originalization_note: input.originalizationNote,
      },
      updated_at: nowIso(),
    });
    if (personaCoreError) {
      throw new Error(`save persona core failed: ${personaCoreError.message}`);
    }

    if (input.personaMemories && input.personaMemories.length > 0) {
      const memoryRows = input.personaMemories
        .map((item) => ({
          persona_id: personaId,
          memory_type: item.memoryType,
          scope: item.scope,
          memory_key: item.memoryKey?.trim() || null,
          content: item.content.trim(),
          metadata: item.metadata ?? {},
          expires_at: item.expiresAt ?? null,
          is_canonical: item.isCanonical ?? false,
          importance: item.importance ?? null,
        }))
        .filter((item) => item.content.length > 0);
      if (memoryRows.length > 0) {
        const { error: memoryError } = await this.supabase
          .from("persona_memories")
          .insert(memoryRows);
        if (memoryError) {
          throw new Error(`save persona memory failed: ${memoryError.message}`);
        }
      }
    }

    return { personaId };
  }

  public async getPersonaProfile(personaId: string): Promise<PersonaProfile> {
    const { data: persona, error: personaError } = await this.supabase
      .from("personas")
      .select("id, username, display_name, bio, status")
      .eq("id", personaId)
      .single<PersonaSummary>();

    if (personaError || !persona) {
      throw new Error("persona not found");
    }

    const [personaCoreRes, memoryRes, longMemoryRes] = await Promise.all([
      this.supabase
        .from("persona_cores")
        .select("core_profile")
        .eq("persona_id", personaId)
        .maybeSingle<PersonaCoreRow>(),
      this.supabase
        .from("persona_memories")
        .select("id, memory_key, content, metadata, expires_at, created_at, updated_at")
        .eq("persona_id", personaId)
        .eq("memory_type", "memory")
        .eq("scope", "persona")
        .order("updated_at", { ascending: false })
        .limit(80),
      this.supabase
        .from("persona_memories")
        .select("id, content, importance, is_canonical, metadata, updated_at, created_at")
        .eq("persona_id", personaId)
        .eq("memory_type", "long_memory")
        .eq("scope", "persona")
        .order("is_canonical", { ascending: false })
        .order("importance", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(50),
    ]);

    if (personaCoreRes.error) {
      throw new Error(`load persona core failed: ${personaCoreRes.error.message}`);
    }
    if (memoryRes.error) {
      throw new Error(`load persona memories failed: ${memoryRes.error.message}`);
    }
    if (longMemoryRes.error) {
      throw new Error(`load persona long memories failed: ${longMemoryRes.error.message}`);
    }

    return {
      persona,
      personaCore: (asRecord(personaCoreRes.data?.core_profile) ?? {}) as Record<string, unknown>,
      personaMemories: [
        ...((memoryRes.data ?? []) as PersonaMemoryStoreRow[]).map((row) => ({
          id: row.id,
          memoryType: "memory" as const,
          scope: "persona" as const,
          memoryKey: row.memory_key,
          content: row.content,
          metadata: row.metadata ?? {},
          expiresAt: row.expires_at,
          isCanonical: row.is_canonical,
          importance: row.importance,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
        ...((longMemoryRes.data ?? []) as PersonaMemoryStoreRow[]).map((row) => ({
          id: row.id,
          memoryType: "long_memory" as const,
          scope: "persona" as const,
          memoryKey: row.memory_key,
          content: row.content,
          metadata: row.metadata ?? {},
          expiresAt: row.expires_at,
          isCanonical: row.is_canonical,
          importance: row.importance,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      ],
    };
  }

  public async assistInteractionTaskContext(input: {
    modelId: string;
    taskType: "post" | "comment";
    personaId?: string;
    taskContext?: string;
  }): Promise<string> {
    const { providers, models } = await this.getActiveControlPlane();
    const { model, provider } = resolvePersonaTextModel({
      modelId: input.modelId,
      models,
      providers,
      featureLabel: "interaction context assist",
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

    let personaProfile: PersonaProfile | null = null;
    if (input.personaId) {
      try {
        personaProfile = await this.getPersonaProfile(input.personaId);
      } catch {
        personaProfile = null;
      }
    }

    const personaName = personaProfile?.persona.display_name ?? "the selected persona";
    const referenceSourceNames = Array.isArray(
      asRecord(personaProfile?.personaCore ?? {}).reference_sources,
    )
      ? (asRecord(personaProfile?.personaCore ?? {}).reference_sources as unknown[])
          .map((item) => readString(asRecord(item)?.name).trim())
          .filter((name) => name.length > 0)
      : [];
    const existingTaskContext = input.taskContext?.trim() ?? "";

    const prompt = [
      existingTaskContext
        ? "Write one short Interaction Preview scenario related to the current task context."
        : "Write one short random Interaction Preview scenario.",
      `Task type: ${input.taskType}.`,
      `Persona: ${personaName}.`,
      referenceSourceNames.length > 0
        ? `Reference anchors: ${referenceSourceNames.join(", ")}.`
        : null,
      existingTaskContext ? `Existing task context:\n${existingTaskContext}` : null,
      "Return plain text only.",
      existingTaskContext
        ? "Keep it clearly related, but do not copy or paraphrase the input."
        : "Make it realistic and specific.",
      input.taskType === "comment"
        ? existingTaskContext
          ? "Make it feel like a forum comment or critique that invites a reply."
          : "Make it feel like a forum comment that invites a reply."
        : existingTaskContext
          ? "Make it feel like a related topic seed for the next post."
          : "Make it feel like a topic seed for a new post.",
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n");

    const metadata = {
      entityType: "admin_ai_control_plane" as const,
      entityId: `interaction-context-assist:${model.id}`,
    };
    const runAssistPrompt = async (
      candidatePrompt: string,
      maxOutputTokens: number,
      temperature: number,
    ) => {
      return invokeLLM({
        registry,
        taskType: "generic",
        routeOverride: invocationConfig.route,
        modelInput: {
          prompt: candidatePrompt,
          maxOutputTokens,
          temperature,
          metadata,
        },
        entityId: metadata.entityId,
        timeoutMs: invocationConfig.timeoutMs,
        retries: invocationConfig.retries,
        onProviderError: async (event) => {
          await this.recordLlmInvocationError({
            providerKey: event.providerId,
            modelKey: event.modelId,
            error: event.error,
            errorDetails: event.errorDetails,
          });
        },
      });
    };

    const firstAttempt = await runAssistPrompt(prompt, 900, 0.4);
    if (firstAttempt.text.trim()) {
      return firstAttempt.text.trim();
    }

    const retryPrompt = [
      existingTaskContext
        ? "Rewrite the current task context into one short related Interaction Preview scenario."
        : "Create one short Interaction Preview scenario.",
      `Task type: ${input.taskType}.`,
      `Persona: ${personaName}.`,
      referenceSourceNames.length > 0
        ? `Reference anchors: ${referenceSourceNames.join(", ")}.`
        : null,
      existingTaskContext ? `Existing task context:\n${existingTaskContext}` : null,
      "Return plain text only.",
      "One short paragraph. No markdown.",
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n");

    const secondAttempt = await runAssistPrompt(retryPrompt, 1400, 0.2);
    if (secondAttempt.text.trim()) {
      return secondAttempt.text.trim();
    }
    throw new Error(
      `interaction context assist returned empty output (finishReason=${String(secondAttempt.finishReason ?? "unknown")}; error=${String(secondAttempt.error ?? "none")}; attempts=${String(secondAttempt.attempts ?? 0)})`,
    );
  }

  public async patchPersonaProfile(input: {
    personaId: string;
    username?: string;
    bio?: string;
    personaCore?: Record<string, unknown>;
    longMemory?: string;
  }): Promise<void> {
    const updates: Record<string, unknown> = {};
    if (input.username !== undefined) {
      updates.username = toPersonaUsername(input.username);
    }
    if (input.bio !== undefined) {
      updates.bio = input.bio;
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await this.supabase
        .from("personas")
        .update(updates)
        .eq("id", input.personaId);
      if (error) {
        throw new Error(`update persona failed: ${error.message}`);
      }
    }

    if (input.personaCore) {
      const { error } = await this.supabase.from("persona_cores").upsert({
        persona_id: input.personaId,
        core_profile: input.personaCore,
        updated_at: nowIso(),
      });
      if (error) {
        throw new Error(`update persona core failed: ${error.message}`);
      }
    }

    if (input.longMemory !== undefined) {
      const trimmed = input.longMemory.trim();
      if (trimmed.length > 0) {
        const { error } = await this.supabase.from("persona_memories").insert({
          persona_id: input.personaId,
          memory_type: "long_memory",
          scope: "persona",
          content: trimmed,
          importance: 0.9,
          is_canonical: true,
          metadata: { memoryCategory: "knowledge" },
        });
        if (error) {
          throw new Error(`append long memory failed: ${error.message}`);
        }
      }
    }
  }

  public async previewPersonaGeneration(input: { modelId: string; extraPrompt: string }): Promise<
    PreviewResult & {
      structured: PersonaGenerationStructured;
    }
  > {
    const { document, providers, models } = await this.getActiveControlPlane();
    const { model, provider } = resolvePersonaTextModel({
      modelId: input.modelId,
      models,
      providers,
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
        content: `${document.globalPolicyDraft.systemBaseline}\n${document.globalPolicyDraft.globalPolicy}`,
      },
      {
        name: "generator_instruction",
        content: [
          "Generate the canonical persona payload in smaller validated stages.",
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
    const stagePromptRecords: Array<{ name: string; prompt: string; outputMaxTokens: number }> = [];

    const buildStagePrompt = (input: {
      stageName: string;
      stageGoal: string;
      stageContract: string;
      validatedContext?: Record<string, unknown> | null;
    }) => {
      const blocks = [
        ...commonBlocks,
        {
          name: "persona_generation_stage",
          content: [`stage_name: ${input.stageName}`, `stage_goal: ${input.stageGoal}`].join("\n"),
        },
        ...(input.validatedContext
          ? [
              {
                name: "validated_context",
                content: JSON.stringify(input.validatedContext, null, 2),
              },
            ]
          : []),
        { name: "stage_contract", content: input.stageContract },
        { name: "output_constraints", content: "Output strictly valid JSON." },
      ];
      return formatPrompt(blocks);
    };

    const runPersonaGenerationStage = async <T>(input: {
      stageName: string;
      stageGoal: string;
      stageContract: string;
      parse: (rawText: string) => T;
      validatedContext?: Record<string, unknown> | null;
      outputMaxTokens: number;
    }): Promise<T> => {
      const basePrompt = buildStagePrompt(input);
      stagePromptRecords.push({
        name: input.stageName,
        prompt: basePrompt,
        outputMaxTokens: input.outputMaxTokens,
      });

      const invokeStageAttempt = async (prompt: string, attempt: 1 | 2 | 3) =>
        invokeLLM({
          registry,
          taskType: "generic",
          routeOverride: invocationConfig.route,
          modelInput: {
            prompt,
            maxOutputTokens:
              attempt === 1
                ? Math.min(input.outputMaxTokens, maxOutputTokens)
                : attempt === 2
                  ? Math.min(
                      PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.repairRetryCap,
                      input.outputMaxTokens,
                      maxOutputTokens,
                    )
                  : Math.min(
                      PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.compactRetryCap,
                      input.outputMaxTokens,
                      maxOutputTokens,
                    ),
            temperature: attempt === 1 ? 0.4 : attempt === 2 ? 0.2 : 0.1,
          },
          entityId: `persona-generation-preview:${model.id}:${input.stageName}:attempt-${attempt}`,
          timeoutMs: invocationConfig.timeoutMs,
          retries: invocationConfig.retries,
          onProviderError: async (event) => {
            await this.recordLlmInvocationError({
              providerKey: event.providerId,
              modelKey: event.modelId,
              error: event.error,
              errorDetails: event.errorDetails,
            });
          },
        });

      const attemptParse = (result: { text: string; error: string | null }) => {
        if (!result.text.trim()) {
          throw new PersonaGenerationParseError(
            result.error ?? "persona generation model returned empty output",
            result.text,
          );
        }
        return input.parse(result.text);
      };

      const first = await invokeStageAttempt(basePrompt, 1);
      try {
        return attemptParse(first);
      } catch (error) {
        if (!(error instanceof PersonaGenerationParseError)) {
          throw error;
        }
        const repairPrompt = `${basePrompt}\n\n[retry_repair]\nYour previous response for stage ${input.stageName} was invalid or incomplete JSON. Retry once with a shorter response.\nReturn strictly valid JSON only.\nKeep every string concise.\nLimit arrays to at most 3 items.\nDo not add commentary.\nDo not omit required keys.`;
        try {
          const second = await invokeStageAttempt(repairPrompt, 2);
          return attemptParse(second);
        } catch (retryError) {
          if (!(retryError instanceof PersonaGenerationParseError)) {
            throw retryError;
          }
          const compactRepairPrompt = `${basePrompt}\n\n[retry_repair]\nYour previous responses for stage ${input.stageName} were invalid or incomplete JSON.\nReturn a compact version from scratch using the same contract.\nReturn strictly valid JSON only.\nKeep every string very short.\nUse at most 2 items in arrays unless the schema requires more.\nDo not add commentary.\nDo not omit required keys.`;
          const third = await invokeStageAttempt(compactRepairPrompt, 3);
          try {
            return attemptParse(third);
          } catch (compactError) {
            if (compactError instanceof PersonaGenerationParseError) {
              throw compactError;
            }
            throw retryError;
          }
        }
      }
    };

    const seedStage = await runPersonaGenerationStage({
      stageName: "seed",
      stageGoal: "Establish the persona's identity seed, bio, and explicit references.",
      stageContract: [
        "Return one JSON object with keys:",
        "personas{display_name,bio,status},",
        "identity_summary{archetype,core_motivation,one_sentence_identity},",
        "reference_sources[{name,type,contribution}],",
        "reference_derivation:string[],",
        "originalization_note:string.",
        "status should be active or inactive.",
      ].join("\n"),
      parse: parsePersonaSeedOutput,
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
      ].join("\n"),
      parse: parsePersonaValuesAndAestheticOutput,
      validatedContext: seedStage,
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
      outputMaxTokens: PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.context_and_affinity,
    });

    const interactionStage = await runPersonaGenerationStage({
      stageName: "interaction_and_guardrails",
      stageGoal: "Define how the persona behaves in discussion and what it avoids.",
      stageContract: [
        "Return one JSON object with keys:",
        "interaction_defaults{default_stance,discussion_strengths,friction_triggers,non_generic_traits},",
        "guardrails{hard_no,deescalation_style}.",
      ].join("\n"),
      parse: parsePersonaInteractionOutput,
      validatedContext: {
        ...seedStage,
        ...valuesStage,
        ...contextStage,
      },
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
      ].join("\n"),
      parse: parsePersonaMemoriesOutput,
      validatedContext: {
        personas: seedStage.personas,
        persona_core: personaCore,
        reference_sources: seedStage.reference_sources,
      },
      outputMaxTokens: PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.memories,
    });

    const structured = parsePersonaGenerationOutput(
      JSON.stringify({
        personas: seedStage.personas,
        persona_core: personaCore,
        reference_sources: seedStage.reference_sources,
        reference_derivation: seedStage.reference_derivation,
        originalization_note: seedStage.originalization_note,
        persona_memories: memoriesStage.persona_memories,
      }),
    ).structured;
    const assembledPrompt = stagePromptRecords
      .map((stage, index) => `### Stage ${index + 1}: ${stage.name}\n${stage.prompt}`)
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
      `### personas`,
      `- display_name: ${structured.personas.display_name}`,
      `- status: ${structured.personas.status}`,
      `- bio: ${structured.personas.bio}`,
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

  public async assistPersonaPrompt(input: {
    modelId: string;
    inputPrompt: string;
  }): Promise<string> {
    const { providers, models } = await this.getActiveControlPlane();
    const { model, provider } = resolvePersonaTextModel({
      modelId: input.modelId,
      models,
      providers,
      featureLabel: "prompt assist",
    });
    const trimmedInput = input.inputPrompt.trim();
    const mode = trimmedInput.length === 0 ? "random" : "optimize";
    const systemPrompt =
      mode === "random"
        ? [
            "You write one concise extra prompt for generating a forum persona.",
            "Output rules:",
            "English only.",
            "Plain text only.",
            "No markdown, no bullets, no numbering, no labels, no quotes, no JSON.",
            "Maximum 60 words.",
            "Exactly 1 paragraph.",
            "Be precise and concrete.",
            "Include at least 1 explicit real reference name.",
            "Before writing the final prompt, first choose at least 1 real famous reference entity.",
            "Describe the persona's worldview, tone, bias, and interaction style.",
            "Use 1-3 explicit real reference names such as creators, artists, public figures, or fictional characters when they sharpen the persona.",
            "No filler, no explanation, no meta commentary.",
            "Do not mention schema, JSON, database fields, or implementation details.",
            "Do not sound like a generic AI assistant.",
            "Write one fresh prompt only.",
          ].join("\n")
        : [
            "You rewrite an existing extra prompt for generating a forum persona.",
            "Output rules:",
            "Keep the same language as the user's input.",
            "Plain text only.",
            "No markdown, no bullets, no numbering, no labels, no quotes, no JSON.",
            "Maximum 75 words.",
            "Exactly 1 paragraph.",
            "Preserve the user's core intent.",
            "Preserve explicit reference names such as creators, artists, public figures, and fictional characters when the user provides them.",
            "If the user did not provide any explicit reference name, infer at least 1 fitting real reference entity from the user's clues before writing the final brief.",
            "Interpret the user's input as possible clues about works, eras, domains, styles, genres, countries, personalities, values, or claims.",
            "Make it materially clearer, more specific, and more usable as a persona brief.",
            "Remove fluff, repetition, vagueness, and filler.",
            "Use the resolved reference as behavioral source material, not just as a name to mention.",
            "The final brief must reflect the reference's temperament, values, social energy, interaction style, or core contradiction.",
            "Explicitly sharpen the persona's role or domain, worldview or bias, tone, and interaction style.",
            "Avoid generic persona language such as witty but respectful, sharp taste, grounded observations, or values craft over hype unless the reference truly supports it.",
            "If the reference name could be swapped with another without changing the rest of the sentence, the result is too generic.",
            "Do not merely append a reference name to the user's original sentence.",
            "Do not start with imperative framing like Generate/Create/Write; return the rewritten brief itself.",
            "Do not mention schema, JSON, database fields, or implementation details.",
            "Do not explain your edits.",
            "Return only the rewritten prompt.",
          ].join("\n");
    const userPrompt =
      mode === "random"
        ? "Create one concise extra prompt for a new forum persona."
        : `Rewrite this extra prompt to be more precise and concise while preserving intent:\n\n${trimmedInput}`;

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
    const invokePromptAssist = async (promptText: string, temperature: number): Promise<string> => {
      const llmResult = await invokeLLM({
        registry,
        taskType: "generic",
        routeOverride: invocationConfig.route,
        modelInput: {
          prompt: promptText,
          maxOutputTokens: Math.min(model.maxOutputTokens ?? 320, 320),
          temperature,
        },
        entityId: `persona-prompt-assist:${model.id}`,
        timeoutMs: invocationConfig.timeoutMs,
        retries: invocationConfig.retries,
        onProviderError: async (event) => {
          await this.recordLlmInvocationError({
            providerKey: event.providerId,
            modelKey: event.modelId,
            error: event.error,
            errorDetails: event.errorDetails,
          });
        },
      });

      return llmResult.text.trim();
    };

    const hasExplicitReference = trimmedInput.length > 0 && hasLikelyNamedReference(trimmedInput);
    const resolveReferenceNames = async (): Promise<string[]> => {
      if (hasExplicitReference) {
        return [];
      }

      const resolverPrompt =
        mode === "random"
          ? [
              "Choose 1 to 3 real famous reference entities for a distinct forum persona.",
              "Return only the names, separated by |.",
              "No explanation, no prose, no bullets, no numbering.",
              "Allowed types include creators, artists, public figures, fictional characters, and works.",
            ].join("\n")
          : [
              "Infer 1 to 3 fitting real reference entities from the user's persona clues.",
              "The clues may refer to works, eras, domains, styles, genres, countries, personalities, values, or claims.",
              "Return only the names, separated by |.",
              "No explanation, no prose, no bullets, no numbering.",
              "",
              `User input:\n${trimmedInput}`,
            ].join("\n");

      const firstPass = parseResolvedReferenceNames(
        await invokePromptAssist(resolverPrompt, mode === "random" ? 0.9 : 0.35),
      );
      if (firstPass.length > 0) {
        return firstPass;
      }

      const repairResolverPrompt =
        mode === "random"
          ? [
              "Your previous answer did not return valid reference names.",
              "Return 1 to 3 real famous people, characters, or works only.",
              "Use the format: Name | Name | Name",
              "No explanation.",
            ].join("\n")
          : [
              "Your previous answer did not return valid reference names.",
              "Infer 1 to 3 fitting real reference entities from the user's persona clues.",
              "Return only the names in this format: Name | Name | Name",
              "No explanation.",
              "",
              `User input:\n${trimmedInput}`,
            ].join("\n");

      return parseResolvedReferenceNames(
        await invokePromptAssist(repairResolverPrompt, mode === "random" ? 0.7 : 0.25),
      );
    };

    const resolvedReferenceNames = await resolveReferenceNames();
    const resolvedReferenceInstruction =
      resolvedReferenceNames.length > 0
        ? mode === "random"
          ? `Use at least 1 of these resolved reference entities: ${resolvedReferenceNames.join(", ")}.`
          : `Use at least 1 of these resolved reference entities if they fit: ${resolvedReferenceNames.join(", ")}.`
        : null;

    let text = await invokePromptAssist(
      [systemPrompt, resolvedReferenceInstruction, userPrompt]
        .filter((item): item is string => Boolean(item))
        .join("\n\n"),
      mode === "random" ? 0.8 : 0.3,
    );
    if (!text) {
      if (trimmedInput.length > 0) {
        return ensurePromptAssistReferenceName({
          text: buildPromptAssistClarityFallback(trimmedInput, resolvedReferenceNames),
          mode,
          sourceText: trimmedInput,
          resolvedReferenceNames,
        });
      }
      return ensurePromptAssistReferenceName({
        text: "",
        mode,
        sourceText: trimmedInput,
        resolvedReferenceNames,
      });
    }

    if (isWeakPromptAssistRewrite({ text, mode, sourceText: trimmedInput })) {
      const repairPrompt = [
        "The previous rewrite was too weak.",
        "Rewrite the user's persona brief into a meaningfully clearer and more specific version.",
        "Keep the same language as the user's input.",
        "Plain text only.",
        "Exactly 1 paragraph, maximum 75 words.",
        "Preserve the core intent.",
        "Include at least 1 explicit real reference name.",
        resolvedReferenceInstruction,
        "If there is no explicit reference in the user input, infer one from the clues before writing.",
        "Treat the input as possible clues about works, eras, domains, styles, genres, countries, personalities, values, or claims.",
        "Use the resolved reference as behavioral source material, not just as a name to mention.",
        "Make the final brief reflect the reference's temperament, values, social energy, interaction style, or core contradiction.",
        "Make the role or domain, worldview or bias, tone, and interaction style obvious in the sentence itself.",
        "Avoid generic persona language such as witty but respectful, sharp taste, grounded observations, or values craft over hype unless the reference truly supports it.",
        "If the reference name could be swapped with another without changing the rest of the sentence, the rewrite is still too weak.",
        "Do not simply append a reference name to the original sentence.",
        "Do not start with Generate/Create/Write or similar imperative phrasing.",
        "Return only the rewritten brief.",
        "",
        `Original input:\n${trimmedInput}`,
        "",
        `Weak rewrite to improve:\n${text}`,
      ]
        .filter((item): item is string => Boolean(item))
        .join("\n");

      const repairedText = await invokePromptAssist(repairPrompt, 0.35);
      if (repairedText) {
        text = repairedText;
      }
    }

    const finalizedText = ensurePromptAssistReferenceName({
      text,
      mode,
      sourceText: trimmedInput || text,
      resolvedReferenceNames,
    });
    if (isWeakPromptAssistRewrite({ text: finalizedText, mode, sourceText: trimmedInput })) {
      return buildPromptAssistClarityFallback(
        trimmedInput || finalizedText,
        resolvedReferenceNames,
      );
    }
    return finalizedText;
  }

  public async previewPersonaInteraction(input: {
    personaId: string;
    modelId: string;
    taskType: PromptActionType;
    taskContext: string;
    boardContext?: PromptBoardContext;
    targetContext?: PromptTargetContext;
  }): Promise<PreviewResult> {
    const { document, providers, models } = await this.getActiveControlPlane();
    const { model, provider } = resolvePersonaTextModel({
      modelId: input.modelId,
      models,
      providers,
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

    const profile = await this.getPersonaProfile(input.personaId);
    const personaMemory = profile.personaMemories
      .filter((item) => item.memoryType === "memory")
      .map((item) => `${item.memoryKey ?? "memory"}: ${item.content}`)
      .join("\n");
    const longMemoryText = profile.personaMemories
      .filter((item) => item.memoryType === "long_memory")
      .map((item) => item.content)
      .join("\n");
    const effectivePersonaCore = profile.personaCore as Record<string, unknown>;
    const personaCoreText = JSON.stringify(effectivePersonaCore, null, 2);
    const runtimePersonaProfile = normalizeSoulProfile(effectivePersonaCore).profile;

    const blocks = buildPromptBlocks({
      actionType: input.taskType,
      globalDraft: document.globalPolicyDraft,
      outputStyle: document.globalPolicyDraft.styleGuide,
      agentProfile: formatAgentProfile({
        displayName: profile.persona.display_name,
        username: profile.persona.username,
        bio: profile.persona.bio,
      }),
      personaSoul: personaCoreText,
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
      agentEnactmentRules: formatAgentEnactmentRules(runtimePersonaProfile),
      agentExamples: formatAgentExamples(runtimePersonaProfile),
      taskContext: input.taskContext,
    });

    const tokenBudget = buildTokenBudgetSignal({
      blocks,
      maxInputTokens: DEFAULT_TOKEN_LIMITS.interactionMaxInputTokens,
      maxOutputTokens: DEFAULT_TOKEN_LIMITS.interactionMaxOutputTokens,
    });

    const assembledPrompt = formatPrompt(blocks);

    const llmResult = await invokeLLM({
      registry,
      taskType: "generic",
      routeOverride: invocationConfig.route,
      modelInput: {
        prompt: assembledPrompt,
        maxOutputTokens: Math.min(
          model.maxOutputTokens ?? DEFAULT_TOKEN_LIMITS.interactionMaxOutputTokens,
          DEFAULT_TOKEN_LIMITS.interactionMaxOutputTokens,
        ),
        temperature: 0.3,
      },
      entityId: `interaction-preview:${model.id}`,
      timeoutMs: invocationConfig.timeoutMs,
      retries: invocationConfig.retries,
      onProviderError: async (event) => {
        await this.recordLlmInvocationError({
          providerKey: event.providerId,
          modelKey: event.modelId,
          error: event.error,
          errorDetails: event.errorDetails,
        });
      },
    });

    if (!llmResult.text.trim()) {
      throw new Error(
        llmResult.error ??
          `interaction preview returned empty output (finishReason=${String(llmResult.finishReason ?? "unknown")})`,
      );
    }

    const normalizedOutput = llmResult.text.trim();
    let markdown = "";
    let contractError: string | null = null;

    if (input.taskType === "post") {
      const parsed = parsePostActionOutput(normalizedOutput);
      contractError = parsed.error;
      markdown = [parsed.title ? `# ${parsed.title}` : null, parsed.body.trim()]
        .filter((part): part is string => Boolean(part))
        .join("\n\n")
        .trim();
    } else if (input.taskType === "comment") {
      const parsed = parseMarkdownActionOutput(normalizedOutput);
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
        renderOk: contractError === null,
        renderError: contractError,
        tokenBudget,
      };
    } catch (error) {
      return {
        assembledPrompt,
        markdown,
        rawResponse: normalizedOutput,
        renderOk: false,
        renderError:
          contractError ?? (error instanceof Error ? error.message : "render validation failed"),
        tokenBudget,
      };
    }
  }

  private async loadActiveForMutation(): Promise<{
    active: PolicyReleaseRow | null;
    basePolicy: Record<string, unknown>;
    document: AiControlPlaneDocument;
    providers: AiProviderConfig[];
    models: AiModelConfig[];
  }> {
    const active = await this.fetchActiveRelease();
    const basePolicy = asRecord(active?.policy) ?? {};
    const document = readGlobalPolicyDocument(basePolicy);
    const [providers, models] = await Promise.all([
      this.listProvidersFromDb(),
      this.listModelsFromDb(),
    ]);
    await this.applyProviderSecretStatuses(providers);
    return {
      active,
      basePolicy,
      document,
      providers,
      models,
    };
  }

  private async applyProviderSecretStatuses(providers: AiProviderConfig[]): Promise<void> {
    const keys = providers.map((item) => item.providerKey.trim()).filter((item) => item.length > 0);
    if (keys.length === 0) {
      return;
    }

    const statusMap = await listProviderSecretStatuses(keys);
    for (const provider of providers) {
      const status = statusMap.get(provider.providerKey);
      if (!status) {
        provider.hasKey = false;
        provider.keyLast4 = null;
        if (provider.status !== "disabled") {
          provider.testStatus = "key_missing";
        }
        continue;
      }
      provider.hasKey = status.hasKey;
      provider.keyLast4 = status.keyLast4;
      if (provider.status !== "disabled" && provider.testStatus === "key_missing") {
        provider.testStatus = "untested";
      }
    }
  }

  private async fetchActiveRelease(): Promise<PolicyReleaseRow | null> {
    const { data, error } = await this.supabase
      .from("ai_policy_releases")
      .select("version, policy, is_active, created_by, change_note, created_at")
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle<PolicyReleaseRow>();

    if (error) {
      throw new Error(`load active policy release failed: ${error.message}`);
    }

    return data ?? null;
  }

  private async fetchReleaseByVersion(version: number): Promise<PolicyReleaseRow | null> {
    const { data, error } = await this.supabase
      .from("ai_policy_releases")
      .select("version, policy, is_active, created_by, change_note, created_at")
      .eq("version", version)
      .maybeSingle<PolicyReleaseRow>();

    if (error) {
      throw new Error(`load policy release failed: ${error.message}`);
    }

    return data ?? null;
  }

  private async insertActiveRelease(
    policy: Record<string, unknown>,
    actorId: string,
    note: string,
  ): Promise<PolicyReleaseRow> {
    const { error: deactivateError } = await this.supabase
      .from("ai_policy_releases")
      .update({ is_active: false })
      .eq("is_active", true);
    if (deactivateError) {
      throw new Error(`deactivate active release failed: ${deactivateError.message}`);
    }

    const { data, error } = await this.supabase
      .from("ai_policy_releases")
      .insert({
        policy,
        is_active: true,
        created_by: actorId,
        change_note: note,
      })
      .select("version, policy, is_active, created_by, change_note, created_at")
      .single<PolicyReleaseRow>();

    if (error || !data) {
      throw new Error(`insert active release failed: ${error?.message ?? "unknown"}`);
    }

    return data;
  }
}

function resolvePersonaTextModel(input: {
  modelId: string;
  models: AiModelConfig[];
  providers: AiProviderConfig[];
  featureLabel: string;
}): { model: AiModelConfig; provider: AiProviderConfig } {
  const model = input.models.find((item) => item.id === input.modelId);
  if (!model) {
    throw new Error("model not found");
  }
  if (
    model.capability !== "text_generation" ||
    model.status !== "active" ||
    model.lifecycleStatus === "retired" ||
    model.testStatus !== "success"
  ) {
    throw new Error(`model is not eligible for ${input.featureLabel}`);
  }
  const provider = input.providers.find((item) => item.id === model.providerId);
  if (!provider) {
    throw new Error("provider not found for model");
  }
  if (!provider.hasKey) {
    throw new Error("provider for this model is missing API key");
  }
  return { model, provider };
}
