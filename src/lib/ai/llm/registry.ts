import type { LlmProvider, ProviderRouteTarget } from "@/lib/ai/llm/types";

type RegistryOptions = {
  defaultTargets: ProviderRouteTarget[];
};

export class LlmProviderRegistry {
  private readonly providers = new Map<string, LlmProvider>();
  private readonly defaultTargets: ProviderRouteTarget[];

  public constructor(options: RegistryOptions) {
    this.defaultTargets = options.defaultTargets
      .filter((target) => target.providerId.trim().length > 0 && target.modelId.trim().length > 0)
      .filter(
        (target, index, arr) =>
          arr.findIndex(
            (item) => item.providerId === target.providerId && item.modelId === target.modelId,
          ) === index,
      );
  }

  public register(provider: LlmProvider): void {
    this.providers.set(provider.providerId, provider);
  }

  public getProvider(providerId: string): LlmProvider | null {
    return this.providers.get(providerId) ?? null;
  }

  public getDefaultTargets(): ProviderRouteTarget[] {
    return this.defaultTargets.map((target) => ({ ...target }));
  }

  public resolveTargets(overrideTargets?: ProviderRouteTarget[]): ProviderRouteTarget[] {
    const source =
      Array.isArray(overrideTargets) && overrideTargets.length > 0
        ? overrideTargets
        : this.defaultTargets;
    return source
      .filter((target) => target.providerId.trim().length > 0 && target.modelId.trim().length > 0)
      .filter(
        (target, index, arr) =>
          arr.findIndex(
            (item) => item.providerId === target.providerId && item.modelId === target.modelId,
          ) === index,
      )
      .map((target) => ({ ...target }));
  }
}
