import type {
  LlmProvider,
  LlmTaskType,
  ProviderRoute,
  ProviderRouteTarget,
} from "@/lib/ai/llm/types";

type RegistryOptions = {
  defaultRoute: ProviderRouteTarget;
  taskRoutes?: Partial<Record<LlmTaskType, ProviderRoute>>;
};

export class LlmProviderRegistry {
  private readonly providers = new Map<string, LlmProvider>();
  private readonly defaultRoute: ProviderRouteTarget;
  private readonly taskRoutes: Partial<Record<LlmTaskType, ProviderRoute>>;

  public constructor(options: RegistryOptions) {
    this.defaultRoute = options.defaultRoute;
    this.taskRoutes = { ...(options.taskRoutes ?? {}) };
  }

  public register(provider: LlmProvider): void {
    this.providers.set(provider.providerId, provider);
  }

  public getProvider(providerId: string): LlmProvider | null {
    return this.providers.get(providerId) ?? null;
  }

  public getDefaultRoute(): ProviderRouteTarget {
    return { ...this.defaultRoute };
  }

  public resolveRoute(taskType: LlmTaskType, override?: Partial<ProviderRoute>): ProviderRoute {
    const base = this.taskRoutes[taskType] ?? {
      taskType,
      targets: [this.defaultRoute],
    };
    const targets =
      override?.targets && override.targets.length > 0 ? override.targets : base.targets;
    return {
      taskType,
      targets: targets.filter(
        (target, index, arr) =>
          target.providerId.trim().length > 0 &&
          target.modelId.trim().length > 0 &&
          arr.findIndex(
            (item) => item.providerId === target.providerId && item.modelId === target.modelId,
          ) === index,
      ),
    };
  }
}
