import { createAdminClient } from "@/lib/supabase/admin";
import { markdownToEditorHtml } from "@/lib/tiptap-markdown";
import { invokeLLM } from "@/lib/ai/llm/invoke-llm";
import { createDefaultLlmProviderRegistry } from "@/lib/ai/llm/default-registry";

export type ProviderTestStatus = "untested" | "success" | "failed" | "disabled" | "key_missing";
export type ProviderStatus = "active" | "disabled";
export type ModelCapability = "text_generation" | "image_generation";
export type ModelStatus = "active" | "disabled";
export type ModelRouteScope =
  | "global_default"
  | "post"
  | "comment"
  | "image"
  | "persona_generation";

export type AiProviderConfig = {
  id: string;
  providerKey: string;
  displayName: string;
  sdkPackage: string;
  status: ProviderStatus;
  testStatus: ProviderTestStatus;
  keyLast4: string | null;
  hasKey: boolean;
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
  supportsInput: boolean;
  supportsOutput: boolean;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  metadata: Record<string, unknown>;
  updatedAt: string;
};

export type AiModelRoute = {
  scope: ModelRouteScope;
  primaryModelId: string | null;
  fallbackModelId: string | null;
  updatedAt: string;
};

export type GlobalPolicyStudioDraft = {
  coreGoal: string;
  globalPolicy: string;
  styleGuide: string;
  forbiddenRules: string;
  updatedAt: string;
};

