import type { LlmTaskType } from "@/lib/ai/llm/types";
import {
  getOrderedTargetsFromInventory,
  loadActiveOrderInventoryFromDb,
  type PromptModality,
} from "@/lib/ai/llm/active-order-inventory";

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

export interface LlmRuntimeConfigProvider {
  getConfig(
    taskType: LlmTaskType,
    capability?: LlmModelCapability,
    promptModality?: PromptModality,
  ): Promise<LlmRuntimeRouteConfig | null>;
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
    const key = `${capability}:${promptModality}`;
    const nowMs = this.now().getTime();
    if (nowMs < this.cacheExpiresAtMs) {
      const cachedRoute = this.cachedRoutes.get(key);
      return cachedRoute ? { route: cachedRoute } : null;
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
    return route ? { route } : null;
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
