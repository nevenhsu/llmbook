import type { LlmTaskType } from "@/lib/ai/llm/types";
import {
  getOrderedTargetsFromInventory,
  loadActiveOrderInventoryFromDb,
} from "@/lib/ai/llm/active-order-inventory";

type RouteTarget = {
  providerId: string;
  modelId: string;
};

type PromptModality = "text_only" | "text_image";

type TaskRoute = {
  targets: RouteTarget[];
};

type LlmModelCapability = "text_generation" | "image_generation";

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

export function readDefaultLlmRuntimePolicy(): { timeoutMs: number; retries: number } {
  return {
    timeoutMs: parsePositiveInt(process.env.AI_MODEL_TIMEOUT_MS, 12_000),
    retries: parseNonNegativeInt(process.env.AI_MODEL_RETRIES, 1),
  };
}

export type LlmRuntimeRouteConfig = {
  enabled?: boolean;
  timeoutMs?: number;
  retries?: number;
  route?: TaskRoute;
};

export interface LlmRuntimeConfigProvider {
  getConfig(
    taskType: LlmTaskType,
    capability?: LlmModelCapability,
    promptModality?: PromptModality,
  ): Promise<LlmRuntimeRouteConfig | null>;
}

export async function resolveLlmInvocationConfig(input: {
  taskType: LlmTaskType;
  capability?: LlmModelCapability;
  promptModality?: PromptModality;
  configProvider?: LlmRuntimeConfigProvider;
  targetOverride?: RouteTarget;
  fallbackTarget?: RouteTarget;
}): Promise<LlmRuntimeRouteConfig> {
  const provider = input.configProvider ?? new CachedLlmRuntimeConfigProvider();
  const runtimeConfig =
    (await provider.getConfig(input.taskType, input.capability, input.promptModality)) ?? {};
  const targets = input.targetOverride
    ? [input.targetOverride]
    : runtimeConfig.route?.targets && runtimeConfig.route.targets.length > 0
      ? runtimeConfig.route.targets
      : input.fallbackTarget
        ? [input.fallbackTarget]
        : undefined;

  return {
    enabled: runtimeConfig.enabled,
    timeoutMs: runtimeConfig.timeoutMs,
    retries: runtimeConfig.retries,
    route: targets ? { targets } : undefined,
  };
}

type CachedOptions = {
  ttlMs?: number;
  now?: () => Date;
};

export class CachedLlmRuntimeConfigProvider implements LlmRuntimeConfigProvider {
  private readonly ttlMs: number;
  private readonly now: () => Date;
  private cacheExpiresAtMs = 0;
  private cachedRoutes = new Map<string, TaskRoute>();

  public constructor(options?: CachedOptions) {
    this.ttlMs = Math.max(1_000, options?.ttlMs ?? 30_000);
    this.now = options?.now ?? (() => new Date());
  }

  public async getConfig(
    _taskType: LlmTaskType,
    capability: LlmModelCapability = "text_generation",
    promptModality: PromptModality = "text_only",
  ): Promise<LlmRuntimeRouteConfig | null> {
    const policy = readDefaultLlmRuntimePolicy();
    const key = `${capability}:${promptModality}`;
    const nowMs = this.now().getTime();
    if (nowMs < this.cacheExpiresAtMs) {
      const cachedRoute = this.cachedRoutes.get(key);
      return cachedRoute ? { route: cachedRoute, ...policy } : { ...policy };
    }

    const textOnly = await this.readDbRoute("text_generation", "text_only").catch(() => undefined);
    const textImage = await this.readDbRoute("text_generation", "text_image").catch(
      () => undefined,
    );
    const image = await this.readDbRoute("image_generation", "text_only").catch(() => undefined);

    this.cachedRoutes = new Map<string, TaskRoute>();
    if (textOnly) {
      this.cachedRoutes.set("text_generation:text_only", textOnly);
    }
    if (textImage) {
      this.cachedRoutes.set("text_generation:text_image", textImage);
    }
    if (image) {
      this.cachedRoutes.set("image_generation:text_only", image);
      this.cachedRoutes.set("image_generation:text_image", image);
    }
    this.cacheExpiresAtMs = nowMs + this.ttlMs;

    const route = this.cachedRoutes.get(key);
    return route ? { route, ...policy } : { ...policy };
  }

  private async readDbRoute(
    capability: LlmModelCapability,
    promptModality: PromptModality,
  ): Promise<TaskRoute | undefined> {
    const inventory = await loadActiveOrderInventoryFromDb();
    const ordered = getOrderedTargetsFromInventory({
      providers: inventory.providers,
      models: inventory.models,
      capability,
      promptModality,
    });
    if (ordered.length === 0) {
      return undefined;
    }
    return { targets: ordered };
  }
}
