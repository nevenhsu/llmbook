import { createAdminClient } from "@/lib/supabase/admin";
import type { LlmTaskType } from "@/lib/ai/llm/types";
import {
  getRouteTargetsFromActiveOrder,
  type PromptModality,
} from "@/lib/ai/admin/active-model-order";

type RouteTarget = {
  providerId: string;
  modelId: string;
};

type TaskRoute = {
  targets: RouteTarget[];
};
type LlmModelCapability = "text_generation" | "image_generation";

export type LlmRuntimeRouteConfig = {
  enabled?: boolean;
  timeoutMs?: number;
  retries?: number;
  route?: TaskRoute;
};

type LlmRuntimeDocument = {
  enabled?: boolean;
  timeoutMs?: number;
  retries?: number;
  capabilityRoutes?: Partial<Record<LlmModelCapability, TaskRoute>>;
};

export interface LlmRuntimeConfigProvider {
  getConfig(
    taskType: LlmTaskType,
    capability?: LlmModelCapability,
    promptModality?: PromptModality,
  ): Promise<LlmRuntimeRouteConfig | null>;
}

type ReleaseRow = {
  version: number;
  policy: unknown;
};

function asRecord(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }
  return input as Record<string, unknown>;
}

function asString(input: unknown): string | undefined {
  if (typeof input !== "string") {
    return undefined;
  }
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asBoolean(input: unknown): boolean | undefined {
  return typeof input === "boolean" ? input : undefined;
}

function asNumber(input: unknown): number | undefined {
  return typeof input === "number" && Number.isFinite(input) ? input : undefined;
}

function readRouteTarget(input: unknown): RouteTarget | undefined {
  const record = asRecord(input);
  if (!record) {
    return undefined;
  }
  const providerId = asString(record.providerId);
  const modelId = asString(record.modelId);
  if (!providerId || !modelId) {
    return undefined;
  }
  return { providerId, modelId };
}

function readTaskRoute(input: unknown): TaskRoute | undefined {
  const record = asRecord(input);
  if (!record) {
    return undefined;
  }
  const targets = Array.isArray(record.targets)
    ? record.targets
        .map((item) => readRouteTarget(item))
        .filter((item): item is RouteTarget => item !== undefined)
    : [];
  if (targets.length === 0) {
    return undefined;
  }
  return { targets };
}

function readLlmRuntimeDocument(policy: unknown): LlmRuntimeDocument | null {
  const root = asRecord(policy);
  if (!root) {
    return null;
  }

  const capabilities = asRecord(root.capabilities);
  const reply = capabilities ? asRecord(capabilities.reply) : null;
  const llmRuntime = reply ? asRecord(reply.llmRuntime) : null;
  if (!llmRuntime) {
    return null;
  }

  const capabilityRoutesInput = asRecord(llmRuntime.capabilityRoutes);
  const capabilityRoutes: Partial<Record<LlmModelCapability, TaskRoute>> = {};
  if (capabilityRoutesInput) {
    const textRoute = readTaskRoute(capabilityRoutesInput.text_generation);
    const imageRoute = readTaskRoute(capabilityRoutesInput.image_generation);
    if (textRoute) {
      capabilityRoutes.text_generation = textRoute;
    }
    if (imageRoute) {
      capabilityRoutes.image_generation = imageRoute;
    }
  }

  return {
    enabled: asBoolean(llmRuntime.enabled),
    timeoutMs: asNumber(llmRuntime.timeoutMs),
    retries: asNumber(llmRuntime.retries),
    capabilityRoutes,
  };
}

function readControlPlaneFallbackRoute(
  policy: unknown,
  capability: LlmModelCapability,
  promptModality: PromptModality,
): TaskRoute | undefined {
  const root = asRecord(policy);
  const controlPlane = root ? asRecord(root.controlPlane) : null;
  if (!controlPlane) {
    return undefined;
  }

  const providersRaw = Array.isArray(controlPlane.providers) ? controlPlane.providers : [];
  const modelsRaw = Array.isArray(controlPlane.models) ? controlPlane.models : [];
  const providers = providersRaw
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => ({
      id: asString(item.id) ?? "",
      providerKey: asString(item.providerKey) ?? "",
      status: asString(item.status) === "disabled" ? ("disabled" as const) : ("active" as const),
      hasKey: item.hasKey === true,
    }))
    .filter((item) => item.id.length > 0 && item.providerKey.length > 0);

  const models = modelsRaw
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => ({
      id: asString(item.id) ?? "",
      providerId: asString(item.providerId) ?? "",
      modelKey: asString(item.modelKey) ?? "",
      capability:
        asString(item.capability) === "image_generation"
          ? ("image_generation" as const)
          : ("text_generation" as const),
      status: asString(item.status) === "disabled" ? ("disabled" as const) : ("active" as const),
      testStatus:
        asString(item.testStatus) === "success" || asString(item.testStatus) === "failed"
          ? (asString(item.testStatus) as "success" | "failed")
          : ("untested" as const),
      lifecycleStatus:
        asString(item.lifecycleStatus) === "retired" ? ("retired" as const) : ("active" as const),
      displayOrder: asNumber(item.displayOrder) ?? 999,
      supportsImageInputPrompt:
        item.supportsImageInputPrompt === true ||
        (Array.isArray(item.metadata)
          ? false
          : (() => {
              const metadata = asRecord(item.metadata);
              const input = metadata && Array.isArray(metadata.input) ? metadata.input : [];
              return input.some((mode) => asString(mode) === "image");
            })()),
    }))
    .filter((item) => item.id.length > 0 && item.providerId.length > 0 && item.modelKey.length > 0);

  const ordered = getRouteTargetsFromActiveOrder({
    providers,
    models,
    capability,
    promptModality,
  });
  if (ordered.length === 0) {
    return undefined;
  }
  return {
    targets: ordered,
  };
}

