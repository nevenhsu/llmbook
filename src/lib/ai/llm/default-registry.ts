import { LlmProviderRegistry } from "@/lib/ai/llm/registry";
import { createMockProvider } from "@/lib/ai/llm/providers/mock-provider";
import { createXaiProvider } from "@/lib/ai/llm/providers/xai-provider";
import { createMinimaxProvider } from "@/lib/ai/llm/providers/minimax-provider";
import { createDeepSeekProvider } from "@/lib/ai/llm/providers/deepseek-provider";
import { loadDecryptedProviderSecrets } from "@/lib/ai/llm/provider-secrets";
import {
  getDefaultDeepSeekModelId,
  getDefaultMinimaxModelId,
  getDefaultXaiModelId,
  resolveDefaultRuntimeTarget,
} from "@/lib/ai/llm/default-model-config";
import type { ProviderRouteTarget } from "@/lib/ai/llm/types";

const DEFAULT_MOCK_MODEL_ID = "mock-fallback";

export function createDefaultLlmProviderRegistry(options?: {
  includeMock?: boolean;
  includeXai?: boolean;
  includeMinimax?: boolean;
  includeDeepSeek?: boolean;
}): LlmProviderRegistry {
  const resolvedDefaultTarget = resolveDefaultRuntimeTarget();
  const defaultTargets: ProviderRouteTarget[] = [resolvedDefaultTarget];
  const defaultXaiModelId = getDefaultXaiModelId();
  const defaultMinimaxModelId = getDefaultMinimaxModelId();
  const defaultDeepSeekModelId = getDefaultDeepSeekModelId();
  const registry = new LlmProviderRegistry({
    defaultTargets,
  });

  if (options?.includeMock ?? false) {
    registry.register(createMockProvider({ modelId: DEFAULT_MOCK_MODEL_ID }));
  }

  if (options?.includeXai ?? true) {
    registry.register(createXaiProvider({ modelId: defaultXaiModelId }));
  }

  if (options?.includeMinimax ?? true) {
    registry.register(createMinimaxProvider({ modelId: defaultMinimaxModelId }));
  }

  if (options?.includeDeepSeek ?? true) {
    registry.register(createDeepSeekProvider({ modelId: defaultDeepSeekModelId }));
  }

  return registry;
}

export async function createDbBackedLlmProviderRegistry(options?: {
  includeMock?: boolean;
  includeXai?: boolean;
  includeMinimax?: boolean;
  includeDeepSeek?: boolean;
}): Promise<LlmProviderRegistry> {
  const resolvedDefaultTarget = resolveDefaultRuntimeTarget();
  const defaultTargets: ProviderRouteTarget[] = [resolvedDefaultTarget];
  const defaultXaiModelId = getDefaultXaiModelId();
  const defaultMinimaxModelId = getDefaultMinimaxModelId();
  const defaultDeepSeekModelId = getDefaultDeepSeekModelId();
  const registry = new LlmProviderRegistry({
    defaultTargets,
  });

  if (options?.includeMock ?? false) {
    registry.register(createMockProvider({ modelId: DEFAULT_MOCK_MODEL_ID }));
  }

  const providerKeys: string[] = [];
  if (options?.includeXai ?? true) {
    providerKeys.push("xai");
  }
  if (options?.includeMinimax ?? true) {
    providerKeys.push("minimax");
  }
  if (options?.includeDeepSeek ?? true) {
    providerKeys.push("deepseek");
  }

  const secretMap = await loadDecryptedProviderSecrets(providerKeys).catch(() => new Map());

  if (options?.includeXai ?? true) {
    registry.register(
      createXaiProvider({
        modelId: defaultXaiModelId,
        apiKey: secretMap.get("xai")?.apiKey,
      }),
    );
  }

  if (options?.includeMinimax ?? true) {
    registry.register(
      createMinimaxProvider({
        modelId: defaultMinimaxModelId,
        apiKey: secretMap.get("minimax")?.apiKey,
      }),
    );
  }

  if (options?.includeDeepSeek ?? true) {
    registry.register(
      createDeepSeekProvider({
        modelId: defaultDeepSeekModelId,
        apiKey: secretMap.get("deepseek")?.apiKey,
      }),
    );
  }

  return registry;
}
