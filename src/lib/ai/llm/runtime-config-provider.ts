import { createAdminClient } from "@/lib/supabase/admin";
import type { LlmTaskType } from "@/lib/ai/llm/types";

type RouteTarget = {
  providerId: string;
  modelId: string;
};

type TaskRoute = {
  primary?: RouteTarget;
  secondary?: RouteTarget;
};

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
  default?: TaskRoute;
  taskRoutes?: Partial<Record<LlmTaskType, TaskRoute>>;
};

export interface LlmRuntimeConfigProvider {
  getConfig(taskType: LlmTaskType): Promise<LlmRuntimeRouteConfig | null>;
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
  const primary = readRouteTarget(record.primary);
  const secondary = readRouteTarget(record.secondary);
  if (!primary && !secondary) {
    return undefined;
  }
  return { primary, secondary };
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

  const taskRoutesInput = asRecord(llmRuntime.taskRoutes);
  const taskRoutes: Partial<Record<LlmTaskType, TaskRoute>> = {};
  if (taskRoutesInput) {
    for (const taskType of ["reply", "vote", "dispatch", "generic"] as const) {
      const route = readTaskRoute(taskRoutesInput[taskType]);
      if (route) {
        taskRoutes[taskType] = route;
      }
    }
  }

  return {
    enabled: asBoolean(llmRuntime.enabled),
    timeoutMs: asNumber(llmRuntime.timeoutMs),
    retries: asNumber(llmRuntime.retries),
    default: readTaskRoute(llmRuntime.default),
    taskRoutes,
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

  public async getConfig(taskType: LlmTaskType): Promise<LlmRuntimeRouteConfig | null> {
    const nowMs = this.now().getTime();
    if (this.cachedDoc && nowMs < this.cacheExpiresAtMs) {
      return this.resolve(taskType, this.cachedDoc);
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
      return null;
    }
    return this.resolve(taskType, this.cachedDoc);
  }

  private resolve(taskType: LlmTaskType, doc: LlmRuntimeDocument): LlmRuntimeRouteConfig {
    const route = doc.taskRoutes?.[taskType] ?? doc.default;
    return {
      enabled: doc.enabled,
      timeoutMs: doc.timeoutMs,
      retries: doc.retries,
      route,
    };
  }
}