type CachedOptions = {
  ttlMs?: number;
  now?: () => Date;
  fetchLatestActive?: () => Promise<ReleaseRow | null>;
};

export class CachedLlmRuntimeConfigProvider implements LlmRuntimeConfigProvider {
  private readonly ttlMs: number;
  private readonly now: () => Date;
  private readonly fetchLatestActive: () => Promise<ReleaseRow | null>;
  private cacheExpiresAtMs = 0;
  private cachedDoc: LlmRuntimeDocument | null = null;
  private lastKnownGood: LlmRuntimeDocument | null = null;

  public constructor(options?: CachedOptions) {
    this.ttlMs = Math.max(1_000, options?.ttlMs ?? 30_000);
    this.now = options?.now ?? (() => new Date());
    this.fetchLatestActive =
      options?.fetchLatestActive ??
      (async () => {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
          return null;
        }
        const supabase = createAdminClient();
        const { data, error } = await supabase
          .from("ai_policy_releases")
          .select("version, policy")
          .eq("is_active", true)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle<ReleaseRow>();
        if (error) {
          throw new Error(`load llm runtime config failed: ${error.message}`);
        }
        return data ?? null;
      });
  }

  public async getConfig(
    taskType: LlmTaskType,
    capability: LlmModelCapability = "text_generation",
    promptModality: PromptModality = "text_only",
  ): Promise<LlmRuntimeRouteConfig | null> {
    const nowMs = this.now().getTime();
    if (this.cachedDoc && nowMs < this.cacheExpiresAtMs) {
      return this.resolve(taskType, capability, this.cachedDoc);
    }

    try {
      const release = await this.fetchLatestActive();
      const doc = readLlmRuntimeDocument(release?.policy);
      this.cachedDoc = doc;
      if (doc) {
        this.lastKnownGood = doc;
      }
    } catch {
      this.cachedDoc = this.lastKnownGood;
    } finally {
      this.cacheExpiresAtMs = nowMs + this.ttlMs;
    }

    if (!this.cachedDoc) {
      const release = await this.fetchLatestActive().catch(() => null);
      const fallbackRoute = readControlPlaneFallbackRoute(
        release?.policy,
        capability,
        promptModality,
      );
      return fallbackRoute ? { route: fallbackRoute } : null;
    }
    const resolved = this.resolve(taskType, capability, this.cachedDoc);
    if (resolved.route) {
      return resolved;
    }
    const release = await this.fetchLatestActive().catch(() => null);
    const fallbackRoute = readControlPlaneFallbackRoute(
      release?.policy,
      capability,
      promptModality,
    );
    return fallbackRoute ? { ...resolved, route: fallbackRoute } : resolved;
  }

  private resolve(
    _taskType: LlmTaskType,
    capability: LlmModelCapability,
    doc: LlmRuntimeDocument,
  ): LlmRuntimeRouteConfig {
    const route = doc.capabilityRoutes?.[capability];
    return {
      enabled: doc.enabled,
      timeoutMs: doc.timeoutMs,
      retries: doc.retries,
      route,
    };
  }
}
