import { generateImage } from "ai";
import { createXai } from "@ai-sdk/xai";
import { createAdminClient } from "@/lib/supabase/admin";
import { markdownToEditorHtml } from "@/lib/tiptap-markdown";
import { invokeLLM } from "@/lib/ai/llm/invoke-llm";
import { createDbBackedLlmProviderRegistry } from "@/lib/ai/llm/default-registry";
import {
  listProviderSecretStatuses,
  loadDecryptedProviderSecrets,
  upsertProviderSecret,
} from "@/lib/ai/llm/provider-secrets";

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
  coreGoal: string;
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
  compressedStages: Array<"persona_memory" | "persona_long_memory">;
  exceeded: boolean;
  message: string | null;
};

export type PreviewResult = {
  assembledPrompt: string;
  markdown: string;
  renderOk: boolean;
  renderError: string | null;
  tokenBudget: PreviewTokenBudget;
};

export type PersonaGenerationStructured = {
  personas: {
    display_name: string;
    bio: string;
    status: "active" | "inactive";
  };
  persona_souls: {
    soul_profile: Record<string, unknown>;
  };
  persona_memory: Array<{
    key: string;
    value: string;
    context_data: Record<string, unknown>;
    expires_in_hours: number | null;
  }>;
  persona_long_memories: Array<{
    content: string;
    importance: number;
    memory_category: "interaction" | "knowledge" | "opinion" | "relationship";
    is_canonical: boolean;
    related_board_slug: string | null;
  }>;
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

type PersonaSoulRow = {
  soul_profile: unknown;
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

const DEFAULT_POLICY_DRAFT = {
  coreGoal: "",
  globalPolicy: "",
  styleGuide: "",
  forbiddenRules: "",
};

const DEFAULT_TOKEN_LIMITS = {
  interactionMaxInputTokens: 3200,
  interactionMaxOutputTokens: 900,
  personaGenerationMaxInputTokens: 2800,
  personaGenerationMaxOutputTokens: 1200,
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
    modelKey: "MiniMax-M2.1",
    displayName: "MiniMax M2.1",
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
    coreGoal: readString(global.coreGoal, DEFAULT_POLICY_DRAFT.coreGoal),
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
      coreGoal: globalPolicyDoc.globalPolicyDraft.coreGoal,
      globalPolicy: globalPolicyDoc.globalPolicyDraft.globalPolicy,
      styleGuide: globalPolicyDoc.globalPolicyDraft.styleGuide,
      forbiddenRules: globalPolicyDoc.globalPolicyDraft.forbiddenRules,
    },
  };
}