export type AiControlPlaneDocument = {
  providers: AiProviderConfig[];
  models: AiModelConfig[];
  routes: AiModelRoute[];
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

const ROUTE_SCOPES: ModelRouteScope[] = [
  "global_default",
  "post",
  "comment",
  "image",
  "persona_generation",
];

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

function asControlPlaneDocument(policy: unknown): AiControlPlaneDocument {
  const root = asRecord(policy) ?? {};
  const controlPlane = asRecord(root.controlPlane) ?? {};

  const providers = Array.isArray(controlPlane.providers)
    ? controlPlane.providers
        .map((item): AiProviderConfig | null => {
          const row = asRecord(item);
          if (!row) {
            return null;
          }
          const id = readString(row.id).trim() || crypto.randomUUID();
          const status = readString(row.status) === "disabled" ? "disabled" : "active";
          const testStatusRaw = readString(row.testStatus);
          const testStatus: ProviderTestStatus =
            testStatusRaw === "success" ||
            testStatusRaw === "failed" ||
            testStatusRaw === "disabled" ||
            testStatusRaw === "key_missing"
              ? testStatusRaw
              : "untested";
          return {
            id,
            providerKey: readString(row.providerKey),
            displayName: readString(row.displayName),
            sdkPackage: readString(row.sdkPackage),
            status,
            testStatus,
            keyLast4: readNullableString(row.keyLast4),
            hasKey: readBoolean(row.hasKey),
            createdAt: readString(row.createdAt, nowIso()),
            updatedAt: readString(row.updatedAt, nowIso()),
          };
        })
        .filter((item): item is AiProviderConfig => item !== null)
    : [];

  const models = Array.isArray(controlPlane.models)
    ? controlPlane.models
        .map((item): AiModelConfig | null => {
          const row = asRecord(item);
          if (!row) {
            return null;
          }
          const capability =
            readString(row.capability) === "image_generation"
              ? "image_generation"
              : "text_generation";
          const status = readString(row.status) === "disabled" ? "disabled" : "active";
          return {
            id: readString(row.id).trim() || crypto.randomUUID(),
            providerId: readString(row.providerId),
            modelKey: readString(row.modelKey),
            displayName: readString(row.displayName),
            capability,
            status,
            supportsInput: readBoolean(row.supportsInput, true),
            supportsOutput: readBoolean(row.supportsOutput, true),
            contextWindow: readNumberOrNull(row.contextWindow),
            maxOutputTokens: readNumberOrNull(row.maxOutputTokens),
            metadata: asRecord(row.metadata) ?? {},
            updatedAt: readString(row.updatedAt, nowIso()),
          };
        })
        .filter((item): item is AiModelConfig => item !== null)
    : [];

  const routesRecord = asRecord(controlPlane.routes) ?? {};
  const routes: AiModelRoute[] = ROUTE_SCOPES.map((scope) => {
    const source = asRecord(routesRecord[scope]) ?? {};
    return {
      scope,
      primaryModelId: readNullableString(source.primaryModelId),
      fallbackModelId: readNullableString(source.fallbackModelId),
      updatedAt: readString(source.updatedAt, nowIso()),
    };
  });

  const draftRecord = asRecord(controlPlane.globalPolicyDraft) ?? {};
  const globalPolicyDraft: GlobalPolicyStudioDraft = {
    coreGoal: readString(draftRecord.coreGoal, DEFAULT_POLICY_DRAFT.coreGoal),
    globalPolicy: readString(draftRecord.globalPolicy, DEFAULT_POLICY_DRAFT.globalPolicy),
    styleGuide: readString(draftRecord.styleGuide, DEFAULT_POLICY_DRAFT.styleGuide),
    forbiddenRules: readString(draftRecord.forbiddenRules, DEFAULT_POLICY_DRAFT.forbiddenRules),
    updatedAt: readString(draftRecord.updatedAt, nowIso()),
  };

  return {
    providers,
    models,
    routes,
    globalPolicyDraft,
  };
}

function applyControlPlaneDocument(
  policy: unknown,
  controlPlaneDoc: AiControlPlaneDocument,
): Record<string, unknown> {
  const root = asRecord(policy) ?? {};
  return {
    ...root,
    controlPlane: {
      providers: controlPlaneDoc.providers,
      models: controlPlaneDoc.models,
      routes: controlPlaneDoc.routes.reduce<Record<string, unknown>>((acc, route) => {
        acc[route.scope] = {
          primaryModelId: route.primaryModelId,
          fallbackModelId: route.fallbackModelId,
          updatedAt: route.updatedAt,
        };
        return acc;
      }, {}),
      globalPolicyDraft: controlPlaneDoc.globalPolicyDraft,
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
  legacy: {
    info: string;
    soul: Record<string, unknown>;
    longMemory: string;
  };
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
    legacy: {
      info: bio,
      soul: soulProfile,
      longMemory:
        personaLongMemories
          .map((item) => asRecord(item))
          .find((item) => !!item && readString(item.content).trim().length > 0)
          ?.content?.toString() ?? "",
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
      ? "Token budget exceeded after persona memory + long memory compression signal. Please simplify global rules in Global Policy Studio."
      : null,
  };
}

export class AdminAiControlPlaneStore {
  private readonly supabase = createAdminClient();

  public async getActiveControlPlane(): Promise<{
    release: PolicyReleaseListItem | null;
    document: AiControlPlaneDocument;
  }> {
    const active = await this.fetchActiveRelease();
    if (!active) {
      return {
        release: null,
        document: asControlPlaneDocument({}),
      };
    }

    const document = asControlPlaneDocument(active.policy);
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
      const doc = asControlPlaneDocument(row.policy);
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

  public async upsertProvider(
    input: Partial<AiProviderConfig> & {
      providerKey: string;
      displayName: string;
      sdkPackage: string;
      apiKey?: string | null;
    },
    actorId: string,
  ): Promise<AiProviderConfig> {
    const { document, basePolicy } = await this.loadActiveForMutation();
    const now = nowIso();
    const apiKey = input.apiKey?.trim() ?? "";
    const keyLast4 = apiKey ? apiKey.slice(-4) : null;

    const nextProvider: AiProviderConfig = {
      id: input.id ?? crypto.randomUUID(),
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
              : (input.testStatus ?? "untested"),
      keyLast4: keyLast4 ?? input.keyLast4 ?? null,
      hasKey: apiKey.length > 0 || input.hasKey === true,
      createdAt: input.createdAt ?? now,
      updatedAt: now,
    };

    const index = document.providers.findIndex((item) => item.id === nextProvider.id);
    if (index >= 0) {
      document.providers[index] = {
        ...document.providers[index],
        ...nextProvider,
        createdAt: document.providers[index].createdAt,
      };
    } else {
      document.providers.push(nextProvider);
    }

    await this.insertActiveRelease(
      applyControlPlaneDocument(basePolicy, document),
      actorId,
      `control-plane: upsert provider ${nextProvider.providerKey}`,
    );

    return nextProvider;
  }

  public async deleteProvider(providerId: string, actorId: string): Promise<void> {
    const { document, basePolicy } = await this.loadActiveForMutation();
    document.providers = document.providers.filter((item) => item.id !== providerId);
    document.models = document.models.filter((item) => item.providerId !== providerId);
    document.routes = document.routes.map((route) => ({
      ...route,
      primaryModelId:
        route.primaryModelId && document.models.some((model) => model.id === route.primaryModelId)
          ? route.primaryModelId
          : null,
      fallbackModelId:
        route.fallbackModelId && document.models.some((model) => model.id === route.fallbackModelId)
          ? route.fallbackModelId
          : null,
      updatedAt: nowIso(),
    }));

    await this.insertActiveRelease(
      applyControlPlaneDocument(basePolicy, document),
      actorId,
      `control-plane: delete provider ${providerId}`,
    );
  }

  public async setProviderTestStatus(
    providerId: string,
    actorId: string,
    requestedStatus?: ProviderTestStatus,
  ): Promise<AiProviderConfig> {
    const { document, basePolicy } = await this.loadActiveForMutation();
    const provider = document.providers.find((item) => item.id === providerId);
    if (!provider) {
      throw new Error("provider not found");
    }

    const nextStatus: ProviderTestStatus =
      requestedStatus ??
      (provider.status === "disabled" ? "disabled" : provider.hasKey ? "success" : "key_missing");

    provider.testStatus = nextStatus;
    provider.updatedAt = nowIso();

    await this.insertActiveRelease(
      applyControlPlaneDocument(basePolicy, document),
      actorId,
      `control-plane: provider test ${provider.providerKey}`,
    );

    return provider;
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
    const { document, basePolicy } = await this.loadActiveForMutation();
    const providerExists = document.providers.some((item) => item.id === input.providerId);
    if (!providerExists) {
      throw new Error("provider not found");
    }

    const nextModel: AiModelConfig = {
      id: input.id ?? crypto.randomUUID(),
      providerId: input.providerId,
      modelKey: input.modelKey,
      displayName: input.displayName,
      capability: input.capability,
      status: input.status === "disabled" ? "disabled" : "active",
      supportsInput: input.supportsInput ?? true,
      supportsOutput: input.supportsOutput ?? true,
      contextWindow: input.contextWindow ?? null,
      maxOutputTokens: input.maxOutputTokens ?? null,
      metadata: input.metadata ?? {},
      updatedAt: nowIso(),
    };

    const index = document.models.findIndex((item) => item.id === nextModel.id);
    if (index >= 0) {
      document.models[index] = {
        ...document.models[index],
        ...nextModel,
      };
    } else {
      document.models.push(nextModel);
    }

    await this.insertActiveRelease(
      applyControlPlaneDocument(basePolicy, document),
      actorId,
      `control-plane: upsert model ${nextModel.modelKey}`,
    );

    return nextModel;
  }

  public async deleteModel(modelId: string, actorId: string): Promise<void> {
    const { document, basePolicy } = await this.loadActiveForMutation();
    document.models = document.models.filter((item) => item.id !== modelId);
    document.routes = document.routes.map((route) => ({
      ...route,
      primaryModelId: route.primaryModelId === modelId ? null : route.primaryModelId,
      fallbackModelId: route.fallbackModelId === modelId ? null : route.fallbackModelId,
      updatedAt: nowIso(),
    }));

    await this.insertActiveRelease(
      applyControlPlaneDocument(basePolicy, document),
      actorId,
      `control-plane: delete model ${modelId}`,
    );
  }

  public async updateRoutes(
    routes: Array<Pick<AiModelRoute, "scope" | "primaryModelId" | "fallbackModelId">>,
    actorId: string,
  ): Promise<AiModelRoute[]> {
    const { document, basePolicy } = await this.loadActiveForMutation();
    const modelIds = new Set(document.models.map((item) => item.id));
    for (const route of routes) {
      if (route.primaryModelId && !modelIds.has(route.primaryModelId)) {
        throw new Error(`primary model not found for route ${route.scope}`);
      }
      if (route.fallbackModelId && !modelIds.has(route.fallbackModelId)) {
        throw new Error(`fallback model not found for route ${route.scope}`);
      }
    }

    const routeMap = new Map(document.routes.map((route) => [route.scope, route]));
    for (const patch of routes) {
      routeMap.set(patch.scope, {
        scope: patch.scope,
        primaryModelId: patch.primaryModelId ?? null,
        fallbackModelId: patch.fallbackModelId ?? null,
        updatedAt: nowIso(),
      });
    }
    document.routes = ROUTE_SCOPES.map(
      (scope) =>
        routeMap.get(scope) ?? {
          scope,
          primaryModelId: null,
          fallbackModelId: null,
          updatedAt: nowIso(),
        },
    );

    await this.insertActiveRelease(
      applyControlPlaneDocument(basePolicy, document),
      actorId,
      "control-plane: update model routes",
    );

    return document.routes;
  }

  public async createPolicyDraft(
    draft: Pick<
      GlobalPolicyStudioDraft,
      "coreGoal" | "globalPolicy" | "styleGuide" | "forbiddenRules"
    >,
    actorId: string,
    note?: string,
  ): Promise<PolicyReleaseListItem> {
    const active = await this.fetchActiveRelease();
    const basePolicy = asRecord(active?.policy) ?? {};
    const document = asControlPlaneDocument(basePolicy);
    document.globalPolicyDraft = {
      ...draft,
      updatedAt: nowIso(),
    };

    const { data, error } = await this.supabase
      .from("ai_policy_releases")
      .insert({
        policy: applyControlPlaneDocument(basePolicy, document),
        is_active: false,
        created_by: actorId,
        change_note: note ?? "control-plane: create global policy draft",
      })
      .select("version, policy, is_active, created_by, change_note, created_at")
      .single();

    if (error || !data) {
      throw new Error(`create policy draft failed: ${error?.message ?? "unknown"}`);
    }

    const row = data as PolicyReleaseRow;
    return {
      version: row.version,
      isActive: row.is_active,
      createdBy: row.created_by,
      changeNote: row.change_note,
      createdAt: row.created_at,
      globalPolicyDraft: asControlPlaneDocument(row.policy).globalPolicyDraft,
    };
  }

  public async publishPolicyRelease(
    version: number,
    actorId: string,
    note?: string,
  ): Promise<void> {
    const row = await this.fetchReleaseByVersion(version);
    if (!row) {
      throw new Error("policy release not found");
    }
    await this.supabase
      .from("ai_policy_releases")
      .update({ is_active: false })
      .eq("is_active", true);
    const { error } = await this.supabase
      .from("ai_policy_releases")
      .update({
        is_active: true,
        created_by: actorId,
        change_note: note ?? row.change_note ?? "control-plane: publish draft",
      })
      .eq("version", version);

    if (error) {
      throw new Error(`publish release failed: ${error.message}`);
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

    const doc = asControlPlaneDocument(inserted.policy);
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

    const document = asControlPlaneDocument(row.policy);
    const model = document.models.find((item) => item.id === modelId);
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
    const { document } = await this.getActiveControlPlane();
    const model = document.models.find((item) => item.id === input.modelId);
    if (!model) {
      throw new Error("model not found");
    }
    if (model.capability !== "text_generation" || model.status !== "active") {
      throw new Error("model is not eligible for persona generation");
    }
    const provider = document.providers.find((item) => item.id === model.providerId);
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
    const llmResult = await invokeLLM({
      registry: createDefaultLlmProviderRegistry({ includeMock: true, includeXai: true }),
      taskType: "generic",
      routeOverride: {
        taskType: "generic",
        primary: {
          providerId: provider.providerKey,
          modelId: model.modelKey,
        },
      },
      modelInput: {
        prompt: assembledPrompt,
        maxOutputTokens:
          model.maxOutputTokens ?? DEFAULT_TOKEN_LIMITS.personaGenerationMaxOutputTokens,
        temperature: 0.4,
      },
      entityId: `persona-generation-preview:${model.id}`,
    });

    if (!llmResult.text.trim()) {
      throw new Error(llmResult.error ?? "persona generation model returned empty output");
    }

    const parsed = parsePersonaGenerationOutput(llmResult.text);
    const structured = parsed.structured;

    const markdown = [
      `## Persona Generation Preview (${model.displayName})`,
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
    const { document } = await this.getActiveControlPlane();
    const model = document.models.find((item) => item.id === input.modelId);
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
      `## Persona Interaction Preview (${model.displayName})`,
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
  }> {
    const active = await this.fetchActiveRelease();
    const basePolicy = asRecord(active?.policy) ?? {};
    return {
      active,
      basePolicy,
      document: asControlPlaneDocument(basePolicy),
    };
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