function buildPromptBlocks(input: {
  globalDraft: GlobalPolicyStudioDraft;
  personaSoul: string;
  personaMemory: string;
  personaLongMemory: string;
  taskContext: string;
}): Array<{ name: string; content: string }> {
  const outputConstraints =
    "Output must be plain markdown compatible with TipTap. No JSON, no XML, no extra labels.";

  return [
    { name: "system_baseline", content: "You are an AI assistant for forum content generation." },
    {
      name: "global_policy",
      content: [
        `Core goal: ${input.globalDraft.coreGoal}`,
        `Policy: ${input.globalDraft.globalPolicy}`,
        `Style: ${input.globalDraft.styleGuide}`,
        `Forbidden: ${input.globalDraft.forbiddenRules}`,
      ].join("\n"),
    },
    { name: "persona_soul", content: input.personaSoul },
    { name: "persona_memory", content: input.personaMemory },
    { name: "persona_long_memory", content: input.personaLongMemory },
    { name: "task_context", content: input.taskContext },
    { name: "output_constraints", content: outputConstraints },
  ];
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

function parsePersonaGenerationOutput(rawText: string): {
  structured: PersonaGenerationStructured;
} {
  const jsonText = extractJsonFromText(rawText);
  if (!jsonText) {
    throw new Error("persona generation output is empty");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("persona generation output must be valid JSON");
  }

  const record = asRecord(parsed);
  if (!record) {
    throw new Error("persona generation output must be a JSON object");
  }

  const personas = asRecord(record.personas);
  const personaSouls = asRecord(record.persona_souls);
  const personaMemory = Array.isArray(record.persona_memory) ? record.persona_memory : [];
  const personaLongMemories = Array.isArray(record.persona_long_memories)
    ? record.persona_long_memories
    : [];

  if (!personas) {
    throw new Error("persona generation output missing personas object");
  }
  if (!personaSouls) {
    throw new Error("persona generation output missing persona_souls object");
  }
  const displayName = readString(personas.display_name).trim();
  const bio = readString(personas.bio).trim();
  const status = readString(personas.status) === "inactive" ? "inactive" : "active";
  const soulProfile = asRecord(personaSouls.soul_profile);
  if (!displayName) {
    throw new Error("persona generation output missing personas.display_name");
  }
  if (!bio) {
    throw new Error("persona generation output missing personas.bio");
  }
  if (!soulProfile) {
    throw new Error("persona generation output missing persona_souls.soul_profile");
  }

  return {
    structured: {
      personas: {
        display_name: displayName,
        bio,
        status,
      },
      persona_souls: {
        soul_profile: soulProfile,
      },
      persona_memory: personaMemory
        .map((item) => {
          const row = asRecord(item);
          if (!row) {
            return null;
          }
          const key = readString(row.key).trim();
          if (!key) {
            return null;
          }
          return {
            key,
            value: readString(row.value).trim(),
            context_data: asRecord(row.context_data) ?? {},
            expires_in_hours: readNumberOrNull(row.expires_in_hours),
          };
        })
        .filter(
          (
            item,
          ): item is {
            key: string;
            value: string;
            context_data: Record<string, unknown>;
            expires_in_hours: number | null;
          } => item !== null,
        ),
      persona_long_memories: personaLongMemories
        .map((item) => {
          const row = asRecord(item);
          if (!row) {
            return null;
          }
          const content = readString(row.content).trim();
          if (!content) {
            return null;
          }
          const categoryRaw = readString(row.memory_category).trim();
          const memory_category: "interaction" | "knowledge" | "opinion" | "relationship" =
            categoryRaw === "interaction" ||
            categoryRaw === "opinion" ||
            categoryRaw === "relationship"
              ? categoryRaw
              : "knowledge";
          return {
            content,
            importance: readNumberOrNull(row.importance) ?? 0.7,
            memory_category,
            is_canonical: readBoolean(row.is_canonical, false),
            related_board_slug: readNullableString(row.related_board_slug),
          };
        })
        .filter(
          (
            item,
          ): item is {
            content: string;
            importance: number;
            memory_category: "interaction" | "knowledge" | "opinion" | "relationship";
            is_canonical: boolean;
            related_board_slug: string | null;
          } => item !== null,
        ),
    },
  };
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

  const mutableOrder = ["persona_memory", "persona_long_memory"] as const;
  const mutableTokensByName = new Map(
    blockStats
      .filter((item) => mutableOrder.includes(item.name as (typeof mutableOrder)[number]))
      .map((item) => [item.name, item.tokens]),
  );
  const compressedStages: Array<"persona_memory" | "persona_long_memory"> = [];

  let total = blockStats.reduce((sum, item) => sum + item.tokens, 0);
  for (const stage of mutableOrder) {
    if (total <= input.maxInputTokens) {
      break;
    }
    const current = mutableTokensByName.get(stage) ?? 0;
    if (current <= 0) {
      continue;
    }
    // Admin preview only exposes the signal. Runtime compression is delegated to AI agents plan.
    const reduced = Math.ceil(current * 0.5);
    mutableTokensByName.set(stage, reduced);
    compressedStages.push(stage);
    total = total - current + reduced;
    const target = blockStats.find((item) => item.name === stage);
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
      ? "Token budget exceeded after persona memory + long memory compression signal. Please simplify global rules in Policy."
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
      const testTimeoutMs = provider.providerKey === "minimax" ? 20_000 : 8_000;
      const testPrompt =
        provider.providerKey === "minimax" ? "Reply with exactly one word: pong" : "ping";
      const testMaxOutputTokens = provider.providerKey === "minimax" ? 128 : 1;
      try {
        const registry = await createDbBackedLlmProviderRegistry({
          includeMock: false,
          includeXai: true,
          includeMinimax: true,
        });
        const llmResult = await invokeLLM({
          registry,
          taskType: "generic",
          routeOverride: {
            targets: [
              {
                providerId: provider.providerKey,
                modelId: model.modelKey,
              },
            ],
          },
          modelInput: {
            prompt: testPrompt,
            maxOutputTokens: testMaxOutputTokens,
            temperature: 0,
          },
          entityId: `model-test:${model.id}`,
          timeoutMs: testTimeoutMs,
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
            ? `Model test timeout (${provider.providerKey}, ${String(testTimeoutMs)}ms)`
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
    const isProviderApiError =
      !isModelRetired &&
      ((typeof input.errorDetails?.statusCode === "number" &&
        (input.errorDetails.statusCode >= 500 ||
          input.errorDetails.statusCode === 401 ||
          input.errorDetails.statusCode === 403 ||
          input.errorDetails.statusCode === 429)) ||
        /(api key|unauthorized|forbidden|quota|rate limit|timeout|network|service unavailable)/.test(
          errorText,
        ));

    const now = nowIso();
    model.lastErrorKind = isModelRetired
      ? "model_retired"
      : isProviderApiError
        ? "provider_api"
        : "other";
    model.lastErrorCode = input.errorDetails?.code ?? null;
    model.lastErrorMessage = input.error.slice(0, 500);
    model.lastErrorAt = now;
    model.testStatus = "failed";

    if (isModelRetired) {
      model.lifecycleStatus = "retired";
      model.status = "disabled";
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
      "coreGoal" | "globalPolicy" | "styleGuide" | "forbiddenRules"
    > & { targetVersion?: number },
    actorId: string,
    note?: string,
  ): Promise<PolicyReleaseListItem> {
    const { active, basePolicy, document } = await this.loadActiveForMutation();
    const currentPolicyVersion = readPositiveInt(active?.version ?? 1, 1);
    const requestedPolicyVersion = readPositiveInt(draft.targetVersion, currentPolicyVersion);
    if (
      requestedPolicyVersion < currentPolicyVersion ||
      requestedPolicyVersion > currentPolicyVersion + 1
    ) {
      throw new Error("Only current or next policy version can be updated");
    }

    document.globalPolicyDraft = {
      coreGoal: draft.coreGoal,
      globalPolicy: draft.globalPolicy,
      styleGuide: draft.styleGuide,
      forbiddenRules: draft.forbiddenRules,
    };
    const policy = writeGlobalPolicyDocument(basePolicy, document);
    const isNextVersionPublish = requestedPolicyVersion === currentPolicyVersion + 1;
    const changeNote =
      note ??
      (isNextVersionPublish
        ? `control-plane: publish policy v${requestedPolicyVersion}`
        : "control-plane: update active policy");

    let row: PolicyReleaseRow;
    if (isNextVersionPublish || !active) {
      row = await this.insertActiveRelease(policy, actorId, changeNote);
    } else {
      const { data, error } = await this.supabase
        .from("ai_policy_releases")
        .update({
          policy,
          created_by: actorId,
          change_note: changeNote,
        })
        .eq("version", active.version)
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
    modelId: string,
    taskContext: string,
  ): Promise<PreviewResult> {
    const row = await this.fetchReleaseByVersion(version);
    if (!row) {
      throw new Error("policy release not found");
    }

    const document = readGlobalPolicyDocument(row.policy);
    const [providers, models] = await Promise.all([
      this.listProvidersFromDb(),
      this.listModelsFromDb(),
    ]);
    await this.applyProviderSecretStatuses(providers);
    const model = models.find((item) => item.id === modelId);
    if (!model) {
      throw new Error("model not found");
    }

    const blocks = buildPromptBlocks({
      globalDraft: document.globalPolicyDraft,
      personaSoul: "(global preview mode)",
      personaMemory: "",
      personaLongMemory: "",
      taskContext,
    });

    const tokenBudget = buildTokenBudgetSignal({
      blocks,
      maxInputTokens: DEFAULT_TOKEN_LIMITS.interactionMaxInputTokens,
      maxOutputTokens: DEFAULT_TOKEN_LIMITS.interactionMaxOutputTokens,
    });

    const markdown = [
      `## Global Policy Preview (${model.displayName})`,
      "",
      `Task Context: ${taskContext || "(empty)"}`,
      "",
      "This is a manual single-model preview response.",
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
    displayName: string;
    bio: string;
    soulProfile: Record<string, unknown>;
    memories?: Array<{
      key: string;
      value: string;
      contextData?: Record<string, unknown>;
      expiresAt?: string | null;
    }>;
    longMemories?: Array<{
      content: string;
      importance?: number;
      memoryCategory?: "interaction" | "knowledge" | "opinion" | "relationship";
      isCanonical?: boolean;
      relatedBoardSlug?: string | null;
    }>;
  }): Promise<{ personaId: string }> {
    const username = toPersonaUsername(input.username?.trim() || input.displayName);

    const { data: persona, error: personaError } = await this.supabase
      .from("personas")
      .insert({
        username,
        display_name: input.displayName,
        bio: input.bio,
        status: "active",
      })
      .select("id")
      .single<{ id: string }>();

    if (personaError || !persona) {
      throw new Error(`create persona failed: ${personaError?.message ?? "unknown"}`);
    }

    const personaId = persona.id;

    const { error: soulError } = await this.supabase.from("persona_souls").upsert({
      persona_id: personaId,
      soul_profile: input.soulProfile,
      version: 1,
      updated_at: nowIso(),
    });
    if (soulError) {
      throw new Error(`save persona soul failed: ${soulError.message}`);
    }

    if (input.memories && input.memories.length > 0) {
      const memoryRows = input.memories
        .map((item) => ({
          persona_id: personaId,
          key: item.key.trim(),
          value: item.value.trim(),
          context_data: item.contextData ?? {},
          expires_at: item.expiresAt ?? null,
        }))
        .filter((item) => item.key.length > 0);
      if (memoryRows.length > 0) {
        const { error: memoryError } = await this.supabase
          .from("persona_memory")
          .upsert(memoryRows, {
            onConflict: "persona_id,key",
          });
        if (memoryError) {
          throw new Error(`save persona memory failed: ${memoryError.message}`);
        }
      }
    }

    if (input.longMemories && input.longMemories.length > 0) {
      const longMemoryRows = input.longMemories
        .map((item) => ({
          persona_id: personaId,
          content: item.content.trim(),
          importance: item.importance ?? 0.7,
          memory_category: item.memoryCategory ?? "knowledge",
          is_canonical: item.isCanonical ?? false,
          related_board_slug: item.relatedBoardSlug ?? null,
        }))
        .filter((item) => item.content.length > 0);

      if (longMemoryRows.length > 0) {
        const { error: longMemoryError } = await this.supabase
          .from("persona_long_memories")
          .insert(longMemoryRows);
        if (longMemoryError) {
          throw new Error(`save persona long memory failed: ${longMemoryError.message}`);
        }
      }
    }

    return { personaId };
  }

  public async getPersonaProfile(personaId: string): Promise<{
    persona: PersonaSummary;
    soulProfile: Record<string, unknown>;
    memories: PersonaMemoryRow[];
    longMemories: PersonaLongMemoryRow[];
  }> {
    const { data: persona, error: personaError } = await this.supabase
      .from("personas")
      .select("id, username, display_name, bio, status")
      .eq("id", personaId)
      .single<PersonaSummary>();

    if (personaError || !persona) {
      throw new Error("persona not found");
    }

    const [soulRes, memoryRes, longMemoryRes] = await Promise.all([
      this.supabase
        .from("persona_souls")
        .select("soul_profile")
        .eq("persona_id", personaId)
        .maybeSingle<PersonaSoulRow>(),
      this.supabase
        .from("persona_memory")
        .select("id, key, value, context_data, expires_at, created_at")
        .eq("persona_id", personaId)
        .order("created_at", { ascending: false })
        .limit(80),
      this.supabase
        .from("persona_long_memories")
        .select("id, content, importance, memory_category, updated_at")
        .eq("persona_id", personaId)
        .order("importance", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(50),
    ]);

    if (soulRes.error) {
      throw new Error(`load persona soul failed: ${soulRes.error.message}`);
    }
    if (memoryRes.error) {
      throw new Error(`load persona memories failed: ${memoryRes.error.message}`);
    }
    if (longMemoryRes.error) {
      throw new Error(`load persona long memories failed: ${longMemoryRes.error.message}`);
    }

    return {
      persona,
      soulProfile: (asRecord(soulRes.data?.soul_profile) ?? {}) as Record<string, unknown>,
      memories: (memoryRes.data ?? []) as PersonaMemoryRow[],
      longMemories: (longMemoryRes.data ?? []) as PersonaLongMemoryRow[],
    };
  }

  public async patchPersonaProfile(input: {
    personaId: string;
    username?: string;
    bio?: string;
    soulProfile?: Record<string, unknown>;
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

    if (input.soulProfile) {
      const { error } = await this.supabase.from("persona_souls").upsert({
        persona_id: input.personaId,
        soul_profile: input.soulProfile,
        updated_at: nowIso(),
      });
      if (error) {
        throw new Error(`update soul profile failed: ${error.message}`);
      }
    }

    if (input.longMemory !== undefined) {
      const trimmed = input.longMemory.trim();
      if (trimmed.length > 0) {
        const { error } = await this.supabase.from("persona_long_memories").insert({
          persona_id: input.personaId,
          content: trimmed,
          importance: 0.9,
          memory_category: "knowledge",
          is_canonical: true,
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
    const model = models.find((item) => item.id === input.modelId);
    if (!model) {
      throw new Error("model not found");
    }
    if (
      model.capability !== "text_generation" ||
      model.status !== "active" ||
      model.lifecycleStatus === "retired" ||
      model.testStatus !== "success"
    ) {
      throw new Error("model is not eligible for persona generation");
    }
    const provider = providers.find((item) => item.id === model.providerId);
    if (!provider) {
      throw new Error("provider not found for model");
    }
    if (provider.status !== "active" || !provider.hasKey) {
      throw new Error("provider for this model is missing API key or disabled");
    }

    const blocks = [
      { name: "system_baseline", content: "Generate a coherent forum persona profile." },
      {
        name: "global_policy",
        content: `${document.globalPolicyDraft.coreGoal}\n${document.globalPolicyDraft.globalPolicy}`,
      },
      {
        name: "generator_instruction",
        content: [
          "Return one JSON object aligned to DB tables with keys:",
          "personas{display_name,bio,status},",
          "persona_souls{soul_profile},",
          "persona_memory[{key,value,context_data,expires_in_hours}],",
          "persona_long_memories[{content,importance,memory_category,is_canonical,related_board_slug}].",
          "Use snake_case keys exactly as provided.",
          "Do not include markdown, explanation, persona_id, id, timestamps, or extra keys.",
        ].join("\n"),
      },
      { name: "admin_extra_prompt", content: input.extraPrompt },
      {
        name: "output_constraints",
        content: "Output strictly valid JSON.",
      },
    ];

    const tokenBudget = buildTokenBudgetSignal({
      blocks,
      maxInputTokens: DEFAULT_TOKEN_LIMITS.personaGenerationMaxInputTokens,
      maxOutputTokens: DEFAULT_TOKEN_LIMITS.personaGenerationMaxOutputTokens,
    });

    const assembledPrompt = formatPrompt(blocks);
    const registry = await createDbBackedLlmProviderRegistry({
      includeMock: true,
      includeXai: true,
      includeMinimax: true,
    });
    const llmResult = await invokeLLM({
      registry,
      taskType: "generic",
      routeOverride: {
        targets: [
          {
            providerId: provider.providerKey,
            modelId: model.modelKey,
          },
        ],
      },
      modelInput: {
        prompt: assembledPrompt,
        maxOutputTokens:
          model.maxOutputTokens ?? DEFAULT_TOKEN_LIMITS.personaGenerationMaxOutputTokens,
        temperature: 0.4,
      },
      entityId: `persona-generation-preview:${model.id}`,
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
      throw new Error(llmResult.error ?? "persona generation model returned empty output");
    }

    const parsed = parsePersonaGenerationOutput(llmResult.text);
    const structured = parsed.structured;

    const markdown = [
      `## Persona Preview (${model.displayName})`,
      "",
      `### personas`,
      `- display_name: ${structured.personas.display_name}`,
      `- status: ${structured.personas.status}`,
      `- bio: ${structured.personas.bio}`,
      "",
      `### persona_souls`,
      "```json",
      JSON.stringify(structured.persona_souls, null, 2),
      "```",
      "",
      `### persona_memory (${structured.persona_memory.length})`,
      "```json",
      JSON.stringify(structured.persona_memory, null, 2),
      "```",
      "",
      `### persona_long_memories (${structured.persona_long_memories.length})`,
      "```json",
      JSON.stringify(structured.persona_long_memories, null, 2),
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

  public async previewPersonaInteraction(input: {
    personaId: string;
    modelId: string;
    taskType: "post" | "comment";
    taskContext: string;
    soulOverride?: Record<string, unknown>;
    longMemoryOverride?: string;
  }): Promise<PreviewResult> {
    const { document, models } = await this.getActiveControlPlane();
    const model = models.find((item) => item.id === input.modelId);
    if (!model) {
      throw new Error("model not found");
    }

    const profile = await this.getPersonaProfile(input.personaId);
    const personaMemory = profile.memories
      .map((item) => `${item.key}: ${item.value ?? ""}`)
      .join("\n");
    const longMemoryText =
      input.longMemoryOverride ?? profile.longMemories.map((item) => item.content).join("\n");
    const soulText = JSON.stringify(input.soulOverride ?? profile.soulProfile);

    const blocks = buildPromptBlocks({
      globalDraft: document.globalPolicyDraft,
      personaSoul: soulText,
      personaMemory,
      personaLongMemory: longMemoryText,
      taskContext: input.taskContext,
    });

    const tokenBudget = buildTokenBudgetSignal({
      blocks,
      maxInputTokens: DEFAULT_TOKEN_LIMITS.interactionMaxInputTokens,
      maxOutputTokens: DEFAULT_TOKEN_LIMITS.interactionMaxOutputTokens,
    });

    const markdown = [
      `## Preview (${model.displayName})`,
      "",
      `Persona: ${profile.persona.display_name} (${profile.persona.username})`,
      `Task: ${input.taskType}`,
      "",
      input.taskContext || "(empty task context)",
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
